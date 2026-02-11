var MMRSystem = {
    STORAGE_COLLECTION: "player_profiles",
    STORAGE_KEY: "profile",

    getPlayerProfile: function(nk, userId) {
        const objects = nk.storageRead([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
            userId: userId
        }]);

        if (objects.length > 0) {
            const profile = objects[0].value;
            if (!profile.seasonMmr) profile.seasonMmr = {};
            return profile;
        }

        return {
            userId: userId,
            mmr: 1000,
            region: "us",
            seasonMmr: {}
        };
    },

    updatePlayerMMR: function(nk, userId, delta, seasonId) {
        const profile = this.getPlayerProfile(nk, userId);
        
        profile.mmr += delta;

        if (seasonId) {
            if (!profile.seasonMmr[seasonId]) {
                 profile.seasonMmr[seasonId] = 1000;
            }
            profile.seasonMmr[seasonId] += delta;
        }
        
        nk.storageWrite([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
            userId: userId,
            value: profile,
            permissionRead: 1,
            permissionWrite: 0
        }]);
    }
};
