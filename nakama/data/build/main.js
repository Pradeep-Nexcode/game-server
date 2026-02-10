"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitModule = InitModule;
const matchBase_1 = require("./engine/matchBase");
const matchmaking_1 = require("./core/matchmaking");
const rpcs_1 = require("./liveops/rpcs");
// Helper to register the match handler
function registerMatch(initializer, name) {
    initializer.registerMatch(name, {
        matchInit: matchBase_1.matchInit,
        matchJoinAttempt: matchBase_1.matchJoinAttempt,
        matchJoin: matchBase_1.matchJoin,
        matchLeave: matchBase_1.matchLeave,
        matchLoop: matchBase_1.matchLoop,
        matchTerminate: matchBase_1.matchTerminate,
        matchSignal: matchBase_1.matchSignal
    });
}
// Entry Point
function InitModule(ctx, logger, nk, initializer) {
    logger.info("Initializing Nakama Game Server Modules...");
    // Register the generic match handler
    // This handler supports all game types via config
    registerMatch(initializer, "game_match");
    // Register Matchmaker Matched Hook
    initializer.registerMatchmakerMatched(matchmaking_1.onMatched);
    // Register LiveOps RPCs
    initializer.registerRpc("admin_start_season", rpcs_1.rpcAdminStartSeason);
    initializer.registerRpc("admin_end_season", rpcs_1.rpcAdminEndSeason);
    initializer.registerRpc("debug_add_xp", rpcs_1.rpcDebugAddXp);
    initializer.registerRpc("equip_cosmetic", rpcs_1.rpcEquipCosmetic);
    initializer.registerRpc("purchase_cosmetic", rpcs_1.rpcPurchaseCosmetic);
    logger.info("Game Match Handler Registered as 'game_match'");
    logger.info("Ready for connections.");
}
