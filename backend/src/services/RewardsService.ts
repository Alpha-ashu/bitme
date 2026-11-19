import { db, RewardCatalogRow } from '../db/Database';
import { CouponReward } from '../types';

export type RewardCategory = 'giftcard' | 'merch' | 'cosmetic' | 'eventpass' | 'partner';

export interface RewardItem {
  id: string;
  title: string;
  category: RewardCategory;
  icon: string;
  baseStarCost: number;
  regions: string[] | 'all';
  stock: number;               // -1 = unlimited
  minLevel: number;
  provider: string;
  description: string;
  enabled?: boolean;
}

export interface RewardView extends RewardItem {
  starCost: number;
  available: boolean;
  soldOut: boolean;
}

export class RewardsService {
  private static dynamicCost(item: RewardItem): number {
    if (item.stock < 0) return item.baseStarCost;
    const scarcity = item.stock <= 5 ? 1.3 : item.stock <= 15 ? 1.12 : 1.0;
    return Math.round(item.baseStarCost * scarcity);
  }

  private static inRegion(item: RewardItem, region: string): boolean {
    return item.regions === 'all' || item.regions.includes(region);
  }

  public static getCatalog(region: string = 'Global', includeDisabled = false): { region: string; items: RewardView[] } {
    const rows = db.listRewardsCatalog(includeDisabled);
    const items = rows.map((item) => ({
      ...item,
      starCost: this.dynamicCost(item),
      soldOut: item.stock === 0,
      available: item.enabled && this.inRegion(item, region) && item.stock !== 0,
    }));
    return { region, items };
  }

  private static voucherCode(): string {
    return 'AP-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  public static redeem(userId: string, itemId: string, region: string = 'Global'): { success: boolean; message: string; voucher?: CouponReward; profile?: any } {
    const item = db.getRewardItem(itemId);
    if (!item || !item.enabled) return { success: false, message: 'Reward not found' };
    if (!this.inRegion(item, region)) return { success: false, message: 'Not available in your region' };
    if (item.stock === 0) return { success: false, message: 'Out of stock' };

    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    if (profile.level < item.minLevel) return { success: false, message: `Requires account level ${item.minLevel}` };

    const cost = this.dynamicCost(item);
    if (profile.stars < cost) return { success: false, message: 'Not enough Stars' };

    if (item.stock > 0 && !db.decrementRewardStock(item.id)) {
      return { success: false, message: 'Out of stock' };
    }

    const voucher: CouponReward = {
      id: `rdm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      storeName: item.title,
      discountText: `Redeemed via ${item.provider}`,
      promoCode: this.voucherCode(),
      expiryDate: '2026-12-31',
      icon: item.icon,
    };
    const updated = db.updateProfile(userId, {
      stars: profile.stars - cost,
      coupons: [...(profile.coupons || []), voucher],
    });

    return { success: true, message: `Redeemed “${item.title}” — voucher ${voucher.promoCode}`, voucher, profile: updated };
  }

  public static upsertCatalogItem(item: Omit<RewardCatalogRow, 'updatedAt'> & { updatedAt?: string }): RewardCatalogRow {
    const full: RewardCatalogRow = {
      ...item,
      updatedAt: new Date().toISOString(),
    };
    db.upsertRewardItem(full);
    return full;
  }
}
