export enum OpCode {
    // Server -> Client
    ERROR = 0,
    STATE_UPDATE = 1,
    GAME_START = 2,
    GAME_OVER = 3,

    // Client -> Server
    MOVE = 100,
    SHOOT = 101,
    JUMP = 102,
    USE_ITEM = 103,
    RELOAD = 104
}

export const SERVER_OPCODES = {
    FULL_SNAPSHOT: 100,
    DELTA_SNAPSHOT: 101,
    GAME_OVER: 102,
    KILLCAM_DATA: 103,
} as const;

export const CLIENT_OPCODES = {
    ACK: 10,
} as const;
