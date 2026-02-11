var shootingSystem = {
    update: function(state, inputs, deltaTime, dispatcher, nk) {
        const nowMs = Date.now();
        
        for (const input of inputs) {
            if (input.opCode === OpCode.SHOOT) {
                const player = state.players[input.sender.sessionId];
                if (player && !player.isDead) {
                    
                    const weaponId = "pistol";
                    const weapon = weaponsConfig[weaponId];
                    
                    if (weapon) {
                        const fireDelayMs = weapon.fireRate * 1000;
                        if (nowMs - player.anticheat.lastShotAtMs < fireDelayMs * 0.9) {
                             player.anticheat.flags.fireRate++;
                             continue;
                        }
                        player.anticheat.lastShotAtMs = nowMs;
                        
                        const shootTick = input.data.tick;
                        const shootDir = input.data.direction;
                        
                        if (!shootTick || shootTick > state.tick) {
                            continue;
                        }
                        
                        const drift = Math.abs(shootTick - state.tick);
                        if (drift > 20) {
                             player.anticheat.flags.timeDrift++;
                             continue;
                        }

                        const rewoundPlayers = HistoryEngine.getRewoundPlayers(state, shootTick);
                        
                        if (rewoundPlayers) {
                            const shooterHistory = rewoundPlayers[player.sessionId];
                            if (!shooterHistory) continue;

                            const origin = shooterHistory.position;
                            
                            let hitTargetId = null;
                            let minDist = 9999;

                            for (const targetId in rewoundPlayers) {
                                if (targetId === player.sessionId) continue;
                                
                                const target = rewoundPlayers[targetId];
                                const targetState = state.players[targetId];
                                if (!targetState || targetState.isDead) continue;
                                
                                if (intersectRaySphere(origin, shootDir, target.position, 1.0)) {
                                    const dist = MathUtils.distance(origin, target.position);
                                    if (dist < weapon.range && dist < minDist) {
                                        minDist = dist;
                                        hitTargetId = targetId;
                                    }
                                }
                            }

                            if (hitTargetId) {
                                const target = state.players[hitTargetId];
                                target.health -= weapon.damage;
                                if (target.health <= 0) {
                                    target.health = 0;
                                    target.isDead = true;
                                    player.score += 100;

                                    if (state.pendingKillcams) {
                                        state.pendingKillcams.push({
                                            victimId: hitTargetId,
                                            killerId: player.sessionId,
                                            killTick: state.tick
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

function intersectRaySphere(origin, direction, center, radius) {
    const L = { x: center.x - origin.x, y: center.y - origin.y, z: center.z - origin.z };
    const tca = L.x * direction.x + L.y * direction.y + L.z * direction.z;
    if (tca < 0) return false;
    const d2 = (L.x * L.x + L.y * L.y + L.z * L.z) - tca * tca;
    if (d2 > radius * radius) return false;
    return true;
}
