var CosmeticsSystem = {
    CATALOG_COLLECTION: "catalog",
    CATALOG_KEY: "cosmetics",
    INVENTORY_COLLECTION: "inventory",
    INVENTORY_KEY: "cosmetics",

    DEFAULT_COSMETICS: [
        { id: "skin_default", type: "player_skin", rarity: "common", name: "Default Skin", unlock: { type: "xp", value: 0 } },
        { id: "skin_blue", type: "player_skin", rarity: "rare", name: "Blue Team", unlock: { type: "xp", value: 2 } },
        { id: "skin_red", type: "player_skin", rarity: "rare", name: "Red Team", unlock: { type: "xp", value: 5 } },
        { id: "skin_gold", type: "player_skin", rarity: "epic", name: "Golden General", unlock: { type: "xp", value: 10 } }
    ],

    getCatalog: function(nk) {
        const objects = nk.storageRead([{
            collection: this.CATALOG_COLLECTION,
            key: this.CATALOG_KEY,
            userId: ""
        }]);

        if (objects.length > 0) {
            return objects[0].value.items;
        }

        nk.storageWrite([{
            collection: this.CATALOG_COLLECTION,
            key: this.CATALOG_KEY,
            userId: "",
            value: { items: this.DEFAULT_COSMETICS },
            permissionRead: 2,
            permissionWrite: 0
        }]);

        return this.DEFAULT_COSMETICS;
    },

    getInventory: function(nk, userId) {
        const objects = nk.storageRead([{
            collection: this.INVENTORY_COLLECTION,
            key: this.INVENTORY_KEY,
            userId: userId
        }]);

        if (objects.length > 0) {
            return objects[0].value;
        }

        return {
            owned: ["skin_default"],
            equipped: {
                player_skin: "skin_default"
            }
        };
    },

    saveInventory: function(nk, userId, inventory) {
        nk.storageWrite([{
            collection: this.INVENTORY_COLLECTION,
            key: this.INVENTORY_KEY,
            userId: userId,
            value: inventory,
            permissionRead: 1,
            permissionWrite: 0
        }]);
    },

    grantCosmetic: function(nk, userId, cosmeticId) {
        const inventory = this.getInventory(nk, userId);
        
        if (inventory.owned.indexOf(cosmeticId) !== -1) {
            return false;
        }

        inventory.owned.push(cosmeticId);
        this.saveInventory(nk, userId, inventory);
        return true;
    },

    equipCosmetic: function(nk, userId, slot, cosmeticId) {
        const inventory = this.getInventory(nk, userId);
        
        if (inventory.owned.indexOf(cosmeticId) === -1) {
            return false;
        }

        inventory.equipped[slot] = cosmeticId;
        this.saveInventory(nk, userId, inventory);
        return true;
    }
};
