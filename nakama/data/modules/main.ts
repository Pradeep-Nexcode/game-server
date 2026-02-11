import { matchInit, matchJoinAttempt, matchJoin, matchLeave, matchLoop, matchTerminate, matchSignal } from './engine/matchBase';
import { onMatched } from './core/matchmaking';
import { rpcAdminStartSeason, rpcAdminEndSeason, rpcDebugAddXp, rpcEquipCosmetic, rpcPurchaseCosmetic } from './liveops/rpcs';

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
