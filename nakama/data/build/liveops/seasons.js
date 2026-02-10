"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSeason = getCurrentSeason;
exports.startSeason = startSeason;
exports.endSeason = endSeason;
const STORAGE_COLLECTION = "liveops";
const STORAGE_KEY = "season";
function getCurrentSeason(nk) {
    const objects = nk.storageRead([{
            collection: STORAGE_COLLECTION,
            key: STORAGE_KEY,
            userId: undefined // Global (system) owner
        }]);
    if (objects.length > 0) {
        return objects[0].value;
    }
    return null;
}
function startSeason(nk, id, name, durationDays) {
    const now = Date.now();
    const season = {
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
function endSeason(nk) {
    const current = getCurrentSeason(nk);
    if (!current || !current.isActive)
        return false;
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
