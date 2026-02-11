var CLIENT_OPCODES = {
    MOVE: 1,
    ACK: 10,
};

var ClientMessages = {
    decodeMessages: function(messages, logger) {
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
            } catch (e) {
                if (logger) logger.error(`Failed to decode message from ${message.sender.sessionId}: ${e}`);
            }
        }
        return decoded;
    }
};
