import { GameState, System } from '../engine/state';
import { SERVER_OPCODES } from '../messages/server';
import { getHistoryRange } from '../engine/history';

export const killcamSystem: System = {
    update: (state: GameState, inputs: any[], deltaTime: number, dispatcher: nkruntime.Dispatcher, nk: nkruntime.Nakama) => {
        if (!state.pendingKillcams || state.pendingKillcams.length === 0) return;

        const tickRate = state.config.tickRate || 20;
        const POST_KILL_DURATION = 0.25; // seconds
        const PRE_KILL_DURATION = 1.0; // seconds

        // We iterate backwards or use a new array to filter
        const remainingKillcams = [];

        for (const killcam of state.pendingKillcams) {
            // We wait until we have enough history for the "post-kill" duration
            const targetTick = killcam.killTick + Math.ceil(POST_KILL_DURATION * tickRate);

            // Wait until targetTick is definitely in history (history is added AFTER systems update)
            // So we need state.tick to be > targetTick
            if (state.tick > targetTick) {
                // Time to send!
                const startTick = killcam.killTick - Math.ceil(PRE_KILL_DURATION * tickRate);
                const endTick = targetTick;

                const historyData = getHistoryRange(state, startTick, endTick);

                // Find victim presence
                const victim = state.players[killcam.victimId];
                if (victim && victim.nodeId) {
                     // Construct presence
                     const presence: nkruntime.Presence = {
                         sessionId: victim.sessionId,
                         userId: victim.userId,
                         username: victim.username,
                         nodeId: victim.nodeId
                     };
                     
                     // Send only to the victim
                     dispatcher.broadcastMessage(
                         SERVER_OPCODES.KILLCAM_DATA,
                         JSON.stringify(historyData),
                         [presence]
                     );
                }
                // Processed, do not add to remaining
            } else {
                // Not ready yet, keep it
                remainingKillcams.push(killcam);
            }
        }

        state.pendingKillcams = remainingKillcams;
    }
};
