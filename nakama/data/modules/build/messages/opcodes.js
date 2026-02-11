"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpCode = void 0;
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
})(OpCode || (exports.OpCode = OpCode = {}));
