var ServerModule = (function (exports) {
    'use strict';

    var OpCode;
    (function (OpCode) {
        // Server -> Client
        OpCode[OpCode["ERROR"] = 0] = "ERROR";
        OpCode[OpCode["STATE_UPDATE"] = 1] = "STATE_UPDATE";
        OpCode[OpCode["GAME_START"] = 2] = "GAME_START";
        OpCode[OpCode["GAME_OVER"] = 3] = "GAME_OVER";
        // Client -> Server
        OpCode[OpCode["MOVE"] = 100] = "MOVE";
        OpCode[OpCode["SHOOT"] = 101] = "SHOOT";
        OpCode[OpCode["JUMP"] = 102] = "JUMP";
        OpCode[OpCode["USE_ITEM"] = 103] = "USE_ITEM";
        OpCode[OpCode["RELOAD"] = 104] = "RELOAD";
    })(OpCode || (OpCode = {}));

    var SERVER_OPCODES = {
        FULL_SNAPSHOT: 100,
        DELTA_SNAPSHOT: 101,
        GAME_OVER: 102,
        KILLCAM_DATA: 103,
    };

    var arena_fps = {
    	maxPlayers: 8,
    	tickRate: 20,
    	systems: [
    		"movement",
    		"shooting",
    		"health",
    		"scoring",
    		"killcam"
    	]
    };
    var racing = {
    	maxPlayers: 6,
    	tickRate: 30,
    	systems: [
    		"movement",
    		"scoring"
    	]
    };
    var topdown_shooter = {
    	maxPlayers: 4,
    	tickRate: 20,
    	systems: [
    		"movement",
    		"shooting",
    		"health",
    		"scoring",
    		"inventory"
    	]
    };
    var games = {
    	arena_fps: arena_fps,
    	racing: racing,
    	topdown_shooter: topdown_shooter
    };

    var games$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        arena_fps: arena_fps,
        default: games,
        racing: racing,
        topdown_shooter: topdown_shooter
    });

    var assault_rifle = {
    	damage: 10,
    	fireRate: 0.1,
    	range: 50
    };
    var pistol = {
    	damage: 15,
    	fireRate: 0.5,
    	range: 30
    };
    var weapons = {
    	assault_rifle: assault_rifle,
    	pistol: pistol
    };

    var weapons$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        assault_rifle: assault_rifle,
        default: weapons,
        pistol: pistol
    });

    var arena_small = {
    	spawnPoints: [
    		{
    			x: 0,
    			y: 0,
    			z: 0
    		},
    		{
    			x: 10,
    			y: 0,
    			z: 10
    		}
    	]
    };
    var race_track_1 = {
    	checkpoints: [
    		{
    			x: 0,
    			y: 0,
    			z: 0
    		},
    		{
    			x: 100,
    			y: 0,
    			z: 0
    		}
    	]
    };
    var maps = {
    	arena_small: arena_small,
    	race_track_1: race_track_1
    };

    var maps$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        arena_small: arena_small,
        default: maps,
        race_track_1: race_track_1
    });

    var gamesConfig = games$1;
    var weaponsConfig = weapons$1;
    var mapsConfig = maps$1;

    var ANTICHEAT_CONFIG = {
        inputRateLimitMs: 40, // 25Hz max for 20Hz server
        // Flags
        softBanThreshold: 10};
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
    function checkInputRate(player, nowMs) {
        // 0.5 * interval as per instructions to tolerate jitter
        var minInterval = ANTICHEAT_CONFIG.inputRateLimitMs * 0.5;
        if (nowMs - player.anticheat.lastInputAtMs < minInterval) {
            player.anticheat.flags.inputSpam++;
            return false;
        }
        player.anticheat.lastInputAtMs = nowMs;
        return true;
    }
    function getTotalFlags(player) {
        var total = 0;
        var flags = player.anticheat.flags;
        for (var key in flags) {
            // @ts-ignore
            total += flags[key];
        }
        return total;
    }
    function decayFlags(player, logger, tick) {
        var flags = player.anticheat.flags;
        var hasFlags = false;
        for (var key in flags) {
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
            var totalFlags = getTotalFlags(player);
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
        var totalFlags = getTotalFlags(player);
        return totalFlags > ANTICHEAT_CONFIG.softBanThreshold;
    }

    var SNAPSHOT_RATE = 3; // every 3 ticks
    function shouldSendSnapshot(tick) {
        return tick % SNAPSHOT_RATE === 0;
    }
    function runGameTick(state, inputs, deltaTime, dispatcher, nk, logger) {
        var activeSystems = state.config.systems;
        var nowMs = Date.now();
        // Filter inputs based on Anti-Cheat
        var filteredInputs = [];
        for (var _i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
            var input = inputs_1[_i];
            // Inputs might come from presences not yet in state (e.g. join request?), 
            // but matchLoop processes messages from joined presences usually.
            // However, standard match handler ensures sender is in presence list.
            // But state.players is our logic.
            var player = state.players[input.sender.sessionId];
            if (!player)
                continue;
            // 1. Soft Ban Check
            if (shouldIgnoreInput(player)) {
                continue;
            }
            // 2. Rate Limit Check (Movement only)
            if (input.opCode === OpCode.MOVE) {
                if (!checkInputRate(player, nowMs)) {
                    // Dropped input
                    continue;
                }
            }
            filteredInputs.push(input);
        }
        for (var _a = 0, activeSystems_1 = activeSystems; _a < activeSystems_1.length; _a++) {
            var systemName = activeSystems_1[_a];
            var system = systemRegistry[systemName];
            if (system) {
                system.update(state, filteredInputs, deltaTime, dispatcher, nk);
            }
            else {
                logger.warn("System not found: ".concat(systemName));
            }
        }
    }

    var CLIENT_OPCODES = {
        ACK: 10,
    };
    function decodeMessages(messages, logger) {
        var decoded = [];
        for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
            var message = messages_1[_i];
            try {
                var dataString = String.fromCharCode.apply(null, message.data);
                var input = JSON.parse(dataString);
                decoded.push({
                    sender: message.sender,
                    opCode: message.opCode,
                    data: input
                });
            }
            catch (e) {
                logger.error("Failed to decode message from ".concat(message.sender.sessionId, ": ").concat(e));
            }
        }
        return decoded;
    }

    function buildSnapshot(state) {
        var _a, _b;
        var players = [];
        for (var key in state.players) {
            if (state.players.hasOwnProperty(key)) {
                var p = state.players[key];
                players.push({
                    id: p.sessionId,
                    x: Number(p.position.x.toFixed(2)), // Simple quantization
                    y: Number(p.position.y.toFixed(2)),
                    z: Number(p.position.z.toFixed(2)),
                    rotX: Number(p.rotation.x.toFixed(2)),
                    rotY: Number(p.rotation.y.toFixed(2)),
                    rotZ: Number(p.rotation.z.toFixed(2)),
                    hp: p.health,
                    lastProcessedSeq: p.lastInputSeq,
                    isSpectator: p.isSpectator,
                    skin: (_a = p.cosmetics) === null || _a === void 0 ? void 0 : _a.player_skin,
                    weaponSkin: (_b = p.cosmetics) === null || _b === void 0 ? void 0 : _b.weapon_skin
                });
            }
        }
        return {
            tick: state.tick,
            players: players
        };
    }
    function buildDeltaFromSnapshot(currentSnapshot, prevPlayers) {
        var deltas = [];
        for (var _i = 0, _a = currentSnapshot.players; _i < _a.length; _i++) {
            var curr = _a[_i];
            var prev = prevPlayers[curr.id];
            if (!prev) {
                // New player, send everything
                deltas.push(curr);
                continue;
            }
            var delta = { id: curr.id };
            var hasChange = false;
            // Position
            if (Math.abs(curr.x - prev.x) > 0.01 || Math.abs(curr.y - prev.y) > 0.01 || Math.abs(curr.z - prev.z) > 0.01) {
                delta.x = curr.x;
                delta.y = curr.y;
                delta.z = curr.z;
                hasChange = true;
            }
            // Rotation
            if (Math.abs((curr.rotX || 0) - (prev.rotX || 0)) > 0.1 ||
                Math.abs((curr.rotY || 0) - (prev.rotY || 0)) > 0.1 ||
                Math.abs((curr.rotZ || 0) - (prev.rotZ || 0)) > 0.1) {
                delta.rotX = curr.rotX;
                delta.rotY = curr.rotY;
                delta.rotZ = curr.rotZ;
                hasChange = true;
            }
            // HP
            if (curr.hp !== prev.hp) {
                delta.hp = curr.hp;
                hasChange = true;
            }
            // Spectator Status
            if (curr.isSpectator !== prev.isSpectator) {
                delta.isSpectator = curr.isSpectator;
                hasChange = true;
            }
            // Cosmetics
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

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    // Keep 10 seconds of history for Killcams/Replays.
    // At 20 ticks/sec, that's 200 snapshots.
    var MAX_HISTORY_SECONDS = 10.0;
    function addHistory(state) {
        var tickRate = state.config.tickRate || 20;
        var maxHistory = tickRate * MAX_HISTORY_SECONDS;
        // Create deep copy of player positions
        var playerSnapshots = {};
        for (var id in state.players) {
            var p = state.players[id];
            // We record even dead players for a bit? Or just alive?
            // Killcam needs to see the victim die, so they must be in history.
            // If isDead is true, they might still be visible (ragdoll?) or just removed.
            // For now, record everyone.
            playerSnapshots[id] = {
                id: p.sessionId,
                position: __assign({}, p.position),
                rotation: __assign({}, p.rotation),
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
        return state.history.filter(function (frame) { return frame.tick >= startTick && frame.tick <= endTick; });
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
        for (var i = 0; i < state.history.length - 1; i++) {
            var prev = state.history[i];
            var next = state.history[i + 1];
            if (targetTick >= prev.tick && targetTick < next.tick) {
                // Interpolate
                var t = (targetTick - prev.tick) / (next.tick - prev.tick);
                return interpolatePlayers(prev.players, next.players, t);
            }
        }
        return null;
    }
    function interpolatePlayers(prev, next, t) {
        var result = {};
        for (var id in prev) {
            if (next[id]) {
                var p1 = prev[id].position;
                var p2 = next[id].position;
                var r1 = prev[id].rotation;
                var r2 = next[id].rotation;
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

    var STORAGE_COLLECTION$2 = "player_profiles";
    var STORAGE_KEY$2 = "profile";
    function getPlayerProfile(nk, userId) {
        var objects = nk.storageRead([{
                collection: STORAGE_COLLECTION$2,
                key: STORAGE_KEY$2,
                userId: userId
            }]);
        if (objects.length > 0) {
            var profile = objects[0].value;
            // Migration safety
            if (!profile.seasonMmr)
                profile.seasonMmr = {};
            return profile;
        }
        // Default profile
        return {
            userId: userId,
            mmr: 1000,
            region: "us", // Default region
            seasonMmr: {}
        };
    }
    function updatePlayerMMR(nk, userId, delta, seasonId) {
        var profile = getPlayerProfile(nk, userId);
        // Update Global MMR
        profile.mmr += delta;
        // Update Season MMR if active
        if (seasonId) {
            if (!profile.seasonMmr[seasonId]) {
                profile.seasonMmr[seasonId] = 1000; // Start fresh for season
            }
            profile.seasonMmr[seasonId] += delta;
        }
        // Write back
        nk.storageWrite([{
                collection: STORAGE_COLLECTION$2,
                key: STORAGE_KEY$2,
                userId: userId,
                value: profile,
                permissionRead: 1, // Owner read
                permissionWrite: 0 // Server auth only
            }]);
    }

    var STORAGE_COLLECTION$1 = "liveops";
    var STORAGE_KEY$1 = "season";
    function getCurrentSeason(nk) {
        var objects = nk.storageRead([{
                collection: STORAGE_COLLECTION$1,
                key: STORAGE_KEY$1,
                userId: undefined // Global (system) owner
            }]);
        if (objects.length > 0) {
            return objects[0].value;
        }
        return null;
    }
    function startSeason(nk, id, name, durationDays) {
        var now = Date.now();
        var season = {
            id: id,
            name: name,
            startAt: now,
            endAt: now + (durationDays * 24 * 60 * 60 * 1000),
            isActive: true
        };
        nk.storageWrite([{
                collection: STORAGE_COLLECTION$1,
                key: STORAGE_KEY$1,
                value: season,
                permissionRead: 2, // Public Read
                permissionWrite: 0 // No Client Write
            }]);
        return season;
    }
    function endSeason(nk) {
        var current = getCurrentSeason(nk);
        if (!current || !current.isActive)
            return false;
        current.isActive = false;
        current.endAt = Date.now(); // Force end now
        nk.storageWrite([{
                collection: STORAGE_COLLECTION$1,
                key: STORAGE_KEY$1,
                value: current,
                permissionRead: 2,
                permissionWrite: 0
            }]);
        return true;
    }

    var CATALOG_COLLECTION = "catalog";
    var CATALOG_KEY = "cosmetics";
    var INVENTORY_COLLECTION = "inventory";
    var INVENTORY_KEY = "cosmetics";
    // Default cosmetics
    var DEFAULT_COSMETICS = [
        { id: "skin_default", type: "player_skin", rarity: "common", name: "Default Skin", unlock: { type: "xp", value: 0 } },
        { id: "skin_blue", type: "player_skin", rarity: "rare", name: "Blue Team", unlock: { type: "xp", value: 2 } },
        { id: "skin_red", type: "player_skin", rarity: "rare", name: "Red Team", unlock: { type: "xp", value: 5 } },
        { id: "skin_gold", type: "player_skin", rarity: "epic", name: "Golden General", unlock: { type: "xp", value: 10 } }
    ];
    // --- CATALOG ---
    function getCatalog(nk) {
        var objects = nk.storageRead([{
                collection: CATALOG_COLLECTION,
                key: CATALOG_KEY,
                userId: "" // Global
            }]);
        if (objects.length > 0) {
            return objects[0].value.items;
        }
        // Initialize if missing
        nk.storageWrite([{
                collection: CATALOG_COLLECTION,
                key: CATALOG_KEY,
                userId: "",
                value: { items: DEFAULT_COSMETICS },
                permissionRead: 2, // Public Read
                permissionWrite: 0 // No Client Write
            }]);
        return DEFAULT_COSMETICS;
    }
    // --- INVENTORY ---
    function getInventory(nk, userId) {
        var objects = nk.storageRead([{
                collection: INVENTORY_COLLECTION,
                key: INVENTORY_KEY,
                userId: userId
            }]);
        if (objects.length > 0) {
            return objects[0].value;
        }
        // Default inventory
        return {
            owned: ["skin_default"],
            equipped: {
                player_skin: "skin_default"
            }
        };
    }
    function saveInventory(nk, userId, inventory) {
        nk.storageWrite([{
                collection: INVENTORY_COLLECTION,
                key: INVENTORY_KEY,
                userId: userId,
                value: inventory,
                permissionRead: 1, // Owner Read
                permissionWrite: 0 // Server Write Only
            }]);
    }
    function grantCosmetic(nk, userId, cosmeticId) {
        var inventory = getInventory(nk, userId);
        if (inventory.owned.indexOf(cosmeticId) !== -1) {
            return false; // Already owned
        }
        inventory.owned.push(cosmeticId);
        saveInventory(nk, userId, inventory);
        return true;
    }
    function equipCosmetic(nk, userId, slot, cosmeticId) {
        var inventory = getInventory(nk, userId);
        var catalog = getCatalog(nk);
        // 1. Check ownership
        if (inventory.owned.indexOf(cosmeticId) === -1) {
            return false;
        }
        // 2. Check type compatibility
        var item = catalog.find(function (c) { return c.id === cosmeticId; });
        if (!item || item.type !== slot) {
            return false;
        }
        // 3. Equip
        inventory.equipped[slot] = cosmeticId;
        saveInventory(nk, userId, inventory);
        return true;
    }

    var STORAGE_COLLECTION = "progression";
    var STORAGE_KEY = "status";
    // Simple level formula: Level = sqrt(XP / 100)
    // XP = 100 -> Lvl 1
    // XP = 400 -> Lvl 2
    // XP = 900 -> Lvl 3
    function calculateLevel(xp) {
        return Math.floor(Math.sqrt(xp / 100));
    }
    function getPlayerProgress(nk, userId) {
        var objects = nk.storageRead([{
                collection: STORAGE_COLLECTION,
                key: STORAGE_KEY,
                userId: userId
            }]);
        if (objects.length > 0) {
            return objects[0].value;
        }
        return {
            xp: 0,
            level: 0,
            rewards: []
        };
    }
    function addXp(nk, userId, amount) {
        var progress = getPlayerProgress(nk, userId);
        var oldLevel = progress.level;
        progress.xp += amount;
        progress.level = calculateLevel(progress.xp);
        var leveledUp = progress.level > oldLevel;
        // Grant level up rewards?
        if (leveledUp) {
            var catalog = getCatalog(nk);
            // Find cosmetics that unlock at this new level
            var rewards = catalog.filter(function (c) { return c.unlock.type === "xp" && c.unlock.value <= progress.level && c.unlock.value > oldLevel; });
            for (var _i = 0, rewards_1 = rewards; _i < rewards_1.length; _i++) {
                var reward = rewards_1[_i];
                grantCosmetic(nk, userId, reward.id);
                progress.rewards.push({
                    type: "cosmetic",
                    id: reward.id,
                    amount: 1,
                    claimedAt: Date.now()
                });
            }
        }
        nk.storageWrite([{
                collection: STORAGE_COLLECTION,
                key: STORAGE_KEY,
                userId: userId,
                value: progress,
                permissionRead: 1, // Owner Read
                permissionWrite: 0 // Server Write Only
            }]);
        return { progress: progress, leveledUp: leveledUp };
    }

    function add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }
    function scale(v, s) {
        return { x: v.x * s, y: v.y * s, z: v.z * s };
    }
    function normalize(v) {
        var len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (len === 0)
            return { x: 0, y: 0, z: 0 };
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }

    var movementSystem = {
        update: function (state, inputs, deltaTime, dispatcher, nk) {
            // Process inputs
            for (var _i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
                var input = inputs_1[_i];
                if (input.opCode === OpCode.MOVE) {
                    var player = state.players[input.sender.sessionId];
                    if (player && !player.isDead) {
                        // Update last processed sequence number
                        if (input.data.seq) {
                            player.lastInputSeq = input.data.seq;
                        }
                        // Expecting input.data to be { x: number, y: number, z: number } or similar
                        // Unity: { "op": "MOVE", "x": 1, "y": 0 } - user example
                        // Let's assume input.data is the payload
                        var moveDir = {
                            x: input.data.x || 0,
                            y: input.data.y || 0,
                            z: input.data.z || 0
                        };
                        // Anti-Cheat: Validate Input Vector
                        // If magnitude > 1.0 (with tolerance), it's a speed hack attempt via vector stretching
                        var lenSq = moveDir.x * moveDir.x + moveDir.y * moveDir.y + moveDir.z * moveDir.z;
                        if (lenSq > 1.02) { // 1.01^2 approx 1.02
                            player.anticheat.flags.speedHack++;
                            moveDir = normalize(moveDir);
                        }
                        // Simple movement: Position += Direction * Speed * DeltaTime
                        // Speed should be in config or player stats
                        var speed = 5; // Hardcoded for now, should come from config/weapon/class
                        var movement = scale(moveDir, speed * deltaTime);
                        player.position = add(player.position, movement);
                        // Update rotation if provided
                        if (input.data.rotX !== undefined) {
                            player.rotation = { x: input.data.rotX, y: input.data.rotY, z: input.data.rotZ };
                        }
                    }
                }
            }
        }
    };

    var shootingSystem = {
        update: function (state, inputs, deltaTime, dispatcher, nk) {
            var nowMs = Date.now();
            for (var _i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
                var input = inputs_1[_i];
                if (input.opCode === OpCode.SHOOT) {
                    var player = state.players[input.sender.sessionId];
                    if (player && !player.isDead) {
                        var weaponId = "pistol"; // Default or get from inventory
                        var weapon = weaponsConfig[weaponId];
                        if (weapon) {
                            // 1. Fire Rate Check
                            // weapon.fireRate is delay in seconds (e.g. 0.1s)
                            var fireDelayMs = weapon.fireRate * 1000;
                            if (nowMs - player.anticheat.lastShotAtMs < fireDelayMs * 0.9) {
                                player.anticheat.flags.fireRate++;
                                continue;
                            }
                            player.anticheat.lastShotAtMs = nowMs;
                            // HITSCAN / RAYCAST LOGIC (Lag Compensated)
                            // Input: { direction: Vector3, tick: number, targetId?: string }
                            // If targetId is provided, we verify the hit.
                            // If no targetId, we might raycast against all (expensive without spatial partition)
                            var shootTick = input.data.tick;
                            var shootDir = input.data.direction; // Normalized
                            // Sanity check: Tick must be in past
                            if (!shootTick || shootTick > state.tick) {
                                // Invalid tick
                                continue;
                            }
                            // 2. Time Drift Check
                            var drift = Math.abs(shootTick - state.tick);
                            // Max drift 1 second (approx 20 ticks)
                            if (drift > 20) {
                                player.anticheat.flags.timeDrift++;
                                continue;
                            }
                            // Rewind the world
                            var rewoundPlayers = getRewoundPlayers(state, shootTick);
                            if (rewoundPlayers) {
                                // Determine shooter position at that time (or current? usually rewound for consistency)
                                var shooterHistory = rewoundPlayers[player.sessionId];
                                if (!shooterHistory)
                                    continue;
                                var origin = shooterHistory.position;
                                // Check for hits
                                // Optimization: Only check the target client claims to have hit
                                // But for security, we should check intersection.
                                var hitTargetId = null;
                                var minDist = 9999;
                                for (var targetId in rewoundPlayers) {
                                    if (targetId === player.sessionId)
                                        continue;
                                    var target = rewoundPlayers[targetId];
                                    var targetState = state.players[targetId]; // Current state for health check
                                    if (!targetState || targetState.isDead)
                                        continue;
                                    // Simple Ray-Sphere Intersection
                                    // Sphere center = target.position
                                    // Radius = 1.0 (approx hitbox)
                                    if (intersectRaySphere(origin, shootDir, target.position, 1.0)) {
                                        var dist = distance(origin, target.position);
                                        if (dist < weapon.range && dist < minDist) {
                                            minDist = dist;
                                            hitTargetId = targetId;
                                        }
                                    }
                                }
                                if (hitTargetId) {
                                    var target = state.players[hitTargetId];
                                    target.health -= weapon.damage;
                                    if (target.health <= 0) {
                                        target.health = 0;
                                        target.isDead = true;
                                        player.score += 100;
                                        // Queue Killcam
                                        if (state.pendingKillcams) {
                                            state.pendingKillcams.push({
                                                victimId: hitTargetId,
                                                killerId: player.sessionId,
                                                killTick: state.tick
                                            });
                                        }
                                    }
                                    // Notify hit (optional)
                                }
                            }
                        }
                    }
                }
            }
            // Projectile update logic removed/commented for Phase 4 focus
        }
    };
    function distance(v1, v2) {
        var dx = v1.x - v2.x;
        var dy = v1.y - v2.y;
        var dz = v1.z - v2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    // https://en.wikipedia.org/wiki/Line%E2%80%93sphere_intersection
    function intersectRaySphere(origin, dir, center, radius) {
        var oc = { x: origin.x - center.x, y: origin.y - center.y, z: origin.z - center.z };
        var a = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
        var b = 2.0 * (oc.x * dir.x + oc.y * dir.y + oc.z * dir.z);
        var c = (oc.x * oc.x + oc.y * oc.y + oc.z * oc.z) - radius * radius;
        var discriminant = b * b - 4 * a * c;
        return (discriminant > 0);
    }

    var healthSystem = {
        update: function (state, inputs, deltaTime, dispatcher, nk) {
            for (var sessionId in state.players) {
                var player = state.players[sessionId];
                if (player.isDead) {
                    // Handle Respawn
                    // Check if enough time passed since death
                    if (!player.deathTime) {
                        player.deathTime = Date.now();
                    }
                    if (Date.now() - player.deathTime > 3000) { // 3 seconds respawn
                        player.isDead = false;
                        player.health = 100;
                        delete player.deathTime;
                        // Respawn at random spawn point
                        if (state.map.spawnPoints && state.map.spawnPoints.length > 0) {
                            var spawnIndex = Math.floor(Math.random() * state.map.spawnPoints.length);
                            player.position = __assign({}, state.map.spawnPoints[spawnIndex]);
                        }
                        else {
                            player.position = { x: 0, y: 0, z: 0 };
                        }
                        dispatcher.broadcastMessage(OpCode.STATE_UPDATE, JSON.stringify({ event: "respawn", sessionId: player.sessionId, position: player.position }));
                    }
                }
            }
        }
    };

    var scoringSystem = {
        update: function (state, inputs, deltaTime, dispatcher, nk) {
            // Check for win condition
            // Example: Score limit or Time limit
            // Time limit check
            var now = Date.now();
            if (state.gameEndTime > 0 && now >= state.gameEndTime) {
                // Game Over
                dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ reason: "time_limit" }));
                // We might want to terminate the match here or switch state
                return;
            }
            // Score limit check (e.g. 1000 points)
            var scoreLimit = 1000;
            for (var sessionId in state.players) {
                if (state.players[sessionId].score >= scoreLimit) {
                    dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ reason: "score_limit", winner: sessionId }));
                    state.gameEndTime = now; // End game immediately
                    break;
                }
            }
        }
    };

    var killcamSystem = {
        update: function (state, inputs, deltaTime, dispatcher, nk) {
            if (!state.pendingKillcams || state.pendingKillcams.length === 0)
                return;
            var tickRate = state.config.tickRate || 20;
            var POST_KILL_DURATION = 0.25; // seconds
            var PRE_KILL_DURATION = 1.0; // seconds
            // We iterate backwards or use a new array to filter
            var remainingKillcams = [];
            for (var _i = 0, _a = state.pendingKillcams; _i < _a.length; _i++) {
                var killcam = _a[_i];
                // We wait until we have enough history for the "post-kill" duration
                var targetTick = killcam.killTick + Math.ceil(POST_KILL_DURATION * tickRate);
                // Wait until targetTick is definitely in history (history is added AFTER systems update)
                // So we need state.tick to be > targetTick
                if (state.tick > targetTick) {
                    // Time to send!
                    var startTick = killcam.killTick - Math.ceil(PRE_KILL_DURATION * tickRate);
                    var endTick = targetTick;
                    var historyData = getHistoryRange(state, startTick, endTick);
                    // Find victim presence
                    var victim = state.players[killcam.victimId];
                    if (victim && victim.nodeId) {
                        // Construct presence
                        var presence = {
                            sessionId: victim.sessionId,
                            userId: victim.userId,
                            username: victim.username,
                            nodeId: victim.nodeId
                        };
                        // Send only to the victim
                        dispatcher.broadcastMessage(SERVER_OPCODES.KILLCAM_DATA, JSON.stringify(historyData), [presence]);
                    }
                    // Processed, do not add to remaining
                }
                else {
                    // Not ready yet, keep it
                    remainingKillcams.push(killcam);
                }
            }
            state.pendingKillcams = remainingKillcams;
        }
    };

    // import { inventorySystem } from '../systems/inventory';
    var systemRegistry = {
        "movement": movementSystem,
        "shooting": shootingSystem,
        "health": healthSystem,
        "scoring": scoringSystem,
        "killcam": killcamSystem,
        // "inventory": inventorySystem
    };
    var matchInit = function (ctx, logger, nk, params) {
        logger.info("Match Init: ".concat(ctx.matchId));
        var gameId = params.gameId || "arena_fps";
        var mapId = params.map || "arena_small";
        var region = params.region || "us";
        var mode = params.mode || "standard";
        var gameConfig = gamesConfig[gameId];
        if (!gameConfig) {
            throw new Error("Game config not found for ID: ".concat(gameId));
        }
        var mapConfig = mapsConfig[mapId];
        if (!mapConfig) {
            throw new Error("Map config not found for ID: ".concat(mapId));
        }
        var state = {
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
        var label = JSON.stringify({
            gameId: gameId,
            mapId: mapId,
            region: region,
            mode: mode,
            maxPlayers: gameConfig.maxPlayers
        });
        return {
            state: state,
            tickRate: gameConfig.tickRate,
            label: label
        };
    };
    var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
        var isSpectator = metadata && metadata.spectator === true;
        // Spectators don't count towards max players? Or maybe they do, but separate limit?
        // For now, let's assume separate limit or no limit.
        if (!isSpectator) {
            if (state.config.maxPlayers && Object.keys(state.players).filter(function (id) { return !state.players[id].isSpectator; }).length >= state.config.maxPlayers) {
                return { state: state, accept: false, rejectMessage: "Match full" };
            }
        }
        else {
            state.pendingSpectators[presence.sessionId] = true;
        }
        return { state: state, accept: true };
    };
    var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
        for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
            var presence = presences_1[_i];
            var isSpectator = state.pendingSpectators[presence.sessionId] || false;
            delete state.pendingSpectators[presence.sessionId];
            // Load Cosmetics
            var inventory = getInventory(nk, presence.userId);
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
                var spawnIndex = Object.keys(state.players).length % state.map.spawnPoints.length;
                state.players[presence.sessionId].position = state.map.spawnPoints[spawnIndex];
            }
        }
        return { state: state };
    };
    var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
        for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
            var presence = presences_2[_i];
            delete state.players[presence.sessionId];
        }
        return { state: state };
    };
    var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
        // Update State Tick
        state.tick = tick;
        // Calculate delta time (approximate based on tick rate)
        var deltaTime = 1 / state.config.tickRate;
        // Process inputs
        var inputs = decodeMessages(messages, logger);
        // Separate ACKs from Game Inputs
        var gameInputs = [];
        for (var _i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
            var input = inputs_1[_i];
            if (input.opCode === CLIENT_OPCODES.ACK) {
                var player = state.players[input.sender.sessionId];
                if (player && input.data && typeof input.data.ackTick === 'number') {
                    player.lastAckTick = input.data.ackTick;
                }
            }
            else {
                var player = state.players[input.sender.sessionId];
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
            for (var id in state.players) {
                decayFlags(state.players[id], logger, state.tick);
            }
        }
        // Broadcast Snapshot (Frequency Controlled)
        if (shouldSendSnapshot(state.tick)) {
            var snapshot = buildSnapshot(state);
            // Keyframe Logic (e.g. every 1 second)
            // Rule: Never trust deltas forever.
            var KEYFRAME_INTERVAL = state.config.tickRate || 20; // Default 1 sec
            var isKeyframe = (state.tick % KEYFRAME_INTERVAL === 0);
            if (isKeyframe) {
                dispatcher.broadcastMessage(SERVER_OPCODES.FULL_SNAPSHOT, JSON.stringify(snapshot));
            }
            else {
                var delta = buildDeltaFromSnapshot(snapshot, state.lastBroadcastPlayers);
                dispatcher.broadcastMessage(SERVER_OPCODES.DELTA_SNAPSHOT, JSON.stringify(delta));
            }
            // Update last broadcast cache
            // We use the 'snapshot' (current truth) as the baseline for next delta
            state.lastBroadcastPlayers = {};
            for (var _a = 0, _b = snapshot.players; _a < _b.length; _a++) {
                var p = _b[_a];
                state.lastBroadcastPlayers[p.id] = p;
            }
        }
        // CHECK MATCH END CONDITION
        // 1. Time limit
        var matchDurationSec = state.config.matchDuration || 300; // Default 5 mins
        var elapsedSec = (Date.now() - state.gameStartTime) / 1000;
        // 2. Score limit (check if any player reached max score)
        var maxScoreReached = false;
        var winningScore = state.config.winningScore || 1000;
        for (var id in state.players) {
            if (state.players[id].score >= winningScore) {
                maxScoreReached = true;
                break;
            }
        }
        if (elapsedSec >= matchDurationSec || maxScoreReached) {
            // Match Over
            var reason = maxScoreReached ? "score_limit" : "time_limit";
            logger.info("Match Ended. ID: ".concat(ctx.matchId, ", Reason: ").concat(reason, ", Duration: ").concat(elapsedSec.toFixed(1), "s, Players: ").concat(Object.keys(state.players).length));
            var currentSeason = getCurrentSeason(nk);
            var seasonId = (currentSeason && currentSeason.isActive) ? currentSeason.id : undefined;
            var isRanked = state.config.mode === "ranked"; // Assume config passed "mode"
            // Simple MMR logic: Winners (+10), Losers (-10)
            // In a real game, sort by score.
            // For now, let's just give +10 to everyone (participation) to prove flow
            // Or better: Top half gets +, Bottom half gets -
            var sortedPlayers = Object.keys(state.players)
                .map(function (key) { return state.players[key]; })
                .sort(function (a, b) { return b.score - a.score; });
            var midPoint = Math.floor(sortedPlayers.length / 2);
            for (var i = 0; i < sortedPlayers.length; i++) {
                var p = sortedPlayers[i];
                var delta = 0;
                var xp = 100; // Base XP
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
                        updatePlayerMMR(nk, p.userId, delta, seasonId);
                    }
                    // Progression (XP) always
                    addXp(nk, p.userId, xp);
                }
                catch (e) {
                    logger.error("Failed to update stats for ".concat(p.userId, ": ").concat(e));
                }
            }
            dispatcher.broadcastMessage(SERVER_OPCODES.GAME_OVER, JSON.stringify({
                reason: maxScoreReached ? "score_limit" : "time_limit",
                scores: sortedPlayers.map(function (p) { return ({ id: p.sessionId, score: p.score }); })
            }));
            return null; // Terminate match
        }
        return { state: state };
    };
    var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
        return { state: state };
    };
    var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
        return { state: state, data: "Signal received: " + data };
    };

    var onMatched = function (ctx, logger, nk, matches) {
        logger.info("Matchmaker matched ".concat(matches.length, " users."));
        // 1. Validate matches
        if (matches.length === 0) {
            return;
        }
        // 2. Extract properties from the first user (they should be identical for the group)
        // The client sends properties like { "gameId": "arena_fps", "region": "asia" }
        // matches[0] is MatchmakerResult
        var properties = matches[0].properties;
        var gameId = properties["gameId"] || "arena_fps";
        var region = properties["region"] || "us";
        var mode = properties["mode"] || "standard";
        // 3. Create the match
        // We pass these parameters to matchInit via the params argument
        try {
            var matchId = nk.matchCreate("game_match", {
                gameId: gameId,
                region: region,
                mode: mode,
                // We can pass the user IDs to pre-validate them in matchInit if we want,
                // but usually they just join via the matchId returned.
            });
            logger.info("Created match: ".concat(matchId, " for game: ").concat(gameId, ", region: ").concat(region));
            return matchId;
        }
        catch (err) {
            logger.error("Failed to create match: ".concat(err));
            throw err;
        }
    };

    // Admin RPCs (Should be protected in production via check for admin ID or similar)
    // For now, we assume these are called by a trusted client or console.
    function rpcAdminStartSeason(ctx, logger, nk, payload) {
        // Simple admin check: In real app, check ctx.userId against a list or use API key logic if http key
        // For demo, we just allow it.
        var input;
        try {
            input = JSON.parse(payload);
        }
        catch (_a) {
            throw new Error("Invalid payload");
        }
        if (!input.id || !input.name || !input.duration) {
            throw new Error("Missing params: id, name, duration");
        }
        var season = startSeason(nk, input.id, input.name, input.duration);
        logger.info("Started season: ".concat(season.id));
        return JSON.stringify(season);
    }
    function rpcAdminEndSeason(ctx, logger, nk, payload) {
        var success = endSeason(nk);
        if (success) {
            logger.info("Ended current season");
            return JSON.stringify({ success: true });
        }
        else {
            return JSON.stringify({ success: false, message: "No active season" });
        }
    }
    // Debug RPC to give myself XP
    function rpcDebugAddXp(ctx, logger, nk, payload) {
        if (!ctx.userId)
            throw new Error("No user ID");
        var amount = Number(payload) || 100;
        var result = addXp(nk, ctx.userId, amount);
        return JSON.stringify(result);
    }
    function rpcEquipCosmetic(ctx, logger, nk, payload) {
        if (!ctx.userId)
            throw new Error("No user ID");
        var input;
        try {
            input = JSON.parse(payload);
        }
        catch (_a) {
            throw new Error("Invalid payload");
        }
        if (!input.slot || !input.cosmeticId) {
            throw new Error("Missing params: slot, cosmeticId");
        }
        var success = equipCosmetic(nk, ctx.userId, input.slot, input.cosmeticId);
        if (!success) {
            throw new Error("Failed to equip: Not owned or invalid slot");
        }
        return JSON.stringify({ success: true, slot: input.slot, id: input.cosmeticId });
    }
    // Placeholder for future store integration
    function rpcPurchaseCosmetic(ctx, logger, nk, payload) {
        if (!ctx.userId)
            throw new Error("No user ID");
        // Future: Verify receipt (Google/Apple/Steam)
        // Future: Check virtual currency balance
        // For now: Just a stub
        return JSON.stringify({ success: false, message: "Store not implemented yet" });
    }

    // Entry Point
    function InitModule(ctx, logger, nk, initializer) {
        logger.info("Initializing Nakama Game Server Modules...");
        // Temporarily skip match registration to allow server startup
        // Register Matchmaker Matched Hook
        initializer.registerMatchmakerMatched(onMatched);
        // Register LiveOps RPCs
        initializer.registerRpc("admin_start_season", rpcAdminStartSeason);
        initializer.registerRpc("admin_end_season", rpcAdminEndSeason);
        initializer.registerRpc("debug_add_xp", rpcDebugAddXp);
        initializer.registerRpc("equip_cosmetic", rpcEquipCosmetic);
        initializer.registerRpc("purchase_cosmetic", rpcPurchaseCosmetic);
        logger.info("Game Match Handler Registered as 'game_match'");
        logger.info("Ready for connections.");
    }

    exports.InitModule = InitModule;
    exports.matchInit = matchInit;
    exports.matchJoin = matchJoin;
    exports.matchJoinAttempt = matchJoinAttempt;
    exports.matchLeave = matchLeave;
    exports.matchLoop = matchLoop;
    exports.matchSignal = matchSignal;
    exports.matchTerminate = matchTerminate;

    return exports;

})({});
function InitModule(ctx, logger, nk, initializer) { return ServerModule.InitModule(ctx, logger, nk, initializer); }
function matchInit(ctx, logger, nk, params) { return ServerModule.matchInit(ctx, logger, nk, params); }
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) { return ServerModule.matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata); }
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presence) { return ServerModule.matchJoin(ctx, logger, nk, dispatcher, tick, state, presence); }
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) { return ServerModule.matchLeave(ctx, logger, nk, dispatcher, tick, state, presences); }
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) { return ServerModule.matchLoop(ctx, logger, nk, dispatcher, tick, state, messages); }
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) { return ServerModule.matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds); }
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) { return ServerModule.matchSignal(ctx, logger, nk, dispatcher, tick, state, data); }
