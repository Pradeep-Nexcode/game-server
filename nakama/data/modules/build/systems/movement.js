"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.movementSystem = void 0;
const opcodes_1 = require("../messages/opcodes");
const math_1 = require("../utils/math");
exports.movementSystem = {
    update: (state, inputs, deltaTime, dispatcher, nk) => {
        // Process inputs
        for (const input of inputs) {
            if (input.opCode === opcodes_1.OpCode.MOVE) {
                const player = state.players[input.sender.sessionId];
                if (player && !player.isDead) {
                    // Update last processed sequence number
                    if (input.data.seq) {
                        player.lastInputSeq = input.data.seq;
                    }
                    // Expecting input.data to be { x: number, y: number, z: number } or similar
                    // Unity: { "op": "MOVE", "x": 1, "y": 0 } - user example
                    // Let's assume input.data is the payload
                    let moveDir = {
                        x: input.data.x || 0,
                        y: input.data.y || 0,
                        z: input.data.z || 0
                    };
                    // Anti-Cheat: Validate Input Vector
                    // If magnitude > 1.0 (with tolerance), it's a speed hack attempt via vector stretching
                    const lenSq = moveDir.x * moveDir.x + moveDir.y * moveDir.y + moveDir.z * moveDir.z;
                    if (lenSq > 1.02) { // 1.01^2 approx 1.02
                        player.anticheat.flags.speedHack++;
                        moveDir = (0, math_1.normalize)(moveDir);
                    }
                    // Simple movement: Position += Direction * Speed * DeltaTime
                    // Speed should be in config or player stats
                    const speed = 5; // Hardcoded for now, should come from config/weapon/class
                    const movement = (0, math_1.scale)(moveDir, speed * deltaTime);
                    player.position = (0, math_1.add)(player.position, movement);
                    // Update rotation if provided
                    if (input.data.rotX !== undefined) {
                        player.rotation = { x: input.data.rotX, y: input.data.rotY, z: input.data.rotZ };
                    }
                }
            }
        }
    }
};
