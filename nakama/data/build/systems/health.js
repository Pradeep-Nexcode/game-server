"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthSystem = void 0;
const opcodes_1 = require("../messages/opcodes");
exports.healthSystem = {
    update: (state, inputs, deltaTime, dispatcher, nk) => {
        for (const sessionId in state.players) {
            const player = state.players[sessionId];
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
                        const spawnIndex = Math.floor(Math.random() * state.map.spawnPoints.length);
                        player.position = Object.assign({}, state.map.spawnPoints[spawnIndex]);
                    }
                    else {
                        player.position = { x: 0, y: 0, z: 0 };
                    }
                    dispatcher.broadcastMessage(opcodes_1.OpCode.STATE_UPDATE, JSON.stringify({ event: "respawn", sessionId: player.sessionId, position: player.position }));
                }
            }
        }
    }
};
