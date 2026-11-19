import { db } from '../db/Database';
import { gameConfig, skinById, SkinDef, accessoryById, AccessoryDef } from '../config/GameConfig';

// Server-authoritative cosmetics & inventory economy.
export interface ShopSkinView extends SkinDef {
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  levelMet: boolean;
  purchasable: boolean;
}

export interface ShopAccessoryView extends AccessoryDef {
  owned: boolean;
  equipped: boolean;
  affordable: boolean;
  levelMet: boolean;
  purchasable: boolean;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
  profile?: any;
  skinId?: string;
  accessoryId?: string;
}

export class EconomyService {
  public static getCatalog(userId?: string): { skins: ShopSkinView[]; starterSkins: string[] } {
    const profile = userId ? db.getProfile(userId) : undefined;
    const owned = new Set(profile?.unlockedSkins || gameConfig.cosmetics.starterSkins);
    const stars = profile?.stars ?? 0;
    const tickets = profile?.tickets ?? 0;
    const level = profile?.level ?? 1;

    const skins = gameConfig.cosmetics.skins.map((s): ShopSkinView => {
      const isOwned = owned.has(s.id);
      const affordable = stars >= s.costStars && tickets >= s.costTickets;
      const levelMet = level >= s.minLevel;
      return {
        ...s,
        owned: isOwned,
        equipped: profile?.equippedSkin === s.id,
        affordable,
        levelMet,
        purchasable: !isOwned && affordable && levelMet,
      };
    });
    return { skins, starterSkins: gameConfig.cosmetics.starterSkins };
  }

  public static getAccessoryCatalog(userId?: string): { accessories: ShopAccessoryView[]; starterAccessories: string[] } {
    const profile = userId ? db.getProfile(userId) : undefined;
    const owned = new Set(profile?.unlockedAccessories || gameConfig.cosmetics.starterAccessories);
    const stars = profile?.stars ?? 0;
    const tickets = profile?.tickets ?? 0;
    const level = profile?.level ?? 1;

    const accessories = gameConfig.cosmetics.accessories.map((a): ShopAccessoryView => {
      const isOwned = owned.has(a.id);
      const affordable = stars >= a.costStars && tickets >= a.costTickets;
      const levelMet = level >= a.minLevel;
      return {
        ...a,
        owned: isOwned,
        equipped: profile?.equippedAccessory === a.id,
        affordable,
        levelMet,
        purchasable: !isOwned && affordable && levelMet,
      };
    });
    return { accessories, starterAccessories: gameConfig.cosmetics.starterAccessories };
  }

  public static ownsSkin(userId: string, skinId: string): boolean {
    const profile = db.getProfile(userId);
    if (!profile) return false;
    const owned = profile.unlockedSkins?.length ? profile.unlockedSkins : gameConfig.cosmetics.starterSkins;
    return owned.includes(skinId);
  }

  public static ownsAccessory(userId: string, accessoryId: string): boolean {
    const profile = db.getProfile(userId);
    if (!profile) return false;
    const owned = profile.unlockedAccessories?.length ? profile.unlockedAccessories : gameConfig.cosmetics.starterAccessories;
    return owned.includes(accessoryId);
  }

  public static purchaseSkin(userId: string, skinId: string): PurchaseResult {
    const skin = skinById(skinId);
    if (!skin) return { success: false, message: 'Unknown skin' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Player profile not found' };

    const owned = profile.unlockedSkins || [];
    if (owned.includes(skinId)) return { success: false, message: `You already own ${skin.name}` };
    if (profile.level < skin.minLevel) return { success: false, message: `${skin.name} unlocks at level ${skin.minLevel}` };
    if (profile.stars < skin.costStars || profile.tickets < skin.costTickets) {
      return { success: false, message: `Not enough ${profile.stars < skin.costStars ? 'stars' : 'tickets'}` };
    }

    const updated = db.updateProfile(userId, {
      stars: profile.stars - skin.costStars,
      tickets: profile.tickets - skin.costTickets,
      unlockedSkins: [...owned, skinId],
    });
    return { success: true, message: `Unlocked ${skin.name}!`, profile: updated, skinId };
  }

  public static equipSkin(userId: string, skinId: string): PurchaseResult {
    if (!skinById(skinId)) return { success: false, message: 'Unknown skin' };
    if (!this.ownsSkin(userId, skinId)) return { success: false, message: 'You do not own that skin' };
    const updated = db.updateProfile(userId, { equippedSkin: skinId });
    if (!updated) return { success: false, message: 'Player profile not found' };
    return { success: true, message: `Equipped ${skinId}`, profile: updated, skinId };
  }

  public static purchaseAccessory(userId: string, accessoryId: string): PurchaseResult {
    const acc = accessoryById(accessoryId);
    if (!acc) return { success: false, message: 'Unknown accessory' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Player profile not found' };

    const owned = profile.unlockedAccessories?.length
      ? profile.unlockedAccessories
      : [...gameConfig.cosmetics.starterAccessories];
    if (owned.includes(accessoryId)) return { success: false, message: `You already own ${acc.name}` };
    if (profile.level < acc.minLevel) return { success: false, message: `${acc.name} unlocks at level ${acc.minLevel}` };
    if (profile.stars < acc.costStars || profile.tickets < acc.costTickets) {
      return { success: false, message: `Not enough ${profile.stars < acc.costStars ? 'stars' : 'tickets'}` };
    }

    const updated = db.updateProfile(userId, {
      stars: profile.stars - acc.costStars,
      tickets: profile.tickets - acc.costTickets,
      unlockedAccessories: [...owned, accessoryId],
    });
    return { success: true, message: `Unlocked ${acc.name}!`, profile: updated, accessoryId };
  }

  public static equipAccessory(userId: string, accessoryId: string): PurchaseResult {
    if (!accessoryId || accessoryId === 'none') {
      const updated = db.updateProfile(userId, { equippedAccessory: undefined });
      if (!updated) return { success: false, message: 'Player profile not found' };
      return { success: true, message: 'Accessory removed', profile: updated, accessoryId: undefined };
    }
    const acc = accessoryById(accessoryId);
    if (!acc) return { success: false, message: 'Unknown accessory' };
    if (!this.ownsAccessory(userId, accessoryId)) return { success: false, message: `You do not own ${acc.name}` };
    const updated = db.updateProfile(userId, { equippedAccessory: accessoryId });
    if (!updated) return { success: false, message: 'Player profile not found' };
    return { success: true, message: `Equipped ${acc.name}`, profile: updated, accessoryId };
  }

  /** Hatch an egg or open a treasure chest from the player's inventory. */
  public static openInventoryItem(
    userId: string,
    itemId: string
  ): { success: boolean; message: string; rewards?: { stars: number; tickets: number; unlockedAccessory?: string; unlockedSkin?: string }; profile?: any } {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Player profile not found' };

    const inv = { ...(profile.inventory || {}) };
    const count = inv[itemId] || 0;
    if (count < 1) return { success: false, message: `You don't have any ${itemId} left` };

    if (!['rare_egg', 'mystery_egg', 'golden_chest'].includes(itemId)) {
      return { success: false, message: 'This item cannot be opened directly' };
    }

    inv[itemId] = count - 1;
    if (inv[itemId] <= 0) delete inv[itemId];

    let stars = 0;
    let tickets = 0;
    let unlockedAccessory: string | undefined;
    let unlockedSkin: string | undefined;
    let label = '';

    const ownedAcc = new Set(profile.unlockedAccessories || gameConfig.cosmetics.starterAccessories);
    const lockedAccs = gameConfig.cosmetics.accessories.filter(a => !ownedAcc.has(a.id));
    const ownedSkins = new Set(profile.unlockedSkins || gameConfig.cosmetics.starterSkins);
    const lockedSkins = gameConfig.cosmetics.skins.filter(s => !ownedSkins.has(s.id) && s.costTickets === 0);

    if (itemId === 'rare_egg') {
      stars = 250 + Math.floor(Math.random() * 250);
      tickets = 2;
      if (lockedAccs.length > 0 && Math.random() < 0.45) {
        const pick = lockedAccs[Math.floor(Math.random() * lockedAccs.length)];
        unlockedAccessory = pick.id;
        ownedAcc.add(pick.id);
      }
      label = 'Hatched Rare Egg';
    } else if (itemId === 'mystery_egg') {
      stars = 500 + Math.floor(Math.random() * 400);
      tickets = 3 + Math.floor(Math.random() * 3);
      if (lockedAccs.length > 0) {
        const pick = lockedAccs[Math.floor(Math.random() * lockedAccs.length)];
        unlockedAccessory = pick.id;
        ownedAcc.add(pick.id);
      }
      label = 'Hatched Mystery Egg';
    } else {
      stars = 750 + Math.floor(Math.random() * 500);
      tickets = 5;
      if (lockedSkins.length > 0) {
        const pick = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
        unlockedSkin = pick.id;
        ownedSkins.add(pick.id);
      } else if (lockedAccs.length > 0) {
        const pick = lockedAccs[Math.floor(Math.random() * lockedAccs.length)];
        unlockedAccessory = pick.id;
        ownedAcc.add(pick.id);
      }
      label = 'Opened Golden Chest';
    }

    const updated = db.updateProfile(userId, {
      inventory: inv,
      stars: profile.stars + stars,
      tickets: profile.tickets + tickets,
      unlockedAccessories: Array.from(ownedAcc),
      unlockedSkins: Array.from(ownedSkins),
    });

    const bonusParts = [`+${stars}★`, `+${tickets}🎟️`];
    if (unlockedAccessory) bonusParts.push(`Accessory: ${unlockedAccessory}`);
    if (unlockedSkin) bonusParts.push(`Skin: ${unlockedSkin}`);

    return {
      success: true,
      message: `${label}: ${bonusParts.join(' · ')}`,
      rewards: { stars, tickets, unlockedAccessory, unlockedSkin },
      profile: updated,
    };
  }
}
