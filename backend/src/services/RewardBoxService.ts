import crypto from 'crypto';
import { db } from '../db/Database';
import { RewardBoxEntry } from '../types';

export interface PowerupPackDef {
  id: 'pw_boost' | 'pw_shield' | 'pw_super';
  name: string;
  shortName: string;
  description: string;
  costStars: number;
  durationSec: number;
  spriteKey: string;
}

export const POWERUP_CATALOG: PowerupPackDef[] = [
  {
    id: 'pw_boost',
    name: 'Speed Boost Charge',
    shortName: 'Boost',
    description: 'Activate in-match for +10s turbo speed surge.',
    costStars: 60,
    durationSec: 10,
    spriteKey: 'ui_bolt_wood',
  },
  {
    id: 'pw_shield',
    name: 'Guard Shield Charge',
    shortName: 'Shield',
    description: 'Activate in-match for +10s damage-blocking shield.',
    costStars: 80,
    durationSec: 10,
    spriteKey: 'ui_heart_wood',
  },
  {
    id: 'pw_super',
    name: 'Super Surge Charge',
    shortName: 'Super',
    description: 'Activate in-match for +8s giant magnet & power aura.',
    costStars: 120,
    durationSec: 8,
    spriteKey: 'farm_sunflower',
  },
];

export class RewardBoxService {
  private static rowToEntry(r: any): RewardBoxEntry {
    return {
      id: r.id,
      userId: r.user_id,
      sourceType: r.source_type as RewardBoxEntry['sourceType'],
      sourceId: r.source_id,
      title: r.title,
      stars: Number(r.stars) || 0,
      xp: Number(r.xp) || 0,
      evoXp: Number(r.evo_xp) || 0,
      tickets: Number(r.tickets) || 0,
      status: r.status === 'collected' ? 'collected' : 'unclaimed',
      createdAt: r.created_at,
      collectedAt: r.collected_at || undefined,
    };
  }

  /**
   * Idempotently deposit a completed quest/level reward into the player's Reward Box.
   * Guaranteed single deposit per (userId, sourceType, sourceId).
   */
  public static deposit(
    userId: string,
    payload: {
      sourceType: RewardBoxEntry['sourceType'];
      sourceId: string;
      title: string;
      stars: number;
      xp: number;
      evoXp: number;
      tickets?: number;
    }
  ): { inserted: boolean; entry: RewardBoxEntry } {
    const conn = db.getRawDb();
    const existing = conn.prepare(
      `SELECT * FROM player_reward_box WHERE user_id = ? AND source_type = ? AND source_id = ?`
    ).get(userId, payload.sourceType, payload.sourceId);
    if (existing) {
      return { inserted: false, entry: this.rowToEntry(existing) };
    }

    const id = `rbox_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    conn.prepare(`
      INSERT INTO player_reward_box (
        id, user_id, source_type, source_id, title, stars, xp, evo_xp, tickets, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unclaimed', ?)
    `).run(
      id,
      userId,
      payload.sourceType,
      payload.sourceId,
      payload.title,
      Math.max(0, Math.round(payload.stars || 0)),
      Math.max(0, Math.round(payload.xp || 0)),
      Math.max(0, Math.round(payload.evoXp || 0)),
      Math.max(0, Math.round(payload.tickets || 0)),
      now
    );

    const row = conn.prepare('SELECT * FROM player_reward_box WHERE id = ?').get(id);
    return { inserted: true, entry: this.rowToEntry(row) };
  }

  public static listBox(userId: string) {
    const conn = db.getRawDb();
    const rows = conn.prepare(`
      SELECT * FROM player_reward_box
      WHERE user_id = ?
      ORDER BY CASE WHEN status = 'unclaimed' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 40
    `).all(userId);
    const items = rows.map(r => this.rowToEntry(r));
    const unclaimed = items.filter(i => i.status === 'unclaimed');
    const profile = db.getProfile(userId);
    const inv = profile?.inventory || {};
    return {
      items,
      unclaimedCount: unclaimed.length,
      totals: {
        stars: unclaimed.reduce((s, i) => s + i.stars, 0),
        xp: unclaimed.reduce((s, i) => s + i.xp, 0),
        evoXp: unclaimed.reduce((s, i) => s + i.evoXp, 0),
        tickets: unclaimed.reduce((s, i) => s + i.tickets, 0),
      },
      powerups: POWERUP_CATALOG.map(p => ({
        ...p,
        owned: Number(inv[p.id] || 0),
      })),
    };
  }

  public static collectItem(userId: string, itemId: string): {
    ok: boolean;
    alreadyCollected?: boolean;
    error?: string;
    collected?: { stars: number; xp: number; evoXp: number; tickets: number };
    profile?: any;
  } {
    const conn = db.getRawDb();
    const row = conn.prepare('SELECT * FROM player_reward_box WHERE id = ? AND user_id = ?').get(itemId, userId) as any;
    if (!row) return { ok: false, error: 'Reward box item not found' };
    if (row.status === 'collected') {
      return { ok: true, alreadyCollected: true, collected: { stars: 0, xp: 0, evoXp: 0, tickets: 0 }, profile: db.getProfile(userId) };
    }

    const now = new Date().toISOString();
    const cas = conn.prepare(
      `UPDATE player_reward_box SET status = 'collected', collected_at = ? WHERE id = ? AND user_id = ? AND status = 'unclaimed'`
    ).run(now, itemId, userId);
    if ((cas.changes || 0) === 0) {
      return { ok: true, alreadyCollected: true, collected: { stars: 0, xp: 0, evoXp: 0, tickets: 0 }, profile: db.getProfile(userId) };
    }

    const entry = this.rowToEntry(row);
    const { profile } = db.grantRewards(userId, { stars: entry.stars, xp: entry.xp, evoXp: entry.evoXp });
    if (entry.tickets > 0 && profile) {
      db.updateProfile(userId, { tickets: (profile.tickets || 0) + entry.tickets });
    }
    return {
      ok: true,
      alreadyCollected: false,
      collected: { stars: entry.stars, xp: entry.xp, evoXp: entry.evoXp, tickets: entry.tickets },
      profile: db.getProfile(userId),
    };
  }

  public static collectAll(userId: string): {
    ok: boolean;
    count: number;
    collected: { stars: number; xp: number; evoXp: number; tickets: number };
    profile?: any;
  } {
    const conn = db.getRawDb();
    const rows = conn.prepare(`SELECT * FROM player_reward_box WHERE user_id = ? AND status = 'unclaimed'`).all(userId) as any[];
    if (!rows.length) {
      return { ok: true, count: 0, collected: { stars: 0, xp: 0, evoXp: 0, tickets: 0 }, profile: db.getProfile(userId) };
    }
    const now = new Date().toISOString();
    const ids = rows.map(r => r.id);
    let stars = 0, xp = 0, evoXp = 0, tickets = 0, count = 0;
    const upd = conn.prepare(`UPDATE player_reward_box SET status = 'collected', collected_at = ? WHERE id = ? AND user_id = ? AND status = 'unclaimed'`);
    for (const r of rows) {
      const res = upd.run(now, r.id, userId);
      if ((res.changes || 0) > 0) {
        count++;
        stars += Number(r.stars) || 0;
        xp += Number(r.xp) || 0;
        evoXp += Number(r.evo_xp) || 0;
        tickets += Number(r.tickets) || 0;
      }
    }
    if (count > 0) {
      const { profile } = db.grantRewards(userId, { stars, xp, evoXp });
      if (tickets > 0 && profile) {
        db.updateProfile(userId, { tickets: (profile.tickets || 0) + tickets });
      }
    }
    void ids;
    return {
      ok: true,
      count,
      collected: { stars, xp, evoXp, tickets },
      profile: db.getProfile(userId),
    };
  }

  public static purchasePowerup(userId: string, powerupId: string): {
    ok: boolean;
    error?: string;
    message?: string;
    powerup?: PowerupPackDef;
    owned?: number;
    profile?: any;
  } {
    const pack = POWERUP_CATALOG.find(p => p.id === powerupId);
    if (!pack) return { ok: false, error: 'Unknown power-up pack' };
    const profile = db.getProfile(userId);
    if (!profile) return { ok: false, error: 'Profile not found' };
    if ((profile.stars || 0) < pack.costStars) {
      return { ok: false, error: `Need ${pack.costStars} Stars to buy ${pack.name}` };
    }
    const inv = { ...(profile.inventory || {}) };
    inv[pack.id] = (Number(inv[pack.id]) || 0) + 1;
    const updated = db.updateProfile(userId, {
      stars: profile.stars - pack.costStars,
      inventory: inv,
    });
    return {
      ok: true,
      message: `Purchased ${pack.name} (×${inv[pack.id]} owned)`,
      powerup: pack,
      owned: inv[pack.id],
      profile: updated,
    };
  }

  public static consumePowerup(userId: string, powerupId: string): {
    ok: boolean;
    error?: string;
    powerup?: PowerupPackDef;
    remaining?: number;
    profile?: any;
  } {
    const pack = POWERUP_CATALOG.find(p => p.id === powerupId);
    if (!pack) return { ok: false, error: 'Unknown power-up' };
    const profile = db.getProfile(userId);
    if (!profile) return { ok: false, error: 'Profile not found' };
    const inv = { ...(profile.inventory || {}) };
    const cur = Number(inv[pack.id]) || 0;
    if (cur < 1) return { ok: false, error: `No ${pack.shortName} charges in inventory` };
    inv[pack.id] = cur - 1;
    const updated = db.updateProfile(userId, { inventory: inv });
    return { ok: true, powerup: pack, remaining: inv[pack.id], profile: updated };
  }
}
