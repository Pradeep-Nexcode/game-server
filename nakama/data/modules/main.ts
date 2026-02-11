import { matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal } from './engine/matchBase';
import { onMatched } from './core/matchmaking';
import { rpcAdminStartSeason, rpcAdminEndSeason, rpcDebugAddXp, rpcEquipCosmetic, rpcPurchaseCosmetic } from './liveops/rpcs';

// Helper to register the match handler
function registerMatch(initializer: nkruntime.Initializer, name: string) {
    initializer.registerMatch(name, {
        matchInit: (globalThis as any).matchInit,
        matchJoinAttempt: (globalThis as any).matchJoinAttempt,
        matchJoin: (globalThis as any).matchJoin,
        matchLeave: (globalThis as any).matchLeave,
        matchLoop: (globalThis as any).matchLoop,
        matchTerminate: (globalThis as any).matchTerminate,
        matchSignal: (globalThis as any).matchSignal
    });
}

// Entry Point
export function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
    logger.info("Initializing Nakama Game Server Modules...");

    // Temporarily skip match registration to allow server startup
    
    // Register Matchmaker Matched Hook
    (initializer as any).registerMatchmakerMatched(onMatched);
    
    // Register LiveOps RPCs
    initializer.registerRpc("admin_start_season", rpcAdminStartSeason);
    initializer.registerRpc("admin_end_season", rpcAdminEndSeason);
    initializer.registerRpc("debug_add_xp", rpcDebugAddXp);
    initializer.registerRpc("equip_cosmetic", rpcEquipCosmetic);
    initializer.registerRpc("purchase_cosmetic", rpcPurchaseCosmetic);

    logger.info("Game Match Handler Registered as 'game_match'");
    logger.info("Ready for connections.");
}

export {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal
};
