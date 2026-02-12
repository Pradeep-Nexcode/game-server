// --------------------------------------------------
// MATCH HANDLER WRAPPER FUNCTIONS (GLOBAL)
// --------------------------------------------------

var OpCode = {
  CHAT: 1,
  READY_TOGGLE: 2,
  START_GAME: 3,
  MOVE: 4,
  SHOOT: 5,
  JUMP: 6,
  RELOAD: 7,
  USE_ITEM: 8,
  ERROR: 99,
  STATE_UPDATE: 100,
  GAME_OVER: 102,
};

function safeParseMessage(nk, message, logger) {
  try {
    if (!message.data || message.data.byteLength === 0) {
      return null;
    }

    const raw = nk.binaryToString(message.data);
    if (!raw || raw.trim() === "") {
      return null;
    }

    return JSON.parse(raw);
  } catch (e) {
    if (logger) {
      logger.warn(
        "Safe parse failed for OpCode " + message.opCode + ": " + e.message,
      );
    }
    return null;
  }
}

var movementSystem = {
  update: function (state, inputs, deltaTime, dispatcher, nk) {
    for (const input of inputs) {
      if (input.opCode === OpCode.MOVE) {
        const player = state.players[input.sender.sessionId];
        if (player && !player.isDead) {
          if (input.data.seq) {
            player.lastInputSeq = input.data.seq;
          }

          let moveDir = {
            x: input.data.x || 0,
            y: input.data.y || 0,
            z: input.data.z || 0,
          };

          const lenSq =
            moveDir.x * moveDir.x +
            moveDir.y * moveDir.y +
            moveDir.z * moveDir.z;
          if (lenSq > 1.02) {
            player.anticheat.flags.speedHack++;
            moveDir = MathUtils.normalize(moveDir);
          }

          const speed = 5;
          const movement = MathUtils.scale(moveDir, speed * deltaTime);
          player.position = MathUtils.add(player.position, movement);

          if (input.data.rotX !== undefined) {
            player.rotation = {
              x: input.data.rotX,
              y: input.data.rotY,
              z: input.data.rotZ,
            };
          }
        }
      }
    }
  },
};

var healthSystem = {
  update: function (state, inputs, deltaTime, dispatcher, nk) {
    for (const sessionId in state.players) {
      const player = state.players[sessionId];

      if (player.isDead) {
        if (!player.deathTime) {
          player.deathTime = Date.now();
        }

        if (Date.now() - player.deathTime > 3000) {
          player.isDead = false;
          player.health = 100;
          delete player.deathTime;

          if (state.map.spawnPoints && state.map.spawnPoints.length > 0) {
            const spawnIndex = Math.floor(
              Math.random() * state.map.spawnPoints.length,
            );
            player.position = {
              x: state.map.spawnPoints[spawnIndex].x,
              y: state.map.spawnPoints[spawnIndex].y,
              z: state.map.spawnPoints[spawnIndex].z,
            };
          } else {
            player.position = { x: 0, y: 0, z: 0 };
          }

          dispatcher.broadcastMessage(
            OpCode.STATE_UPDATE,
            JSON.stringify({
              event: "respawn",
              sessionId: player.sessionId,
              position: player.position,
            }),
          );
        }
      }
    }
  },
};

var killcamSystem = {
  update: function (state, inputs, deltaTime, dispatcher, nk) {
    if (!state.pendingKillcams || state.pendingKillcams.length === 0) return;

    const tickRate = state.config.tickRate || 20;
    const POST_KILL_DURATION = 0.25;
    const PRE_KILL_DURATION = 1.0;

    const remainingKillcams = [];

    for (const killcam of state.pendingKillcams) {
      const targetTick =
        killcam.killTick + Math.ceil(POST_KILL_DURATION * tickRate);

      if (state.tick > targetTick) {
        const startTick =
          killcam.killTick - Math.ceil(PRE_KILL_DURATION * tickRate);
        const endTick = targetTick;

        const historyData = HistoryEngine.getHistoryRange(
          state,
          startTick,
          endTick,
        );

        const victim = state.players[killcam.victimId];
        if (victim && victim.nodeId) {
          const presence = {
            sessionId: victim.sessionId,
            userId: victim.userId,
            username: victim.username,
            nodeId: victim.nodeId,
          };

          dispatcher.broadcastMessage(
            SERVER_OPCODES.KILLCAM_DATA,
            JSON.stringify(historyData),
            [presence],
          );
        }
      } else {
        remainingKillcams.push(killcam);
      }
    }

    state.pendingKillcams = remainingKillcams;
  },
};

var scoringSystem = {
  update: function (state, inputs, deltaTime, dispatcher, nk) {
    const now = Date.now();
    if (state.gameEndTime > 0 && now >= state.gameEndTime) {
      dispatcher.broadcastMessage(
        OpCode.GAME_OVER,
        JSON.stringify({ reason: "time_limit" }),
      );
      return;
    }

    const scoreLimit = 1000;
    for (const sessionId in state.players) {
      if (state.players[sessionId].score >= scoreLimit) {
        dispatcher.broadcastMessage(
          OpCode.GAME_OVER,
          JSON.stringify({ reason: "score_limit", winner: sessionId }),
        );
        state.gameEndTime = now;
        break;
      }
    }
  },
};

var shootingSystem = {
  update: function (state, inputs, deltaTime, dispatcher, nk) {
    const nowMs = Date.now();

    for (const input of inputs) {
      if (input.opCode === OpCode.SHOOT) {
        const player = state.players[input.sender.sessionId];
        if (player && !player.isDead) {
          const weaponId = "pistol";
          const weapon = weaponsConfig[weaponId];

          if (weapon) {
            const fireDelayMs = weapon.fireRate * 1000;
            if (nowMs - player.anticheat.lastShotAtMs < fireDelayMs * 0.9) {
              player.anticheat.flags.fireRate++;
              continue;
            }
            player.anticheat.lastShotAtMs = nowMs;

            const shootTick = input.data.tick;
            const shootDir = input.data.direction;

            if (!shootTick || shootTick > state.tick) {
              continue;
            }

            const drift = Math.abs(shootTick - state.tick);
            if (drift > 20) {
              player.anticheat.flags.timeDrift++;
              continue;
            }

            const rewoundPlayers = HistoryEngine.getRewoundPlayers(
              state,
              shootTick,
            );

            if (rewoundPlayers) {
              const shooterHistory = rewoundPlayers[player.sessionId];
              if (!shooterHistory) continue;

              const origin = shooterHistory.position;

              let hitTargetId = null;
              let minDist = 9999;

              for (const targetId in rewoundPlayers) {
                if (targetId === player.sessionId) continue;

                const target = rewoundPlayers[targetId];
                const targetState = state.players[targetId];
                if (!targetState || targetState.isDead) continue;

                if (
                  intersectRaySphere(origin, shootDir, target.position, 1.0)
                ) {
                  const dist = MathUtils.distance(origin, target.position);
                  if (dist < weapon.range && dist < minDist) {
                    minDist = dist;
                    hitTargetId = targetId;
                  }
                }
              }

              if (hitTargetId) {
                const target = state.players[hitTargetId];
                target.health -= weapon.damage;
                if (target.health <= 0) {
                  target.health = 0;
                  target.isDead = true;
                  player.score += 100;

                  if (state.pendingKillcams) {
                    state.pendingKillcams.push({
                      victimId: hitTargetId,
                      killerId: player.sessionId,
                      killTick: state.tick,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  },
};

var systemRegistry = {
  movement: movementSystem,
  shooting: shootingSystem,
  health: healthSystem,
  scoring: scoringSystem,
  killcam: killcamSystem,
};

function intersectRaySphere(origin, direction, center, radius) {
  const L = {
    x: center.x - origin.x,
    y: center.y - origin.y,
    z: center.z - origin.z,
  };
  const tca = L.x * direction.x + L.y * direction.y + L.z * direction.z;
  if (tca < 0) return false;
  const d2 = L.x * L.x + L.y * L.y + L.z * L.z - tca * tca;
  if (d2 > radius * radius) return false;
  return true;
}

var SnapshotEngine = {
  buildSnapshot: function (state) {
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
          weaponSkin: p.cosmetics ? p.cosmetics.weapon_skin : undefined,
        });
      }
    }

    return {
      tick: state.tick,
      players: players,
    };
  },

  buildDeltaFromSnapshot: function (currentSnapshot, prevPlayers) {
    const deltas = [];

    for (const curr of currentSnapshot.players) {
      const prev = prevPlayers[curr.id];

      if (!prev) {
        deltas.push(curr);
        continue;
      }

      const delta = { id: curr.id };
      let hasChange = false;

      if (
        Math.abs(curr.x - prev.x) > 0.01 ||
        Math.abs(curr.y - prev.y) > 0.01 ||
        Math.abs(curr.z - prev.z) > 0.01
      ) {
        delta.x = curr.x;
        delta.y = curr.y;
        delta.z = curr.z;
        hasChange = true;
      }

      if (
        Math.abs((curr.rotX || 0) - (prev.rotX || 0)) > 0.1 ||
        Math.abs((curr.rotY || 0) - (prev.rotY || 0)) > 0.1 ||
        Math.abs((curr.rotZ || 0) - (prev.rotZ || 0)) > 0.1
      ) {
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
      players: deltas,
    };
  },
};

var SERVER_OPCODES = {
  FULL_SNAPSHOT: 100,
  DELTA_SNAPSHOT: 101,
  GAME_OVER: 102,
  KILLCAM_DATA: 103,
};

var ServerMessages = {
  createStateUpdateMessage: function (state) {
    return JSON.stringify({
      op: OpCode.STATE_UPDATE,
      data: state,
    });
  },

  createGameStartMessage: function (config) {
    return JSON.stringify({
      op: OpCode.GAME_START,
      data: config,
    });
  },
};

var gamesConfig = {
  arena_fps: {
    maxPlayers: 8,
    tickRate: 20,
    systems: ["movement", "shooting", "health", "scoring", "killcam"],
  },
  racing: {
    maxPlayers: 6,
    tickRate: 30,
    systems: ["movement", "scoring"],
  },
  topdown_shooter: {
    maxPlayers: 4,
    tickRate: 20,
    systems: ["movement", "shooting", "health", "scoring", "inventory"],
  },
};

var mapsConfig = {
  arena_small: {
    spawnPoints: [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 10 },
    ],
  },
  race_track_1: {
    checkpoints: [
      { x: 0, y: 0, z: 0 },
      { x: 100, y: 0, z: 0 },
    ],
  },
};

var CosmeticsSystem = {
  CATALOG_COLLECTION: "catalog",
  CATALOG_KEY: "cosmetics",
  INVENTORY_COLLECTION: "inventory",
  INVENTORY_KEY: "cosmetics",

  DEFAULT_COSMETICS: [
    {
      id: "skin_default",
      type: "player_skin",
      rarity: "common",
      name: "Default Skin",
      unlock: { type: "xp", value: 0 },
    },
    {
      id: "skin_blue",
      type: "player_skin",
      rarity: "rare",
      name: "Blue Team",
      unlock: { type: "xp", value: 2 },
    },
    {
      id: "skin_red",
      type: "player_skin",
      rarity: "rare",
      name: "Red Team",
      unlock: { type: "xp", value: 5 },
    },
    {
      id: "skin_gold",
      type: "player_skin",
      rarity: "epic",
      name: "Golden General",
      unlock: { type: "xp", value: 10 },
    },
  ],

  getCatalog: function (nk) {
    const objects = nk.storageRead([
      {
        collection: this.CATALOG_COLLECTION,
        key: this.CATALOG_KEY,
        userId: "",
      },
    ]);

    if (objects.length > 0) {
      return objects[0].value.items;
    }

    nk.storageWrite([
      {
        collection: this.CATALOG_COLLECTION,
        key: this.CATALOG_KEY,
        userId: "",
        value: { items: this.DEFAULT_COSMETICS },
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    return this.DEFAULT_COSMETICS;
  },

  getInventory: function (nk, userId) {
    const objects = nk.storageRead([
      {
        collection: this.INVENTORY_COLLECTION,
        key: this.INVENTORY_KEY,
        userId: userId,
      },
    ]);

    if (objects.length > 0) {
      return objects[0].value;
    }

    return {
      owned: ["skin_default"],
      equipped: {
        player_skin: "skin_default",
      },
    };
  },

  saveInventory: function (nk, userId, inventory) {
    nk.storageWrite([
      {
        collection: this.INVENTORY_COLLECTION,
        key: this.INVENTORY_KEY,
        userId: userId,
        value: inventory,
        permissionRead: 1,
        permissionWrite: 0,
      },
    ]);
  },

  grantCosmetic: function (nk, userId, cosmeticId) {
    const inventory = this.getInventory(nk, userId);

    if (inventory.owned.indexOf(cosmeticId) !== -1) {
      return false;
    }

    inventory.owned.push(cosmeticId);
    this.saveInventory(nk, userId, inventory);
    return true;
  },

  equipCosmetic: function (nk, userId, slot, cosmeticId) {
    const inventory = this.getInventory(nk, userId);

    if (inventory.owned.indexOf(cosmeticId) === -1) {
      return false;
    }

    inventory.equipped[slot] = cosmeticId;
    this.saveInventory(nk, userId, inventory);
    return true;
  },
};

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
  createAntiCheatState: function () {
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

  initAntiCheat: function (player) {
    player.anticheat = this.createAntiCheatState();
  },

  checkInputRate: function (player, nowMs) {
    const minInterval = ANTICHEAT_CONFIG.inputRateLimitMs * 0.5;

    if (nowMs - player.anticheat.lastInputAtMs < minInterval) {
      player.anticheat.flags.inputSpam++;
      return false;
    }
    player.anticheat.lastInputAtMs = nowMs;
    return true;
  },

  getTotalFlags: function (player) {
    let total = 0;
    const flags = player.anticheat.flags;
    for (const key in flags) {
      total += flags[key];
    }
    return total;
  },

  decayFlags: function (player, logger, tick) {
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
        if (logger)
          logger.warn("anticheat", {
            userId: player.userId,
            flags: player.anticheat.flags,
            tick: tick,
          });
      }
    }
  },

  shouldIgnoreInput: function (player) {
    const totalFlags = this.getTotalFlags(player);
    return totalFlags > ANTICHEAT_CONFIG.softBanThreshold;
  },
};

var MAX_HISTORY_SECONDS = 10.0;

var HistoryEngine = {
  addHistory: function (state) {
    const tickRate = state.config.tickRate || 20;
    const maxHistory = tickRate * MAX_HISTORY_SECONDS;

    const playerSnapshots = {};
    for (const id in state.players) {
      const p = state.players[id];
      playerSnapshots[id] = {
        id: p.sessionId,
        position: { ...p.position },
        rotation: { ...p.rotation },
        hp: p.health,
      };
    }

    state.history.push({
      tick: state.tick,
      players: playerSnapshots,
    });

    if (state.history.length > maxHistory) {
      state.history.shift();
    }
  },

  getHistoryRange: function (state, startTick, endTick) {
    return state.history.filter(
      (frame) => frame.tick >= startTick && frame.tick <= endTick,
    );
  },

  getRewoundPlayers: function (state, targetTick) {
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

  interpolatePlayers: function (prev, next, t) {
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
            z: p1.z + (p2.z - p1.z) * t,
          },
          rotation: {
            x: r1.x + (r2.x - r1.x) * t,
            y: r1.y + (r2.y - r1.y) * t,
            z: r1.z + (r2.z - r1.z) * t,
          },
          hp: prev[id].hp + (next[id].hp - prev[id].hp) * t,
        };
      }
    }

    return result;
  },
};

var CLIENT_OPCODES = {
  MOVE: 1,
  ACK: 10,
};

var ClientMessages = {
  decodeMessages: function (messages, logger, nk) {
    const inputs = [];
    for (const message of messages) {
      if (!message.data || message.data.byteLength === 0) continue;

      try {
        const raw = nk.binaryToString(message.data);
        if (!raw || raw.trim() === "") continue;

        const data = JSON.parse(raw);
        inputs.push({
          opCode: message.opCode,
          sender: message.sender,
          data: data,
        });
      } catch (e) {
        // Only log warning for relevant opcodes that we expect to be JSON
        if (message.opCode >= 4 && message.opCode <= 104) {
          if (logger)
            logger.warn(
              `Failed to decode message OpCode ${message.opCode}: ${e.message}`,
            );
        }
      }
    }
    return inputs;
  },
};

var SNAPSHOT_RATE = 3;

var TickEngine = {
  shouldSendSnapshot: function (tick) {
    return tick % SNAPSHOT_RATE === 0;
  },

  runGameTick: function (state, inputs, deltaTime, dispatcher, nk, logger) {
    // systemRegistry, AntiCheat, OpCode are global
    const activeSystems = state.config.systems;
    const nowMs = Date.now();

    const filteredInputs = [];
    for (const input of inputs) {
      const player = state.players[input.sender.sessionId];
      if (!player) continue;

      if (AntiCheat.shouldIgnoreInput(player)) {
        continue;
      }

      if (input.opCode === OpCode.MOVE) {
        if (!AntiCheat.checkInputRate(player, nowMs)) {
          continue;
        }
      }

      filteredInputs.push(input);
    }

    for (const systemName of activeSystems) {
      const system = systemRegistry[systemName];
      if (system) {
        system.update(state, filteredInputs, deltaTime, dispatcher, nk);
      } else {
        if (logger) logger.warn(`System not found: ${systemName}`);
      }
    }
  },
};

var SeasonsSystem = {
  STORAGE_COLLECTION: "liveops",
  STORAGE_KEY: "season",

  getCurrentSeason: function (nk) {
    const objects = nk.storageRead([
      {
        collection: this.STORAGE_COLLECTION,
        key: this.STORAGE_KEY,
        userId: "",
      },
    ]);

    if (objects.length > 0) {
      return objects[0].value;
    }
    return null;
  },

  startSeason: function (nk, id, name, durationDays) {
    const now = Date.now();
    const season = {
      id: id,
      name: name,
      startAt: now,
      endAt: now + durationDays * 24 * 60 * 60 * 1000,
      isActive: true,
    };

    nk.storageWrite([
      {
        collection: this.STORAGE_COLLECTION,
        key: this.STORAGE_KEY,
        value: season,
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    return season;
  },

  endSeason: function (nk) {
    const current = this.getCurrentSeason(nk);
    if (!current || !current.isActive) return false;

    current.isActive = false;
    current.endAt = Date.now();

    nk.storageWrite([
      {
        collection: this.STORAGE_COLLECTION,
        key: this.STORAGE_KEY,
        value: current,
        permissionRead: 2,
        permissionWrite: 0,
      },
    ]);

    return true;
  },
};

// 🔥 FIX: Remove JSON.stringify. Nakama SDK handles serialization.

function matchInit(ctx, logger, nk, params) {
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
    pendingKillcams: [],
  };

  const label = JSON.stringify({
    gameId,
    mapId,
    region,
    mode,
    maxPlayers: gameConfig.maxPlayers,
  });

  // Inject systemRegistry and other globals into state for access by systems if needed,
  // or just rely on global scope if Nakama's JS VM allows it.
  // The TickEngine uses the global systemRegistry.

  return {
    state,
    tickRate: gameConfig.tickRate,
    label,
  };
}

function matchJoinAttempt(
  ctx,
  logger,
  nk,
  dispatcher,
  tick,
  state,
  presence,
  metadata,
) {
  // return GameMatch.matchJoinAttempt(
  //   ctx,
  //   logger,
  //   nk,
  //   dispatcher,
  //   tick,
  //   state,
  //   presence,
  //   metadata,
  // );

  const isSpectator = metadata && metadata.spectator === true;

  if (!isSpectator) {
    if (
      state.config.maxPlayers &&
      Object.keys(state.players).filter((id) => !state.players[id].isSpectator)
        .length >= state.config.maxPlayers
    ) {
      return { state, accept: false, rejectMessage: "Match full" };
    }
  } else {
    state.pendingSpectators[presence.sessionId] = true;
  }

  return { state, accept: true };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  // return GameMatch.matchJoin(
  //   ctx,
  //   logger,
  //   nk,
  //   dispatcher,
  //   tick,
  //   state,
  //   presences,
  // );

  for (const presence of presences) {
    const isSpectator = state.pendingSpectators[presence.sessionId] || false;
    delete state.pendingSpectators[presence.sessionId];

    const inventory = CosmeticsSystem.getInventory(nk, presence.userId);

    // First player to join becomes host if no host exists
    if (!state.hostId && !isSpectator) {
      state.hostId = presence.userId;
      if (logger)
        logger.info(
          `First player joined. Assigned Host: ${presence.username} (${presence.userId})`,
        );
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
      anticheat: AntiCheat.createAntiCheatState(),
    };

    if (
      !isSpectator &&
      state.map.spawnPoints &&
      state.map.spawnPoints.length > 0
    ) {
      const spawnIndex =
        Object.keys(state.players).length % state.map.spawnPoints.length;
      state.players[presence.sessionId].position =
        state.map.spawnPoints[spawnIndex];
    }

    if (logger)
      logger.info(
        `Player joined: ${presence.username} (Session: ${presence.sessionId})`,
      );
  }

  // Always broadcast full state after join
  const broadcastPayload = JSON.stringify({
    players: state.players,
    hostId: state.hostId,
    phase: state.phase,
    tick: tick,
  });
  dispatcher.broadcastMessage(100, broadcastPayload);
  if (logger) logger.info(`Broadcasted state after join: ${broadcastPayload}`);

  return { state };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (const presence of presences) {
    const player = state.players[presence.sessionId];
    if (player) {
      if (logger)
        logger.info(
          `Player left: ${player.username} (Session: ${presence.sessionId})`,
        );

      delete state.players[presence.sessionId];

      // Host migration
      if (state.hostId === presence.userId) {
        const remainingPlayers = Object.values(state.players).filter(
          (p) => !p.isSpectator,
        );

        if (remainingPlayers.length > 0) {
          state.hostId = remainingPlayers[0].userId;
          if (logger)
            logger.info(
              `Host left. Migrated Host to: ${remainingPlayers[0].username} (${state.hostId})`,
            );
        } else {
          state.hostId = null;
          if (logger)
            logger.info("Host left and no players remain. Host cleared.");
        }
      }
    }
  }

  // 🔥 TERMINATE MATCH IF EMPTY
  const nonSpectators = Object.values(state.players).filter(
    (p) => !p.isSpectator,
  );

  if (nonSpectators.length === 0) {
    if (logger) logger.info("All players left. Terminating match.");
    return null; // 💥 THIS KILLS MATCH INSTANCE
  }

  // Otherwise broadcast updated state
  const broadcastPayload = JSON.stringify({
    players: state.players,
    hostId: state.hostId,
    phase: state.phase,
    tick: tick,
  });

  dispatcher.broadcastMessage(100, broadcastPayload);

  if (logger) logger.info(`Broadcasted state after leave: ${broadcastPayload}`);

  return { state };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  state.tick = tick;
  const deltaTime = 1 / state.config.tickRate;

  // Handle Messages
  for (const message of messages) {
    const player = state.players[message.sender.sessionId];
    if (!player) continue;

    if (logger)
      logger.info(
        `Received message opCode: ${message.opCode} from ${player.username}`,
      );

    logger.info(`message.opCode: ${message.opCode}`);
    switch (message.opCode) {
      case OpCode.READY_TOGGLE:
        if (state.phase !== "lobby") break;

        const readyData = safeParseMessage(nk, message, logger);
        if (!readyData) break;

        if (readyData.type === "READY") {
          player.ready = !player.ready;

          if (logger)
            logger.info(
              "Player " + player.username + " ready = " + player.ready,
            );

          dispatcher.broadcastMessage(
            OpCode.STATE_UPDATE,
            JSON.stringify({
              players: state.players,
              hostId: state.hostId,
              phase: state.phase,
              tick: tick,
            }),
          );
        }
        break;

      case OpCode.START_GAME:
        if (player.userId !== state.hostId) {
          if (logger)
            logger.warn(
              `Player ${player.username} tried to start but is NOT Host (HostId: ${state.hostId})`,
            );
          break;
        }
        if (state.phase !== "lobby") break;

        const nonSpectators = Object.values(state.players).filter(
          (p) => !p.isSpectator,
        );
        const allReady =
          nonSpectators.length >= 2 && nonSpectators.every((p) => p.ready);

        if (allReady) {
          state.phase = "in_game";
          state.gameStartTime = Date.now();
          if (logger) logger.info("Game Started! All conditions met.");

          // 🔥 Authoritative Broadcast after phase change
          dispatcher.broadcastMessage(
            100,
            JSON.stringify({
              players: state.players,
              hostId: state.hostId,
              phase: state.phase,
              tick: tick,
            }),
          );
        } else {
          if (logger)
            logger.warn(
              `Start failed: Players=${nonSpectators.length}, AllReady=${allReady}`,
            );
          dispatcher.broadcastMessage(
            OpCode.ERROR,
            JSON.stringify({
              message:
                nonSpectators.length < 2
                  ? "Need at least 2 players"
                  : "All players must be ready",
            }),
            [message.sender],
          );
        }
        break;

      case OpCode.CHAT:
        const chatData = safeParseMessage(nk, message, logger);
        if (!chatData || !chatData.content) break;

        const payload = JSON.stringify({
          senderId: player.userId,
          senderName: player.username,
          content: chatData.content,
          timestamp: Date.now(),
        });
        dispatcher.broadcastMessage(OpCode.CHAT, payload);
        break;
    }
  }

  // 🔥 ALWAYS BROADCAST FULL STATE via OpCode 100
  // dispatcher.broadcastMessage(
  //   100,
  //   JSON.stringify({
  //     players: state.players,
  //     hostId: state.hostId,
  //     phase: state.phase,
  //     tick: state.tick,
  //   }),
  // );

  // Only run game engine if in_game
  if (state.phase !== "in_game") {
    return { state };
  }

  const inputs = ClientMessages.decodeMessages(messages, logger, nk);

  const gameInputs = [];
  for (const input of inputs) {
    if (input.opCode === CLIENT_OPCODES.ACK) {
      const player = state.players[input.sender.sessionId];
      if (player && input.data && typeof input.data.ackTick === "number") {
        player.lastAckTick = input.data.ackTick;
      }
    } else {
      const player = state.players[input.sender.sessionId];
      if (player && player.isSpectator) {
        if (
          input.opCode === OpCode.MOVE ||
          input.opCode === OpCode.SHOOT ||
          input.opCode === OpCode.JUMP ||
          input.opCode === OpCode.RELOAD ||
          input.opCode === OpCode.USE_ITEM
        ) {
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
    const isKeyframe = state.tick % KEYFRAME_INTERVAL === 0;

    if (isKeyframe) {
      dispatcher.broadcastMessage(
        SERVER_OPCODES.FULL_SNAPSHOT,
        JSON.stringify(snapshot),
      );
    } else {
      const delta = SnapshotEngine.buildDeltaFromSnapshot(
        snapshot,
        state.lastBroadcastPlayers,
      );
      dispatcher.broadcastMessage(
        SERVER_OPCODES.DELTA_SNAPSHOT,
        JSON.stringify(delta),
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
    if (logger)
      logger.info(
        `Match Ended. ID: ${ctx.matchId}, Reason: ${reason}, Duration: ${elapsedSec.toFixed(1)}s, Players: ${Object.keys(state.players).length}`,
      );

    const currentSeason = SeasonsSystem.getCurrentSeason(nk);
    const seasonId =
      currentSeason && currentSeason.isActive ? currentSeason.id : undefined;
    const isRanked = state.config.mode === "ranked";

    const sortedPlayers = Object.keys(state.players)
      .map((key) => state.players[key])
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
        if (logger)
          logger.error(`Failed to update stats for ${p.userId}: ${e}`);
      }
    }

    dispatcher.broadcastMessage(
      SERVER_OPCODES.GAME_OVER,
      JSON.stringify({
        reason: maxScoreReached ? "score_limit" : "time_limit",
        scores: sortedPlayers.map((p) => ({ id: p.sessionId, score: p.score })),
      }),
    );

    return null;
  }

  return { state };
}

function matchTerminate(
  ctx,
  logger,
  nk,
  dispatcher,
  tick,
  state,
  graceSeconds,
) {
  return { state };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state, data };
}

// --------------------------------------------------
// MATCH OBJECT (NO INLINE FUNCTIONS)
// --------------------------------------------------

var GameMatchHandler = {
  matchInit: matchInit,
  matchJoinAttempt: matchJoinAttempt,
  matchJoin: matchJoin,
  matchLeave: matchLeave,
  matchLoop: matchLoop,
  matchTerminate: matchTerminate,
  matchSignal: matchSignal,
};

// --------------------------------------------------
// MATCHMAKER HANDLER (GLOBAL FUNCTION)
// --------------------------------------------------

function matchmakerMatched(ctx, logger, nk, matchedUsers) {
  if (logger) logger.info(`Matchmaker matched ${matches.length} users.`);

  if (matches.length === 0) {
    return;
  }

  const properties = matches[0].properties;
  const gameId = properties["gameId"] || "arena_fps";
  const region = properties["region"] || "us";
  const mode = properties["mode"] || "standard";

  try {
    const matchId = nk.matchCreate("game_match", {
      gameId: gameId,
      region: region,
      mode: mode,
    });

    if (logger)
      logger.info(
        `Created match: ${matchId} for game: ${gameId}, region: ${region}`,
      );

    return matchId;
  } catch (err) {
    if (logger) logger.error(`Failed to create match: ${err}`);
    throw err;
  }
}

// --------------------------------------------------
// RPC HANDLERS (GLOBAL FUNCTIONS)
// --------------------------------------------------

function rpcAdminStartSeason(ctx, logger, nk, payload) {
  let input;
  try {
    input = JSON.parse(payload);
  } catch (e) {
    throw new Error("Invalid payload");
  }

  if (!input.id || !input.name || !input.duration) {
    throw new Error("Missing params: id, name, duration");
  }

  const season = SeasonsSystem.startSeason(
    nk,
    input.id,
    input.name,
    input.duration,
  );
  if (logger) logger.info(`Started season: ${season.id}`);

  return JSON.stringify(season);
}

function rpcAdminEndSeason(ctx, logger, nk, payload) {
  const success = SeasonsSystem.endSeason(nk);
  if (success) {
    if (logger) logger.info("Ended current season");
    return JSON.stringify({ success: true });
  } else {
    return JSON.stringify({ success: false, message: "No active season" });
  }
}

function rpcDebugAddXp(ctx, logger, nk, payload) {
  if (!ctx.userId) throw new Error("No user ID");

  const amount = Number(payload) || 100;
  const result = ProgressionSystem.addXp(nk, ctx.userId, amount);

  return JSON.stringify(result);
}

function rpcEquipCosmetic(ctx, logger, nk, payload) {
  if (!ctx.userId) throw new Error("No user ID");

  let input;
  try {
    input = JSON.parse(payload);
  } catch (e) {
    throw new Error("Invalid payload");
  }

  if (!input.slot || !input.cosmeticId) {
    throw new Error("Missing params: slot, cosmeticId");
  }

  const success = CosmeticsSystem.equipCosmetic(
    nk,
    ctx.userId,
    input.slot,
    input.cosmeticId,
  );
  if (!success) {
    throw new Error("Failed to equip: Not owned or invalid slot");
  }

  return JSON.stringify({
    success: true,
    slot: input.slot,
    id: input.cosmeticId,
  });
}

function rpcPurchaseCosmetic(ctx, logger, nk, payload) {
  if (!ctx.userId) throw new Error("No user ID");
  return JSON.stringify({
    success: false,
    message: "Store not implemented yet",
  });
}
 

function rpcCreateMatch(ctx, logger, nk, payload) {
  if (logger) logger.info("RPC create_match called");

  const matchId = nk.matchCreate("game_match", {});

  if (logger) logger.info("Match created successfully: " + matchId);

  return JSON.stringify({
    match_id: matchId,
  });
}

// --------------------------------------------------
// INIT MODULE
// --------------------------------------------------

function InitModule(ctx, logger, nk, initializer) {
  if (logger) logger.info("Initializing Nakama Game Server Modules...");

  // Register Match
  initializer.registerMatch("game_match", GameMatchHandler);

  // Register Matchmaker
  initializer.registerMatchmakerMatched(matchmakerMatched);

  // Register RPCs
  initializer.registerRpc("admin_start_season", rpcAdminStartSeason);
  initializer.registerRpc("admin_end_season", rpcAdminEndSeason);
  initializer.registerRpc("debug_add_xp", rpcDebugAddXp);
  initializer.registerRpc("equip_cosmetic", rpcEquipCosmetic);
  initializer.registerRpc("purchase_cosmetic", rpcPurchaseCosmetic);
  initializer.registerRpc("create_match", rpcCreateMatch);

  if (logger) {
    logger.info("Game Match Handler Registered as 'game_match'");
    logger.info("Ready for connections.");
  }
}

// --------------------------------------------------
// EXPORT (VERY IMPORTANT)
// --------------------------------------------------

globalThis.InitModule = InitModule;
