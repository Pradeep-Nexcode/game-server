export interface CosmeticItem {
    id: string;
    type: "player_skin" | "weapon_skin" | "emote";
    rarity: "common" | "rare" | "epic";
    name: string;
    unlock: {
        type: "xp" | "season" | "purchase";
        value: number; // level / season_rank / price
    };
}

export interface PlayerInventory {
    owned: string[];        // cosmetic IDs
    equipped: {
        player_skin?: string;
        weapon_skin?: string;
        emote?: string;
    };
}

const CATALOG_COLLECTION = "catalog";
const CATALOG_KEY = "cosmetics";

const INVENTORY_COLLECTION = "inventory";
const INVENTORY_KEY = "cosmetics";

// Default cosmetics
export const DEFAULT_COSMETICS: CosmeticItem[] = [
    { id: "skin_default", type: "player_skin", rarity: "common", name: "Default Skin", unlock: { type: "xp", value: 0 } },
    { id: "skin_blue", type: "player_skin", rarity: "rare", name: "Blue Team", unlock: { type: "xp", value: 2 } },
    { id: "skin_red", type: "player_skin", rarity: "rare", name: "Red Team", unlock: { type: "xp", value: 5 } },
    { id: "skin_gold", type: "player_skin", rarity: "epic", name: "Golden General", unlock: { type: "xp", value: 10 } }
];

// --- CATALOG ---

export function getCatalog(nk: nkruntime.Nakama): CosmeticItem[] {
    const objects = nk.storageRead([{
        collection: CATALOG_COLLECTION,
        key: CATALOG_KEY,
        userId: "" // Global
    }]);

    if (objects.length > 0) {
        return objects[0].value.items as CosmeticItem[];
    }

    // Initialize if missing
    nk.storageWrite([{
        collection: CATALOG_COLLECTION,
        key: CATALOG_KEY,
        userId: "",
        value: { items: DEFAULT_COSMETICS },
        permissionRead: 2, // Public Read
        permissionWrite: 0 // No Client Write
    }]);

    return DEFAULT_COSMETICS;
}

// --- INVENTORY ---

export function getInventory(nk: nkruntime.Nakama, userId: string): PlayerInventory {
    const objects = nk.storageRead([{
        collection: INVENTORY_COLLECTION,
        key: INVENTORY_KEY,
        userId: userId
    }]);

    if (objects.length > 0) {
        return objects[0].value as PlayerInventory;
    }

    // Default inventory
    return {
        owned: ["skin_default"],
        equipped: {
            player_skin: "skin_default"
        }
    };
}

export function saveInventory(nk: nkruntime.Nakama, userId: string, inventory: PlayerInventory) {
    nk.storageWrite([{
        collection: INVENTORY_COLLECTION,
        key: INVENTORY_KEY,
        userId: userId,
        value: inventory,
        permissionRead: 1, // Owner Read
        permissionWrite: 0 // Server Write Only
    }]);
}

export function grantCosmetic(nk: nkruntime.Nakama, userId: string, cosmeticId: string): boolean {
    const inventory = getInventory(nk, userId);
    
    if (inventory.owned.indexOf(cosmeticId) !== -1) {
        return false; // Already owned
    }

    inventory.owned.push(cosmeticId);
    saveInventory(nk, userId, inventory);
    return true;
}

export function equipCosmetic(nk: nkruntime.Nakama, userId: string, slot: "player_skin" | "weapon_skin" | "emote", cosmeticId: string): boolean {
    const inventory = getInventory(nk, userId);
    const catalog = getCatalog(nk);
    
    // 1. Check ownership
    if (inventory.owned.indexOf(cosmeticId) === -1) {
        return false;
    }

    // 2. Check type compatibility
    const item = catalog.find((c: CosmeticItem) => c.id === cosmeticId);
    if (!item || item.type !== slot) {
        return false;
    }

    // 3. Equip
    inventory.equipped[slot] = cosmeticId;
    saveInventory(nk, userId, inventory);
    return true;
}
