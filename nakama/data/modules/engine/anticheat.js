var ANTICHEAT_CONFIG = {
    maxSpeed: 15,
    maxAccel: 50,
    teleportThreshold: 10,
    inputRateLimitMs: 40,
    bodyCamOffsetMax: 1.0,
    maxAimAngleDeg: 180,
    softBanThreshold: 10,
    decayIntervalMs: 10000,
};

var AntiCheat = {
    createAntiCheatState: function() {
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
    },

    initAntiCheat: function(player) {
        player.anticheat = this.createAntiCheatState();
    },

    checkInputRate: function(player, nowMs) {
        const minInterval = ANTICHEAT_CONFIG.inputRateLimitMs * 0.5;
        
        if (nowMs - player.anticheat.lastInputAtMs < minInterval) {
            player.anticheat.flags.inputSpam++;
            return false;
        }
        player.anticheat.lastInputAtMs = nowMs;
        return true;
    },

    getTotalFlags: function(player) {
        let total = 0;
        const flags = player.anticheat.flags;
        for (const key in flags) {
            total += flags[key];
        }
        return total;
    },

    decayFlags: function(player, logger, tick) {
        const flags = player.anticheat.flags;
        let hasFlags = false;
        for (const key in flags) {
            if (flags[key] > 0) hasFlags = true;
            flags[key] *= 0.8;
            if (flags[key] < 0.1) flags[key] = 0;
        }
        
        if (hasFlags && logger && tick !== undefined) {
             const totalFlags = this.getTotalFlags(player);
             if (totalFlags > 1.0) {
                 if (logger) logger.warn("anticheat", { 
                     userId: player.userId, 
                     flags: player.anticheat.flags,
                     tick: tick 
                 });
             }
        }
    },

    shouldIgnoreInput: function(player) {
        const totalFlags = this.getTotalFlags(player);
        return totalFlags > ANTICHEAT_CONFIG.softBanThreshold;
    }
};
