import { db } from '../db/Database';
import { AdventureProgressionService } from './AdventureProgressionService';
import { ExplorerService } from './ExplorerService';
import { AnalyticsService } from './AnalyticsService';

export interface BossProgressRecord {
  userId: string;
  bossLevel: number;
  bossId: string;
  stageIndex: number;
  stageTotal: number;
  attempts: number;
  bestTimeMs?: number;
  defeated: boolean;
  claimed: boolean;
  updatedAt: string;
}

export class BossProgressionService {
  public static getBossProgress(userId: string, bossLevel: number): BossProgressRecord {
    const def = AdventureProgressionService.getLevelDef(bossLevel);
    const conn = db.getRawDb();
    let row = conn.prepare('SELECT * FROM boss_progress WHERE user_id = ? AND boss_level = ?').get(userId, bossLevel) as any;
    if (!row) {
      const now = new Date().toISOString();
      conn.prepare(`
        INSERT OR IGNORE INTO boss_progress (
          user_id, boss_level, boss_id, stage_index, stage_total, attempts, defeated, claimed, updated_at
        ) VALUES (?, ?, ?, 0, ?, 0, 0, 0, ?)
      `).run(userId, bossLevel, def.bossId || `boss_lv${bossLevel}`, def.stages.length, now);
      row = conn.prepare('SELECT * FROM boss_progress WHERE user_id = ? AND boss_level = ?').get(userId, bossLevel);
    }
    return {
      userId,
      bossLevel: row.boss_level,
      bossId: row.boss_id,
      stageIndex: row.stage_index || 0,
      stageTotal: row.stage_total || def.stages.length,
      attempts: row.attempts || 0,
      bestTimeMs: row.best_time_ms ?? undefined,
      defeated: !!row.defeated,
      claimed: !!row.claimed,
      updatedAt: row.updated_at,
    };
  }

  public static recordAttempt(userId: string, bossLevel: number): BossProgressRecord {
    const rec = this.getBossProgress(userId, bossLevel);
    const now = new Date().toISOString();
    db.getRawDb().prepare(`
      UPDATE boss_progress SET attempts = attempts + 1, updated_at = ? WHERE user_id = ? AND boss_level = ?
    `).run(now, userId, bossLevel);

    const def = AdventureProgressionService.getLevelDef(bossLevel);
    AnalyticsService.track({
      eventType: 'boss_attempt',
      userId,
      mode: 'boss',
      metadata: {
        bossLevel,
        bossId: rec.bossId,
        bossName: def.bossName,
        isMajorMilestone: def.isMajorMilestone,
        attempt: rec.attempts + 1,
      },
    });
    return this.getBossProgress(userId, bossLevel);
  }

  public static updateStageProgress(userId: string, bossLevel: number, stageIndex: number): BossProgressRecord {
    this.getBossProgress(userId, bossLevel);
    const now = new Date().toISOString();
    db.getRawDb().prepare(`
      UPDATE boss_progress SET stage_index = MAX(stage_index, ?), updated_at = ? WHERE user_id = ? AND boss_level = ?
    `).run(stageIndex, now, userId, bossLevel);
    return this.getBossProgress(userId, bossLevel);
  }

  public static recordFailure(userId: string, bossLevel: number, abandoned = false): void {
    const rec = this.getBossProgress(userId, bossLevel);
    const def = AdventureProgressionService.getLevelDef(bossLevel);
    AnalyticsService.track({
      eventType: abandoned && def.isMajorMilestone ? 'boss_milestone_abandon' : 'boss_fail',
      userId,
      mode: 'boss',
      metadata: {
        bossLevel,
        bossId: rec.bossId,
        stageIndex: rec.stageIndex,
        isMajorMilestone: def.isMajorMilestone,
        abandoned,
      },
    });
  }

  public static recordVictory(userId: string, bossLevel: number, elapsedMs = 0): BossProgressRecord {
    const rec = this.getBossProgress(userId, bossLevel);
    const def = AdventureProgressionService.getLevelDef(bossLevel);
    const now = new Date().toISOString();
    const bestMs = elapsedMs > 0
      ? (rec.bestTimeMs ? Math.min(rec.bestTimeMs, elapsedMs) : elapsedMs)
      : rec.bestTimeMs ?? null;

    db.getRawDb().prepare(`
      UPDATE boss_progress
      SET defeated = 1, claimed = 1, stage_index = stage_total, best_time_ms = ?, updated_at = ?
      WHERE user_id = ? AND boss_level = ?
    `).run(bestMs, now, userId, bossLevel);

    // For 100-level signature kingdom bosses, mirror defeat into existing ExplorerService state too
    if (def.isMajorMilestone && def.bossId) {
      const baseBossId = def.bossId.replace(/_m\d+$/, '');
      try { ExplorerService.recordBossDefeat(userId, baseBossId); } catch { /* ignore if kingdom not open via legacy rule */ }
    }

    AnalyticsService.track({
      eventType: 'boss_victory',
      userId,
      mode: 'boss',
      durationSeconds: Math.round(elapsedMs / 1000),
      metadata: {
        bossLevel,
        bossId: rec.bossId,
        bossName: def.bossName,
        isMajorMilestone: def.isMajorMilestone,
        attempts: Math.max(1, rec.attempts),
      },
    });

    return this.getBossProgress(userId, bossLevel);
  }

  public static listClearedBosses(userId: string): BossProgressRecord[] {
    const rows = db.getRawDb().prepare(
      'SELECT * FROM boss_progress WHERE user_id = ? ORDER BY boss_level ASC'
    ).all(userId) as any[];
    return rows.map(r => ({
      userId: r.user_id,
      bossLevel: r.boss_level,
      bossId: r.boss_id,
      stageIndex: r.stage_index || 0,
      stageTotal: r.stage_total || 1,
      attempts: r.attempts || 0,
      bestTimeMs: r.best_time_ms ?? undefined,
      defeated: !!r.defeated,
      claimed: !!r.claimed,
      updatedAt: r.updated_at,
    }));
  }
}

