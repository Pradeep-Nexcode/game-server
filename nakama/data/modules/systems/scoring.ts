import { GameState, System } from '../engine/state';
import { OpCode } from '../messages/opcodes';

export const scoringSystem: System = {
    update: (state: GameState, inputs: any[], deltaTime: number, dispatcher: nkruntime.Dispatcher, nk: nkruntime.Nakama) => {
        // Check for win condition
        // Example: Score limit or Time limit
        
        // Time limit check
        const now = Date.now();
        if (state.gameEndTime > 0 && now >= state.gameEndTime) {
             // Game Over
             dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ reason: "time_limit" }));
             // We might want to terminate the match here or switch state
             return;
        }
        
        // Score limit check (e.g. 1000 points)
        const scoreLimit = 1000; 
        for (const sessionId in state.players) {
            if (state.players[sessionId].score >= scoreLimit) {
                dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ reason: "score_limit", winner: sessionId }));
                state.gameEndTime = now; // End game immediately
                break;
            }
        }
    }
};
