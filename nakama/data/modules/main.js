// --------------------------------------------------
// MATCH HANDLER WRAPPER FUNCTIONS (GLOBAL)
// --------------------------------------------------

function matchInit(ctx, logger, nk, params) {
  return GameMatch.matchInit(ctx, logger, nk, params);
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  return GameMatch.matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata);
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  return GameMatch.matchJoin(ctx, logger, nk, dispatcher, tick, state, presences);
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  return GameMatch.matchLeave(ctx, logger, nk, dispatcher, tick, state, presences);
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  return GameMatch.matchLoop(ctx, logger, nk, dispatcher, tick, state, messages);
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return GameMatch.matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds);
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return GameMatch.matchSignal(ctx, logger, nk, dispatcher, tick, state, data);
}


// --------------------------------------------------
// MATCH OBJECT (NO INLINE FUNCTIONS)
// --------------------------------------------------

var GameMatchHandler = {
  matchInit: matchInit,
  matchJoinAttempt: matchJoinAttempt,
  matchJoin: matchJoin,
  matchLeave: matchLeave,
  matchLoop: matchLoop,
  matchTerminate: matchTerminate,
  matchSignal: matchSignal
};


// --------------------------------------------------
// MATCHMAKER HANDLER (GLOBAL FUNCTION)
// --------------------------------------------------

function matchmakerMatched(ctx, logger, nk, matchedUsers) {
  return Matchmaking.onMatched(ctx, logger, nk, matchedUsers);
}


// --------------------------------------------------
// RPC HANDLERS (GLOBAL FUNCTIONS)
// --------------------------------------------------

function rpcAdminStartSeason(ctx, logger, nk, payload) {
  return RPCSystem.rpcAdminStartSeason(ctx, logger, nk, payload);
}

function rpcAdminEndSeason(ctx, logger, nk, payload) {
  return RPCSystem.rpcAdminEndSeason(ctx, logger, nk, payload);
}

function rpcDebugAddXp(ctx, logger, nk, payload) {
  return RPCSystem.rpcDebugAddXp(ctx, logger, nk, payload);
}

function rpcEquipCosmetic(ctx, logger, nk, payload) {
  return RPCSystem.rpcEquipCosmetic(ctx, logger, nk, payload);
}

function rpcPurchaseCosmetic(ctx, logger, nk, payload) {
  return RPCSystem.rpcPurchaseCosmetic(ctx, logger, nk, payload);
}


// --------------------------------------------------
// INIT MODULE
// --------------------------------------------------

function InitModule(ctx, logger, nk, initializer) {

  if (logger) logger.info("Initializing Nakama Game Server Modules...");

  // Register Match
  initializer.registerMatch("game_match", GameMatchHandler);

  // Register Matchmaker
  initializer.registerMatchmakerMatched(matchmakerMatched);

  // Register RPCs
  initializer.registerRpc("admin_start_season", rpcAdminStartSeason);
  initializer.registerRpc("admin_end_season", rpcAdminEndSeason);
  initializer.registerRpc("debug_add_xp", rpcDebugAddXp);
  initializer.registerRpc("equip_cosmetic", rpcEquipCosmetic);
  initializer.registerRpc("purchase_cosmetic", rpcPurchaseCosmetic);

  if (logger) {
    logger.info("Game Match Handler Registered as 'game_match'");
    logger.info("Ready for connections.");
  }
}


// --------------------------------------------------
// EXPORT (VERY IMPORTANT)
// --------------------------------------------------

globalThis.InitModule = InitModule;
