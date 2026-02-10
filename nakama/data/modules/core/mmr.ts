export interface PlayerProfile {
    userId: string;
    mmr: number; // Current/Global MMR
    region: string;
    seasonMmr: { [seasonId: string]: number }; // MMR per season
}

const STORAGE_COLLECTION = "player_profiles";
const STORAGE_KEY = "profile";

export function getPlayerProfile(nk: nkruntime.Nakama, userId: string): PlayerProfile {
    const objects = nk.storageRead([{
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY,
        userId: userId
    }]);

    if (objects.length > 0) {
        const profile = objects[0].value as PlayerProfile;
        // Migration safety
        if (!profile.seasonMmr) profile.seasonMmr = {};
        return profile;
    }

    // Default profile
    return {
        userId: userId,
        mmr: 1000,
        region: "us", // Default region
        seasonMmr: {}
    };
}

export function updatePlayerMMR(nk: nkruntime.Nakama, userId: string, delta: number, seasonId?: string) {
    const profile = getPlayerProfile(nk, userId);
    
    // Update Global MMR
    profile.mmr += delta;

    // Update Season MMR if active
    if (seasonId) {
        if (!profile.seasonMmr[seasonId]) {
             profile.seasonMmr[seasonId] = 1000; // Start fresh for season
        }
        profile.seasonMmr[seasonId] += delta;
    }
    
    // Write back
    nk.storageWrite([{
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY,
        userId: userId,
        value: profile,
        permissionRead: 1, // Owner read
        permissionWrite: 0 // Server auth only
    }]);
}
