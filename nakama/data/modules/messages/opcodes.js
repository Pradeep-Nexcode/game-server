var OpCode = {
    // Phase 2: Lobby & Core
    CHAT: 1,
    READY_TOGGLE: 2,
    START_GAME: 3,
    LOBBY_STATE_UPDATE: 100,

    // Server -> Client
    ERROR: 0,
    STATE_UPDATE: 1,
    GAME_START: 2,
    GAME_OVER: 3,
    
    // Client -> Server
    MOVE: 100,
    SHOOT: 101,
    JUMP: 102,
    USE_ITEM: 103,
    RELOAD: 104
};
