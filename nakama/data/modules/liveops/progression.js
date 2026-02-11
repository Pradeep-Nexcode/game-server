var ProgressionSystem = {
    STORAGE_COLLECTION: "progression",
    STORAGE_KEY: "status",

    calculateLevel: function(xp) {
        return Math.floor(Math.sqrt(xp / 100));
    },

    getPlayerProgress: function(nk, userId) {
        const objects = nk.storageRead([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
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
    },

    addXp: function(nk, userId, amount) {
        const progress = this.getPlayerProgress(nk, userId);
        const oldLevel = progress.level;
        
        progress.xp += amount;
        progress.level = this.calculateLevel(progress.xp);

        const leveledUp = progress.level > oldLevel;

        if (leveledUp) {
            const catalog = CosmeticsSystem.getCatalog(nk);
            const rewards = catalog.filter(c => c.unlock.type === "xp" && c.unlock.value <= progress.level && c.unlock.value > oldLevel);
            
            for (const reward of rewards) {
                CosmeticsSystem.grantCosmetic(nk, userId, reward.id);
                progress.rewards.push({
                    type: "cosmetic",
                    id: reward.id,
                    amount: 1,
                    claimedAt: Date.now()
                });
            }
        }

        nk.storageWrite([{
            collection: this.STORAGE_COLLECTION,
            key: this.STORAGE_KEY,
            userId: userId,
            value: progress,
            permissionRead: 1,
            permissionWrite: 0
        }]);

        return { progress, leveledUp };
    }
};
