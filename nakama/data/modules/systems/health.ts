import { GameState, System } from '../engine/state';
import { OpCode } from '../messages/opcodes';

export const healthSystem: System = {
    update: (state: GameState, inputs: any[], deltaTime: number, dispatcher: nkruntime.Dispatcher, nk: nkruntime.Nakama) => {
        for (const sessionId in state.players) {
            const player = state.players[sessionId];
            
            if (player.isDead) {
                // Handle Respawn
                // Check if enough time passed since death
                if (!player.deathTime) {
                    player.deathTime = Date.now();
                }
                
                if (Date.now() - player.deathTime > 3000) { // 3 seconds respawn
                    player.isDead = false;
                    player.health = 100;
                    delete player.deathTime;
                    
                    // Respawn at random spawn point
                    if (state.map.spawnPoints && state.map.spawnPoints.length > 0) {
                        const spawnIndex = Math.floor(Math.random() * state.map.spawnPoints.length);
                        player.position = { ...state.map.spawnPoints[spawnIndex] };
                    } else {
                        player.position = { x: 0, y: 0, z: 0 };
                    }
                    
                    dispatcher.broadcastMessage(OpCode.STATE_UPDATE, JSON.stringify({ event: "respawn", sessionId: player.sessionId, position: player.position }));
                }
            }
        }
    }
};
