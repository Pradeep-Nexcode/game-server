import { PlayerState } from './state';
import { Vector3 } from '../utils/math';

export const ANTICHEAT_CONFIG = {
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

export function createAntiCheatState() {
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

export function initAntiCheat(player: PlayerState) {
    player.anticheat = createAntiCheatState();
}

export function checkInputRate(player: PlayerState, nowMs: number): boolean {
    // 0.5 * interval as per instructions to tolerate jitter
    const minInterval = ANTICHEAT_CONFIG.inputRateLimitMs * 0.5;
    
    if (nowMs - player.anticheat.lastInputAtMs < minInterval) {
        player.anticheat.flags.inputSpam++;
        return false;
    }
    player.anticheat.lastInputAtMs = nowMs;
    return true;
}

function getTotalFlags(player: PlayerState): number {
    let total = 0;
    const flags = player.anticheat.flags;
    for (const key in flags) {
        // @ts-ignore
        total += flags[key];
    }
    return total;
}

export function decayFlags(player: PlayerState, logger?: nkruntime.Logger, tick?: number) {
    const flags = player.anticheat.flags;
    let hasFlags = false;
    for (const key in flags) {
        // @ts-ignore
        if (flags[key] > 0) hasFlags = true;
        
        // @ts-ignore
        flags[key] *= 0.8;
        // @ts-ignore
        if (flags[key] < 0.1) flags[key] = 0;
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

export function shouldIgnoreInput(player: PlayerState): boolean {
    // Simple sum of flags or specific thresholds
    const totalFlags = getTotalFlags(player);
    return totalFlags > ANTICHEAT_CONFIG.softBanThreshold;
}
