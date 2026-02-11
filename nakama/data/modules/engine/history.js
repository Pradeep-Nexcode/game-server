var MAX_HISTORY_SECONDS = 10.0;

var HistoryEngine = {
    addHistory: function(state) {
        const tickRate = state.config.tickRate || 20;
        const maxHistory = tickRate * MAX_HISTORY_SECONDS;

        const playerSnapshots = {};
        for (const id in state.players) {
            const p = state.players[id];
            playerSnapshots[id] = {
                id: p.sessionId,
                position: { ...p.position },
                rotation: { ...p.rotation },
                hp: p.health
            };
        }

        state.history.push({
            tick: state.tick,
            players: playerSnapshots
        });

        if (state.history.length > maxHistory) {
            state.history.shift();
        }
    },

    getHistoryRange: function(state, startTick, endTick) {
        return state.history.filter(frame => frame.tick >= startTick && frame.tick <= endTick);
    },

    getRewoundPlayers: function(state, targetTick) {
        if (state.history.length === 0) return null;

        if (targetTick < state.history[0].tick) {
            return null;
        }

        if (targetTick >= state.history[state.history.length - 1].tick) {
             return state.history[state.history.length - 1].players;
        }

        for (let i = 0; i < state.history.length - 1; i++) {
            const prev = state.history[i];
            const next = state.history[i + 1];

            if (targetTick >= prev.tick && targetTick < next.tick) {
                const t = (targetTick - prev.tick) / (next.tick - prev.tick);
                return this.interpolatePlayers(prev.players, next.players, t);
            }
        }

        return null;
    },

    interpolatePlayers: function(prev, next, t) {
        const result = {};

        for (const id in prev) {
            if (next[id]) {
                const p1 = prev[id].position;
                const p2 = next[id].position;
                const r1 = prev[id].rotation;
                const r2 = next[id].rotation;

                result[id] = {
                    id: id,
                    position: {
                        x: p1.x + (p2.x - p1.x) * t,
                        y: p1.y + (p2.y - p1.y) * t,
                        z: p1.z + (p2.z - p1.z) * t
                    },
                    rotation: {
                        x: r1.x + (r2.x - r1.x) * t,
                        y: r1.y + (r2.y - r1.y) * t,
                        z: r1.z + (r2.z - r1.z) * t
                    },
                    hp: prev[id].hp + (next[id].hp - prev[id].hp) * t
                };
            }
        }

        return result;
    }
};
