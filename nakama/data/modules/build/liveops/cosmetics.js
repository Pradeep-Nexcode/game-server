"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COSMETICS = void 0;
exports.getCatalog = getCatalog;
exports.getInventory = getInventory;
exports.saveInventory = saveInventory;
exports.grantCosmetic = grantCosmetic;
exports.equipCosmetic = equipCosmetic;
const CATALOG_COLLECTION = "catalog";
const CATALOG_KEY = "cosmetics";
const INVENTORY_COLLECTION = "inventory";
const INVENTORY_KEY = "cosmetics";
// Default cosmetics
exports.DEFAULT_COSMETICS = [
    { id: "skin_default", type: "player_skin", rarity: "common", name: "Default Skin", unlock: { type: "xp", value: 0 } },
    { id: "skin_blue", type: "player_skin", rarity: "rare", name: "Blue Team", unlock: { type: "xp", value: 2 } },
    { id: "skin_red", type: "player_skin", rarity: "rare", name: "Red Team", unlock: { type: "xp", value: 5 } },
    { id: "skin_gold", type: "player_skin", rarity: "epic", name: "Golden General", unlock: { type: "xp", value: 10 } }
];
// --- CATALOG ---
function getCatalog(nk) {
    const objects = nk.storageRead([{
            collection: CATALOG_COLLECTION,
            key: CATALOG_KEY,
            userId: "" // Global
        }]);
    if (objects.length > 0) {
        return objects[0].value.items;
    }
    // Initialize if missing
    nk.storageWrite([{
            collection: CATALOG_COLLECTION,
            key: CATALOG_KEY,
            userId: "",
            value: { items: exports.DEFAULT_COSMETICS },
            permissionRead: 2, // Public Read
            permissionWrite: 0 // No Client Write
        }]);
    return exports.DEFAULT_COSMETICS;
}
// --- INVENTORY ---
function getInventory(nk, userId) {
    const objects = nk.storageRead([{
            collection: INVENTORY_COLLECTION,
            key: INVENTORY_KEY,
            userId: userId
        }]);
    if (objects.length > 0) {
        return objects[0].value;
    }
    // Default inventory
    return {
        owned: ["skin_default"],
        equipped: {
            player_skin: "skin_default"
        }
    };
}
function saveInventory(nk, userId, inventory) {
    nk.storageWrite([{
            collection: INVENTORY_COLLECTION,
            key: INVENTORY_KEY,
            userId: userId,
            value: inventory,
            permissionRead: 1, // Owner Read
            permissionWrite: 0 // Server Write Only
        }]);
}
function grantCosmetic(nk, userId, cosmeticId) {
    const inventory = getInventory(nk, userId);
    if (inventory.owned.indexOf(cosmeticId) !== -1) {
        return false; // Already owned
    }
    inventory.owned.push(cosmeticId);
    saveInventory(nk, userId, inventory);
    return true;
}
function equipCosmetic(nk, userId, slot, cosmeticId) {
    const inventory = getInventory(nk, userId);
    const catalog = getCatalog(nk);
    // 1. Check ownership
    if (inventory.owned.indexOf(cosmeticId) === -1) {
        return false;
    }
    // 2. Check type compatibility
    const item = catalog.find(c => c.id === cosmeticId);
    if (!item || item.type !== slot) {
        return false;
    }
    // 3. Equip
    inventory.equipped[slot] = cosmeticId;
    saveInventory(nk, userId, inventory);
    return true;
}
