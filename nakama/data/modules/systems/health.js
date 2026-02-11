var healthSystem = {
    update: function(state, inputs, deltaTime, dispatcher, nk) {
        for (const sessionId in state.players) {
            const player = state.players[sessionId];
            
            if (player.isDead) {
                if (!player.deathTime) {
                    player.deathTime = Date.now();
                }
                
                if (Date.now() - player.deathTime > 3000) {
                    player.isDead = false;
                    player.health = 100;
                    delete player.deathTime;
                    
                    if (state.map.spawnPoints && state.map.spawnPoints.length > 0) {
                        const spawnIndex = Math.floor(Math.random() * state.map.spawnPoints.length);
                        player.position = { 
                            x: state.map.spawnPoints[spawnIndex].x,
                            y: state.map.spawnPoints[spawnIndex].y,
                            z: state.map.spawnPoints[spawnIndex].z
                        };
                    } else {
                        player.position = { x: 0, y: 0, z: 0 };
                    }
                    
                    dispatcher.broadcastMessage(OpCode.STATE_UPDATE, JSON.stringify({ event: "respawn", sessionId: player.sessionId, position: player.position }));
                }
            }
        }
    }
};
