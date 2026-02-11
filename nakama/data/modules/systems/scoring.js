var scoringSystem = {
    update: function(state, inputs, deltaTime, dispatcher, nk) {
        const now = Date.now();
        if (state.gameEndTime > 0 && now >= state.gameEndTime) {
             dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ reason: "time_limit" }));
             return;
        }
        
        const scoreLimit = 1000; 
        for (const sessionId in state.players) {
            if (state.players[sessionId].score >= scoreLimit) {
                dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ reason: "score_limit", winner: sessionId }));
                state.gameEndTime = now;
                break;
            }
        }
    }
};
