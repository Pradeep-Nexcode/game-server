var SERVER_OPCODES = {
    FULL_SNAPSHOT: 100,
    DELTA_SNAPSHOT: 101,
    GAME_OVER: 102,
    KILLCAM_DATA: 103,
};

var ServerMessages = {
    createStateUpdateMessage: function(state) {
        return JSON.stringify({
            op: OpCode.STATE_UPDATE,
            data: state
        });
    },

    createGameStartMessage: function(config) {
        return JSON.stringify({
            op: OpCode.GAME_START,
            data: config
        });
    }
};
