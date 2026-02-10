// Global Nakama Runtime Types
declare namespace nkruntime {
    export interface Logger {
        debug(format: string, ...args: any[]): void;
        info(format: string, ...args: any[]): void;
        warn(format: string, ...args: any[]): void;
        error(format: string, ...args: any[]): void;
    }

    export interface Initializer {
        registerMatch(name: string, matchHandlers: Match): void;
        registerRpc(name: string, rpcFn: (ctx: Context, logger: Logger, nk: Nakama, payload: string) => string | void): void;
    }

    export interface Context {
        userId: string;
        sessionId: string;
        username: string;
        matchId: string;
    }

    export interface Nakama {
        matchCreate(module: string, params?: {[key: string]: any}): string;
        storageRead(requests: StorageReadRequest[]): StorageObject[];
        storageWrite(objects: StorageWriteRequest[]): StorageWriteAck[];
        uuidv4(): string;
    }

    export interface Match {
        matchInit(ctx: Context, logger: Logger, nk: Nakama, params: {[key: string]: any}): { state: any, tickRate: number, label: string };
        matchJoinAttempt(ctx: Context, logger: Logger, nk: Nakama, dispatcher: Dispatcher, tick: number, state: any, presence: Presence, metadata: {[key: string]: any}): { state: any, accept: boolean, rejectMessage?: string } | null;
        matchJoin(ctx: Context, logger: Logger, nk: Nakama, dispatcher: Dispatcher, tick: number, state: any, presences: Presence[]): { state: any } | null;
        matchLeave(ctx: Context, logger: Logger, nk: Nakama, dispatcher: Dispatcher, tick: number, state: any, presences: Presence[]): { state: any } | null;
        matchLoop(ctx: Context, logger: Logger, nk: Nakama, dispatcher: Dispatcher, tick: number, state: any, messages: MatchMessage[]): { state: any } | null;
        matchTerminate(ctx: Context, logger: Logger, nk: Nakama, dispatcher: Dispatcher, tick: number, state: any, graceSeconds: number): { state: any } | null;
        matchSignal(ctx: Context, logger: Logger, nk: Nakama, dispatcher: Dispatcher, tick: number, state: any, data: string): { state: any, data?: string } | null;
    }

    export interface Dispatcher {
        broadcastMessage(opCode: number, data?: string | null, presences?: Presence[] | null, sender?: Presence | null): void;
        matchKick(presences: Presence[]): void;
        matchLabelUpdate(label: string): void;
    }

    export interface Presence {
        userId: string;
        sessionId: string;
        username: string;
        nodeId: string;
    }

    export interface MatchMessage {
        sender: Presence;
        opCode: number;
        data: number[]; // byte array
        reliable: boolean;
        receiveTimeMs: number;
    }

    export interface StorageReadRequest {
        collection: string;
        key: string;
        userId?: string;
    }

    export interface StorageObject {
        collection: string;
        key: string;
        userId: string;
        value: any;
        version: string;
        permissionRead: number;
        permissionWrite: number;
        createTime: number;
        updateTime: number;
    }

    export interface StorageWriteRequest {
        collection: string;
        key: string;
        value: any;
        userId?: string;
        permissionRead?: number;
        permissionWrite?: number;
        version?: string;
    }
    
    export interface StorageWriteAck {
        collection: string;
        key: string;
        version: string;
        userId: string;
        permissionRead?: number;
        permissionWrite?: number;
        version?: string;
    }
}
