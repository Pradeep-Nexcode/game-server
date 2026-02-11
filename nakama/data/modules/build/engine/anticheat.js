"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANTICHEAT_CONFIG = void 0;
exports.createAntiCheatState = createAntiCheatState;
exports.initAntiCheat = initAntiCheat;
exports.checkInputRate = checkInputRate;
exports.decayFlags = decayFlags;
exports.shouldIgnoreInput = shouldIgnoreInput;
exports.ANTICHEAT_CONFIG = {
    // These should ideally be loaded from games.json, but defaults here
    maxSpeed: 15, // Units per second
    maxAccel: 50,
    teleportThreshold: 10, // Jump > 10 units = teleport
    inputRateLimitMs: 40, // 25Hz max for 20Hz server
    // Shooting
    bodyCamOffsetMax: 1.0, // Tolerance for cam position vs body position
    maxAimAngleDeg: 180, // 180 means any angle is fine (for now), restrict for realistic games
    // Flags
    softBanThreshold: 10,
    decayIntervalMs: 10000,
};
function createAntiCheatState() {
    return {
        flags: {
            inputSpam: 0,
            speedHack: 0,
            teleport: 0,
            fireRate: 0,
            fakeCam: 0,
            aimSnap: 0,
            timeDrift: 0,
            desync: 0,
        },
        lastInputAtMs: 0,
        lastShotAtMs: 0,
    };
}
function initAntiCheat(player) {
    player.anticheat = createAntiCheatState();
}
function checkInputRate(player, nowMs) {
    // 0.5 * interval as per instructions to tolerate jitter
    const minInterval = exports.ANTICHEAT_CONFIG.inputRateLimitMs * 0.5;
    if (nowMs - player.anticheat.lastInputAtMs < minInterval) {
        player.anticheat.flags.inputSpam++;
        return false;
    }
    player.anticheat.lastInputAtMs = nowMs;
    return true;
}
function getTotalFlags(player) {
    let total = 0;
    const flags = player.anticheat.flags;
    for (const key in flags) {
        // @ts-ignore
        total += flags[key];
    }
    return total;
}
function decayFlags(player, logger, tick) {
    const flags = player.anticheat.flags;
    let hasFlags = false;
    for (const key in flags) {
        // @ts-ignore
        if (flags[key] > 0)
            hasFlags = true;
        // @ts-ignore
        flags[key] *= 0.8;
        // @ts-ignore
        if (flags[key] < 0.1)
            flags[key] = 0;
    }
    if (hasFlags && logger && tick !== undefined) {
        const totalFlags = getTotalFlags(player);
        if (totalFlags > 1.0) {
            logger.warn("anticheat", {
                userId: player.userId,
                flags: player.anticheat.flags,
                tick: tick
            });
        }
    }
}
function shouldIgnoreInput(player) {
    // Simple sum of flags or specific thresholds
    const totalFlags = getTotalFlags(player);
    return totalFlags > exports.ANTICHEAT_CONFIG.softBanThreshold;
}
