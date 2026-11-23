import { db } from '../db/Database';
import { HeartState } from '../types';

export const MAX_HEARTS = 5;
export const HEART_RESTORE_INTERVAL_SEC = 15 * 60; // 15 minutes per heart
export const HEART_RESTORE_INTERVAL_MS = HEART_RESTORE_INTERVAL_SEC * 1000;
export const HEART_SHARDS_PER_RECHARGE = 30; // Collect 30 in-game hearts to recharge 1 full heart

interface HeartRow {
  user_id: string;
  hearts: number;
  max_hearts: number;
  heart_shards: number;
  next_restore_anchor_ms: number;
  updated_at: string;
}

/**
 * Server-authoritative 5-Heart life & recharge engine:
 * - Max 5 hearts.
 * - Wrong quiz answers deduct 1 heart (min 0).
 * - Missing hearts automatically restore 1 every 15 minutes (lazy real-time calculation).
 * - Collecting 30 in-game heart pickups immediately recharges +1 full heart.
 */
export class HeartService {
  private static hasUserRow(userId: string): boolean {
    const conn = db.getRawDb();
    return !!conn.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
  }

  private static ensureRow(userId: string, nowMs: number): HeartRow | null {
    const conn = db.getRawDb();
    let row = conn.prepare('SELECT * FROM player_hearts WHERE user_id = ?').get(userId) as HeartRow | undefined;
    if (!row) {
      if (!this.hasUserRow(userId)) return null;
      const nowIso = new Date(nowMs).toISOString();
      conn.prepare(`
        INSERT OR IGNORE INTO player_hearts (
          user_id, hearts, max_hearts, heart_shards, next_restore_anchor_ms, updated_at
        ) VALUES (?, ?, ?, 0, 0, ?)
      `).run(userId, MAX_HEARTS, MAX_HEARTS, nowIso);
      row = conn.prepare('SELECT * FROM player_hearts WHERE user_id = ?').get(userId) as HeartRow | undefined;
    }
    return row || null;
  }

  private static saveRow(
    userId: string,
    hearts: number,
    heartShards: number,
    anchorMs: number,
    nowMs: number
  ): void {
    if (!this.hasUserRow(userId)) return;
    const conn = db.getRawDb();
    conn.prepare(`
      INSERT INTO player_hearts (user_id, hearts, max_hearts, heart_shards, next_restore_anchor_ms, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        hearts = excluded.hearts,
        max_hearts = excluded.max_hearts,
        heart_shards = excluded.heart_shards,
        next_restore_anchor_ms = excluded.next_restore_anchor_ms,
        updated_at = excluded.updated_at
    `).run(userId, hearts, MAX_HEARTS, heartShards, anchorMs, new Date(nowMs).toISOString());
  }

  private static toState(hearts: number, heartShards: number, anchorMs: number, nowMs: number): HeartState {
    const clampedHearts = Math.max(0, Math.min(MAX_HEARTS, hearts));
    const isFull = clampedHearts >= MAX_HEARTS;
    const nextRestoreAtMs = (!isFull && anchorMs > 0) ? (anchorMs + HEART_RESTORE_INTERVAL_MS) : 0;
    const nextRestoreInSec = (!isFull && nextRestoreAtMs > nowMs)
      ? Math.max(1, Math.ceil((nextRestoreAtMs - nowMs) / 1000))
      : 0;
    return {
      hearts: clampedHearts,
      maxHearts: MAX_HEARTS,
      heartShards: Math.max(0, Math.min(HEART_SHARDS_PER_RECHARGE, heartShards)),
      shardsRequired: HEART_SHARDS_PER_RECHARGE,
      restoreIntervalSec: HEART_RESTORE_INTERVAL_SEC,
      nextRestoreInSec,
      nextRestoreAtMs,
    };
  }

  /**
   * Read current heart status, lazily applying any completed 15-minute restores.
   */
  public static getHeartState(userId: string, nowMs = Date.now()): HeartState {
    const row = this.ensureRow(userId, nowMs);
    if (!row) return this.toState(MAX_HEARTS, 0, 0, nowMs);
    let hearts = Math.max(0, Math.min(MAX_HEARTS, Number(row.hearts)));
    let shards = Math.max(0, Number(row.heart_shards) || 0);
    let anchorMs = Math.max(0, Number(row.next_restore_anchor_ms) || 0);
    let dirty = false;

    if (hearts < MAX_HEARTS) {
      if (anchorMs <= 0) {
        anchorMs = nowMs;
        dirty = true;
      } else {
        const elapsed = Math.max(0, nowMs - anchorMs);
        const restored = Math.floor(elapsed / HEART_RESTORE_INTERVAL_MS);
        if (restored > 0) {
          hearts = Math.min(MAX_HEARTS, hearts + restored);
          anchorMs = hearts >= MAX_HEARTS ? 0 : anchorMs + restored * HEART_RESTORE_INTERVAL_MS;
          dirty = true;
        }
      }
    } else if (anchorMs !== 0) {
      anchorMs = 0;
      dirty = true;
    }

    // If a player somehow has >= 30 banked shards while missing a heart, consume immediately
    while (shards >= HEART_SHARDS_PER_RECHARGE && hearts < MAX_HEARTS) {
      shards -= HEART_SHARDS_PER_RECHARGE;
      hearts += 1;
      if (hearts >= MAX_HEARTS) anchorMs = 0;
      dirty = true;
    }

    if (dirty) {
      this.saveRow(userId, hearts, shards, anchorMs, nowMs);
    }
    return this.toState(hearts, shards, anchorMs, nowMs);
  }

  /**
   * Deduct 1 (or more) hearts — called server-side when the player gives a wrong quiz answer.
   * Starts the 15-minute restore timer when transitioning below max hearts.
   */
  public static deductHeart(
    userId: string,
    amount = 1,
    nowMs = Date.now()
  ): { state: HeartState; deducted: number } {
    const cur = this.getHeartState(userId, nowMs);
    const row = this.ensureRow(userId, nowMs);
    if (!row) return { state: cur, deducted: 0 };
    const before = cur.hearts;
    const after = Math.max(0, before - Math.max(1, Math.round(amount)));
    const deducted = before - after;
    let anchorMs = Math.max(0, Number(row.next_restore_anchor_ms) || 0);

    if (after < MAX_HEARTS) {
      if (before >= MAX_HEARTS || anchorMs <= 0) {
        anchorMs = nowMs;
      }
    } else {
      anchorMs = 0;
    }

    this.saveRow(userId, after, cur.heartShards, anchorMs, nowMs);
    return {
      state: this.toState(after, cur.heartShards, anchorMs, nowMs),
      deducted,
    };
  }

  /**
   * Add 1 (or more) hearts — e.g. from watching a rewarded revive ad or special item.
   */
  public static addHeart(
    userId: string,
    amount = 1,
    nowMs = Date.now()
  ): { state: HeartState; added: number } {
    const cur = this.getHeartState(userId, nowMs);
    const row = this.ensureRow(userId, nowMs);
    if (!row) return { state: cur, added: 0 };
    const before = cur.hearts;
    const after = Math.min(MAX_HEARTS, before + Math.max(1, Math.round(amount)));
    const added = after - before;
    let anchorMs = Math.max(0, Number(row.next_restore_anchor_ms) || 0);
    if (after >= MAX_HEARTS) {
      anchorMs = 0;
    }
    this.saveRow(userId, after, cur.heartShards, anchorMs, nowMs);
    return {
      state: this.toState(after, cur.heartShards, anchorMs, nowMs),
      added,
    };
  }

  public static deductHearts = HeartService.deductHeart;
  public static addHearts = HeartService.addHeart;

  /**
   * Collect in-game heart pickups toward the 30-heart single-heart recharge rule.
   * Every 30 collected hearts restores +1 full heart (when below max 5).
   */
  public static collectHeartPickup(
    userId: string,
    count = 1,
    nowMs = Date.now()
  ): { state: HeartState; rechargedCount: number; shardsAdded: number } {
    const cur = this.getHeartState(userId, nowMs);
    const row = this.ensureRow(userId, nowMs);
    if (!row) return { state: cur, rechargedCount: 0, shardsAdded: 0 };
    const add = Math.max(1, Math.min(30, Math.round(count)));

    let hearts = cur.hearts;
    let shards = cur.heartShards + add;
    let anchorMs = Math.max(0, Number(row.next_restore_anchor_ms) || 0);
    let rechargedCount = 0;

    while (shards >= HEART_SHARDS_PER_RECHARGE && hearts < MAX_HEARTS) {
      shards -= HEART_SHARDS_PER_RECHARGE;
      hearts += 1;
      rechargedCount += 1;
    }

    if (hearts >= MAX_HEARTS) {
      anchorMs = 0;
      // When already at full 5/5 hearts, keep banked progress up to 29/30 so the very next pickup after losing a heart recharges cleanly
      shards = Math.min(shards, HEART_SHARDS_PER_RECHARGE - 1);
    } else if (anchorMs <= 0) {
      anchorMs = nowMs;
    }

    this.saveRow(userId, hearts, shards, anchorMs, nowMs);
    return {
      state: this.toState(hearts, shards, anchorMs, nowMs),
      rechargedCount,
      shardsAdded: add,
    };
  }
}
