"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchSignal = exports.matchTerminate = exports.matchLoop = exports.matchLeave = exports.matchJoin = exports.matchJoinAttempt = exports.matchInit = exports.systemRegistry = void 0;
const opcodes_1 = require("../messages/opcodes");
const server_1 = require("../messages/server");
const config_1 = require("../config");
const tick_1 = require("./tick");
const client_1 = require("../messages/client");
const snapshot_1 = require("./snapshot");
const history_1 = require("./history");
const anticheat_1 = require("./anticheat");
const mmr_1 = require("../core/mmr");
const seasons_1 = require("../liveops/seasons");
const progression_1 = require("../liveops/progression");
// System Registry
const movement_1 = require("../systems/movement");
const shooting_1 = require("../systems/shooting");
const health_1 = require("../systems/health");
const scoring_1 = require("../systems/scoring");
const killcam_1 = require("../systems/killcam");
// import { inventorySystem } from '../systems/inventory';
exports.systemRegistry = {
    "movement": movement_1.movementSystem,
    "shooting": shooting_1.shootingSystem,
    "health": health_1.healthSystem,
    "scoring": scoring_1.scoringSystem,
    "killcam": killcam_1.killcamSystem,
    // "inventory": inventorySystem
};
const cosmetics_1 = require("../liveops/cosmetics");
const matchInit = function (ctx, logger, nk, params) {
    logger.info(`Match Init: ${ctx.matchId}`);
    const gameId = params.gameId || "arena_fps";
    const mapId = params.map || "arena_small";
    const region = params.region || "us";
    const mode = params.mode || "standard";
    const gameConfig = config_1.gamesConfig[gameId];
    if (!gameConfig) {
        throw new Error(`Game config not found for ID: ${gameId}`);
    }
    const mapConfig = config_1.mapsConfig[mapId];
    if (!mapConfig) {
        throw new Error(`Map config not found for ID: ${mapId}`);
    }
    const state = {
        players: {},
        projectiles: [],
        gameStartTime: Date.now(),
        gameEndTime: 0,
        config: gameConfig,
        map: mapConfig,
        tick: 0,
        history: [],
        lastBroadcastPlayers: {},
        pendingSpectators: {},
        pendingKillcams: []
    };
    const label = JSON.stringify({
        gameId,
        mapId,
        region,
        mode,
        maxPlayers: gameConfig.maxPlayers
    });
    return {
        state,
        tickRate: gameConfig.tickRate,
        label
    };
};
exports.matchInit = matchInit;
const matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    const isSpectator = metadata && metadata.spectator === true;
    // Spectators don't count towards max players? Or maybe they do, but separate limit?
    // For now, let's assume separate limit or no limit.
    if (!isSpectator) {
        if (state.config.maxPlayers && Object.keys(state.players).filter(id => !state.players[id].isSpectator).length >= state.config.maxPlayers) {
            return { state, accept: false, rejectMessage: "Match full" };
        }
    }
    else {
        state.pendingSpectators[presence.sessionId] = true;
    }
    return { state, accept: true };
};
exports.matchJoinAttempt = matchJoinAttempt;
const matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (const presence of presences) {
        const isSpectator = state.pendingSpectators[presence.sessionId] || false;
        delete state.pendingSpectators[presence.sessionId];
        // Load Cosmetics
        const inventory = (0, cosmetics_1.getInventory)(nk, presence.userId);
        state.players[presence.sessionId] = {
            sessionId: presence.sessionId,
            userId: presence.userId,
            username: presence.username,
            nodeId: presence.nodeId,
            position: { x: 0, y: 0, z: 0 }, // Should use spawn points
            rotation: { x: 0, y: 0, z: 0 },
            health: 100,
            score: 0,
            inventory: [],
            cosmetics: inventory.equipped,
            isDead: false,
            isSpectator: isSpectator,
            lastInputSeq: 0,
            lastAckTick: 0,
            anticheat: (0, anticheat_1.createAntiCheatState)()
        };
        // Assign spawn point if available AND NOT SPECTATOR
        if (!isSpectator && state.map.spawnPoints && state.map.spawnPoints.length > 0) {
            const spawnIndex = Object.keys(state.players).length % state.map.spawnPoints.length;
            state.players[presence.sessionId].position = state.map.spawnPoints[spawnIndex];
        }
    }
    return { state };
};
exports.matchJoin = matchJoin;
const matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (const presence of presences) {
        delete state.players[presence.sessionId];
    }
    return { state };
};
exports.matchLeave = matchLeave;
const matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    // Update State Tick
    state.tick = tick;
    // Calculate delta time (approximate based on tick rate)
    const deltaTime = 1 / state.config.tickRate;
    // Process inputs
    const inputs = (0, client_1.decodeMessages)(messages, logger);
    // Separate ACKs from Game Inputs
    const gameInputs = [];
    for (const input of inputs) {
        if (input.opCode === client_1.CLIENT_OPCODES.ACK) {
            const player = state.players[input.sender.sessionId];
            if (player && input.data && typeof input.data.ackTick === 'number') {
                player.lastAckTick = input.data.ackTick;
            }
        }
        else {
            const player = state.players[input.sender.sessionId];
            if (player && player.isSpectator) {
                // Block gameplay inputs for spectators
                if (input.opCode === opcodes_1.OpCode.MOVE ||
                    input.opCode === opcodes_1.OpCode.SHOOT ||
                    input.opCode === opcodes_1.OpCode.JUMP ||
                    input.opCode === opcodes_1.OpCode.RELOAD ||
                    input.opCode === opcodes_1.OpCode.USE_ITEM) {
                    continue;
                }
            }
            gameInputs.push(input);
        }
    }
    // Run Game Tick (Systems)
    (0, tick_1.runGameTick)(state, gameInputs, deltaTime, dispatcher, nk, logger);
    // Record History for Lag Compensation
    (0, history_1.addHistory)(state);
    // Anti-Cheat: Decay Flags
    if (state.tick % 200 === 0) {
        for (const id in state.players) {
            (0, anticheat_1.decayFlags)(state.players[id], logger, state.tick);
        }
    }
    // Broadcast Snapshot (Frequency Controlled)
    if ((0, tick_1.shouldSendSnapshot)(state.tick)) {
        const snapshot = (0, snapshot_1.buildSnapshot)(state);
        // Keyframe Logic (e.g. every 1 second)
        // Rule: Never trust deltas forever.
        const KEYFRAME_INTERVAL = state.config.tickRate || 20; // Default 1 sec
        const isKeyframe = (state.tick % KEYFRAME_INTERVAL === 0);
        if (isKeyframe) {
            dispatcher.broadcastMessage(server_1.SERVER_OPCODES.FULL_SNAPSHOT, JSON.stringify(snapshot));
        }
        else {
            const delta = (0, snapshot_1.buildDeltaFromSnapshot)(snapshot, state.lastBroadcastPlayers);
            dispatcher.broadcastMessage(server_1.SERVER_OPCODES.DELTA_SNAPSHOT, JSON.stringify(delta));
        }
        // Update last broadcast cache
        // We use the 'snapshot' (current truth) as the baseline for next delta
        state.lastBroadcastPlayers = {};
        for (const p of snapshot.players) {
            state.lastBroadcastPlayers[p.id] = p;
        }
    }
    // CHECK MATCH END CONDITION
    // 1. Time limit
    const matchDurationSec = state.config.matchDuration || 300; // Default 5 mins
    const elapsedSec = (Date.now() - state.gameStartTime) / 1000;
    // 2. Score limit (check if any player reached max score)
    let maxScoreReached = false;
    const winningScore = state.config.winningScore || 1000;
    for (const id in state.players) {
        if (state.players[id].score >= winningScore) {
            maxScoreReached = true;
            break;
        }
    }
    if (elapsedSec >= matchDurationSec || maxScoreReached) {
        // Match Over
        const reason = maxScoreReached ? "score_limit" : "time_limit";
        logger.info(`Match Ended. ID: ${ctx.matchId}, Reason: ${reason}, Duration: ${elapsedSec.toFixed(1)}s, Players: ${Object.keys(state.players).length}`);
        const currentSeason = (0, seasons_1.getCurrentSeason)(nk);
        const seasonId = (currentSeason && currentSeason.isActive) ? currentSeason.id : undefined;
        const isRanked = state.config.mode === "ranked"; // Assume config passed "mode"
        // Simple MMR logic: Winners (+10), Losers (-10)
        // In a real game, sort by score.
        // For now, let's just give +10 to everyone (participation) to prove flow
        // Or better: Top half gets +, Bottom half gets -
        const sortedPlayers = Object.keys(state.players)
            .map(key => state.players[key])
            .sort((a, b) => b.score - a.score);
        const midPoint = Math.floor(sortedPlayers.length / 2);
        for (let i = 0; i < sortedPlayers.length; i++) {
            const p = sortedPlayers[i];
            let delta = 0;
            let xp = 100; // Base XP
            if (i < midPoint) {
                delta = 10; // Winner
                xp += 50; // Win Bonus
            }
            else {
                delta = -10; // Loser
            }
            // Only update if not a bot (we don't have bots yet but good practice)
            try {
                // MMR only in Ranked
                if (isRanked) {
                    (0, mmr_1.updatePlayerMMR)(nk, p.userId, delta, seasonId);
                }
                // Progression (XP) always
                (0, progression_1.addXp)(nk, p.userId, xp);
            }
            catch (e) {
                logger.error(`Failed to update stats for ${p.userId}: ${e}`);
            }
        }
        dispatcher.broadcastMessage(server_1.SERVER_OPCODES.GAME_OVER, JSON.stringify({
            reason: maxScoreReached ? "score_limit" : "time_limit",
            scores: sortedPlayers.map((p) => ({ id: p.sessionId, score: p.score }))
        }));
        return null; // Terminate match
    }
    return { state };
};
exports.matchLoop = matchLoop;
const matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state };
};
exports.matchTerminate = matchTerminate;
const matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
    return { state, data: "Signal received: " + data };
};
exports.matchSignal = matchSignal;
