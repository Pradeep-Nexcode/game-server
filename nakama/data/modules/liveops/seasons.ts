export interface Season {
    id: string;
    startAt: number; // timestamp
    endAt: number;   // timestamp
    isActive: boolean;
    name: string;
}

const STORAGE_COLLECTION = "liveops";
const STORAGE_KEY = "season";

export function getCurrentSeason(nk: nkruntime.Nakama): Season | null {
    const objects = nk.storageRead([{
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY,
        userId: undefined // Global (system) owner
    }]);

    if (objects.length > 0) {
        return objects[0].value as Season;
    }
    return null;
}

export function startSeason(nk: nkruntime.Nakama, id: string, name: string, durationDays: number): Season {
    const now = Date.now();
    const season: Season = {
        id: id,
        name: name,
        startAt: now,
        endAt: now + (durationDays * 24 * 60 * 60 * 1000),
        isActive: true
    };

    nk.storageWrite([{
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY,
        value: season,
        permissionRead: 2, // Public Read
        permissionWrite: 0 // No Client Write
    }]);

    return season;
}

export function endSeason(nk: nkruntime.Nakama): boolean {
    const current = getCurrentSeason(nk);
    if (!current || !current.isActive) return false;

    current.isActive = false;
    current.endAt = Date.now(); // Force end now

    nk.storageWrite([{
        collection: STORAGE_COLLECTION,
        key: STORAGE_KEY,
        value: current,
        permissionRead: 2,
        permissionWrite: 0
    }]);

    return true;
}
