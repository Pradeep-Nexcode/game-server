import { startSeason, endSeason } from './seasons';
import { addXp } from './progression';
import { equipCosmetic } from './cosmetics';

// Admin RPCs (Should be protected in production via check for admin ID or similar)
// For now, we assume these are called by a trusted client or console.

export function rpcAdminStartSeason(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    // Simple admin check: In real app, check ctx.userId against a list or use API key logic if http key
    // For demo, we just allow it.
    
    let input: any;
    try {
        input = JSON.parse(payload);
    } catch {
        throw new Error("Invalid payload");
    }

    if (!input.id || !input.name || !input.duration) {
        throw new Error("Missing params: id, name, duration");
    }

    const season = startSeason(nk, input.id, input.name, input.duration);
    logger.info(`Started season: ${season.id}`);
    
    return JSON.stringify(season);
}

export function rpcAdminEndSeason(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    const success = endSeason(nk);
    if (success) {
        logger.info("Ended current season");
        return JSON.stringify({ success: true });
    } else {
        return JSON.stringify({ success: false, message: "No active season" });
    }
}

// Debug RPC to give myself XP
export function rpcDebugAddXp(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw new Error("No user ID");
    
    const amount = Number(payload) || 100;
    const result = addXp(nk, ctx.userId, amount);
    
    return JSON.stringify(result);
}

export function rpcEquipCosmetic(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw new Error("No user ID");

    let input: any;
    try {
        input = JSON.parse(payload);
    } catch {
        throw new Error("Invalid payload");
    }

    if (!input.slot || !input.cosmeticId) {
        throw new Error("Missing params: slot, cosmeticId");
    }

    const success = equipCosmetic(nk, ctx.userId, input.slot, input.cosmeticId);
    if (!success) {
        throw new Error("Failed to equip: Not owned or invalid slot");
    }

    return JSON.stringify({ success: true, slot: input.slot, id: input.cosmeticId });
}

// Placeholder for future store integration
export function rpcPurchaseCosmetic(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
    if (!ctx.userId) throw new Error("No user ID");
    
    // Future: Verify receipt (Google/Apple/Steam)
    // Future: Check virtual currency balance
    
    // For now: Just a stub
    return JSON.stringify({ success: false, message: "Store not implemented yet" });
}
