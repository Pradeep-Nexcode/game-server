# Multiplayer System Architecture

## 1. High-Level Overview

This project is a **server-authoritative multiplayer backend** built on the **Nakama** runtime. It solves the problem of scaling a competitive shooter (or fast-paced action game) without the operational complexity of dedicated game server fleets (like Agones/Kubernetes) or the security risks of peer-to-peer networking.

### The "Hybrid" Approach
We use Nakama not just as a database wrapper, but as a **tick-based game server**.
- **Nakama** handles: WebSocket management, Authentication, Matchmaking, Database (PostgreSQL), and Cluster scaling.
- **Custom Engine** handles: Physics, Game Logic, State Synchronization, Lag Compensation, and Anti-Cheat.

This separation allows us to write **pure TypeScript game logic** that runs efficiently inside Nakama's Go runtime (via goja), treating Nakama as a robust networking framework rather than just a backend API.

---

## 2. System Architecture

The system enforces a strict **Authoritative Server** model.

### Responsibilities
| Component | Responsibilities |
|-----------|------------------|
| **Client** (Unity/Web) | - Collects User Input (WASD, Mouse)<br>- **Predicts** local movement (for responsiveness)<br>- Renders the game state<br>- **Interpolates** remote entities<br>- Sends Input Commands to Server |
| **Server** (Nakama) | - Validates Input (Anti-Cheat)<br>- **Simulates** World State (Physics, Hit Reg)<br>- Maintains "True" Game State<br>- Broadcasts Snapshots/Deltas<br>- Persists Data (Stats, XP) |

### Why Clients Never Send State
Clients **never** send coordinates (e.g., "I am at X,Y"). They send **intent** (e.g., "I am holding W, facing 45 degrees").
- **Security**: A hacked client cannot teleport; it can only ask to move forward. If there is a wall, the server rejects the move.
- **Consistency**: All physics calculations happen on the server, ensuring all players see the same outcome.

---

## 3. Server Runtime Flow

The lifecycle of a match follows this precise flow:

1.  **Authentication**: Client logs in via Device ID, Email, or Steam. Nakama issues a JWT Session Token.
2.  **Matchmaking**: Client requests a match. Nakama's matchmaker groups players based on properties (Region, Rank, Mode).
3.  **Match Initialization**:
    - Nakama spawns a **Match Loop** (a lightweight goroutine).
    - `matchInit()` runs: Loads map config, initializes zero-state.
4.  **Simulation Loop**:
    - The server ticks at a fixed rate (e.g., **20Hz** or **60Hz**).
    - **Input Phase**: Process all inputs buffered since the last tick.
    - **Update Phase**: Run game systems (Movement, Physics, Logic).
    - **Output Phase**: Broadcast state changes to clients.
5.  **Termination**: When the game ends (time/score limit), results are written to the database, and the match handler is disposed.

---

## 4. Game Engine Layer (Inside Nakama)

The engine is modular and data-driven.

### Core Components
- **`matchBase.ts`**: The entry point. Handles Nakama signals (`Join`, `Leave`, `Loop`, `Terminate`).
- **`state.ts`**: Defines the `GameState` interface. This is the "Single Source of Truth."
- **`tick.ts`**: The heartbeat. Orchestrates the execution order of systems.

### Systems Architecture
We use an Entity-Component-System (ECS)-lite approach.
- **Movement System**: Applies velocity, friction, and collision logic to update Player positions.
- **Shooting System**: Handles weapon firing, cooldowns, ammo, and raycasts.
- **Health System**: Processes damage events and death states.
- **Scoring System**: Tracks kills, deaths, and objective points.

### Config-Driven Design
Game modes (`standard`, `hardcore`) and maps (`arena_small`, `city_large`) are defined in JSON configurations. The engine loads these at `matchInit`, making it easy to patch balance changes without code deploys.

---

## 5. Networking & State Sync

To minimize bandwidth while maintaining precision, we use **Delta Compression**.

1.  **Snapshots**: A complete description of the world (Position, Rotation, HP, State).
2.  **Delta Compression**:
    - The server caches the *last sent state* for each player.
    - Each tick, it compares the *current state* vs. *last sent state*.
    - Only **changed fields** are transmitted.
    - Example: If a player stands still, 0 bytes of position data are sent.
3.  **Frequency Control**: We can tick at 60Hz but send network updates at 20Hz to save bandwidth, relying on client interpolation to smooth the gaps.

---

## 6. Client Prediction & Reconciliation

This is critical for "feeling" instant.

1.  **Input Sequencing**: Every input packet is tagged with a `sequence_number`.
2.  **Client-Side Prediction**:
    - When the user presses 'W', the client **immediately** moves the character locally.
    - It stores this input and the resulting state in a buffer.
3.  **Server Reconciliation**:
    - The server processes the input and sends back the "True" position for that `sequence_number`.
    - The client compares its predicted position vs. the server's authoritative response.
    - If they differ (drift > threshold), the client **snaps** to the server position and re-simulates subsequent inputs.

---

## 7. Lag Compensation (FPS Shooting)

To prevent "I shot him but he didn't die" scenarios, we implement **Server-Side Rewind**.

1.  **History Buffer**: The server maintains a circular buffer of the last ~1 second of World States.
2.  **The Shot**:
    - Client sends: "I shot at Tick 100, Direction D."
    - Server is currently at Tick 105.
3.  **The Rewind**:
    - The server looks up the World State at Tick 100.
    - It **moves all hitboxes** back to where they were at Tick 100.
    - It performs the Raycast.
4.  **Validation**:
    - If the ray hits, damage is applied.
    - The server checks for "Time Drift" (if the client claims to shoot too far in the past, it's rejected).

---

## 8. Anti-Cheat Strategy

We use a multi-layered defense.

1.  **Validation**:
    - **Movement**: Distance per tick is clamped. Teleporting is impossible.
    - **Fire Rate**: Server tracks `lastShotTime`. Rapid-fire hacks are ignored.
2.  **Sanity Checks**:
    - **Time Drift**: Inputs with timestamps too far from server time are rejected.
    - **Hit Verification**: Raycasts must originate from the player's actual position.
3.  **Soft Flagging**:
    - Suspicious actions increment a `flagCount` on the player.
    - Crossing a threshold triggers a log or silent shadowban rather than an immediate disconnect (to prevent cheat developers from A/B testing the limits).

---

## 9. Replays, Killcams & Spectators

Since the server maintains a **History Buffer**, features like Killcams are almost free.

- **Killcam**: When a player dies, the server packages the last 5 seconds of the History Buffer and sends it to the victim. The client simply "plays back" these states.
- **Spectators**: A spectator is just a player with no physical body. They receive the same World Snapshots but send no input.
- **Replays**: The entire stream of World Snapshots can be serialized to a file/database for full match replays.

---

## 10. Live Ops (Phase-6A)

Live Ops are decoupled from the high-frequency game loop.

- **Seasons**: Stored in Nakama Storage. The match handler reads the current season config at start.
- **Progression**: XP and Leveling happen **atomically** at the end of a match via Wallet/Storage updates.
- **Ranked**: MMR updates use Nakama's Leaderboard API.
- **Admin RPCs**: Authorized users can call `debug_add_xp` or `admin_start_season` to modify live state without restarting the server.

---

## 11. Deployment & Production

- **Docker**: The entire stack (Nakama, Postgres, Custom Code) runs in Docker containers.
- **VPS/Cloud**: Can be deployed on a single DigitalOcean Droplet (vertical scaling) or a cluster (horizontal scaling).
- **Restart Safety**:
    - Game logic is loaded at runtime.
    - **Safe Updates**: We can deploy new code to new match instances while letting old matches finish on the old code version (if using rolling updates in a cluster).
- **Persistence**: All critical data (Accounts, Wallets, Leaderboards) lives in Postgres, independent of the game server memory.

---

## 12. Design Principles

- **Reusability**: The `matchBase` and `Systems` are generic. You can swap the "Shooting System" for a "Melee System" and make an RPG.
- **Scalability**: Nakama manages the "room" overhead. Our code only worries about the simulation. A single core can handle hundreds of concurrent matches depending on complexity.
- **Small Team Friendly**: No need for a separate "Game Server Build" vs "API Server." It's one codebase, one deployment.

---

## 13. Summary

This system represents a **professional, production-ready** foundation for multiplayer games. It avoids the common pitfalls of:
- **Trusting the Client** (Cheating).
- **Complexity Explosion** (Separate API vs. Game Server).
- **Lag Frustration** (Lack of rewinding).

For a new developer:
1.  **Think in Ticks**: Everything happens in discrete time steps.
2.  **Trust the State**: If it's not in `GameState`, it doesn't exist.
3.  **Separate Logic**: Keep Systems pure. Input -> System -> State Change.

This architecture is designed to start simple and scale to millions of users.
