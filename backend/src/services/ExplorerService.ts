import { db } from '../db/Database';
import { ALL_WORLDS, KINGDOMS, KingdomDef, NpcDef, QuestDef, kingdomByNumber, questById, npcById, bossById } from '../config/ExplorerContent';
import { AnalyticsService } from './AnalyticsService';
import { PlayerProfile } from '../types';

export interface QuestView extends QuestDef {
  accepted: boolean;
  completed: boolean;
  claimed: boolean;
  progress: number;
  pct: number;
}

export interface NpcView extends NpcDef {
  line: string;
  questState: 'none' | 'offer' | 'active' | 'ready' | 'done';
  quest?: QuestView;
}

export interface KingdomView {
  n: number; id: string; name: string; theme: string; icon: string;
  intro: string; outro: string; unlockLevel: number;
  unlocked: boolean; completed: boolean; current: boolean;
  questsDone: number; questsTotal: number;
  boss?: { id: string; name: string; icon: string; intro: string; unlockLevel: number; unlocked: boolean; defeated: boolean; hp: number; score: number };
}

export interface ExplorerState {
  kingdom: number;
  accepted: string[];
  claimed: string[];
  kingdomsDone: number[];
  bossesDefeated: string[];
  baseline: Record<string, number>;
}

export class ExplorerService {
  static getState(profile: PlayerProfile): ExplorerState {
    const raw = (profile as any).explorer as Partial<ExplorerState> | undefined;
    return {
      kingdom: raw?.kingdom || 1,
      accepted: raw?.accepted || [],
      claimed: raw?.claimed || [],
      kingdomsDone: raw?.kingdomsDone || [],
      bossesDefeated: raw?.bossesDefeated || [],
      baseline: raw?.baseline || {},
    };
  }

  private static save(userId: string, state: ExplorerState) {
    db.updateProfile(userId, { explorer: state } as any);
  }

  private static metricValue(profile: PlayerProfile, metric: string): number {
    const s: any = profile.stats || {};
    const generic = s.collectibles?.[metric];
    if (typeof generic === 'number') return generic;
    const named: Record<string, string> = {
      cherry: 'cherriesCollected', apple: 'applesCollected', frog: 'frogsCollected',
      star: 'totalStars', kill: 'totalKills', boost: 'totalBoostsUsed',
    };
    return s[named[metric]] || 0;
  }

  private static questProgress(profile: PlayerProfile, state: ExplorerState, q: QuestDef): number {
    if (!state.accepted.includes(q.id)) return 0;
    const now = this.metricValue(profile, q.metric);
    const base = state.baseline[q.id] ?? now;
    return Math.max(0, Math.min(q.target, now - base));
  }

  static questView(profile: PlayerProfile, state: ExplorerState, q: QuestDef): QuestView {
    const progress = this.questProgress(profile, state, q);
    return {
      ...q,
      accepted: state.accepted.includes(q.id),
      completed: progress >= q.target,
      claimed: state.claimed.includes(q.id),
      progress,
      pct: q.target > 0 ? Math.min(100, Math.round((progress / q.target) * 100)) : 100,
    };
  }

  static kingdomUnlocked(profile: PlayerProfile, state: ExplorerState, k: KingdomDef): boolean {
    if ((profile.level || 1) < k.unlockLevel) return false;
    if (k.n === 1) return true;
    return state.kingdomsDone.includes(k.n - 1);
  }

  static kingdomView(profile: PlayerProfile, state: ExplorerState, k: KingdomDef): KingdomView {
    const done = k.quests.filter(q => state.claimed.includes(q.id)).length;
    const boss = k.boss ? {
      id: k.boss.id,
      name: k.boss.name,
      icon: k.boss.icon,
      intro: k.boss.intro,
      unlockLevel: k.boss.unlockLevel,
      hp: k.boss.hp,
      score: k.boss.score,
      unlocked: done >= k.quests.length && k.quests.length > 0 && (profile.level || 1) >= k.boss.unlockLevel,
      defeated: state.bossesDefeated.includes(k.boss.id),
    } : undefined;
    return {
      n: k.n, id: k.id, name: k.name, theme: k.theme, icon: k.icon,
      intro: k.intro, outro: k.outro, unlockLevel: k.unlockLevel,
      unlocked: this.kingdomUnlocked(profile, state, k),
      completed: state.kingdomsDone.includes(k.n),
      current: state.kingdom === k.n,
      questsDone: done, questsTotal: k.quests.length,
      boss,
    };
  }

  static npcView(profile: PlayerProfile, state: ExplorerState, npc: NpcDef): NpcView {
    if (!npc.questId) return { ...npc, line: npc.greeting, questState: 'none' };
    const q = questById(npc.questId);
    if (!q) return { ...npc, line: npc.greeting, questState: 'none' };
    const view = this.questView(profile, state, q);

    if (view.claimed) return { ...npc, line: npc.afterQuest || npc.greeting, questState: 'done', quest: view };
    if (view.completed) return { ...npc, line: `${npc.afterQuest || 'You did it.'}`, questState: 'ready', quest: view };
    if (view.accepted) return { ...npc, line: `${q.brief} (${view.progress}/${q.target})`, questState: 'active', quest: view };
    return { ...npc, line: npc.greeting, questState: 'offer', quest: view };
  }

  static overview(userId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return null;
    const state = this.getState(profile);
    const kingdoms = KINGDOMS.map(k => this.kingdomView(profile, state, k));
    const current = kingdomByNumber(state.kingdom) || KINGDOMS[0];
    return {
      kingdom: this.kingdomView(profile, state, current),
      kingdoms,
      npcs: current.npcs.map(n => this.npcView(profile, state, n)),
      quests: current.quests.map(q => this.questView(profile, state, q)),
      activeQuest: current.quests.map(q => this.questView(profile, state, q))
        .find(q => q.accepted && !q.claimed) || null,
    };
  }

  static selectKingdom(userId: string, kingdomNum: number): { success: boolean; message: string; overview?: any } {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    const k = kingdomByNumber(kingdomNum);
    if (!k) return { success: false, message: 'Unknown kingdom' };
    const state = this.getState(profile);
    if (!this.kingdomUnlocked(profile, state, k)) {
      return { success: false, message: `${k.name} unlocks at Level ${k.unlockLevel} after clearing Kingdom ${k.n - 1}` };
    }
    state.kingdom = k.n;
    this.save(userId, state);
    return { success: true, message: `Entered ${k.name}`, overview: this.overview(userId) };
  }

  static acceptQuest(userId: string, questId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    const q = questById(questId);
    if (!q) return { success: false, message: 'Unknown quest' };

    const state = this.getState(profile);
    const k = kingdomByNumber(q.kingdom)!;
    if (!this.kingdomUnlocked(profile, state, k)) return { success: false, message: `${k.name} is not open to you yet` };
    if (state.claimed.includes(questId)) return { success: false, message: 'Already completed' };
    if (state.accepted.includes(questId)) return { success: false, message: 'Already accepted' };

    state.accepted = [...state.accepted, questId];
    state.baseline = { ...state.baseline, [questId]: this.metricValue(profile, q.metric) };
    this.save(userId, state);
    return { success: true, message: `Accepted: ${q.title}`, quest: this.questView(db.getProfile(userId)!, state, q) };
  }

  static claimQuest(userId: string, questId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    const q = questById(questId);
    if (!q) return { success: false, message: 'Unknown quest' };

    const state = this.getState(profile);
    if (state.claimed.includes(questId)) return { success: false, alreadyClaimed: true, message: 'Already claimed' };
    if (!state.accepted.includes(questId)) return { success: false, message: 'Accept the quest first' };

    const progress = this.questProgress(profile, state, q);
    if (progress < q.target) return { success: false, message: `Not finished — ${progress}/${q.target}` };

    state.claimed = [...state.claimed, questId];

    let kingdomCompleted = false;
    if (q.completesKingdom && !state.kingdomsDone.includes(q.kingdom)) {
      state.kingdomsDone = [...state.kingdomsDone, q.kingdom];
      kingdomCompleted = true;
      const next = kingdomByNumber(q.kingdom + 1);
      if (next) state.kingdom = next.n;
    }
    this.save(userId, state);

    const { profile: updated, levelsGained } = db.grantRewards(userId, {
      stars: q.rewardStars, xp: q.rewardXp, evoXp: q.rewardEvoXp,
    });

    AnalyticsService.track({
      eventType: 'story_quest_complete',
      userId,
      mode: 'explorer',
      metadata: { questId: q.id, kingdom: q.kingdom, kingdomCompleted },
    });

    return {
      success: true,
      message: q.title,
      rewards: { stars: q.rewardStars, xp: q.rewardXp, evoXp: q.rewardEvoXp },
      levelsGained,
      kingdomCompleted,
      unlockedKingdom: kingdomCompleted ? kingdomByNumber(q.kingdom + 1)?.name : undefined,
      nextQuest: q.unlocksQuest ? questById(q.unlocksQuest)?.title : undefined,
      profile: updated,
    };
  }

  /** Record a Kingdom Boss defeat, award scaled campaign rewards, and update analytics. */
  static recordBossDefeat(userId: string, bossId: string) {
    const profile = db.getProfile(userId);
    if (!profile) return { success: false, message: 'Profile not found' };
    const boss = bossById(bossId);
    if (!boss) return { success: false, message: 'Unknown boss' };

    const state = this.getState(profile);
    const k = kingdomByNumber(boss.kingdom)!;
    if (!this.kingdomUnlocked(profile, state, k)) {
      return { success: false, message: `${k.name} is not unlocked yet` };
    }

    const firstTime = !state.bossesDefeated.includes(boss.id);
    if (firstTime) state.bossesDefeated = [...state.bossesDefeated, boss.id];
    this.save(userId, state);

    const baseStars = 400 * boss.kingdom;
    const rewardStars = firstTime ? baseStars : Math.round(baseStars * 0.35);
    const rewardXp = firstTime ? 350 * boss.kingdom : 120 * boss.kingdom;
    const rewardEvoXp = firstTime ? 150 * boss.kingdom : 50 * boss.kingdom;

    const { profile: updated, levelsGained } = db.grantRewards(userId, {
      stars: rewardStars, xp: rewardXp, evoXp: rewardEvoXp,
    });

    if (updated) {
      const nextStats = { ...updated.stats, bossKills: (updated.stats.bossKills || 0) + 1 };
      const modeStats = { ...(updated.modeStats || {}) };
      const expStats = {
        matchesPlayed: 0, wins: 0, losses: 0, highestScore: 0, kills: 0, deaths: 0, longestSurvivalSeconds: 0, stars: 0,
        ...(modeStats.explorer || {}),
      };
      expStats.chaptersCompleted = Math.max(expStats.chaptersCompleted || 0, state.bossesDefeated.length);
      modeStats.explorer = expStats;
      db.updateProfile(userId, { stats: nextStats, modeStats });
    }

    AnalyticsService.track({
      eventType: 'story_boss_defeat',
      userId,
      mode: 'boss',
      score: boss.score,
      metadata: { bossId: boss.id, bossName: boss.name, kingdom: boss.kingdom, firstTime },
    });

    return {
      success: true,
      firstTime,
      boss,
      rewards: { stars: rewardStars, xp: rewardXp, evoXp: rewardEvoXp },
      levelsGained,
      profile: db.getProfile(userId),
      overview: this.overview(userId),
    };
  }

  static npcPlacements(worldSize: number, kingdomNumber?: number) {
    const list = kingdomNumber !== undefined
      ? ALL_WORLDS.filter(k => k.n === kingdomNumber)
      : ALL_WORLDS;
    return list.flatMap(k => k.npcs.map(n => ({
      ...n, kingdom: k.n,
      wx: n.at.x * worldSize, wy: n.at.y * worldSize,
    })));
  }
}

export { KINGDOMS, npcById, bossById, kingdomByNumber };
