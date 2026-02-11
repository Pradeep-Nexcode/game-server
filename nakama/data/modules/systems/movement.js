var movementSystem = {
    update: function(state, inputs, deltaTime, dispatcher, nk) {
        for (const input of inputs) {
            if (input.opCode === OpCode.MOVE) {
                const player = state.players[input.sender.sessionId];
                if (player && !player.isDead) {
                    if (input.data.seq) {
                        player.lastInputSeq = input.data.seq;
                    }
                    
                    let moveDir = {
                        x: input.data.x || 0,
                        y: input.data.y || 0,
                        z: input.data.z || 0
                    };

                    const lenSq = moveDir.x*moveDir.x + moveDir.y*moveDir.y + moveDir.z*moveDir.z;
                    if (lenSq > 1.02) {
                        player.anticheat.flags.speedHack++;
                        moveDir = MathUtils.normalize(moveDir);
                    }

                    const speed = 5;
                    const movement = MathUtils.scale(moveDir, speed * deltaTime);
                    player.position = MathUtils.add(player.position, movement);
                    
                    if (input.data.rotX !== undefined) {
                         player.rotation = { x: input.data.rotX, y: input.data.rotY, z: input.data.rotZ };
                    }
                }
            }
        }
    }
};
