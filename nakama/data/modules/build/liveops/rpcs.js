"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcAdminStartSeason = rpcAdminStartSeason;
exports.rpcAdminEndSeason = rpcAdminEndSeason;
exports.rpcDebugAddXp = rpcDebugAddXp;
exports.rpcEquipCosmetic = rpcEquipCosmetic;
exports.rpcPurchaseCosmetic = rpcPurchaseCosmetic;
const seasons_1 = require("./seasons");
const progression_1 = require("./progression");
const cosmetics_1 = require("./cosmetics");
// Admin RPCs (Should be protected in production via check for admin ID or similar)
// For now, we assume these are called by a trusted client or console.
function rpcAdminStartSeason(ctx, logger, nk, payload) {
    // Simple admin check: In real app, check ctx.userId against a list or use API key logic if http key
    // For demo, we just allow it.
    let input;
    try {
        input = JSON.parse(payload);
    }
    catch (_a) {
        throw new Error("Invalid payload");
    }
    if (!input.id || !input.name || !input.duration) {
        throw new Error("Missing params: id, name, duration");
    }
    const season = (0, seasons_1.startSeason)(nk, input.id, input.name, input.duration);
    logger.info(`Started season: ${season.id}`);
    return JSON.stringify(season);
}
function rpcAdminEndSeason(ctx, logger, nk, payload) {
    const success = (0, seasons_1.endSeason)(nk);
    if (success) {
        logger.info("Ended current season");
        return JSON.stringify({ success: true });
    }
    else {
        return JSON.stringify({ success: false, message: "No active season" });
    }
}
// Debug RPC to give myself XP
function rpcDebugAddXp(ctx, logger, nk, payload) {
    if (!ctx.userId)
        throw new Error("No user ID");
    const amount = Number(payload) || 100;
    const result = (0, progression_1.addXp)(nk, ctx.userId, amount);
    return JSON.stringify(result);
}
function rpcEquipCosmetic(ctx, logger, nk, payload) {
    if (!ctx.userId)
        throw new Error("No user ID");
    let input;
    try {
        input = JSON.parse(payload);
    }
    catch (_a) {
        throw new Error("Invalid payload");
    }
    if (!input.slot || !input.cosmeticId) {
        throw new Error("Missing params: slot, cosmeticId");
    }
    const success = (0, cosmetics_1.equipCosmetic)(nk, ctx.userId, input.slot, input.cosmeticId);
    if (!success) {
        throw new Error("Failed to equip: Not owned or invalid slot");
    }
    return JSON.stringify({ success: true, slot: input.slot, id: input.cosmeticId });
}
// Placeholder for future store integration
function rpcPurchaseCosmetic(ctx, logger, nk, payload) {
    if (!ctx.userId)
        throw new Error("No user ID");
    // Future: Verify receipt (Google/Apple/Steam)
    // Future: Check virtual currency balance
    // For now: Just a stub
    return JSON.stringify({ success: false, message: "Store not implemented yet" });
}
