"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldSendSnapshot = shouldSendSnapshot;
exports.runGameTick = runGameTick;
const matchBase_1 = require("./matchBase");
const anticheat_1 = require("./anticheat");
const opcodes_1 = require("../messages/opcodes");
const SNAPSHOT_RATE = 3; // every 3 ticks
function shouldSendSnapshot(tick) {
    return tick % SNAPSHOT_RATE === 0;
}
function runGameTick(state, inputs, deltaTime, dispatcher, nk, logger) {
    const activeSystems = state.config.systems;
    const nowMs = Date.now();
    // Filter inputs based on Anti-Cheat
    const filteredInputs = [];
    for (const input of inputs) {
        // Inputs might come from presences not yet in state (e.g. join request?), 
        // but matchLoop processes messages from joined presences usually.
        // However, standard match handler ensures sender is in presence list.
        // But state.players is our logic.
        const player = state.players[input.sender.sessionId];
        if (!player)
            continue;
        // 1. Soft Ban Check
        if ((0, anticheat_1.shouldIgnoreInput)(player)) {
            continue;
        }
        // 2. Rate Limit Check (Movement only)
        if (input.opCode === opcodes_1.OpCode.MOVE) {
            if (!(0, anticheat_1.checkInputRate)(player, nowMs)) {
                // Dropped input
                continue;
            }
        }
        filteredInputs.push(input);
    }
    for (const systemName of activeSystems) {
        const system = matchBase_1.systemRegistry[systemName];
        if (system) {
            system.update(state, filteredInputs, deltaTime, dispatcher, nk);
        }
        else {
            logger.warn(`System not found: ${systemName}`);
        }
    }
}
