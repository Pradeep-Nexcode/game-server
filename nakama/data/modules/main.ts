import {
    matchInit as baseMatchInit,
    matchJoinAttempt as baseMatchJoinAttempt,
    matchJoin as baseMatchJoin,
    matchLeave as baseMatchLeave,
    matchLoop as baseMatchLoop,
    matchTerminate as baseMatchTerminate,
    matchSignal as baseMatchSignal
} from './engine/matchBase';
import { onMatched as baseOnMatched } from './core/matchmaking';
import { rpcAdminStartSeason, rpcAdminEndSeason, rpcDebugAddXp, rpcEquipCosmetic, rpcPurchaseCosmetic } from './liveops/rpcs';

export function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: any}) {
    return baseMatchInit(ctx, logger, nk, params);
}

export function matchJoinAttempt(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: any, presence: nkruntime.Presence, metadata: {[key: string]: any}) {
    return baseMatchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata);
}

export function matchJoin(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: any, presences: nkruntime.Presence[]) {
    return baseMatchJoin(ctx, logger, nk, dispatcher, tick, state, presences);
}

export function matchLeave(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: any, presences: nkruntime.Presence[]) {
    return baseMatchLeave(ctx, logger, nk, dispatcher, tick, state, presences);
}

export function matchLoop(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: any, messages: nkruntime.MatchMessage[]) {
    return baseMatchLoop(ctx, logger, nk, dispatcher, tick, state, messages);
}

export function matchTerminate(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: any, graceSeconds: number) {
    return baseMatchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds);
}

export function matchSignal(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.Dispatcher, tick: number, state: any, data: string) {
    return baseMatchSignal(ctx, logger, nk, dispatcher, tick, state, data);
}

export function matchmakerMatched(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, matchedUsers: any[]) {
    return baseOnMatched(ctx, logger, nk, matchedUsers);
}

// Helper to register the match handler
function registerMatch(initializer: nkruntime.Initializer, name: string) {
    initializer.registerMatch(name, {
        matchInit,
        matchJoinAttempt,
        matchJoin,
        matchLeave,
        matchLoop,
        matchTerminate,
        matchSignal
    });
}

// Entry Point
export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("Initializing Nakama Game Server Modules...");

    // Register the generic match handler
    // This handler supports all game types via config
    registerMatch(initializer, "game_match");

    // Register Matchmaker Matched Hook
    (initializer as any).registerMatchmakerMatched(matchmakerMatched);

    // Register LiveOps RPCs
    initializer.registerRpc("admin_start_season", rpcAdminStartSeason);
    initializer.registerRpc("admin_end_season", rpcAdminEndSeason);
    initializer.registerRpc("debug_add_xp", rpcDebugAddXp);
    initializer.registerRpc("equip_cosmetic", rpcEquipCosmetic);
    initializer.registerRpc("purchase_cosmetic", rpcPurchaseCosmetic);

    logger.info("Game Match Handler Registered as 'game_match'");
    logger.info("Ready for connections.");
}
