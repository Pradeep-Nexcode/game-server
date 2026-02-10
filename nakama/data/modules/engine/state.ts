import { Vector3 } from '../utils/math';
import { HistorySnapshot } from './history';
import { PlayerSnapshot } from '../messages/server';

export interface AntiCheatFlags {
    inputSpam: number;
    speedHack: number;
    teleport: number;
    fireRate: number;
    fakeCam: number;
    aimSnap: number;
    timeDrift: number;
    desync: number;
}

export interface PlayerState {
    sessionId: string;
    userId: string;
    username: string;
    nodeId: string;
    position: Vector3;
    rotation: Vector3;
    health: number;
    score: number;
    inventory: string[];
    cosmetics?: {
        player_skin?: string;
        weapon_skin?: string;
    };
    isDead: boolean;
    isSpectator?: boolean;
    deathTime?: number;
    lastInputSeq: number;
    lastAckTick: number;
    
    // Anti-Cheat State
    anticheat: {
        flags: AntiCheatFlags;
        lastInputAtMs: number;
        lastShotAtMs: number;
    };
}

export interface GameState {
    players: { [sessionId: string]: PlayerState };
    projectiles: any[]; // Define properly if needed
    gameStartTime: number;
    gameEndTime: number;
    config: any;
    map: any;
    tick: number;
    history: HistorySnapshot[];
    lastBroadcastPlayers: { [sessionId: string]: PlayerSnapshot };
    pendingSpectators: { [sessionId: string]: boolean };
    pendingKillcams: {
        victimId: string;
        killerId: string;
        killTick: number;
    }[];
}

export interface System {
    update(state: GameState, inputs: any[], deltaTime: number, dispatcher: nkruntime.Dispatcher, nakama: nkruntime.Nakama): void;
}
