"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLevel = calculateLevel;
exports.getPlayerProgress = getPlayerProgress;
exports.addXp = addXp;
const cosmetics_1 = require("./cosmetics");
const STORAGE_COLLECTION = "progression";
const STORAGE_KEY = "status";
// Simple level formula: Level = sqrt(XP / 100)
// XP = 100 -> Lvl 1
// XP = 400 -> Lvl 2
// XP = 900 -> Lvl 3
function calculateLevel(xp) {
    return Math.floor(Math.sqrt(xp / 100));
}
function getPlayerProgress(nk, userId) {
    const objects = nk.storageRead([{
            collection: STORAGE_COLLECTION,
            key: STORAGE_KEY,
            userId: userId
        }]);
    if (objects.length > 0) {
        return objects[0].value;
    }
    return {
        xp: 0,
        level: 0,
        rewards: []
    };
}
function addXp(nk, userId, amount) {
    const progress = getPlayerProgress(nk, userId);
    const oldLevel = progress.level;
    progress.xp += amount;
    progress.level = calculateLevel(progress.xp);
    const leveledUp = progress.level > oldLevel;
    // Grant level up rewards?
    if (leveledUp) {
        const catalog = (0, cosmetics_1.getCatalog)(nk);
        // Find cosmetics that unlock at this new level
        const rewards = catalog.filter(c => c.unlock.type === "xp" && c.unlock.value <= progress.level && c.unlock.value > oldLevel);
        for (const reward of rewards) {
            (0, cosmetics_1.grantCosmetic)(nk, userId, reward.id);
            progress.rewards.push({
                type: "cosmetic",
                id: reward.id,
                amount: 1,
                claimedAt: Date.now()
            });
        }
    }
    nk.storageWrite([{
            collection: STORAGE_COLLECTION,
            key: STORAGE_KEY,
            userId: userId,
            value: progress,
            permissionRead: 1, // Owner Read
            permissionWrite: 0 // Server Write Only
        }]);
    return { progress, leveledUp };
}
