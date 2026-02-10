import { WorldSnapshot, DeltaSnapshot, PlayerDelta, PlayerSnapshot } from "../messages/server";
import { GameState } from "./state";
import { Vector3 } from "../utils/math";

function vecEqual(a: {x: number, y: number, z: number}, b: {x: number, y: number, z: number}): boolean {
    return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.z - b.z) < 0.01;
}

export function buildSnapshot(state: GameState): WorldSnapshot {
    const players: PlayerSnapshot[] = [];
    for (const key in state.players) {
        if (state.players.hasOwnProperty(key)) {
            const p = state.players[key];
            players.push({
                id: p.sessionId,
                x: Number(p.position.x.toFixed(2)), // Simple quantization
                y: Number(p.position.y.toFixed(2)),
                z: Number(p.position.z.toFixed(2)),
                rotX: Number(p.rotation.x.toFixed(2)),
                rotY: Number(p.rotation.y.toFixed(2)),
                rotZ: Number(p.rotation.z.toFixed(2)),
                hp: p.health,
                lastProcessedSeq: p.lastInputSeq,
                isSpectator: p.isSpectator,
                skin: p.cosmetics?.player_skin,
                weaponSkin: p.cosmetics?.weapon_skin
            });
        }
    }
    
    return {
        tick: state.tick,
        players: players
    };
}

export function buildDeltaFromSnapshot(currentSnapshot: WorldSnapshot, prevPlayers: { [id: string]: PlayerSnapshot }): DeltaSnapshot {
    const deltas: PlayerDelta[] = [];
    
    for (const curr of currentSnapshot.players) {
        const prev = prevPlayers[curr.id];
        
        if (!prev) {
            // New player, send everything
            deltas.push(curr);
            continue;
        }

        const delta: PlayerDelta = { id: curr.id };
        let hasChange = false;

        // Position
        if (Math.abs(curr.x - prev.x) > 0.01 || Math.abs(curr.y - prev.y) > 0.01 || Math.abs(curr.z - prev.z) > 0.01) {
            delta.x = curr.x;
            delta.y = curr.y;
            delta.z = curr.z;
            hasChange = true;
        }

        // Rotation
        if (Math.abs((curr.rotX || 0) - (prev.rotX || 0)) > 0.1 || 
            Math.abs((curr.rotY || 0) - (prev.rotY || 0)) > 0.1 || 
            Math.abs((curr.rotZ || 0) - (prev.rotZ || 0)) > 0.1) {
            delta.rotX = curr.rotX;
            delta.rotY = curr.rotY;
            delta.rotZ = curr.rotZ;
            hasChange = true;
        }

        // HP
        if (curr.hp !== prev.hp) {
            delta.hp = curr.hp;
            hasChange = true;
        }

        // Spectator Status
        if (curr.isSpectator !== prev.isSpectator) {
            delta.isSpectator = curr.isSpectator;
            hasChange = true;
        }

        // Cosmetics
        if (curr.skin !== prev.skin) {
            delta.skin = curr.skin;
            hasChange = true;
        }
        if (curr.weaponSkin !== prev.weaponSkin) {
            delta.weaponSkin = curr.weaponSkin;
            hasChange = true;
        }

        if (hasChange) {
            deltas.push(delta);
        }
    }

    return {
        tick: currentSnapshot.tick,
        players: deltas
    };
}
