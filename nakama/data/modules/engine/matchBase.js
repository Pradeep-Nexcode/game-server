var systemRegistry = {
    "movement": movementSystem,
    "shooting": shootingSystem,
    "health": healthSystem,
    "scoring": scoringSystem,
    "killcam": killcamSystem,
};

globalThis.GameMatch = {
    matchInit: function(ctx, logger, nk, params) {
        if (logger) logger.info(`Match Init: ${ctx.matchId}`);

        const gameId = params.gameId || "arena_fps";
        const mapId = params.map || "arena_small";
        const region = params.region || "us";
        const mode = params.mode || "standard";
        
        const gameConfig = gamesConfig[gameId];
        if (!gameConfig) {
            throw new Error(`Game config not found for ID: ${gameId}`);
        }

        const mapConfig = mapsConfig[mapId];
        if (!mapConfig) {
            throw new Error(`Map config not found for ID: ${mapId}`);
        }

        const state = {
            players: {},
            hostId: null,
            phase: "lobby", // lobby | in_game
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
    },

    matchJoinAttempt: function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
        const isSpectator = metadata && metadata.spectator === true;
        
        if (!isSpectator) {
            if (state.config.maxPlayers && Object.keys(state.players).filter(id => !state.players[id].isSpectator).length >= state.config.maxPlayers) {
                return { state, accept: false, rejectMessage: "Match full" };
            }
        } else {
            state.pendingSpectators[presence.sessionId] = true;
        }
        
        return { state, accept: true };
    },

    matchJoin: function(ctx, logger, nk, dispatcher, tick, state, presences) {
        for (const presence of presences) {
            const isSpectator = state.pendingSpectators[presence.sessionId] || false;
            delete state.pendingSpectators[presence.sessionId];

            const inventory = CosmeticsSystem.getInventory(nk, presence.userId);

            // First player to join becomes host if no host exists
            if (!state.hostId && !isSpectator) {
                state.hostId = presence.userId;
                if (logger) logger.info(`First player joined. Assigned Host: ${presence.username} (${presence.userId})`);
            }

            state.players[presence.sessionId] = {
                sessionId: presence.sessionId,
                userId: presence.userId,
                username: presence.username,
                nodeId: presence.nodeId,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                health: 100,
                score: 0,
                inventory: [],
                cosmetics: inventory.equipped,
                isDead: false,
                isSpectator: isSpectator,
                ready: false,
                lastInputSeq: 0,
                lastAckTick: 0,
                anticheat: AntiCheat.createAntiCheatState()
            };
            
            if (!isSpectator && state.map.spawnPoints && state.map.spawnPoints.length > 0) {
                 const spawnIndex = Object.keys(state.players).length % state.map.spawnPoints.length;
                 state.players[presence.sessionId].position = state.map.spawnPoints[spawnIndex];
            }
            
            if (logger) logger.info(`Player joined: ${presence.username} (Session: ${presence.sessionId})`);
        }

        // Always broadcast full state after join
        const broadcastPayload = JSON.stringify({
            players: state.players,
            hostId: state.hostId,
            phase: state.phase,
            tick: tick
        });
        dispatcher.broadcastMessage(100, broadcastPayload);
        if (logger) logger.info(`Broadcasted state after join: ${broadcastPayload}`);

        return { state };
    },

    matchLeave: function(ctx, logger, nk, dispatcher, tick, state, presences) {
        for (const presence of presences) {
            const player = state.players[presence.sessionId];
            if (player) {
                if (logger) logger.info(`Player left: ${player.username} (Session: ${presence.sessionId})`);
                delete state.players[presence.sessionId];
                
                // If the host left, migrate host to the next available player
                if (state.hostId === presence.userId) {
                    const remainingPlayers = Object.values(state.players).filter(p => !p.isSpectator);
                    if (remainingPlayers.length > 0) {
                        state.hostId = remainingPlayers[0].userId;
                        if (logger) logger.info(`Host left. Migrated Host to: ${remainingPlayers[0].username} (${state.hostId})`);
                    } else {
                        state.hostId = null;
                        if (logger) logger.info("Host left and no players remain. Host cleared.");
                    }
                }
            }
        }

        // Always broadcast full state after leave
        const broadcastPayload = JSON.stringify({
            players: state.players,
            hostId: state.hostId,
            phase: state.phase,
            tick: tick
        });
        dispatcher.broadcastMessage(100, broadcastPayload);
        if (logger) logger.info(`Broadcasted state after leave: ${broadcastPayload}`);

        return { state };
    },

    matchLoop: function(ctx, logger, nk, dispatcher, tick, state, messages) {
        state.tick = tick;
        const deltaTime = 1 / state.config.tickRate;

        // Handle Messages
        for (const message of messages) {
            const player = state.players[message.sender.sessionId];
            if (!player) continue;

            if (logger) logger.info(`Received message opCode: ${message.opCode} from ${player.username}`);

            switch (message.opCode) {
                case 2: // READY_TOGGLE
                    if (state.phase !== "lobby") break;
                    
                    try {
                        const data = JSON.parse(nk.binaryToString(message.data));
                        if (data.type === "READY") {
                            player.ready = !player.ready;
                            if (logger) logger.info(`READY from user: ${player.username} (New status: ${player.ready})`);
                            
                            // 🔥 Authoritative Broadcast immediately after ready toggle
                            const readyPayload = JSON.stringify({
                                players: state.players,
                                hostId: state.hostId,
                                phase: state.phase,
                                tick: tick
                            });
                            dispatcher.broadcastMessage(100, readyPayload);
                        }
                    } catch (e) {
                        if (logger) logger.error(`Error parsing READY message: ${e.message}`);
                    }
                    break;

                case 3: // START_GAME
                    if (player.userId !== state.hostId) {
                        if (logger) logger.warn(`Player ${player.username} tried to start but is NOT Host (HostId: ${state.hostId})`);
                        break;
                    }
                    if (state.phase !== "lobby") break;

                    const nonSpectators = Object.values(state.players).filter(p => !p.isSpectator);
                    const allReady = nonSpectators.length >= 2 && nonSpectators.every(p => p.ready);

                    if (allReady) {
                        state.phase = "in_game";
                        state.gameStartTime = Date.now();
                        if (logger) logger.info("Game Started! All conditions met.");
                        
                        // 🔥 Authoritative Broadcast after phase change
                        dispatcher.broadcastMessage(100, JSON.stringify({
                            players: state.players,
                            hostId: state.hostId,
                            phase: state.phase,
                            tick: tick
                        }));
                    } else {
                        if (logger) logger.warn(`Start failed: Players=${nonSpectators.length}, AllReady=${allReady}`);
                        dispatcher.broadcastMessage(OpCode.ERROR, JSON.stringify({
                            message: nonSpectators.length < 2 ? "Need at least 2 players" : "All players must be ready"
                        }), [message.sender]);
                    }
                    break;

                case OpCode.CHAT: // Handle Chat (only broadcast if in_game)
                    try {
                        const chatData = JSON.parse(nk.binaryToString(message.data));
                        const payload = JSON.stringify({
                            senderId: player.userId,
                            senderName: player.username,
                            content: chatData.content,
                            timestamp: Date.now()
                        });
                        dispatcher.broadcastMessage(OpCode.CHAT, payload);
                    } catch (e) {
                        if (logger) logger.error(`Error parsing CHAT message: ${e.message}`);
                    }
                    break;
            }
        }

        // Only run game engine if in_game
        if (state.phase !== "in_game") {
            return { state };
        }

        const inputs = ClientMessages.decodeMessages(messages, logger);

        const gameInputs = [];
        for (const input of inputs) {
            if (input.opCode === CLIENT_OPCODES.ACK) {
                const player = state.players[input.sender.sessionId];
                if (player && input.data && typeof input.data.ackTick === 'number') {
                    player.lastAckTick = input.data.ackTick;
                }
            } else {
                const player = state.players[input.sender.sessionId];
                if (player && player.isSpectator) {
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

        TickEngine.runGameTick(state, gameInputs, deltaTime, dispatcher, nk, logger);
        HistoryEngine.addHistory(state);

        if (state.tick % 200 === 0) {
            for (const id in state.players) {
                AntiCheat.decayFlags(state.players[id], logger, state.tick);
            }
        }

        if (TickEngine.shouldSendSnapshot(state.tick)) {
            const snapshot = SnapshotEngine.buildSnapshot(state);
            const KEYFRAME_INTERVAL = state.config.tickRate || 20;
            const isKeyframe = (state.tick % KEYFRAME_INTERVAL === 0);

            if (isKeyframe) {
                dispatcher.broadcastMessage(
                    SERVER_OPCODES.FULL_SNAPSHOT,
                    JSON.stringify(snapshot)
                );
            } else {
                const delta = SnapshotEngine.buildDeltaFromSnapshot(snapshot, state.lastBroadcastPlayers);
                dispatcher.broadcastMessage(
                    SERVER_OPCODES.DELTA_SNAPSHOT,
                    JSON.stringify(delta)
                );
            }

            state.lastBroadcastPlayers = {};
            for (const p of snapshot.players) {
                state.lastBroadcastPlayers[p.id] = p;
            }
        }

        const matchDurationSec = state.config.matchDuration || 300;
        const elapsedSec = (Date.now() - state.gameStartTime) / 1000;
        
        let maxScoreReached = false;
        const winningScore = state.config.winningScore || 1000;
        for (const id in state.players) {
            if (state.players[id].score >= winningScore) {
                maxScoreReached = true;
                break;
            }
        }

        if (elapsedSec >= matchDurationSec || maxScoreReached) {
            const reason = maxScoreReached ? "score_limit" : "time_limit";
            if (logger) logger.info(`Match Ended. ID: ${ctx.matchId}, Reason: ${reason}, Duration: ${elapsedSec.toFixed(1)}s, Players: ${Object.keys(state.players).length}`);
            
            const currentSeason = SeasonsSystem.getCurrentSeason(nk);
            const seasonId = (currentSeason && currentSeason.isActive) ? currentSeason.id : undefined;
            const isRanked = state.config.mode === "ranked";

            const sortedPlayers = Object.keys(state.players)
                .map(key => state.players[key])
                .sort((a, b) => b.score - a.score);
            
            const midPoint = Math.floor(sortedPlayers.length / 2);

            for (let i = 0; i < sortedPlayers.length; i++) {
                const p = sortedPlayers[i];
                let delta = 0;
                let xp = 100;

                if (i < midPoint) {
                    delta = 10;
                    xp += 50;
                } else {
                    delta = -10;
                }
                
                try {
                    if (isRanked) {
                         MMRSystem.updatePlayerMMR(nk, p.userId, delta, seasonId);
                    }
                    ProgressionSystem.addXp(nk, p.userId, xp);
                } catch (e) {
                    if (logger) logger.error(`Failed to update stats for ${p.userId}: ${e}`);
                }
            }
            
            dispatcher.broadcastMessage(SERVER_OPCODES.GAME_OVER, JSON.stringify({
                reason: maxScoreReached ? "score_limit" : "time_limit",
                scores: sortedPlayers.map((p) => ({ id: p.sessionId, score: p.score }))
            }));

            return null;
        }

        return { state };
    },

    matchSignal: function(ctx, logger, nk, dispatcher, tick, state, data) {
        return { state, data };
    },

    matchTerminate: function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
        return { state };
    }
};
