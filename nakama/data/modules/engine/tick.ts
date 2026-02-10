import { GameState } from './state';
import { System } from './state';
import { systemRegistry } from './matchBase';
import { checkInputRate, shouldIgnoreInput } from './anticheat';
import { OpCode } from '../messages/opcodes';

const SNAPSHOT_RATE = 3; // every 3 ticks

export function shouldSendSnapshot(tick: number): boolean {
    return tick % SNAPSHOT_RATE === 0;
}

export function runGameTick(state: GameState, inputs: any[], deltaTime: number, dispatcher: nkruntime.Dispatcher, nk: nkruntime.Nakama, logger: nkruntime.Logger) {
    const activeSystems = state.config.systems;
    const nowMs = Date.now();
    
    // Filter inputs based on Anti-Cheat
    const filteredInputs = [];
    for (const input of inputs) {
        // Inputs might come from presences not yet in state (e.g. join request?), 
        // but matchLoop processes messages from joined presences usually.
        // However, standard match handler ensures sender is in presence list.
        // But state.players is our logic.
        
        const player = state.players[input.sender.sessionId];
        if (!player) continue;

        // 1. Soft Ban Check
        if (shouldIgnoreInput(player)) {
             continue;
        }
        
        // 2. Rate Limit Check (Movement only)
        if (input.opCode === OpCode.MOVE) {
             if (!checkInputRate(player, nowMs)) {
                 // Dropped input
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
            logger.warn(`System not found: ${systemName}`);
        }
    }
}
