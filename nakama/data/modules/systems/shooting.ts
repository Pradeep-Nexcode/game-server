import { GameState, System } from '../engine/state';
import { OpCode } from '../messages/opcodes';
import { weaponsConfig } from '../config';
import { getRewoundPlayers } from '../engine/history';
import { Vector3 } from '../utils/math';
import { ANTICHEAT_CONFIG } from '../engine/anticheat';

export const shootingSystem: System = {
    update: (state: GameState, inputs: any[], deltaTime: number, dispatcher: nkruntime.Dispatcher, nk: nkruntime.Nakama) => {
        const nowMs = Date.now();
        
        for (const input of inputs) {
            if (input.opCode === OpCode.SHOOT) {
                const player = state.players[input.sender.sessionId];
                if (player && !player.isDead) {
                    
                    const weaponId = "pistol"; // Default or get from inventory
                    const weapon = (weaponsConfig as any)[weaponId];
                    
                    if (weapon) {
                        // 1. Fire Rate Check
                        // weapon.fireRate is delay in seconds (e.g. 0.1s)
                        const fireDelayMs = weapon.fireRate * 1000;
                        if (nowMs - player.anticheat.lastShotAtMs < fireDelayMs * 0.9) {
                             player.anticheat.flags.fireRate++;
                             continue;
                        }
                        player.anticheat.lastShotAtMs = nowMs;

                        // HITSCAN / RAYCAST LOGIC (Lag Compensated)
                        // Input: { direction: Vector3, tick: number, targetId?: string }
                        // If targetId is provided, we verify the hit.
                        // If no targetId, we might raycast against all (expensive without spatial partition)
                        
                        const shootTick = input.data.tick;
                        const shootDir = input.data.direction; // Normalized
                        
                        // Sanity check: Tick must be in past
                        if (!shootTick || shootTick > state.tick) {
                            // Invalid tick
                            continue;
                        }
                        
                        // 2. Time Drift Check
                        const drift = Math.abs(shootTick - state.tick);
                        // Max drift 1 second (approx 20 ticks)
                        if (drift > 20) {
                             player.anticheat.flags.timeDrift++;
                             continue;
                        }

                        // Rewind the world
                        const rewoundPlayers = getRewoundPlayers(state, shootTick);
                        
                        if (rewoundPlayers) {
                            // Determine shooter position at that time (or current? usually rewound for consistency)
                            const shooterHistory = rewoundPlayers[player.sessionId];
                            if (!shooterHistory) continue;

                            const origin = shooterHistory.position;
                            
                            // Check for hits
                            // Optimization: Only check the target client claims to have hit
                            // But for security, we should check intersection.
                            
                            let hitTargetId: string | null = null;
                            let minDist = 9999;

                            for (const targetId in rewoundPlayers) {
                                if (targetId === player.sessionId) continue;
                                
                                const target = rewoundPlayers[targetId];
                                const targetState = state.players[targetId]; // Current state for health check
                                if (!targetState || targetState.isDead) continue;

                                // Simple Ray-Sphere Intersection
                                // Sphere center = target.position
                                // Radius = 1.0 (approx hitbox)
                                
                                if (intersectRaySphere(origin, shootDir, target.position, 1.0)) {
                                    const dist = distance(origin, target.position);
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

                                    // Queue Killcam
                                    if (state.pendingKillcams) {
                                        state.pendingKillcams.push({
                                            victimId: hitTargetId,
                                            killerId: player.sessionId,
                                            killTick: state.tick
                                        });
                                    }
                                }
                                
                                // Notify hit (optional)
                            }
                        }
                    }
                }
            }
        }
        
        // Projectile update logic removed/commented for Phase 4 focus
    }
};

function distance(v1: Vector3, v2: Vector3): number {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

// https://en.wikipedia.org/wiki/Line%E2%80%93sphere_intersection
function intersectRaySphere(origin: Vector3, dir: Vector3, center: Vector3, radius: number): boolean {
    const oc = { x: origin.x - center.x, y: origin.y - center.y, z: origin.z - center.z };
    const a = dir.x*dir.x + dir.y*dir.y + dir.z*dir.z;
    const b = 2.0 * (oc.x*dir.x + oc.y*dir.y + oc.z*dir.z);
    const c = (oc.x*oc.x + oc.y*oc.y + oc.z*oc.z) - radius*radius;
    const discriminant = b*b - 4*a*c;
    return (discriminant > 0);
}
