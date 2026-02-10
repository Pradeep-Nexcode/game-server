import { OpCode } from './opcodes';

export const SERVER_OPCODES = {
    FULL_SNAPSHOT: 100,
    DELTA_SNAPSHOT: 101,
    GAME_OVER: 102,
    KILLCAM_DATA: 103,
} as const;

export interface PlayerSnapshot {
    id: string;
    x: number;
    y: number;
    z: number;
    rotX?: number;
    rotY?: number;
    rotZ?: number;
    hp?: number;
    lastProcessedSeq?: number;
    isSpectator?: boolean;
    skin?: string;
    weaponSkin?: string;
}

export interface PlayerDelta {
    id: string;
    x?: number;
    y?: number;
    z?: number;
    rotX?: number;
    rotY?: number;
    rotZ?: number;
    hp?: number;
    isSpectator?: boolean;
    skin?: string;
    weaponSkin?: string;
}

export interface WorldSnapshot {
    tick: number;
    players: PlayerSnapshot[];
}

export interface DeltaSnapshot {
    tick: number;
    players: PlayerDelta[];
}

export function createStateUpdateMessage(state: any): string {
    return JSON.stringify({
        op: OpCode.STATE_UPDATE,
        data: state
    });
}

export function createGameStartMessage(config: any): string {
    return JSON.stringify({
        op: OpCode.GAME_START,
        data: config
    });
}
