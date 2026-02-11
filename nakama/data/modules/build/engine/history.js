"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addHistory = addHistory;
exports.getHistoryRange = getHistoryRange;
exports.getRewoundPlayers = getRewoundPlayers;
// Keep 10 seconds of history for Killcams/Replays.
// At 20 ticks/sec, that's 200 snapshots.
const MAX_HISTORY_SECONDS = 10.0;
function addHistory(state) {
    const tickRate = state.config.tickRate || 20;
    const maxHistory = tickRate * MAX_HISTORY_SECONDS;
    // Create deep copy of player positions
    const playerSnapshots = {};
    for (const id in state.players) {
        const p = state.players[id];
        // We record even dead players for a bit? Or just alive?
        // Killcam needs to see the victim die, so they must be in history.
        // If isDead is true, they might still be visible (ragdoll?) or just removed.
        // For now, record everyone.
        playerSnapshots[id] = {
            id: p.sessionId,
            position: Object.assign({}, p.position),
            rotation: Object.assign({}, p.rotation),
            hp: p.health
        };
    }
    state.history.push({
        tick: state.tick,
        players: playerSnapshots
    });
    // Prune old history
    if (state.history.length > maxHistory) {
        state.history.shift();
    }
}
function getHistoryRange(state, startTick, endTick) {
    return state.history.filter(frame => frame.tick >= startTick && frame.tick <= endTick);
}
function getRewoundPlayers(state, targetTick) {
    if (state.history.length === 0)
        return null;
    // If target is older than oldest history, clamp to oldest (or reject)
    if (targetTick < state.history[0].tick) {
        // Too old, cannot rewind. Return null or oldest?
        // For strict lag comp, we reject.
        return null;
    }
    // If target is newer than newest, clamp to newest
    if (targetTick >= state.history[state.history.length - 1].tick) {
        return state.history[state.history.length - 1].players;
    }
    // Find the two snapshots surrounding targetTick
    // history is sorted by tick (ascending)
    for (let i = 0; i < state.history.length - 1; i++) {
        const prev = state.history[i];
        const next = state.history[i + 1];
        if (targetTick >= prev.tick && targetTick < next.tick) {
            // Interpolate
            const t = (targetTick - prev.tick) / (next.tick - prev.tick);
            return interpolatePlayers(prev.players, next.players, t);
        }
    }
    return null;
}
function interpolatePlayers(prev, next, t) {
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
                hp: prev[id].hp
            };
        }
    }
    return result;
}
