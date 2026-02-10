# Nakama Server - Rolling Update Guide

## 1. Strategy: "Drain & Replace"
Since Nakama is stateful (matches running in memory), we cannot simply kill the container without disconnecting players.

### Steps:

1.  **Prepare New Image/Build**
    - `npm run build` locally or in CI.
    - Ensure `docker-compose.yml` points to the new version (if using custom images) or just mount the new `data/build` JS files.

2.  **Stop New Matches (Optional but Recommended)**
    - You can add an RPC or config flag to disable Matchmaking.
    - Wait for `match_count` to drop or just proceed if you accept disconnecting current matches.
    - *Note: Nakama is robust. Restarting usually reconnects players to the lobby, but the match state in memory is lost unless you persisted it (we don't persist active match RAM).*

3.  **Restart Container**
    ```bash
    docker-compose restart nakama
    ```
    - Since we use `restart: unless-stopped`, it comes back up immediately.
    - `depends_on: postgres` ensures DB is ready first.

4.  **Verify**
    - Check logs: `docker-compose logs -f nakama`
    - Look for "Startup done".

## 2. Zero-Downtime (Advanced - For Future)
To achieve true zero-downtime, you need a Load Balancer (LB) and 2 Nakama nodes.

1.  Spin up Node B (New Code).
2.  Tell LB to send *new* matches to Node B.
3.  Wait for Node A matches to finish.
4.  Shutdown Node A.

*For Phase 6B, the "Restart Container" method is sufficient (5-10s downtime).*
