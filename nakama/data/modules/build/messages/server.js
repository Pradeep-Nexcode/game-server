"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVER_OPCODES = void 0;
exports.createStateUpdateMessage = createStateUpdateMessage;
exports.createGameStartMessage = createGameStartMessage;
const opcodes_1 = require("./opcodes");
exports.SERVER_OPCODES = {
    FULL_SNAPSHOT: 100,
    DELTA_SNAPSHOT: 101,
    GAME_OVER: 102,
    KILLCAM_DATA: 103,
};
function createStateUpdateMessage(state) {
    return JSON.stringify({
        op: opcodes_1.OpCode.STATE_UPDATE,
        data: state
    });
}
function createGameStartMessage(config) {
    return JSON.stringify({
        op: opcodes_1.OpCode.GAME_START,
        data: config
    });
}
