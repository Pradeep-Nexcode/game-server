var SNAPSHOT_RATE = 3;

var TickEngine = {
    shouldSendSnapshot: function(tick) {
        return tick % SNAPSHOT_RATE === 0;
    },

    runGameTick: function(state, inputs, deltaTime, dispatcher, nk, logger) {
        // systemRegistry, AntiCheat, OpCode are global
        const activeSystems = state.config.systems;
        const nowMs = Date.now();
        
        const filteredInputs = [];
        for (const input of inputs) {
            const player = state.players[input.sender.sessionId];
            if (!player) continue;

            if (AntiCheat.shouldIgnoreInput(player)) {
                 continue;
            }
            
            if (input.opCode === OpCode.MOVE) {
                 if (!AntiCheat.checkInputRate(player, nowMs)) {
                     continue; 
                 }
            }
            
            filteredInputs.push(input);
        }
        
        for (const systemName of activeSystems) {
            const system = systemRegistry[systemName];
            if (system) {
                system.update(state, filteredInputs, deltaTime, dispatcher, nk);
            } else {
                if (logger) logger.warn(`System not found: ${systemName}`);
            }
        }
    }
};
