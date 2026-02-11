var SeasonsSystem = {
    STORAGE_COLLECTION: "liveops",
    STORAGE_KEY: "season",

    getCurrentSeason: function(nk) {
        const objects = nk.storageRead([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
            userId: ""
        }]);

        if (objects.length > 0) {
            return objects[0].value;
        }
        return null;
    },

    startSeason: function(nk, id, name, durationDays) {
        const now = Date.now();
        const season = {
            id: id,
            name: name,
            startAt: now,
            endAt: now + (durationDays * 24 * 60 * 60 * 1000),
            isActive: true
        };

        nk.storageWrite([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
            value: season,
            permissionRead: 2,
            permissionWrite: 0
        }]);

        return season;
    },

    endSeason: function(nk) {
        const current = this.getCurrentSeason(nk);
        if (!current || !current.isActive) return false;

        current.isActive = false;
        current.endAt = Date.now();

        nk.storageWrite([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
            value: current,
            permissionRead: 2,
            permissionWrite: 0
        }]);

        return true;
    }
};
