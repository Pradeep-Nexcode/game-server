var killcamSystem = {
    update: function(state, inputs, deltaTime, dispatcher, nk) {
        if (!state.pendingKillcams || state.pendingKillcams.length === 0) return;

        const tickRate = state.config.tickRate || 20;
        const POST_KILL_DURATION = 0.25;
        const PRE_KILL_DURATION = 1.0;

        const remainingKillcams = [];

        for (const killcam of state.pendingKillcams) {
            const targetTick = killcam.killTick + Math.ceil(POST_KILL_DURATION * tickRate);

            if (state.tick > targetTick) {
                const startTick = killcam.killTick - Math.ceil(PRE_KILL_DURATION * tickRate);
                const endTick = targetTick;

                const historyData = HistoryEngine.getHistoryRange(state, startTick, endTick);

                const victim = state.players[killcam.victimId];
                if (victim && victim.nodeId) {
                     const presence = {
                         sessionId: victim.sessionId,
                         userId: victim.userId,
                         username: victim.username,
                         nodeId: victim.nodeId
                     };
                     
                     dispatcher.broadcastMessage(
                         SERVER_OPCODES.KILLCAM_DATA,
                         JSON.stringify(historyData),
                         [presence]
                     );
                }
            } else {
                remainingKillcams.push(killcam);
            }
        }

        state.pendingKillcams = remainingKillcams;
    }
};
