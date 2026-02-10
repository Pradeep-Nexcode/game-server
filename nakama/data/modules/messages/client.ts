export const CLIENT_OPCODES = {
    MOVE: 1, // Example
    ACK: 10,
} as const;

export interface ClientMessage {
    sender: nkruntime.Presence;
    opCode: number;
    data: any;
}

export function decodeMessages(messages: nkruntime.MatchMessage[], logger: nkruntime.Logger): ClientMessage[] {
    const decoded: ClientMessage[] = [];
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
            logger.error(`Failed to decode message from ${message.sender.sessionId}: ${e}`);
        }
    }
    return decoded;
}
