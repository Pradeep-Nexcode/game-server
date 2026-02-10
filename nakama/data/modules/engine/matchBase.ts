import { GameState, System } from './state';
import { OpCode } from '../messages/opcodes';
import { SERVER_OPCODES } from '../messages/server';
import { gamesConfig, mapsConfig } from '../config';
import { runGameTick, shouldSendSnapshot } from './tick';
import { decodeMessages, CLIENT_OPCODES } from '../messages/client';
import { createStateUpdateMessage } from '../messages/server';
import { buildSnapshot, buildDeltaFromSnapshot } from './snapshot';
import { addHistory } from './history';
import { createAntiCheatState, decayFlags } from './anticheat';
import { PlayerState } from './state';
import { updatePlayerMMR } from '../core/mmr';
import { getCurrentSeason } from '../liveops/seasons';
import { addXp } from '../liveops/progression';

// System Registry
import { movementSystem } from '../systems/movement';
import { shootingSystem } from '../systems/shooting';
import { healthSystem } from '../systems/health';
import { scoringSystem } from '../systems/scoring';
import { killcamSystem } from '../systems/killcam';
// import { inventorySystem } from '../systems/inventory';

export const systemRegistry: {[key: string]: System} = {
    "movement": movementSystem,
    "shooting": shootingSystem,
    "health": healthSystem,
    "scoring": scoringSystem,
    "killcam": killcamSystem,
    // "inventory": inventorySystem
};

import { getInventory } from '../liveops/cosmetics';

export const matchInit = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: any}): { state: any, tickRate: number, label: string } {
    logger.info(`Match Init: ${ctx.matchId}`);

    const gameId = params.gameId || "arena_fps";
    const mapId = params.map || "arena_small";
    const region = params.region || "us";
    const mode = params.mode || "standard";
    
    const gameConfig = (gamesConfig as any)[gameId];
    if (!gameConfig) {
        throw new Error(`Game config not found for ID: ${gameId}`);
    }

    const mapConfig = (mapsConfig as any)[mapId];
    if (!mapConfig) {
        throw new Error(`Map config not found for ID: ${mapId}`);
    }

    const state: GameState = {
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
}

export const matchJoinAttempt = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: GameState, presence: nkruntime.Presence, metadata: {[key: string]: any}): { state: any, accept: boolean, rejectMessage?: string } | null {
    const isSpectator = metadata && metadata.spectator === true;
    
    // Spectators don't count towards max players? Or maybe they do, but separate limit?
    // For now, let's assume separate limit or no limit.
    if (!isSpectator) {
        if (state.config.maxPlayers && Object.keys(state.players).filter(id => !state.players[id].isSpectator).length >= state.config.maxPlayers) {
            return { state, accept: false, rejectMessage: "Match full" };
        }
    } else {
        state.pendingSpectators[presence.sessionId] = true;
    }
    
    return { state, accept: true };
}

export const matchJoin = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: GameState, presences: nkruntime.Presence[]): { state: any } | null {
    for (const presence of presences) {
        const isSpectator = state.pendingSpectators[presence.sessionId] || false;
        delete state.pendingSpectators[presence.sessionId];

        // Load Cosmetics
        const inventory = getInventory(nk, presence.userId);

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
            anticheat: createAntiCheatState()
        };
        
        // Assign spawn point if available AND NOT SPECTATOR
        if (!isSpectator && state.map.spawnPoints && state.map.spawnPoints.length > 0) {
             const spawnIndex = Object.keys(state.players).length % state.map.spawnPoints.length;
             state.players[presence.sessionId].position = state.map.spawnPoints[spawnIndex];
        }
    }
    return { state };
}

export const matchLeave = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: GameState, presences: nkruntime.Presence[]): { state: any } | null {
    for (const presence of presences) {
        delete state.players[presence.sessionId];
    }
    return { state };
}

export const matchLoop = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: GameState, messages: nkruntime.MatchMessage[]): { state: any } | null {
    // Update State Tick
    state.tick = tick;

    // Calculate delta time (approximate based on tick rate)
    const deltaTime = 1 / state.config.tickRate;

    // Process inputs
    const inputs = decodeMessages(messages, logger);

    // Separate ACKs from Game Inputs
    const gameInputs: any[] = [];
    for (const input of inputs) {
        if (input.opCode === CLIENT_OPCODES.ACK) {
            const player = state.players[input.sender.sessionId];
            if (player && input.data && typeof input.data.ackTick === 'number') {
                player.lastAckTick = input.data.ackTick;
            }
        } else {
            const player = state.players[input.sender.sessionId];
            if (player && player.isSpectator) {
                // Block gameplay inputs for spectators
                if (input.opCode === OpCode.MOVE || 
                    input.opCode === OpCode.SHOOT || 
                    input.opCode === OpCode.JUMP || 
                    input.opCode === OpCode.RELOAD || 
                    input.opCode === OpCode.USE_ITEM) {
                    continue;
                }
            }
            gameInputs.push(input);
        }
    }

    // Run Game Tick (Systems)
    runGameTick(state, gameInputs, deltaTime, dispatcher, nk, logger);

    // Record History for Lag Compensation
    addHistory(state);

    // Anti-Cheat: Decay Flags
    if (state.tick % 200 === 0) {
        for (const id in state.players) {
            decayFlags(state.players[id], logger, state.tick);
        }
    }

    // Broadcast Snapshot (Frequency Controlled)
    if (shouldSendSnapshot(state.tick)) {
        const snapshot = buildSnapshot(state);
        
        // Keyframe Logic (e.g. every 1 second)
        // Rule: Never trust deltas forever.
        const KEYFRAME_INTERVAL = state.config.tickRate || 20; // Default 1 sec
        const isKeyframe = (state.tick % KEYFRAME_INTERVAL === 0);

        if (isKeyframe) {
            dispatcher.broadcastMessage(
                SERVER_OPCODES.FULL_SNAPSHOT,
                JSON.stringify(snapshot)
            );
        } else {
            const delta = buildDeltaFromSnapshot(snapshot, state.lastBroadcastPlayers);
            dispatcher.broadcastMessage(
                SERVER_OPCODES.DELTA_SNAPSHOT,
                JSON.stringify(delta)
            );
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
        
        const currentSeason = getCurrentSeason(nk);
        const seasonId = (currentSeason && currentSeason.isActive) ? currentSeason.id : undefined;
        const isRanked = state.config.mode === "ranked"; // Assume config passed "mode"

        // Simple MMR logic: Winners (+10), Losers (-10)
        // In a real game, sort by score.
        // For now, let's just give +10 to everyone (participation) to prove flow
        // Or better: Top half gets +, Bottom half gets -
        
        const sortedPlayers = Object.keys(state.players)
            .map(key => state.players[key])
            .sort((a: PlayerState, b: PlayerState) => b.score - a.score);
        
        const midPoint = Math.floor(sortedPlayers.length / 2);

        for (let i = 0; i < sortedPlayers.length; i++) {
            const p = sortedPlayers[i];
            let delta = 0;
            let xp = 100; // Base XP

            if (i < midPoint) {
                delta = 10; // Winner
                xp += 50;   // Win Bonus
            } else {
                delta = -10; // Loser
            }
            
            // Only update if not a bot (we don't have bots yet but good practice)
            try {
                // MMR only in Ranked
                if (isRanked) {
                     updatePlayerMMR(nk, p.userId, delta, seasonId);
                }
                
                // Progression (XP) always
                addXp(nk, p.userId, xp);

            } catch (e) {
                logger.error(`Failed to update stats for ${p.userId}: ${e}`);
            }
        }
        
        dispatcher.broadcastMessage(SERVER_OPCODES.GAME_OVER, JSON.stringify({
            reason: maxScoreReached ? "score_limit" : "time_limit",
            scores: sortedPlayers.map((p: PlayerState) => ({ id: p.sessionId, score: p.score }))
        }));

        return null; // Terminate match
    }

    return { state };
}

export const matchTerminate = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: GameState, graceSeconds: number): { state: any } | null {
    return { state };
}

export const matchSignal = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: GameState, data: string): { state: any, data?: string } | null {
    return { state, data: "Signal received: " + data };
}
