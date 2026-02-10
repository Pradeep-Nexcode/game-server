import { getCatalog, grantCosmetic } from './cosmetics';

export interface PlayerProgress {
    xp: number;
    level: number;
    rewards: Reward[];
}

export interface Reward {
    type: "xp" | "cosmetic";
    id?: string; // e.g. "skin_gold_ak47"
    amount: number;
    claimedAt?: number;
}

const STORAGE_COLLECTION = "progression";
const STORAGE_KEY = "status";

// Simple level formula: Level = sqrt(XP / 100)
// XP = 100 -> Lvl 1
// XP = 400 -> Lvl 2
// XP = 900 -> Lvl 3
export function calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100));
}

export function getPlayerProgress(nk: nkruntime.Nakama, userId: string): PlayerProgress {
    const objects = nk.storageRead([{
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY,
        userId: userId
    }]);

    if (objects.length > 0) {
        return objects[0].value as PlayerProgress;
    }

    return {
        xp: 0,
        level: 0,
        rewards: []
    };
}

export function addXp(nk: nkruntime.Nakama, userId: string, amount: number): { progress: PlayerProgress, leveledUp: boolean } {
    const progress = getPlayerProgress(nk, userId);
    const oldLevel = progress.level;
    
    progress.xp += amount;
    progress.level = calculateLevel(progress.xp);

    const leveledUp = progress.level > oldLevel;

    // Grant level up rewards?
    if (leveledUp) {
        const catalog = getCatalog(nk);
        // Find cosmetics that unlock at this new level
        const rewards = catalog.filter(c => c.unlock.type === "xp" && c.unlock.value <= progress.level && c.unlock.value > oldLevel);
        
        for (const reward of rewards) {
            grantCosmetic(nk, userId, reward.id);
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
