globalThis.RPCSystem = {
  rpcAdminStartSeason: function (ctx, logger, nk, payload) {
    let input;
    try {
      input = JSON.parse(payload);
    } catch (e) {
      throw new Error("Invalid payload");
    }

    if (!input.id || !input.name || !input.duration) {
      throw new Error("Missing params: id, name, duration");
    }

    const season = SeasonsSystem.startSeason(
      nk,
      input.id,
      input.name,
      input.duration,
    );
    if (logger) logger.info(`Started season: ${season.id}`);

    return JSON.stringify(season);
  },

  rpcAdminEndSeason: function (ctx, logger, nk, payload) {
    const success = SeasonsSystem.endSeason(nk);
    if (success) {
      if (logger) logger.info("Ended current season");
      return JSON.stringify({ success: true });
    } else {
      return JSON.stringify({ success: false, message: "No active season" });
    }
  },

  rpcDebugAddXp: function (ctx, logger, nk, payload) {
    if (!ctx.userId) throw new Error("No user ID");

    const amount = Number(payload) || 100;
    const result = ProgressionSystem.addXp(nk, ctx.userId, amount);

    return JSON.stringify(result);
  },

  rpcEquipCosmetic: function (ctx, logger, nk, payload) {
    if (!ctx.userId) throw new Error("No user ID");

    let input;
    try {
      input = JSON.parse(payload);
    } catch (e) {
      throw new Error("Invalid payload");
    }

    if (!input.slot || !input.cosmeticId) {
      throw new Error("Missing params: slot, cosmeticId");
    }

    const success = CosmeticsSystem.equipCosmetic(
      nk,
      ctx.userId,
      input.slot,
      input.cosmeticId,
    );
    if (!success) {
      throw new Error("Failed to equip: Not owned or invalid slot");
    }

    return JSON.stringify({
      success: true,
      slot: input.slot,
      id: input.cosmeticId,
    });
  },

  rpcPurchaseCosmetic: function (ctx, logger, nk, payload) {
    if (!ctx.userId) throw new Error("No user ID");
    return JSON.stringify({
      success: false,
      message: "Store not implemented yet",
    });
  },

  rpcCreateMatch: function (ctx, logger, nk, payload) {
    if (logger) logger.info("RPC create_match called");

    const matchId = nk.matchCreate("game_match", {});

    if (logger) logger.info("Match created successfully: " + matchId);

    return JSON.stringify({
      match_id: matchId,
    });
  },
};
