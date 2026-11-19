import { db } from '../db/Database';
import { KINGDOMS, kingdomByNumber } from '../config/ExplorerContent';
import { CampaignLevelDef, LevelType, QuestRewardBundle, QuestStageSpec } from '../types';
import { ProgressionService } from './ProgressionService';
import { AnalyticsService } from './AnalyticsService';

export interface CampaignWorldMeta {
  worldNumber: number;
  id: string;
  name: string;
  theme: string;
  icon: string;
  levelStart: number;
  levelEnd: number;
  chapterTitle: string;
  castlePart?: string;
  guardianBossId: string;
  guardianBossName: string;
  guardianBossIcon: string;
}

export interface CampaignProgressRow {
  userId: string;
  adventureLevel: number;
  highestUnlockedLevel: number;
  currentWorld: number;
  completedLevels: number[];
  bossCheckpointsCleared: number[];
  milestonesClaimed: number[];
  legendaryRewards: string[];
  updatedAt: string;
}

// 10-World Campaign Structure (Worlds 1–7 reuse existing kingdoms; Worlds 8–10 extend to Level 1,000)
export const CAMPAIGN_WORLDS: CampaignWorldMeta[] = [
  { worldNumber: 1, id: 'emerald_hollow', name: 'Emerald Hollow', theme: 'forest', icon: '🌳', levelStart: 1, levelEnd: 100, chapterTitle: 'Ch.1–2 · The Lost Prince', castlePart: 'Bridge Restored (Lv.50)', guardianBossId: 'boss_thornmaw', guardianBossName: 'Thornmaw', guardianBossIcon: '🐲' },
  { worldNumber: 2, id: 'sunken_reach', name: 'Sunken Reach', theme: 'riverlands', icon: '🌊', levelStart: 101, levelEnd: 200, chapterTitle: 'Ch.3 · The Sleeping Giant', castlePart: 'Gates Rebuilt (Lv.200)', guardianBossId: 'boss_tidecoil', guardianBossName: 'Tidecoil', guardianBossIcon: '🐉' },
  { worldNumber: 3, id: 'ashfall', name: 'Ashfall', theme: 'volcano', icon: '🔥', levelStart: 201, levelEnd: 300, chapterTitle: 'Ch.4 · Temple of Wisdom', guardianBossId: 'boss_cinderfang', guardianBossName: 'Cinderfang', guardianBossIcon: '🔥' },
  { worldNumber: 4, id: 'white_silence', name: 'White Silence', theme: 'ice', icon: '❄️', levelStart: 301, levelEnd: 400, chapterTitle: 'Ch.5 · The Broken Crown', guardianBossId: 'boss_frostscale', guardianBossName: 'Frostscale', guardianBossIcon: '❄️' },
  { worldNumber: 5, id: 'bloomfall', name: 'Bloomfall', theme: 'tropical', icon: '🌸', levelStart: 401, levelEnd: 500, chapterTitle: 'Ch.6 · The Seven Kingdoms', castlePart: 'Gardens Revived (Lv.500)', guardianBossId: 'boss_petalwyrm', guardianBossName: 'Petalwyrm', guardianBossIcon: '🌺' },
  { worldNumber: 6, id: 'the_hush', name: 'The Hush', theme: 'swamp', icon: '🌑', levelStart: 501, levelEnd: 600, chapterTitle: 'Ch.6 · Shadow March', guardianBossId: 'boss_duskshroud', guardianBossName: 'Duskshroud', guardianBossIcon: '👁️' },
  { worldNumber: 7, id: 'crown_spire', name: 'Crown Spire', theme: 'royal_castle', icon: '👑', levelStart: 601, levelEnd: 700, chapterTitle: 'Ch.7 · The Final Guardian', guardianBossId: 'boss_venom_emperor', guardianBossName: 'Venom Emperor', guardianBossIcon: '👑' },
  { worldNumber: 8, id: 'the_forgotten_wilds', name: 'The Forgotten Wilds', theme: 'ancient_ruins', icon: '🌿', levelStart: 701, levelEnd: 800, chapterTitle: 'Ch.8 · Roots of Legend', castlePart: 'Towers Reconstructed (Lv.800)', guardianBossId: 'boss_wyrmwood', guardianBossName: 'Ancient Wyrmwood', guardianBossIcon: '🌳' },
  { worldNumber: 9, id: 'the_ancient_depths', name: 'The Ancient Depths', theme: 'riverlands', icon: '🌀', levelStart: 801, levelEnd: 900, chapterTitle: 'Ch.8 · Abyssal Trial', guardianBossId: 'boss_abyssal_leviathan', guardianBossName: 'Abyssal Leviathan', guardianBossIcon: '🌀' },
  { worldNumber: 10, id: 'the_final_realm', name: 'The Final Realm', theme: 'royal_castle', icon: '🌟', levelStart: 901, levelEnd: 1000, chapterTitle: 'Ch.8 · Return of the King', castlePart: 'Throne Room Reopened (Lv.1000)', guardianBossId: 'boss_sovereign_eclipse', guardianBossName: 'Sovereign Eclipse', guardianBossIcon: '🌟' },
];

// Boss Archetypes rotating every 10 levels (10, 20, ..., 90 + 100 Major Milestone)
const BOSS_TEN_ARCHETYPES: Record<number, { archetype: string; title: string; mechanic: string; kind: QuestStageSpec['kind']; category?: 'word' | 'math' | 'memory' | 'logic' }> = {
  10: { archetype: 'first_guardian', title: 'First Guardian', mechanic: 'Collect Guardian Shards & activate Sanctum Switches', kind: 'switches' },
  20: { archetype: 'speed_guardian', title: 'Speed Guardian', mechanic: 'Timed rush: gather Wind Stars before the clock expires', kind: 'collect' },
  30: { archetype: 'memory_guardian', title: 'Memory Guardian', mechanic: 'Repeat ancient visual patterns & recall rune symbols', kind: 'quiz', category: 'memory' },
  40: { archetype: 'word_guardian', title: 'Word Guardian', mechanic: 'Break the cipher with Word Guardian challenges', kind: 'quiz', category: 'word' },
  50: { archetype: 'math_guardian', title: 'Math Guardian', mechanic: 'Solve the Arithmetic Guardian trials to shatter its seal', kind: 'quiz', category: 'math' },
  60: { archetype: 'survival_guardian', title: 'Survival Guardian', mechanic: 'Endure volcanic hazards while holding the safe zone', kind: 'survive' },
  70: { archetype: 'navigation_guardian', title: 'Navigation Guardian', mechanic: 'Pass all directional beacons in the exact sequence', kind: 'navigate' },
  80: { archetype: 'strategy_guardian', title: 'Strategy Guardian', mechanic: 'Solve Logic trials & unlock shrine switches', kind: 'quiz', category: 'logic' },
  90: { archetype: 'trial_guardian', title: 'Trial Guardian', mechanic: 'Combined multi-skill trial before the Realm Fortress', kind: 'switches' },
};

const LEVEL_TYPE_ROTATION: LevelType[] = [
  'exploration', 'collection', 'word_puzzle', 'math', 'navigation',
  'memory', 'survival', 'logic', 'rescue', 'boss_challenge',
  'collection', 'word_puzzle', 'math', 'navigation', 'secret',
  'memory', 'logic', 'survival', 'multi_stage', 'boss_challenge',
];

const ENV_EFFECTS_BY_THEME: Record<string, string> = {
  forest: 'Canopy Breeze',
  riverlands: 'River Current',
  volcano: 'Magma Vents',
  ice: 'Black Ice Drift',
  tropical: 'Pollen Gusts',
  swamp: 'Mist Veil',
  ancient_ruins: 'Rune Pulses',
  royal_castle: 'Starlight Surge',
};

export class AdventureProgressionService {
  public static worldForLevel(levelNumber: number): CampaignWorldMeta {
    const clamped = Math.max(1, Math.min(1000, Math.floor(levelNumber || 1)));
    const idx = Math.floor((clamped - 1) / 100);
    return CAMPAIGN_WORLDS[Math.min(CAMPAIGN_WORLDS.length - 1, idx)];
  }

  public static getOverride(entityType: string, entityId: string): any | null {
    const row = db.getRawDb().prepare(
      `SELECT payload_json FROM content_overrides WHERE entity_type = ? AND entity_id = ? AND status = 'published'`
    ).get(entityType, entityId) as { payload_json: string } | undefined;
    if (!row) return null;
    try { return JSON.parse(row.payload_json); } catch { return null; }
  }

  /**
   * Data-driven generator for all 1,000 Adventure Campaign levels with curated Vertical Slice (Levels 1–20),
   * 100 Boss Checkpoints (every 10 levels), 10 Major 3-Stage Milestones (every 100 levels),
   * and Admin CMS override support.
   */
  public static getLevelDef(levelNumber: number): CampaignLevelDef {
    const lvl = Math.max(1, Math.min(1000, Math.floor(levelNumber || 1)));
    const world = this.worldForLevel(lvl);
    const kDef = kingdomByNumber(world.worldNumber) || KINGDOMS[0];
    const withinWorld = ((lvl - 1) % 100) + 1; // 1..100
    const isMajorMilestone = lvl % 100 === 0;
    const isBossCheckpoint = lvl % 10 === 0;
    const difficultyTier = (lvl <= 50 ? 1 : lvl <= 200 ? 2 : lvl <= 450 ? 3 : lvl <= 750 ? 4 : 5) as 1 | 2 | 3 | 4 | 5;

    // Assign a world NPC to host this level's adventure encounter
    const npcList = kDef.npcs;
    const hostNpc = npcList[(lvl - 1) % npcList.length];

    // Smooth, balanced reward scaling (prevents economy inflation while rewarding milestone mastery)
    const baseStars = Math.round(45 + Math.min(350, lvl * 0.45) + (isBossCheckpoint ? 110 : 0) + (isMajorMilestone ? 350 : 0));
    const baseXp = Math.round(55 + Math.min(450, lvl * 0.6) + (isBossCheckpoint ? 140 : 0) + (isMajorMilestone ? 420 : 0));
    const baseEvoXp = Math.round(18 + Math.min(180, lvl * 0.22) + (isBossCheckpoint ? 45 : 0) + (isMajorMilestone ? 180 : 0));
    const rewards: QuestRewardBundle = {
      stars: baseStars,
      xp: baseXp,
      evoXp: baseEvoXp,
      tickets: isMajorMilestone ? (lvl === 1000 ? 10 : 3) : (isBossCheckpoint ? 1 : 0),
      badge: isMajorMilestone ? `${world.id}_guardian_lv${lvl}` : undefined,
      unlockItem: lvl === 1000 ? 'sovereign_eclipse_crown' : (isMajorMilestone ? `milestone_chest_${lvl}` : undefined),
    };

    const difficultyParams = {
      enemySpeedMult: Number((1.0 + Math.min(0.65, (lvl - 1) * 0.00065)).toFixed(3)),
      hazardDensity: Math.min(10, 2 + Math.floor(lvl / 110)),
      puzzleDifficulty: difficultyTier,
      timeLimitSec: isMajorMilestone ? 180 : isBossCheckpoint ? 90 : 0,
      environmentalEffect: ENV_EFFECTS_BY_THEME[world.theme] || 'Canopy Breeze',
    };

    // Deterministic world coordinates centered near the sanctuary (3000, 3000) so objectives are discoverable!
    const mkWaypoints = (count: number, seedOffset: number) => {
      const HALF = 3000;
      const out = [];
      for (let i = 0; i < count; i++) {
        const ang = ((lvl * 1.37 + i * 2.1 + seedOffset) % (Math.PI * 2));
        const dist = 340 + i * 165;
        out.push({
          id: `wp_${lvl}_${i + 1}`,
          label: `Beacon ${i + 1}`,
          x: Math.round(HALF + Math.cos(ang) * dist),
          y: Math.round(HALF + Math.sin(ang) * dist),
          radius: 75,
        });
      }
      return out;
    };

    const mkSwitches = (count: number) => {
      const HALF = 3000;
      const out = [];
      for (let i = 0; i < count; i++) {
        const ang = ((lvl * 0.91 + i * ((Math.PI * 2) / count)) % (Math.PI * 2));
        const dist = 360 + (i % 2) * 110;
        out.push({
          id: `sw_${lvl}_${i + 1}`,
          label: `Rune Switch ${i + 1}`,
          x: Math.round(HALF + Math.cos(ang) * dist),
          y: Math.round(HALF + Math.sin(ang) * dist),
          radius: 68,
        });
      }
      return out;
    };

    let levelType: LevelType;
    let title: string;
    let description: string;
    let expectedDurationSec = 45;
    let stages: QuestStageSpec[];
    let bossId: string | undefined;
    let bossName: string | undefined;
    let bossArchetype: string | undefined;

    if (isMajorMilestone) {
      // ── Every 100 Levels (100, 200, ..., 1000): 3-Stage Major Boss Milestone ──
      levelType = 'boss_challenge';
      bossId = lvl === 1000 ? 'boss_sovereign_eclipse' : `${world.guardianBossId}_m${lvl}`;
      bossName = lvl === 1000 ? 'Sovereign Eclipse (Final Boss)' : `${world.guardianBossName} · Realm Guardian`;
      bossArchetype = lvl === 1000 ? 'final_sovereign_finale' : 'kingdom_guardian_milestone';
      title = lvl === 1000
        ? 'Level 1,000 Finale: The Sovereign Eclipse'
        : `Realm ${world.worldNumber} Milestone: ${world.guardianBossName}`;
      description = lvl === 1000
        ? 'Conquer all three celestial stages — Survival Trial, Wisdom Trial, and Final Guardian — to reclaim the Eternal Crown.'
        : `3-Stage Milestone Boss in ${world.name}: clear the Guardian Trial, pass the Knowledge Trial, and seal ${world.guardianBossName}.`;
      expectedDurationSec = 150;
      const quizCats: Array<'word' | 'math' | 'memory' | 'logic'> = ['math', 'word', 'memory', 'logic'];
      const trialCat = quizCats[(world.worldNumber - 1) % quizCats.length];
      stages = [
        {
          index: 0,
          kind: 'switches',
          label: `Stage 1 · Guardian Trial: Activate ${3 + Math.min(2, Math.floor(world.worldNumber / 4))} Sanctum Seals`,
          target: 3 + Math.min(2, Math.floor(world.worldNumber / 4)),
          switches: mkSwitches(3 + Math.min(2, Math.floor(world.worldNumber / 4))),
          timeLimitSec: 70,
        },
        {
          index: 1,
          kind: 'quiz',
          label: `Stage 2 · Knowledge Trial: Complete ${lvl === 1000 ? 5 : 3} ${trialCat.toUpperCase()} trials`,
          category: trialCat,
          target: lvl === 1000 ? 5 : 3,
          untimed: false,
        },
        {
          index: 2,
          kind: 'boss_objective',
          label: `Stage 3 · Final Guardian: Collect ${6 + world.worldNumber} Guardian Shards to shatter ${world.guardianBossName}`,
          metric: 'star',
          target: 6 + Math.min(8, world.worldNumber),
          timeLimitSec: 90,
        },
      ];
    } else if (isBossCheckpoint) {
      // ── Every 10 Levels (10, 20, 30 ... 990): Objective Boss Checkpoint ──
      const mod100 = withinWorld; // 10, 20, ..., 90
      const arch = BOSS_TEN_ARCHETYPES[mod100] || BOSS_TEN_ARCHETYPES[10];
      levelType = 'boss_challenge';
      bossId = `boss_cp_${lvl}_${arch.archetype}`;
      bossName = `${world.name} ${arch.title}`;
      bossArchetype = arch.archetype;
      title = `Lv.${lvl} Boss · ${arch.title}`;
      description = arch.mechanic;
      expectedDurationSec = 75;

      if (lvl === 10) {
        title = 'Lv.10 Boss · First Guardian (Rootguard)';
        description = 'Collect 5 Forest Shards and activate 2 Sanctum Switches to weaken Rootguard!';
        stages = [
          { index: 0, kind: 'collect', label: 'Phase 1 · Collect 5 Forest Shards (Fruits/Stars)', metric: 'any_food', target: 5 },
          { index: 1, kind: 'switches', label: 'Phase 2 · Activate 2 Sanctum Switches', target: 2, switches: mkSwitches(2) },
        ];
      } else if (lvl === 20) {
        title = 'Lv.20 Boss · Speed Guardian (Gale Serpent)';
        description = 'Collect 6 Wind Collectibles within 45 seconds, then solve a quick Gale Trial!';
        stages = [
          { index: 0, kind: 'collect', label: 'Phase 1 · Gather 6 Wind Collectibles in 45s', metric: 'any_food', target: 6, timeLimitSec: 45 },
          { index: 1, kind: 'quiz', label: 'Phase 2 · Gale Knowledge Seal (2 Math Puzzles)', category: 'math', target: 2, untimed: false },
        ];
      } else if (arch.kind === 'quiz' && arch.category) {
        stages = [
          { index: 0, kind: 'quiz', label: `Phase 1 · ${arch.title} Trial (${3} ${arch.category} challenges)`, category: arch.category, target: 3, untimed: false },
          { index: 1, kind: 'switches', label: 'Phase 2 · Seal the Guardian Sanctum (2 Switches)', target: 2, switches: mkSwitches(2) },
        ];
      } else if (arch.kind === 'survive') {
        stages = [
          { index: 0, kind: 'survive', label: `Phase 1 · Survive ${25 + difficultyTier * 5}s amidst hazards`, target: 25 + difficultyTier * 5 },
          { index: 1, kind: 'collect', label: 'Phase 2 · Claim 4 Guardian Stars', metric: 'any_food', target: 4 },
        ];
      } else if (arch.kind === 'navigate') {
        stages = [
          { index: 0, kind: 'navigate', label: 'Phase 1 · Reach 4 Guardian Beacons in sequence', target: 4, waypoints: mkWaypoints(4, 0.5) },
          { index: 1, kind: 'switches', label: 'Phase 2 · Lock 2 Portal Switches', target: 2, switches: mkSwitches(2) },
        ];
      } else {
        stages = [
          { index: 0, kind: 'collect', label: `Phase 1 · Collect ${5 + difficultyTier} Realm Shards`, metric: 'any_food', target: 5 + difficultyTier, timeLimitSec: 60 },
          { index: 1, kind: 'switches', label: 'Phase 2 · Activate 3 Guardian Switches', target: 3, switches: mkSwitches(3) },
        ];
      }
    } else {
      // ── Standard & Rotating Levels (1–999 non-multiples of 10) ──
      const rotIdx = (lvl - 1) % LEVEL_TYPE_ROTATION.length;
      levelType = LEVEL_TYPE_ROTATION[rotIdx];
      if (lvl % 25 === 15) levelType = 'secret';

      // Hand-crafted Vertical Slice polish for Levels 1–19
      const curatedMeta: Record<number, { type: LevelType; title: string; desc: string; dur: number; stages: QuestStageSpec[] }> = {
        1: {
          type: 'exploration', title: 'First Footsteps in Emerald Hollow',
          desc: 'Explore the forest edge and gather 5 sweet items to awaken your senses.',
          dur: 30,
          stages: [{ index: 0, kind: 'collect', label: 'Collect 5 Forest Foods', metric: 'any_food', target: 5 }],
        },
        2: {
          type: 'collection', title: 'Village Harvest',
          desc: 'Elder Moss asks for 8 bright park collectibles for the village storehouse.',
          dur: 40,
          stages: [{ index: 0, kind: 'collect', label: 'Gather 8 Park Collectibles', metric: 'any_food', target: 8 }],
        },
        3: {
          type: 'word_puzzle', title: 'Runes of the Hollow',
          desc: 'Decode 3 ancient forest word puzzles to restore the signpost markings.',
          dur: 45,
          stages: [{ index: 0, kind: 'quiz', label: 'Solve 3 Word Challenges', category: 'word', target: 3, untimed: true }],
        },
        4: {
          type: 'math', title: 'Star Counter’s Trial',
          desc: 'Help Fen the Trader balance his ledger with 3 arithmetic challenges.',
          dur: 45,
          stages: [{ index: 0, kind: 'quiz', label: 'Solve 3 Math Challenges', category: 'math', target: 3, untimed: true }],
        },
        5: {
          type: 'navigation', title: 'Sanctuary Trail',
          desc: 'Follow the glowing forest beacons in exact order to chart the safe road.',
          dur: 45,
          stages: [{ index: 0, kind: 'navigate', label: 'Visit 3 Forest Beacons in Order', target: 3, waypoints: mkWaypoints(3, 0.2) }],
        },
        6: {
          type: 'memory', title: 'Echoes of the Canopy',
          desc: 'Remember the ancient stone patterns and recall 3 memory trials.',
          dur: 45,
          stages: [{ index: 0, kind: 'quiz', label: 'Complete 3 Memory Challenges', category: 'memory', target: 3, untimed: true }],
        },
        7: {
          type: 'survival', title: 'Ember Squall',
          desc: 'Stay alive for 20 seconds while dodging hazards and collecting healing springs.',
          dur: 30,
          stages: [{ index: 0, kind: 'survive', label: 'Survive for 20 Seconds', target: 20 }],
        },
        8: {
          type: 'logic', title: 'Keeper’s Riddle',
          desc: 'Outsmart the forest locks by solving 3 logic and strategy puzzles.',
          dur: 45,
          stages: [{ index: 0, kind: 'quiz', label: 'Solve 3 Logic Puzzles', category: 'logic', target: 3, untimed: true }],
        },
        9: {
          type: 'rescue', title: 'Rescue Stranded Pip',
          desc: 'Follow the distress signal beacon and reach Pip safely.',
          dur: 40,
          stages: [{ index: 0, kind: 'rescue', label: 'Reach & Rescue Pip at the Shrine', target: 1, waypoints: mkWaypoints(1, 1.1), rescueNpcId: 'npc_villager_pip' }],
        },
        11: {
          type: 'collection', title: 'Sunfruit Run',
          desc: 'Gather 10 park fruits to fuel the eastern patrol.',
          dur: 45,
          stages: [{ index: 0, kind: 'collect', label: 'Collect 10 Park Foods', metric: 'any_food', target: 10 }],
        },
        12: {
          type: 'word_puzzle', title: 'Scroll of the Scouts',
          desc: 'Unscramble 3 scout messages to uncover Venom Order routes.',
          dur: 50,
          stages: [{ index: 0, kind: 'quiz', label: 'Complete 3 Word Puzzles', category: 'word', target: 3, untimed: true }],
        },
        13: {
          type: 'math', title: 'Bridge Architect',
          desc: 'Calculate the stone spans by solving 3 math challenges.',
          dur: 50,
          stages: [{ index: 0, kind: 'quiz', label: 'Solve 3 Math Problems', category: 'math', target: 3, untimed: true }],
        },
        14: {
          type: 'navigation', title: 'Four-Wind Waypoints',
          desc: 'Glide through 4 forest checkpoints in order.',
          dur: 55,
          stages: [{ index: 0, kind: 'navigate', label: 'Reach 4 Waypoints in Order', target: 4, waypoints: mkWaypoints(4, 0.8) }],
        },
        15: {
          type: 'secret', title: 'Secret Glade of Switches',
          desc: 'Hidden Challenge! Activate 3 glowing glade rune switches for bonus treasure.',
          dur: 55,
          stages: [{ index: 0, kind: 'switches', label: 'Activate 3 Hidden Rune Switches', target: 3, switches: mkSwitches(3) }],
        },
        16: {
          type: 'memory', title: 'Lantern Recall',
          desc: 'Recall 3 lantern sequences from the deep grove.',
          dur: 50,
          stages: [{ index: 0, kind: 'quiz', label: 'Pass 3 Memory Trials', category: 'memory', target: 3, untimed: false }],
        },
        17: {
          type: 'logic', title: 'Path of Wisdom',
          desc: 'Choose optimal routes and solve 3 strategy riddles.',
          dur: 50,
          stages: [{ index: 0, kind: 'quiz', label: 'Pass 3 Logic Trials', category: 'logic', target: 3, untimed: false }],
        },
        18: {
          type: 'survival', title: 'Thorny Gale',
          desc: 'Survive 25 seconds outside hazards while keeping HP above zero.',
          dur: 35,
          stages: [{ index: 0, kind: 'survive', label: 'Survive 25 Seconds', target: 25 }],
        },
        19: {
          type: 'multi_stage', title: 'Before the Gale Guardian',
          desc: 'Multi-Stage Trial: Gather 6 items, then solve 2 Word runes to unlock Level 20!',
          dur: 70,
          stages: [
            { index: 0, kind: 'collect', label: 'Stage 1 · Gather 6 Wind Items', metric: 'any_food', target: 6 },
            { index: 1, kind: 'quiz', label: 'Stage 2 · Decode 2 Wind Words', category: 'word', target: 2, untimed: false },
          ],
        },
      };

      const curated = curatedMeta[lvl];
      if (curated) {
        levelType = curated.type;
        title = curated.title;
        description = curated.desc;
        expectedDurationSec = curated.dur;
        stages = curated.stages;
      } else {
        // Template-driven generator for Levels 21–999
        const qCount = Math.min(5, 3 + Math.floor(difficultyTier / 2));
        const collectTarget = Math.min(24, 6 + Math.floor(withinWorld / 12) + difficultyTier * 2);
        const surviveSec = Math.min(55, 20 + difficultyTier * 6);
        switch (levelType) {
          case 'word_puzzle':
            title = `${world.name} Word Scroll #${withinWorld}`;
            description = `Solve ${qCount} word puzzles to decipher ${world.name}'s ancient lore.`;
            expectedDurationSec = 55;
            stages = [{ index: 0, kind: 'quiz', label: `Solve ${qCount} Word Puzzles`, category: 'word', target: qCount, untimed: difficultyTier <= 2 }];
            break;
          case 'math':
            title = `${world.name} Star Ledger #${withinWorld}`;
            description = `Solve ${qCount} math trials to balance the Starlight Obelisk.`;
            expectedDurationSec = 55;
            stages = [{ index: 0, kind: 'quiz', label: `Solve ${qCount} Math Challenges`, category: 'math', target: qCount, untimed: difficultyTier <= 2 }];
            break;
          case 'memory':
            title = `${world.name} Echoes #${withinWorld}`;
            description = `Pass ${qCount} visual pattern & memory trials in ${world.name}.`;
            expectedDurationSec = 55;
            stages = [{ index: 0, kind: 'quiz', label: `Complete ${qCount} Memory Trials`, category: 'memory', target: qCount, untimed: difficultyTier <= 2 }];
            break;
          case 'logic':
            title = `${world.name} Strategy Seal #${withinWorld}`;
            description = `Crack ${qCount} logic & path-choice puzzles to unseal the shrine.`;
            expectedDurationSec = 55;
            stages = [{ index: 0, kind: 'quiz', label: `Solve ${qCount} Logic Riddles`, category: 'logic', target: qCount, untimed: difficultyTier <= 2 }];
            break;
          case 'navigation':
            title = `${world.name} Wayfinder #${withinWorld}`;
            description = `Navigate through ${3 + (difficultyTier >= 3 ? 1 : 0)} beacons in exact sequence.`;
            expectedDurationSec = 55;
            stages = [{ index: 0, kind: 'navigate', label: `Reach ${3 + (difficultyTier >= 3 ? 1 : 0)} Beacons in Order`, target: 3 + (difficultyTier >= 3 ? 1 : 0), waypoints: mkWaypoints(3 + (difficultyTier >= 3 ? 1 : 0), lvl * 0.17) }];
            break;
          case 'survival':
            title = `${world.name} Endurance #${withinWorld}`;
            description = `Survive ${surviveSec} seconds amid ${difficultyParams.environmentalEffect}.`;
            expectedDurationSec = surviveSec + 10;
            stages = [{ index: 0, kind: 'survive', label: `Survive ${surviveSec} Seconds`, target: surviveSec }];
            break;
          case 'rescue':
            title = `Rescue Mission · ${world.name} #${withinWorld}`;
            description = `Reach the stranded traveler in ${world.name} and clear 2 rescue switches.`;
            expectedDurationSec = 60;
            stages = [
              { index: 0, kind: 'rescue', label: 'Locate Stranded Villager', target: 1, waypoints: mkWaypoints(1, lvl * 0.33), rescueNpcId: hostNpc.id },
              { index: 1, kind: 'collect', label: 'Gather 4 Healing Fruits for Rescue', metric: 'any_food', target: 4 },
            ];
            break;
          case 'secret':
            title = `Hidden Vault of ${world.name} #${withinWorld}`;
            description = 'Bonus Secret Level! Activate the hidden rune switches for extra Stars & Tickets.';
            expectedDurationSec = 65;
            rewards.stars = Math.round(rewards.stars * 1.4);
            rewards.tickets = (rewards.tickets || 0) + 1;
            stages = [{ index: 0, kind: 'switches', label: 'Activate 3 Secret Rune Switches', target: 3, switches: mkSwitches(3) }];
            break;
          case 'multi_stage': {
            const cats: Array<'word' | 'math' | 'memory' | 'logic'> = ['word', 'math', 'memory', 'logic'];
            const cat = cats[lvl % cats.length];
            title = `${world.name} Grand Trial #${withinWorld}`;
            description = `Two-stage challenge: harvest realm energy, then clear ${cat} trials.`;
            expectedDurationSec = 85;
            stages = [
              { index: 0, kind: 'collect', label: `Stage 1 · Collect ${Math.min(12, Math.ceil(collectTarget * 0.65))} Realm Items`, metric: 'any_food', target: Math.min(12, Math.ceil(collectTarget * 0.65)) },
              { index: 1, kind: 'quiz', label: `Stage 2 · Complete 2 ${cat.toUpperCase()} Puzzles`, category: cat, target: 2, untimed: false },
            ];
            break;
          }
          default:
            title = `${world.name} Harvest #${withinWorld}`;
            description = `Explore ${world.name} and gather ${collectTarget} collectibles.`;
            expectedDurationSec = 50;
            stages = [{ index: 0, kind: 'collect', label: `Collect ${collectTarget} Realm Collectibles`, metric: 'any_food', target: collectTarget }];
            break;
        }
      }
    }

    const baseDef: CampaignLevelDef = {
      levelId: `lvl_${lvl}`,
      levelNumber: lvl,
      worldNumber: world.worldNumber,
      worldId: world.id,
      worldName: world.name,
      theme: world.theme,
      title,
      description,
      levelType,
      difficultyTier,
      expectedDurationSec,
      isBossCheckpoint,
      isMajorMilestone,
      bossId,
      bossName,
      bossArchetype,
      npcId: hostNpc.id,
      npcName: hostNpc.name,
      stages,
      difficultyParams,
      rewards,
      unlockRequirement: Math.max(1, lvl - 1),
    };

    // Apply optional Admin CMS content override without requiring a code deploy
    const override = this.getOverride('campaign_level', `lvl_${lvl}`);
    if (override && typeof override === 'object') {
      return {
        ...baseDef,
        title: override.title ?? baseDef.title,
        description: override.description ?? baseDef.description,
        difficultyTier: override.difficultyTier ?? baseDef.difficultyTier,
        expectedDurationSec: override.expectedDurationSec ?? baseDef.expectedDurationSec,
        rewards: override.rewards ? { ...baseDef.rewards, ...override.rewards } : baseDef.rewards,
        difficultyParams: override.difficultyParams ? { ...baseDef.difficultyParams, ...override.difficultyParams } : baseDef.difficultyParams,
      };
    }
    return baseDef;
  }

  public static getProgress(userId: string): CampaignProgressRow {
    const conn = db.getRawDb();
    let row = conn.prepare('SELECT * FROM player_campaign_progress WHERE user_id = ?').get(userId) as any;
    if (!row) {
      const now = new Date().toISOString();
      conn.prepare(`
        INSERT OR IGNORE INTO player_campaign_progress (
          user_id, adventure_level, highest_unlocked_level, current_world,
          completed_levels_json, boss_checkpoints_json, milestones_claimed_json,
          legendary_rewards_json, updated_at
        ) VALUES (?, 1, 1, 1, '[]', '[]', '[]', '[]', ?)
      `).run(userId, now);
      row = conn.prepare('SELECT * FROM player_campaign_progress WHERE user_id = ?').get(userId);
    }
    const parseNums = (s: string | null): number[] => {
      try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.map(Number).filter(Number.isFinite) : []; } catch { return []; }
    };
    const parseStrs = (s: string | null): string[] => {
      try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
    };
    return {
      userId,
      adventureLevel: row?.adventure_level || 1,
      highestUnlockedLevel: row?.highest_unlocked_level || 1,
      currentWorld: row?.current_world || 1,
      completedLevels: parseNums(row?.completed_levels_json),
      bossCheckpointsCleared: parseNums(row?.boss_checkpoints_json),
      milestonesClaimed: parseNums(row?.milestones_claimed_json),
      legendaryRewards: parseStrs(row?.legendary_rewards_json),
      updatedAt: row?.updated_at || new Date().toISOString(),
    };
  }

  private static saveProgress(p: CampaignProgressRow) {
    p.updatedAt = new Date().toISOString();
    db.getRawDb().prepare(`
      UPDATE player_campaign_progress
      SET adventure_level = ?, highest_unlocked_level = ?, current_world = ?,
          completed_levels_json = ?, boss_checkpoints_json = ?,
          milestones_claimed_json = ?, legendary_rewards_json = ?, updated_at = ?
      WHERE user_id = ?
    `).run(
      p.adventureLevel,
      p.highestUnlockedLevel,
      p.currentWorld,
      JSON.stringify(p.completedLevels),
      JSON.stringify(p.bossCheckpointsCleared),
      JSON.stringify(p.milestonesClaimed),
      JSON.stringify(p.legendaryRewards),
      p.updatedAt,
      p.userId
    );
  }

  /**
   * Server-authoritative completion of an Adventure Campaign Level (invoked ONLY by QuestEngineService
   * after server-verified stage completion — never trusted directly from clients).
   */
  public static recordLevelCompletion(
    userId: string,
    levelNumber: number,
    qualityMultiplier = 1,
    opts?: { deferWalletCredit?: boolean }
  ): {
    firstClear: boolean;
    nextUnlockedLevel: number;
    rewardsGranted: QuestRewardBundle;
    milestoneUnlocked?: number;
    legendaryUnlocked?: string;
    progress: CampaignProgressRow;
    profile: any;
  } {
    const def = this.getLevelDef(levelNumber);
    const prog = this.getProgress(userId);
    const firstClear = !prog.completedLevels.includes(levelNumber);

    if (firstClear) {
      prog.completedLevels = [...prog.completedLevels, levelNumber].sort((a, b) => a - b);
      if (def.isBossCheckpoint && !prog.bossCheckpointsCleared.includes(levelNumber)) {
        prog.bossCheckpointsCleared = [...prog.bossCheckpointsCleared, levelNumber].sort((a, b) => a - b);
      }
      if (levelNumber >= prog.highestUnlockedLevel && levelNumber < 1000) {
        prog.highestUnlockedLevel = levelNumber + 1;
      }
      prog.adventureLevel = Math.max(prog.adventureLevel, prog.highestUnlockedLevel);
      prog.currentWorld = this.worldForLevel(prog.adventureLevel).worldNumber;
    }

    // First-clear grants full scaled rewards; replay grants reduced 30% reward (prevents farming abuse)
    const mult = firstClear ? Math.max(0.8, Math.min(1.25, qualityMultiplier)) : 0.3;
    const rewardsGranted: QuestRewardBundle = {
      stars: Math.round(def.rewards.stars * mult),
      xp: Math.round(def.rewards.xp * mult),
      evoXp: Math.round(def.rewards.evoXp * mult),
      tickets: firstClear ? (def.rewards.tickets || 0) : 0,
      badge: firstClear ? def.rewards.badge : undefined,
      unlockItem: firstClear ? def.rewards.unlockItem : undefined,
    };

    let milestoneUnlocked: number | undefined;
    let legendaryUnlocked: string | undefined;
    if (firstClear && def.isMajorMilestone && !prog.milestonesClaimed.includes(levelNumber)) {
      prog.milestonesClaimed = [...prog.milestonesClaimed, levelNumber].sort((a, b) => a - b);
      milestoneUnlocked = levelNumber;
      if (levelNumber === 1000 && !prog.legendaryRewards.includes('sovereign_eclipse_collection')) {
        prog.legendaryRewards = [...prog.legendaryRewards, 'sovereign_eclipse_collection'];
        legendaryUnlocked = 'Sovereign Eclipse Legendary Collection';
      }
    }

    this.saveProgress(prog);

    let profile = db.getProfile(userId);
    if (!opts?.deferWalletCredit) {
      const granted = db.grantRewards(userId, {
        stars: rewardsGranted.stars,
        xp: rewardsGranted.xp,
        evoXp: rewardsGranted.evoXp,
      });
      profile = granted.profile;
      if (rewardsGranted.tickets && profile) {
        db.updateProfile(userId, { tickets: (profile.tickets || 0) + rewardsGranted.tickets });
      }
    }
    if (legendaryUnlocked && profile) {
      const skins = new Set(profile.unlockedSkins || ['Forest', 'Jungle']);
      skins.add('Mythical');
      skins.add('Royal');
      const accs = new Set(profile.unlockedAccessories || ['flower_crown']);
      accs.add('golden_wings');
      db.updateProfile(userId, {
        unlockedSkins: Array.from(skins),
        unlockedAccessories: Array.from(accs),
        title: 'Sovereign of Coils',
      });
    }

    AnalyticsService.track({
      eventType: 'adventure_level_complete',
      userId,
      mode: 'explorer',
      score: rewardsGranted.stars,
      metadata: {
        levelNumber,
        worldNumber: def.worldNumber,
        levelType: def.levelType,
        firstClear,
        isBossCheckpoint: def.isBossCheckpoint,
        isMajorMilestone: def.isMajorMilestone,
      },
    });

    return {
      firstClear,
      nextUnlockedLevel: prog.highestUnlockedLevel,
      rewardsGranted,
      milestoneUnlocked,
      legendaryUnlocked,
      progress: prog,
      profile: db.getProfile(userId),
    };
  }

  public static getOverview(userId: string, opts?: { world?: number; page?: number; pageSize?: number }) {
    const prog = this.getProgress(userId);
    const profile = db.getProfile(userId);
    const worldNum = Math.max(1, Math.min(10, Number(opts?.world) || prog.currentWorld || 1));
    const world = CAMPAIGN_WORLDS[worldNum - 1];
    const pageSize = Math.max(5, Math.min(25, Number(opts?.pageSize) || 20));
    const totalPages = Math.ceil(100 / pageSize);
    const defaultPage = Math.floor(((Math.min(world.levelEnd, Math.max(world.levelStart, prog.highestUnlockedLevel)) - world.levelStart)) / pageSize);
    const page = Math.max(0, Math.min(totalPages - 1, opts?.page !== undefined ? Number(opts.page) : defaultPage));

    const completedSet = new Set(prog.completedLevels);
    const bossSet = new Set(prog.bossCheckpointsCleared);

    const startLvl = world.levelStart + page * pageSize;
    const endLvl = Math.min(world.levelEnd, startLvl + pageSize - 1);
    const levels = [];
    for (let l = startLvl; l <= endLvl; l++) {
      const def = this.getLevelDef(l);
      levels.push({
        ...def,
        unlocked: l <= prog.highestUnlockedLevel,
        completed: completedSet.has(l),
        bossDefeated: bossSet.has(l),
        isCurrent: l === prog.highestUnlockedLevel,
      });
    }

    const worlds = CAMPAIGN_WORLDS.map(w => {
      const clearedInWorld = prog.completedLevels.filter(l => l >= w.levelStart && l <= w.levelEnd).length;
      const bossesInWorld = prog.bossCheckpointsCleared.filter(l => l >= w.levelStart && l <= w.levelEnd).length;
      return {
        ...w,
        unlocked: prog.highestUnlockedLevel >= w.levelStart,
        completed: clearedInWorld >= 100 || prog.milestonesClaimed.includes(w.levelEnd),
        levelsCleared: clearedInWorld,
        bossesCleared: bossesInWorld,
        milestoneClaimed: prog.milestonesClaimed.includes(w.levelEnd),
      };
    });

    const accountLevel = profile?.level || 1;
    const prestige = profile?.prestige || 0;
    return {
      // Strictly separated progression axes (Phase 3.1)
      axes: {
        adventureLevel: prog.adventureLevel,
        highestUnlockedLevel: prog.highestUnlockedLevel,
        campaignCompletionPct: Number(((prog.completedLevels.length / 1000) * 100).toFixed(2)),
        accountLevel,
        evolutionTier: profile?.equippedEvolution || 'Baby',
        unlockedEvolutions: ProgressionService.unlockedEvolutions(accountLevel, profile?.evolutionXp || 0, prestige),
        prestige,
        currentWorld: worldNum,
        bossCheckpointsCleared: prog.bossCheckpointsCleared.length,
        bossCheckpointsTotal: 100,
        majorMilestonesCleared: prog.milestonesClaimed.length,
        majorMilestonesTotal: 10,
      },
      world,
      worlds,
      page,
      totalPages,
      levels,
      legendaryRewards: prog.legendaryRewards,
    };
  }
}

