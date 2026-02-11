var SnapshotEngine = {
    buildSnapshot: function(state) {
        const players = [];
        for (const key in state.players) {
            if (state.players.hasOwnProperty(key)) {
                const p = state.players[key];
                players.push({
                    id: p.sessionId,
                    x: Number(p.position.x.toFixed(2)),
                    y: Number(p.position.y.toFixed(2)),
                    z: Number(p.position.z.toFixed(2)),
                    rotX: Number(p.rotation.x.toFixed(2)),
                    rotY: Number(p.rotation.y.toFixed(2)),
                    rotZ: Number(p.rotation.z.toFixed(2)),
                    hp: p.health,
                    lastProcessedSeq: p.lastInputSeq,
                    isSpectator: p.isSpectator,
                    skin: p.cosmetics ? p.cosmetics.player_skin : undefined,
                    weaponSkin: p.cosmetics ? p.cosmetics.weapon_skin : undefined
                });
            }
        }
        
        return {
            tick: state.tick,
            players: players
        };
    },

    buildDeltaFromSnapshot: function(currentSnapshot, prevPlayers) {
        const deltas = [];
        
        for (const curr of currentSnapshot.players) {
            const prev = prevPlayers[curr.id];
            
            if (!prev) {
                deltas.push(curr);
                continue;
            }

            const delta = { id: curr.id };
            let hasChange = false;

            if (Math.abs(curr.x - prev.x) > 0.01 || Math.abs(curr.y - prev.y) > 0.01 || Math.abs(curr.z - prev.z) > 0.01) {
                delta.x = curr.x;
                delta.y = curr.y;
                delta.z = curr.z;
                hasChange = true;
            }

            if (Math.abs((curr.rotX || 0) - (prev.rotX || 0)) > 0.1 || 
                Math.abs((curr.rotY || 0) - (prev.rotY || 0)) > 0.1 || 
                Math.abs((curr.rotZ || 0) - (prev.rotZ || 0)) > 0.1) {
                delta.rotX = curr.rotX;
                delta.rotY = curr.rotY;
                delta.rotZ = curr.rotZ;
                hasChange = true;
            }

            if (curr.hp !== prev.hp) {
                delta.hp = curr.hp;
                hasChange = true;
            }

            if (curr.isSpectator !== prev.isSpectator) {
                delta.isSpectator = curr.isSpectator;
                hasChange = true;
            }

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
};
