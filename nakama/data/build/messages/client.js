"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_OPCODES = void 0;
exports.decodeMessages = decodeMessages;
exports.CLIENT_OPCODES = {
    MOVE: 1, // Example
    ACK: 10,
};
function decodeMessages(messages, logger) {
    const decoded = [];
    for (const message of messages) {
        try {
            const dataString = String.fromCharCode.apply(null, message.data);
            const input = JSON.parse(dataString);
            decoded.push({
                sender: message.sender,
                opCode: message.opCode,
                data: input
            });
        }
        catch (e) {
            logger.error(`Failed to decode message from ${message.sender.sessionId}: ${e}`);
        }
    }
    return decoded;
}
