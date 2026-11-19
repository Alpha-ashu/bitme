import crypto from 'crypto';
import { db } from '../db/Database';
import {
  CampaignLevelDef,
  LevelType,
  NpcEncounterPayload,
  NpcQuotaStatus,
  QuestRewardBundle,
  QuestSessionView,
  QuestStageSpec,
  QuestState,
  QuizCategory,
  QuizQuestionClient,
  RewardBoxEntry,
} from '../types';
import { kingdomByNumber, npcById, questById } from '../config/ExplorerContent';
import { AdventureProgressionService } from './AdventureProgressionService';
import { BossProgressionService } from './BossProgressionService';
import { QuestionBankService } from './QuestionBankService';
import { ExplorerService } from './ExplorerService';
import { AnalyticsService } from './AnalyticsService';
import { RewardBoxService } from './RewardBoxService';

const ALLOWED_TRANSITIONS: Record<QuestState, QuestState[]> = {
  AVAILABLE: ['APPROACHABLE', 'OFFERED', 'ACCEPTED'],
  APPROACHABLE: ['OFFERED', 'AVAILABLE'],
  OFFERED: ['ACCEPTED', 'AVAILABLE', 'SKIPPED'],
  ACCEPTED: ['ACTIVE', 'ABANDONED'],
  ACTIVE: ['COMPLETED', 'FAILED', 'ABANDONED'],
  COMPLETED: ['CLAIMABLE'],
  CLAIMABLE: ['CLAIMED'],
  CLAIMED: [],
  SKIPPED: ['AVAILABLE', 'OFFERED', 'ACCEPTED'],
  ABANDONED: ['AVAILABLE', 'OFFERED', 'ACCEPTED'],
  FAILED: ['AVAILABLE', 'OFFERED', 'ACCEPTED'],
};

interface StoredObjective {
  title: string;
  description: string;
  difficultyTier: number;
  expectedDurationSec: number;
  stages: QuestStageSpec[];
  isCampaignLevel: boolean;
  isBossCheckpoint?: boolean;
  isMajorMilestone?: boolean;
  legacyQuestId?: string;
}

interface StoredProgress {
  count: number;
  elapsedSec: number;
  completedWaypoints: string[];
  activatedSwitches: string[];
  quizSessionId?: string;
  stageStartedAtMs: number;
}

const ACTIVE_MAIN_STATES: QuestState[] = ['ACCEPTED', 'ACTIVE', 'COMPLETED', 'CLAIMABLE'];

export class QuestEngineService {
  public static readonly MAX_TASKS_PER_NPC = 5;
  public static npcCooldownMs = 30 * 60 * 1000; // 30 minutes rest after completing 5 quests for the same Quest Master

  public static canTransition(from: QuestState, to: QuestState): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Quest Master 5-task quota & 30-minute cooldown tracker.
   * Automatically resets completed_in_cycle back to 0 once the 30-minute waiting period elapses.
   */
  public static getNpcQuota(userId: string, npcId: string, nowMs = Date.now()): NpcQuotaStatus {
    const conn = db.getRawDb();
    const row = conn.prepare(
      'SELECT * FROM npc_quest_quota WHERE user_id = ? AND npc_id = ?'
    ).get(userId, npcId) as any;

    if (!row) {
      return {
        npcId,
        completedInCycle: 0,
        maxPerCycle: this.MAX_TASKS_PER_NPC,
        totalCompleted: 0,
        onCooldown: false,
        cooldownRemainingSec: 0,
      };
    }

    let completedInCycle = Number(row.completed_in_cycle) || 0;
    const totalCompleted = Number(row.total_completed) || 0;
    let cooldownUntil: string | undefined = row.cooldown_until || undefined;
    let cooldownRemainingSec = 0;
    let onCooldown = false;

    if (cooldownUntil) {
      const untilMs = Date.parse(cooldownUntil);
      if (!Number.isNaN(untilMs) && untilMs > nowMs) {
        onCooldown = true;
        cooldownRemainingSec = Math.max(1, Math.ceil((untilMs - nowMs) / 1000));
      } else {
        // 30-minute waiting period finished -> automatically reset cycle quota to 0/5!
        completedInCycle = 0;
        cooldownUntil = undefined;
        conn.prepare(
          'UPDATE npc_quest_quota SET completed_in_cycle = 0, cooldown_until = NULL, updated_at = ? WHERE user_id = ? AND npc_id = ?'
        ).run(new Date(nowMs).toISOString(), userId, npcId);
      }
    }

    return {
      npcId,
      completedInCycle,
      maxPerCycle: this.MAX_TASKS_PER_NPC,
      totalCompleted,
      onCooldown,
      cooldownUntil,
      cooldownRemainingSec,
    };
  }

  public static getAllNpcQuotas(userId: string, nowMs = Date.now()): Record<string, NpcQuotaStatus> {
    const rows = db.getRawDb().prepare('SELECT npc_id FROM npc_quest_quota WHERE user_id = ?').all(userId) as Array<{ npc_id: string }>;
    const out: Record<string, NpcQuotaStatus> = {};
    for (const r of rows) {
      out[r.npc_id] = this.getNpcQuota(userId, r.npc_id, nowMs);
    }
    return out;
  }

  public static recordNpcTaskCompletion(userId: string, npcId: string, nowMs = Date.now()): NpcQuotaStatus {
    const current = this.getNpcQuota(userId, npcId, nowMs);
    const nextInCycle = Math.min(this.MAX_TASKS_PER_NPC, current.completedInCycle + 1);
    const nextTotal = current.totalCompleted + 1;
    const cooldownUntil = nextInCycle >= this.MAX_TASKS_PER_NPC
      ? new Date(nowMs + this.npcCooldownMs).toISOString()
      : null;

    db.getRawDb().prepare(`
      INSERT INTO npc_quest_quota (user_id, npc_id, completed_in_cycle, total_completed, cooldown_until, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, npc_id) DO UPDATE SET
        completed_in_cycle = excluded.completed_in_cycle,
        total_completed = excluded.total_completed,
        cooldown_until = excluded.cooldown_until,
        updated_at = excluded.updated_at
    `).run(userId, npcId, nextInCycle, nextTotal, cooldownUntil, new Date(nowMs).toISOString());

    return this.getNpcQuota(userId, npcId, nowMs);
  }

  private static wrapDelta(d: number, worldSize: number): number {
    let r = ((d % worldSize) + worldSize) % worldSize;
    if (r > worldSize / 2) r -= worldSize;
    return r;
  }

  private static rowToView(row: any): QuestSessionView {
    const obj: StoredObjective = JSON.parse(row.objective_json || '{}');
    const prog: StoredProgress = JSON.parse(row.progress_json || '{}');
    const rewards: QuestRewardBundle = JSON.parse(row.reward_json || '{"stars":0,"xp":0,"evoXp":0}');
    const stages = Array.isArray(obj.stages) && obj.stages.length > 0
      ? obj.stages
      : [{ index: 0, kind: 'collect' as const, label: obj.title || 'Complete Objective', target: 1 }];
    const stageIdx = Math.max(0, Math.min(stages.length - 1, Number(row.stage_index) || 0));
    const currentStage = stages[stageIdx];
    const progressVal = currentStage.kind === 'survive'
      ? Math.floor(prog.elapsedSec || 0)
      : (prog.count || 0);
    const targetVal = Math.max(1, currentStage.target || 1);

    let timeRemainingSec: number | undefined;
    if (currentStage.timeLimitSec && currentStage.timeLimitSec > 0 && row.state === 'ACTIVE') {
      const used = prog.elapsedSec || 0;
      timeRemainingSec = Math.max(0, Math.ceil(currentStage.timeLimitSec - used));
    }

    return {
      sessionId: row.id,
      questId: row.quest_id,
      levelNumber: row.level_number || 0,
      npcId: row.npc_id || undefined,
      title: obj.title || row.quest_id,
      description: obj.description || '',
      difficultyTier: obj.difficultyTier || 1,
      expectedDurationSec: obj.expectedDurationSec || 45,
      questType: (row.quest_type || 'collection') as LevelType,
      state: row.state as QuestState,
      stageIndex: stageIdx,
      stageTotal: stages.length,
      currentStage,
      progress: Math.min(targetVal, progressVal),
      target: targetVal,
      pct: Math.min(100, Math.round((Math.min(targetVal, progressVal) / targetVal) * 100)),
      timeRemainingSec,
      completedWaypoints: prog.completedWaypoints || [],
      activatedSwitches: prog.activatedSwitches || [],
      quizSessionId: prog.quizSessionId,
      rewards,
      attempts: row.attempts || 1,
    };
  }

  /** Returns the player's currently active/claimable main quest (persisted across reconnects). */
  public static getActiveMainQuest(userId: string): QuestSessionView | null {
    const row = db.getRawDb().prepare(`
      SELECT * FROM quest_sessions
      WHERE user_id = ? AND is_main = 1 AND state IN ('ACCEPTED', 'ACTIVE', 'COMPLETED', 'CLAIMABLE')
      ORDER BY updated_at DESC LIMIT 1
    `).get(userId);
    return row ? this.rowToView(row) : null;
  }

  public static getSessionById(userId: string, sessionId: string): QuestSessionView | null {
    const row = db.getRawDb().prepare('SELECT * FROM quest_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
    return row ? this.rowToView(row) : null;
  }

  /**
   * Build the server-validated NPC Encounter offer payload for a specific NPC.
   * Links the NPC to either the player's current Adventure Campaign level in this world OR
   * the NPC's classic Kingdom quest if no campaign level is pending.
   */
  public static buildNpcEncounter(userId: string, npcId: string): NpcEncounterPayload | null {
    const npc = npcById(npcId);
    const profile = db.getProfile(userId);
    if (!npc || !profile) return null;

    const active = this.getActiveMainQuest(userId);
    const campProg = AdventureProgressionService.getProgress(userId);
    const npcQuota = this.getNpcQuota(userId, npcId);

    // If the active quest is CLAIMABLE or belongs to this NPC, surface it directly!
    if (active && (active.npcId === npcId || active.state === 'CLAIMABLE')) {
      return {
        npcId: npc.id,
        npcName: npc.name,
        npcRole: npc.role,
        npcIcon: npc.icon,
        npcAccessory: npc.accessory,
        greeting: active.state === 'CLAIMABLE' ? (npc.afterQuest || 'Splendid work! Claim your reward.') : npc.greeting,
        questId: active.questId,
        levelNumber: active.levelNumber,
        title: active.title,
        description: active.description,
        questType: active.questType,
        difficultyTier: active.difficultyTier,
        expectedDurationSec: active.expectedDurationSec,
        rewards: active.rewards,
        questState: active.state,
        sessionId: active.sessionId,
        canAccept: false,
        canClaim: active.state === 'CLAIMABLE',
        npcQuota,
      };
    }

    // Quest Master 5-task cycle completed -> show 30-minute rest status cleanly!
    if (npcQuota.onCooldown) {
      const mins = Math.floor(npcQuota.cooldownRemainingSec / 60);
      const secs = npcQuota.cooldownRemainingSec % 60;
      const timerStr = `${mins}m ${String(secs).padStart(2, '0')}s`;
      return {
        npcId: npc.id,
        npcName: npc.name,
        npcRole: npc.role,
        npcIcon: npc.icon,
        npcAccessory: npc.accessory,
        greeting: `You completed all ${npcQuota.maxPerCycle}/${npcQuota.maxPerCycle} tasks for ${npc.name}!`,
        questId: `cooldown_${npc.id}`,
        levelNumber: campProg.highestUnlockedLevel,
        title: `${npc.name} Resting (${npcQuota.completedInCycle}/${npcQuota.maxPerCycle} Done)`,
        description: `Wait ${timerStr} before taking new quests from ${npc.name}, or visit another Quest Master!`,
        questType: 'exploration',
        difficultyTier: 1,
        expectedDurationSec: 0,
        rewards: { stars: 0, xp: 0, evoXp: 0 },
        questState: 'CLAIMED',
        canAccept: false,
        canClaim: false,
        npcQuota,
        cooldownMessage: `Quest Master cooldown active — ready again in ${timerStr}.`,
      };
    }

    // Determine which Adventure Campaign level this NPC can offer
    const nextLvl = campProg.highestUnlockedLevel;
    const def = AdventureProgressionService.getLevelDef(nextLvl);

    // Check if there is an existing OFFERED / SKIPPED / FAILED session for this level
    const existingRow = db.getRawDb().prepare(`
      SELECT * FROM quest_sessions
      WHERE user_id = ? AND quest_id = ?
      ORDER BY updated_at DESC LIMIT 1
    `).get(userId, def.levelId) as any;

    const state: QuestState = existingRow
      ? (existingRow.state as QuestState)
      : 'AVAILABLE';

    // If already claimed, fall back to NPC's legacy kingdom quest if uncompleted
    if (state === 'CLAIMED' && npc.questId) {
      const legacy = questById(npc.questId);
      const expState = ExplorerService.getState(profile);
      if (legacy && !expState.claimed.includes(legacy.id)) {
        const qv = ExplorerService.questView(profile, expState, legacy);
        const qState: QuestState = qv.completed ? 'CLAIMABLE' : qv.accepted ? 'ACTIVE' : 'OFFERED';
        return {
          npcId: npc.id,
          npcName: npc.name,
          npcRole: npc.role,
          npcIcon: npc.icon,
          npcAccessory: npc.accessory,
          greeting: npc.greeting,
          questId: legacy.id,
          levelNumber: 0,
          title: legacy.title,
          description: legacy.brief,
          questType: 'collection',
          difficultyTier: Math.min(5, Math.max(1, Math.ceil(legacy.kingdom / 2))),
          expectedDurationSec: 60,
          rewards: { stars: legacy.rewardStars, xp: legacy.rewardXp, evoXp: legacy.rewardEvoXp },
          questState: qState,
          canAccept: qState === 'OFFERED' && !active,
          canClaim: qState === 'CLAIMABLE',
          npcQuota,
        };
      }
      return null; // All quests from this NPC are completed & unavailable
    }

    return {
      npcId: npc.id,
      npcName: npc.name,
      npcRole: npc.role,
      npcIcon: npc.icon,
      npcAccessory: npc.accessory,
      greeting: npc.greeting,
      questId: def.levelId,
      levelNumber: def.levelNumber,
      title: `Lv.${def.levelNumber} · ${def.title}`,
      description: def.description,
      questType: def.levelType,
      difficultyTier: def.difficultyTier,
      expectedDurationSec: def.expectedDurationSec,
      rewards: def.rewards,
      questState: active ? active.state : 'OFFERED',
      sessionId: existingRow?.id,
      canAccept: !active,
      canClaim: false,
      npcQuota,
    };
  }

  /** Record server-side OFFERED state + analytics when an eligible NPC encounter triggers. */
  public static recordOffer(userId: string, npcId: string): NpcEncounterPayload | null {
    const payload = this.buildNpcEncounter(userId, npcId);
    if (!payload) return null;

    AnalyticsService.track({
      eventType: 'npc_encounter',
      userId,
      mode: 'explorer',
      metadata: { npcId, questId: payload.questId, levelNumber: payload.levelNumber, state: payload.questState },
    });
    if (payload.canAccept) {
      AnalyticsService.track({
        eventType: 'quest_offer',
        userId,
        mode: 'explorer',
        metadata: { npcId, questId: payload.questId, levelNumber: payload.levelNumber, questType: payload.questType },
      });
    }
    return payload;
  }

  /**
   * ACCEPT QUEST (or directly start an Adventure Campaign level):
   * - Validates unlock & 1 active main quest constraint
   * - Transitions AVAILABLE/OFFERED/SKIPPED/FAILED/ABANDONED → ACCEPTED → ACTIVE
   * - Automatically creates server Quiz Session if current stage is a Quiz!
   */
  public static acceptQuest(
    userId: string,
    opts: { questId?: string; levelNumber?: number; npcId?: string }
  ): {
    ok: boolean;
    error?: string;
    cooldownRemainingSec?: number;
    npcQuota?: NpcQuotaStatus;
    session?: QuestSessionView;
    quizQuestion?: QuizQuestionClient | null;
  } {
    const profile = db.getProfile(userId);
    if (!profile) return { ok: false, error: 'Profile not found' };

    // Enforce Quest Master 5-task cycle + 30-minute cooldown when accepting from an NPC
    if (opts.npcId) {
      const quota = this.getNpcQuota(userId, opts.npcId);
      if (quota.onCooldown) {
        const mins = Math.floor(quota.cooldownRemainingSec / 60);
        const secs = quota.cooldownRemainingSec % 60;
        return {
          ok: false,
          cooldownRemainingSec: quota.cooldownRemainingSec,
          npcQuota: quota,
          error: `You completed 5/5 tasks with this Quest Master! Wait ${mins}m ${String(secs).padStart(2, '0')}s before returning.`,
        };
      }
    }

    // Prevent duplicate acceptance & enforce 1 active main quest
    const active = this.getActiveMainQuest(userId);
    if (active) {
      // Idempotently return existing active quest if player taps accept twice on the same quest
      const requestedId = opts.levelNumber ? `lvl_${opts.levelNumber}` : opts.questId;
      if (requestedId && active.questId === requestedId) {
        const quizQ = active.quizSessionId ? QuestionBankService.getSession(userId, active.quizSessionId)?.currentQuestion || null : null;
        return { ok: true, session: active, quizQuestion: quizQ };
      }
      return { ok: false, error: `Finish or abandon "${active.title}" before accepting another main quest.` };
    }

    // Resolve either a Campaign Level (`lvl_N` / `levelNumber`) or a Legacy Kingdom Quest (`q1_forage`)
    let levelNumber = opts.levelNumber ? Math.floor(opts.levelNumber) : 0;
    if (!levelNumber && opts.questId && /^lvl_\d+$/.test(opts.questId)) {
      levelNumber = Number(opts.questId.slice(4));
    }

    const conn = db.getRawDb();
    const now = new Date().toISOString();
    let questId: string;
    let questType: LevelType;
    let objective: StoredObjective;
    let rewards: QuestRewardBundle;
    let npcId = opts.npcId;
    let startStageIndex = 0;

    if (levelNumber > 0) {
      const prog = AdventureProgressionService.getProgress(userId);
      if (levelNumber > prog.highestUnlockedLevel) {
        return { ok: false, error: `Adventure Level ${levelNumber} is locked (unlock Lv.${prog.highestUnlockedLevel} first).` };
      }
      const def: CampaignLevelDef = AdventureProgressionService.getLevelDef(levelNumber);
      questId = def.levelId;
      questType = def.levelType;
      npcId = npcId || def.npcId;
      rewards = def.rewards;
      objective = {
        title: def.title,
        description: def.description,
        difficultyTier: def.difficultyTier,
        expectedDurationSec: def.expectedDurationSec,
        stages: def.stages,
        isCampaignLevel: true,
        isBossCheckpoint: def.isBossCheckpoint,
        isMajorMilestone: def.isMajorMilestone,
      };
      // For multi-stage boss milestones, preserve cleared stage index across retries/reconnects!
      if (def.isBossCheckpoint) {
        const bp = BossProgressionService.recordAttempt(userId, levelNumber);
        if (!bp.defeated && bp.stageIndex > 0 && bp.stageIndex < def.stages.length) {
          startStageIndex = bp.stageIndex;
        }
      }
      AnalyticsService.track({
        eventType: 'adventure_level_start',
        userId,
        mode: 'explorer',
        metadata: { levelNumber, worldNumber: def.worldNumber, levelType: def.levelType },
      });
    } else if (opts.questId) {
      const legacy = questById(opts.questId);
      if (!legacy) return { ok: false, error: 'Unknown quest' };
      const expState = ExplorerService.getState(profile);
      if (expState.claimed.includes(legacy.id)) {
        return { ok: false, error: 'Quest already completed and claimed' };
      }
      const k = kingdomByNumber(legacy.kingdom);
      if (!k) return { ok: false, error: 'Unknown kingdom' };
      // Mirror acceptance into ExplorerService for full backwards compatibility
      if (!expState.accepted.includes(legacy.id)) {
        ExplorerService.acceptQuest(userId, legacy.id);
      }
      questId = legacy.id;
      questType = legacy.metric === 'kill' ? 'survival' : 'collection';
      rewards = { stars: legacy.rewardStars, xp: legacy.rewardXp, evoXp: legacy.rewardEvoXp };
      objective = {
        title: legacy.title,
        description: legacy.brief,
        difficultyTier: Math.min(5, Math.max(1, Math.ceil(legacy.kingdom / 2))),
        expectedDurationSec: 60,
        stages: [{
          index: 0,
          kind: legacy.metric === 'kill' ? 'kill' : 'collect',
          label: `${legacy.title} (${legacy.target})`,
          metric: legacy.metric,
          target: legacy.target,
        }],
        isCampaignLevel: false,
        legacyQuestId: legacy.id,
      };
    } else {
      return { ok: false, error: 'Missing questId or levelNumber' };
    }

    // Count previous attempts on this questId
    const prevAttemptsRow = conn.prepare(
      'SELECT COUNT(*) AS cnt FROM quest_sessions WHERE user_id = ? AND quest_id = ?'
    ).get(userId, questId) as { cnt: number };
    const attempts = (prevAttemptsRow?.cnt || 0) + 1;

    const sessionId = `qs_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const firstStage = objective.stages[startStageIndex] || objective.stages[0];
    const progress: StoredProgress = {
      count: 0,
      elapsedSec: 0,
      completedWaypoints: [],
      activatedSwitches: [],
      stageStartedAtMs: Date.now(),
    };

    let quizQuestion: QuizQuestionClient | null = null;
    if (firstStage.kind === 'quiz' && firstStage.category) {
      const created = QuestionBankService.createQuizSession(userId, {
        questSessionId: sessionId,
        levelNumber: levelNumber || 1,
        category: firstStage.category as QuizCategory,
        count: firstStage.target,
        untimed: firstStage.untimed,
      });
      progress.quizSessionId = created.session.id;
      quizQuestion = created.firstQuestion;
    }

    // State transition: AVAILABLE/OFFERED → ACCEPTED → ACTIVE
    conn.prepare(`
      INSERT INTO quest_sessions (
        id, user_id, quest_id, level_number, npc_id, state, quest_type, is_main,
        stage_index, stage_total, attempts, objective_json, progress_json, reward_json,
        started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      questId,
      levelNumber,
      npcId || null,
      questType,
      startStageIndex,
      objective.stages.length,
      attempts,
      JSON.stringify(objective),
      JSON.stringify(progress),
      JSON.stringify(rewards),
      now,
      now
    );

    AnalyticsService.track({
      eventType: 'quest_accept',
      userId,
      mode: 'explorer',
      metadata: { sessionId, questId, levelNumber, npcId, questType, attempts },
    });

    const row = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(sessionId);
    return { ok: true, session: this.rowToView(row), quizQuestion };
  }

  /** LATER button: dismiss popup safely without marking quest unavailable or granting anything. */
  public static deferQuest(userId: string, npcId: string, questId: string): { ok: true; state: QuestState } {
    AnalyticsService.track({
      eventType: 'quest_later',
      userId,
      mode: 'explorer',
      metadata: { npcId, questId },
    });
    return { ok: true, state: 'AVAILABLE' };
  }

  /** SKIP button: records SKIPPED encounter cleanly, awards ZERO rewards, does NOT accept quest. */
  public static skipQuest(userId: string, npcId: string, questId: string, levelNumber = 0): { ok: true; state: QuestState } {
    const conn = db.getRawDb();
    const now = new Date().toISOString();
    const id = `qs_skip_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    conn.prepare(`
      INSERT INTO quest_sessions (
        id, user_id, quest_id, level_number, npc_id, state, quest_type, is_main,
        stage_index, stage_total, attempts, objective_json, progress_json, reward_json,
        started_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'SKIPPED', 'exploration', 0, 0, 1, 0, '{}', '{}', '{}', ?, ?)
    `).run(id, userId, questId, levelNumber, npcId || null, now, now);

    AnalyticsService.track({
      eventType: 'quest_skip',
      userId,
      mode: 'explorer',
      metadata: { npcId, questId, levelNumber },
    });
    return { ok: true, state: 'SKIPPED' };
  }

  public static abandonActiveQuest(userId: string): { ok: boolean; error?: string } {
    const active = this.getActiveMainQuest(userId);
    if (!active) return { ok: false, error: 'No active quest to abandon' };
    if (!this.canTransition(active.state, 'ABANDONED')) {
      return { ok: false, error: `Cannot abandon quest in state ${active.state}` };
    }
    const now = new Date().toISOString();
    db.getRawDb().prepare(
      `UPDATE quest_sessions SET state = 'ABANDONED', updated_at = ? WHERE id = ?`
    ).run(now, active.sessionId);

    if (active.levelNumber > 0) {
      const def = AdventureProgressionService.getLevelDef(active.levelNumber);
      if (def.isBossCheckpoint) BossProgressionService.recordFailure(userId, active.levelNumber, true);
      AnalyticsService.track({
        eventType: 'adventure_level_abandon',
        userId,
        mode: 'explorer',
        metadata: { sessionId: active.sessionId, levelNumber: active.levelNumber },
      });
    }
    AnalyticsService.track({
      eventType: 'quest_abandon',
      userId,
      mode: 'explorer',
      metadata: { sessionId: active.sessionId, questId: active.questId, levelNumber: active.levelNumber },
    });
    return { ok: true };
  }

  /**
   * Advance active stage or automatically complete, claim & deposit rewards into the player's Reward Box!
   * Also updates Adventure progression, Boss progress, and the Quest Master's 5-task quota (30-min cooldown on 5/5).
   */
  private static advanceStageOrComplete(
    userId: string,
    row: any,
    obj: StoredObjective,
    prog: StoredProgress
  ): {
    session: QuestSessionView;
    stageAdvanced: boolean;
    completed: boolean;
    autoClaimedToBox?: boolean;
    rewardBoxItem?: RewardBoxEntry;
    npcQuota?: NpcQuotaStatus;
    nextUnlockedLevel?: number;
    nextQuiz?: QuizQuestionClient | null;
  } {
    const conn = db.getRawDb();
    const now = new Date().toISOString();
    const curIdx = Number(row.stage_index) || 0;
    const nextIdx = curIdx + 1;

    if (nextIdx < obj.stages.length) {
      const nextStage = obj.stages[nextIdx];
      const freshProg: StoredProgress = {
        count: 0,
        elapsedSec: 0,
        completedWaypoints: [],
        activatedSwitches: [],
        stageStartedAtMs: Date.now(),
      };
      let nextQuiz: QuizQuestionClient | null = null;
      if (nextStage.kind === 'quiz' && nextStage.category) {
        const created = QuestionBankService.createQuizSession(userId, {
          questSessionId: row.id,
          levelNumber: row.level_number || 1,
          category: nextStage.category,
          count: nextStage.target,
          untimed: nextStage.untimed,
        });
        freshProg.quizSessionId = created.session.id;
        nextQuiz = created.firstQuestion;
      }
      if (obj.isBossCheckpoint && row.level_number > 0) {
        BossProgressionService.updateStageProgress(userId, row.level_number, nextIdx);
      }
      conn.prepare(`
        UPDATE quest_sessions SET stage_index = ?, progress_json = ?, updated_at = ? WHERE id = ?
      `).run(nextIdx, JSON.stringify(freshProg), now, row.id);
      const updated = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(row.id);
      return { session: this.rowToView(updated), stageAdvanced: true, completed: false, nextQuiz };
    }

    // All stages cleared -> Auto-claim atomically (ACTIVE → CLAIMED) & deposit into Reward Box!
    const cas = conn.prepare(`
      UPDATE quest_sessions
      SET state = 'CLAIMED', progress_json = ?, completed_at = ?, claimed_at = ?, updated_at = ?
      WHERE id = ? AND state = 'ACTIVE'
    `).run(JSON.stringify(prog), now, now, now, row.id);

    const rewardsRaw: QuestRewardBundle = JSON.parse(row.reward_json || '{"stars":50,"xp":50,"evoXp":15}');
    let grantedBundle: QuestRewardBundle = rewardsRaw;
    let nextUnlockedLevel: number | undefined;

    if ((cas.changes || 0) > 0) {
      if (obj.isCampaignLevel && row.level_number > 0) {
        if (obj.isBossCheckpoint) {
          const elapsedMs = Math.max(1000, Date.now() - Date.parse(row.started_at || now));
          BossProgressionService.recordVictory(userId, row.level_number, elapsedMs);
        }
        const comp = AdventureProgressionService.recordLevelCompletion(userId, row.level_number, 1, { deferWalletCredit: true });
        grantedBundle = comp.rewardsGranted;
        nextUnlockedLevel = comp.nextUnlockedLevel;
      } else if (obj.legacyQuestId) {
        ExplorerService.claimQuest(userId, obj.legacyQuestId);
      }
    }

    const boxRes = RewardBoxService.deposit(userId, {
      sourceType: obj.isBossCheckpoint ? 'boss' : obj.isCampaignLevel ? 'level' : 'quest',
      sourceId: row.id,
      title: row.level_number > 0 ? `Lv.${row.level_number} · ${obj.title || row.quest_id}` : (obj.title || row.quest_id),
      stars: grantedBundle.stars || 0,
      xp: grantedBundle.xp || 0,
      evoXp: grantedBundle.evoXp || 0,
      tickets: grantedBundle.tickets || 0,
    });

    let npcQuota: NpcQuotaStatus | undefined;
    if ((cas.changes || 0) > 0 && row.npc_id) {
      npcQuota = this.recordNpcTaskCompletion(userId, String(row.npc_id));
    }

    const durSec = Math.max(1, Math.round((Date.now() - Date.parse(row.started_at || now)) / 1000));
    AnalyticsService.track({
      eventType: 'quest_complete',
      userId,
      mode: 'explorer',
      durationSeconds: durSec,
      metadata: { sessionId: row.id, questId: row.quest_id, levelNumber: row.level_number, attempts: row.attempts, autoClaimedToBox: true },
    });
    AnalyticsService.track({
      eventType: 'quest_claim',
      userId,
      mode: 'explorer',
      score: grantedBundle.stars || 0,
      metadata: { sessionId: row.id, questId: row.quest_id, levelNumber: row.level_number, destination: 'reward_box' },
    });

    const updated = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(row.id);
    return {
      session: this.rowToView(updated),
      stageAdvanced: false,
      completed: true,
      autoClaimedToBox: true,
      rewardBoxItem: boxRes.entry,
      npcQuota,
      nextUnlockedLevel,
      nextQuiz: null,
    };
  }

  /** Called by server Quiz endpoint when a Quiz session finishes. */
  public static handleQuizOutcome(
    userId: string,
    questSessionId: string,
    passed: boolean,
    correctCount: number
  ): {
    session: QuestSessionView | null;
    stageAdvanced: boolean;
    completed: boolean;
    failed: boolean;
    autoClaimedToBox?: boolean;
    rewardBoxItem?: RewardBoxEntry;
    npcQuota?: NpcQuotaStatus;
    nextUnlockedLevel?: number;
    nextQuiz?: QuizQuestionClient | null;
  } {
    const conn = db.getRawDb();
    const row = conn.prepare('SELECT * FROM quest_sessions WHERE id = ? AND user_id = ?').get(questSessionId, userId) as any;
    if (!row || row.state !== 'ACTIVE') return { session: null, stageAdvanced: false, completed: false, failed: false };

    const obj: StoredObjective = JSON.parse(row.objective_json || '{}');
    const prog: StoredProgress = JSON.parse(row.progress_json || '{}');
    const now = new Date().toISOString();

    if (!passed) {
      // Fail stage cleanly without erasing earlier multi-stage milestone progress
      conn.prepare(`UPDATE quest_sessions SET state = 'FAILED', updated_at = ? WHERE id = ?`).run(now, row.id);
      if (obj.isBossCheckpoint && row.level_number > 0) {
        BossProgressionService.recordFailure(userId, row.level_number, false);
      }
      AnalyticsService.track({
        eventType: 'quest_fail',
        userId,
        mode: 'explorer',
        metadata: { sessionId: row.id, questId: row.quest_id, levelNumber: row.level_number, reason: 'quiz_failed' },
      });
      if (row.level_number > 0) {
        AnalyticsService.track({
          eventType: 'adventure_level_fail',
          userId,
          mode: 'explorer',
          metadata: { levelNumber: row.level_number, reason: 'quiz_failed' },
        });
      }
      const failedRow = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(row.id);
      return { session: this.rowToView(failedRow), stageAdvanced: false, completed: false, failed: true };
    }

    prog.count = correctCount;
    const res = this.advanceStageOrComplete(userId, row, obj, prog);
    return { ...res, failed: false };
  }

  /** Called by authoritative GameSessionService whenever a player collects food or defeats a rival. */
  public static recordGameplayMetric(
    userId: string,
    metric: string,
    amount = 1
  ): {
    session: QuestSessionView;
    stageAdvanced: boolean;
    completed: boolean;
    autoClaimedToBox?: boolean;
    rewardBoxItem?: RewardBoxEntry;
    npcQuota?: NpcQuotaStatus;
    nextUnlockedLevel?: number;
    nextQuiz?: QuizQuestionClient | null;
  } | null {
    const conn = db.getRawDb();
    const row = conn.prepare(`
      SELECT * FROM quest_sessions WHERE user_id = ? AND is_main = 1 AND state = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1
    `).get(userId) as any;
    if (!row) return null;

    const obj: StoredObjective = JSON.parse(row.objective_json || '{}');
    const prog: StoredProgress = JSON.parse(row.progress_json || '{}');
    const stage = obj.stages[Number(row.stage_index) || 0];
    if (!stage) return null;

    const matches =
      (stage.kind === 'collect' || stage.kind === 'boss_objective')
        ? (stage.metric === 'any_food' ? metric !== 'kill' : stage.metric === metric)
        : (stage.kind === 'kill' && metric === 'kill');
    if (!matches) return null;

    prog.count = Math.min(stage.target, (prog.count || 0) + amount);
    if (prog.count >= stage.target) {
      return this.advanceStageOrComplete(userId, row, obj, prog);
    }
    conn.prepare('UPDATE quest_sessions SET progress_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(prog), new Date().toISOString(), row.id);
    const updated = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(row.id);
    return { session: this.rowToView(updated), stageAdvanced: false, completed: false };
  }

  /**
   * Called on server ticks (throttled ~4 Hz per player) to evaluate spatial & timed quest stages:
   * - Navigation waypoints (in sequence)
   * - Rescue beacon arrival
   * - Boss Sanctum switches
   * - Survival timer & timed stage expiration
   */
  public static recordSpatialTick(
    userId: string,
    x: number,
    y: number,
    dtSec: number,
    worldSize = 6000,
    isFrozen = false
  ): {
    session: QuestSessionView;
    stageAdvanced: boolean;
    completed: boolean;
    failed?: boolean;
    feedback?: string;
    autoClaimedToBox?: boolean;
    rewardBoxItem?: RewardBoxEntry;
    npcQuota?: NpcQuotaStatus;
    nextUnlockedLevel?: number;
    nextQuiz?: QuizQuestionClient | null;
  } | null {
    if (isFrozen) return null;
    const conn = db.getRawDb();
    const row = conn.prepare(`
      SELECT * FROM quest_sessions WHERE user_id = ? AND is_main = 1 AND state = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1
    `).get(userId) as any;
    if (!row) return null;

    const obj: StoredObjective = JSON.parse(row.objective_json || '{}');
    const prog: StoredProgress = JSON.parse(row.progress_json || '{}');
    const stage = obj.stages[Number(row.stage_index) || 0];
    if (!stage) return null;

    let changed = false;
    let feedback: string | undefined;

    if (stage.kind === 'survive' || (stage.timeLimitSec && stage.timeLimitSec > 0)) {
      prog.elapsedSec = (prog.elapsedSec || 0) + dtSec;
      changed = true;
      if (stage.kind === 'survive' && prog.elapsedSec >= stage.target) {
        const res = this.advanceStageOrComplete(userId, row, obj, prog);
        return { ...res, feedback: 'SURVIVAL CLEARED!' };
      }
      if (stage.kind !== 'survive' && stage.timeLimitSec && prog.elapsedSec >= stage.timeLimitSec) {
        const now = new Date().toISOString();
        conn.prepare(`UPDATE quest_sessions SET state = 'FAILED', progress_json = ?, updated_at = ? WHERE id = ?`)
          .run(JSON.stringify(prog), now, row.id);
        if (obj.isBossCheckpoint && row.level_number > 0) BossProgressionService.recordFailure(userId, row.level_number, false);
        AnalyticsService.track({ eventType: 'quest_fail', userId, mode: 'explorer', metadata: { sessionId: row.id, questId: row.quest_id, reason: 'timeout' } });
        const failedRow = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(row.id);
        return { session: this.rowToView(failedRow), stageAdvanced: false, completed: false, failed: true, feedback: 'TIME UP — RETRY!' };
      }
    }

    if ((stage.kind === 'navigate' || stage.kind === 'rescue') && stage.waypoints?.length) {
      prog.completedWaypoints = prog.completedWaypoints || [];
      const nextWp = stage.waypoints[prog.completedWaypoints.length];
      if (nextWp) {
        const dx = this.wrapDelta(x - nextWp.x, worldSize);
        const dy = this.wrapDelta(y - nextWp.y, worldSize);
        const r = (nextWp.radius || 75) + 28;
        if (dx * dx + dy * dy <= r * r) {
          prog.completedWaypoints.push(nextWp.id);
          prog.count = prog.completedWaypoints.length;
          changed = true;
          feedback = stage.kind === 'rescue' ? 'VILLAGER RESCUED!' : `${nextWp.label.toUpperCase()} REACHED!`;
          if (prog.count >= stage.target) {
            const res = this.advanceStageOrComplete(userId, row, obj, prog);
            return { ...res, feedback };
          }
        }
      }
    }

    if (stage.kind === 'switches' && stage.switches?.length) {
      prog.activatedSwitches = prog.activatedSwitches || [];
      for (const sw of stage.switches) {
        if (prog.activatedSwitches.includes(sw.id)) continue;
        const dx = this.wrapDelta(x - sw.x, worldSize);
        const dy = this.wrapDelta(y - sw.y, worldSize);
        const r = (sw.radius || 68) + 26;
        if (dx * dx + dy * dy <= r * r) {
          prog.activatedSwitches.push(sw.id);
          prog.count = prog.activatedSwitches.length;
          changed = true;
          feedback = `${sw.label.toUpperCase()} LIT!`;
          if (prog.count >= stage.target) {
            const res = this.advanceStageOrComplete(userId, row, obj, prog);
            return { ...res, feedback };
          }
        }
      }
    }

    if (!changed) return null;
    conn.prepare('UPDATE quest_sessions SET progress_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(prog), new Date().toISOString(), row.id);
    const updated = conn.prepare('SELECT * FROM quest_sessions WHERE id = ?').get(row.id);
    return { session: this.rowToView(updated), stageAdvanced: false, completed: false, feedback };
  }

  /**
   * Idempotent server-authoritative reward claim: CLAIMABLE → CLAIMED.
   * Prevents duplicate claims strictly via atomic state check in SQLite.
   */
  public static claimQuest(userId: string, sessionId?: string): {
    ok: boolean;
    alreadyClaimed?: boolean;
    error?: string;
    rewards?: QuestRewardBundle;
    nextUnlockedLevel?: number;
    milestoneUnlocked?: number;
    legendaryUnlocked?: string;
    profile?: any;
  } {
    const conn = db.getRawDb();
    const row = sessionId
      ? conn.prepare('SELECT * FROM quest_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as any
      : conn.prepare(`SELECT * FROM quest_sessions WHERE user_id = ? AND state = 'CLAIMABLE' ORDER BY updated_at DESC LIMIT 1`).get(userId) as any;

    if (!row) return { ok: false, error: 'No claimable quest found' };
    if (row.state === 'CLAIMED') {
      return { ok: true, alreadyClaimed: true, error: 'Reward already deposited to Reward Box' };
    }
    if (row.state !== 'CLAIMABLE') return { ok: false, error: `Quest is not ready to claim (state: ${row.state})` };

    const now = new Date().toISOString();
    // Atomic CAS update prevents concurrent double-claim race conditions
    const upd = conn.prepare(
      `UPDATE quest_sessions SET state = 'CLAIMED', claimed_at = ?, updated_at = ? WHERE id = ? AND state = 'CLAIMABLE'`
    ).run(now, now, row.id);
    if ((upd.changes || 0) === 0) {
      return { ok: false, alreadyClaimed: true, error: 'Reward already claimed' };
    }

    const obj: StoredObjective = JSON.parse(row.objective_json || '{}');
    const rewards: QuestRewardBundle = JSON.parse(row.reward_json || '{"stars":50,"xp":50,"evoXp":15}');
    let nextUnlockedLevel: number | undefined;
    let milestoneUnlocked: number | undefined;
    let legendaryUnlocked: string | undefined;

    if (obj.isCampaignLevel && row.level_number > 0) {
      if (obj.isBossCheckpoint) {
        const elapsedMs = Math.max(1000, Date.now() - Date.parse(row.started_at || now));
        BossProgressionService.recordVictory(userId, row.level_number, elapsedMs);
      }
      const comp = AdventureProgressionService.recordLevelCompletion(userId, row.level_number, 1);
      nextUnlockedLevel = comp.nextUnlockedLevel;
      milestoneUnlocked = comp.milestoneUnlocked;
      legendaryUnlocked = comp.legendaryUnlocked;

      AnalyticsService.track({
        eventType: 'quest_claim',
        userId,
        mode: 'explorer',
        score: comp.rewardsGranted.stars,
        metadata: { sessionId: row.id, questId: row.quest_id, levelNumber: row.level_number },
      });

      return {
        ok: true,
        rewards: comp.rewardsGranted,
        nextUnlockedLevel,
        milestoneUnlocked,
        legendaryUnlocked,
        profile: comp.profile,
      };
    }

    // Legacy Kingdom quest claim bridge
    if (obj.legacyQuestId) {
      const r: any = ExplorerService.claimQuest(userId, obj.legacyQuestId);
      if (r.success) {
        AnalyticsService.track({ eventType: 'quest_claim', userId, mode: 'explorer', score: r.rewards?.stars || 0, metadata: { sessionId: row.id, questId: row.quest_id } });
        return { ok: true, rewards: r.rewards, profile: r.profile };
      }
    }

    const { profile } = db.grantRewards(userId, { stars: rewards.stars, xp: rewards.xp, evoXp: rewards.evoXp });
    AnalyticsService.track({ eventType: 'quest_claim', userId, mode: 'explorer', score: rewards.stars, metadata: { sessionId: row.id, questId: row.quest_id } });
    return { ok: true, rewards, profile };
  }
}
