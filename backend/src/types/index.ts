export type UserRole = 'player' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'disabled' | 'banned';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  status: UserStatus;
  isGuest: boolean;
  createdAt: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
  mfaEnabled?: boolean;
}

export type Evolution = 'Baby' | 'Young' | 'Teen' | 'Adult' | 'Elite' | 'Titan' | 'Legend' | 'King';

// Score thresholds that drive in-match visual stage (separate from permanent Evolution XP ladder)
export const SCORE_EVOLUTION_THRESHOLDS: Array<{ stage: Evolution; scoreMin: number }> = [
  { stage: 'Baby',   scoreMin: 0 },
  { stage: 'Young',  scoreMin: 500 },
  { stage: 'Teen',   scoreMin: 1000 },
  { stage: 'Adult',  scoreMin: 1500 },
  { stage: 'Elite',  scoreMin: 2000 },
  { stage: 'Titan',  scoreMin: 2500 },
];

export type AccessorySlot = 'hat' | 'neck' | 'back';

export interface Accessory {
  id: string;
  name: string;
  icon: string;
  slot: AccessorySlot;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  seasonal?: boolean;
  costStars?: number;
  costTickets?: number;
  minLevel?: number;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  avatarUrl: string;
  level: number;         // Account Level 1-1000 (permanent, cross-device)
  xp: number;            // XP toward the next account level
  evolutionXp: number;   // separate currency that gates snake evolutions
  prestige: number;      // prestige stars earned after hitting level 1000
  rating: number;        // Elo / MMR rating
  stars: number;         // Primary soft currency
  tickets: number;       // Premium battle pass tickets
  // §social Public, shareable player identifier ("AP-XXXX-XXXX"). Safe to print, screenshot
  // and send to anyone — unlike `userId`, which is an internal account key and never leaves
  // the server. Friend requests can be addressed by this or by exact username.
  friendCode: string;
  equippedSkin: string;
  unlockedSkins: string[];       // owned skin ids — the server refuses to equip anything else
  equippedEvolution: Evolution;
  unlockedEvolutions: Evolution[];
  equippedTrail: string;
  equippedAccessory?: string;    // cosmetic accessory id
  unlockedAccessories: string[]; // list of owned accessory ids
  stats: PlayerStats;
  modeStats?: ModeStatsMap;      // §V7 per-mode independent statistics
  coupons?: CouponReward[];
  // §5/§6 Onboarding + editable profile fields (persisted across devices)
  avatar?: string;               // emoji/avatar chosen at onboarding or profile edit
  title?: string;                // cosmetic player title
  country?: string;
  language?: string;
  preferredRegion?: string;
  lastNameChange?: number;       // epoch ms of the last display-name change (cooldown gate)
  lastAdClaim?: number;          // epoch ms of the last /api/ads/claim (anti-farm cooldown)
  // §milestone Story checkpoints reached, ever. One-time and permanent: the reward is banked
  // the moment it is earned mid-match, so a crash or a quit can't undo the journey.
  milestones?: string[];
  // §explorer Campaign save: current kingdom, accepted/claimed quests, kingdoms completed,
  // bosses defeated, and the metric baselines that make quest targets mean "this many more".
  explorer?: {
    kingdom: number;
    accepted: string[];
    claimed: string[];
    kingdomsDone: number[];
    bossesDefeated: string[];
    baseline: Record<string, number>;
  };
  inventory?: Record<string, number>; // §V7 owned consumable/collectible items (eggs, event items) → count
  lastDailyBonus?: string;       // §V7 YYYY-MM-DD of the last daily-all-complete bonus (once/day gate)
  dailyStreak?: number;
  lastStreakDate?: string;
}

// §V7 Centralized permanent statistics. Win rate and K/D are DERIVED on read (never stored),
// so they can't drift out of sync. Everything here is server-authoritative and additive.
export interface PlayerStats {
  // General
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  totalFoodEaten: number;
  highestScore: number;
  survivalTimeSeconds: number;      // cumulative play time (seconds)
  longestSurvivalSeconds: number;   // best single-life survival
  totalDistanceKm: number;
  totalStars: number;               // lifetime stars collected in-match
  cherriesCollected: number;
  applesCollected: number;
  frogsCollected: number;
  powerupsCollected: number;
  couponsEarned: number;
  // Combat
  totalKills: number;
  totalDeaths: number;
  longestKillStreak: number;
  mostKillsInMatch: number;
  totalDamageDealt: number;
  totalDamageReceived: number;
  mostDamageDealt: number;
  mostDamageReceived: number;
  bossKills?: number;
  // §milestone Best number of distinct landmarks reached in a single run. Explore progress was
  // only ever fed to missions; the journey timeline needs it as a durable stat too.
  areasExplored?: number;
  totalAssists?: number;
  // Generic lifetime tally, keyed by collectible type. The named fields above are the legacy
  // shape the UI already reads; this map means a NEW power-up (magnet, fire, whatever comes
  // next) starts persisting the day it is added to the spawn table, with no schema change.
  collectibles?: Record<string, number>;
}

// §V7 Per-mode independent statistics. Keyed by stat-mode: 'free_roam' | 'explorer' |
// 'battle_royale' | 'team' | 'classic'. Optional fields carry mode-specific extras.
export interface ModeStat {
  matchesPlayed: number;
  wins: number;
  losses: number;
  highestScore: number;
  kills: number;
  deaths: number;
  longestSurvivalSeconds: number;
  stars: number;
  missionsCompleted?: number;
  // Battle Royale
  top3?: number;
  highestRank?: number;   // best (lowest) placement achieved
  // Team Battle
  assists?: number;
  mvp?: number;
  highestTeamScore?: number;
  // Explorer / Story
  chaptersCompleted?: number;
  bossesDefeated?: number;
  questsCompleted?: number;
  explorationPct?: number;
  treasuresOpened?: number;
  secretsFound?: number;
  // Classic Snake
  longestSnake?: number;
  bestTimeSeconds?: number;
}

export type StatMode = 'free_roam' | 'explorer' | 'battle_royale' | 'team' | 'classic';
export type ModeStatsMap = Partial<Record<StatMode, ModeStat>>;

// §V7 Persisted per-match record for the Match History page.
export interface MatchRecord {
  id: string;
  at: string;              // ISO timestamp
  mode: StatMode;
  durationSeconds: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  highestCombo: number;    // best kill streak within this match
  foodCollected: number;   // every collectible picked up this match
  stars: number;
  xp: number;
  evoXp: number;
  rank?: number;
  rewards?: string;        // short human-readable reward summary
  map?: string;
  result: 'win' | 'loss';
}

// §explorer A villager standing in the world. Static: they never move, so they ride the
// cached world layout rather than the 30 Hz tick. What they SAY comes from the campaign API.
export interface WorldNpc {
  id: string;
  name: string;
  role: string;
  icon: string;
  accessory?: string;
  kingdom: number;
  x: number;
  y: number;
  radius: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface SnakeSegment {
  x: number;
  y: number;
}

export type GameMode = 'classic' | 'battle_royale' | 'team' | 'event' | 'boss';

export type GrowthStage = 'Baby' | 'Young' | 'Teen' | 'Adult' | 'Elite' | 'Titan';

export interface SnakeState {
  id: string;
  userId: string;
  displayName: string;
  skin: string;
  head: Vector2D;
  body: SnakeSegment[];
  angle: number;
  speed: number;
  speedPct: number;      // 0-100 display value for the SPEED stat
  boosting: boolean;
  score: number;
  level: number;
  length: number;
  radius: number;
  hp: number;
  maxHp: number;
  defense: number;       // DEFENSE stat: % incoming damage reduction
  stage: GrowthStage;    // in-match SIZE tier derived from score
  evolution: string;     // displayed account evolution form (players) / size tier (bots)
  region?: string;       // matchmaking region label (display only)
  isAlive: boolean;
  isAutoProtectAI: boolean;
  autoProtectTimer: number;
  kills: number;
  assists?: number;      // §stats Team Battle only — credited near a teammate's kill
  // Active buffs / abilities (server-authoritative timers, in seconds)
  shieldTimer: number;       // invulnerability remaining
  speedBoostTimer: number;   // temporary speed buff remaining
  superTimer?: number;       // 🍄 super power (invincible + faster) remaining
  abilityCooldown: number;   // time until ability can be used again
  abilityActiveTimer: number;// ability effect remaining
  poisonTimer?: number;      // lingering toxic skull curse remaining (seconds)
  activeBuff?: string;
  team?: 'red' | 'blue';
  distanceTravelled: number; // metres (world units / 100)
  isBot?: boolean;
  isBoss?: boolean;
  isPaused?: boolean;        // §12 backgrounded player — solo/adventure only (never PvP immunity)
  inInteraction?: boolean;   // safe NPC/quiz interaction freeze in solo/adventure modes
  inQuiz?: boolean;          // active quiz trial — snake becomes invisible & untargetable
  isInvisible?: boolean;     // hidden from game canvas & enemies while in quiz
  quizStartedAt?: number;    // wall-clock ms safety timestamp for quiz invisibility
  isMapPlanning?: boolean;   // safe tactical map planning pause (no enemy attacks while planning)
  mapPlanningStartedAt?: number;
  teamContribution?: number; // Team Battle Royale objective contribution score
  carryingRelicId?: string;  // Team Battle Royale relic currently carried
  lastHitTick?: number;      // tick timestamp of last obstacle collision hit
  lastObjectTick?: number;   // tick timestamp of last interactive prop reward
}

export type CollectibleType =
  | 'cherry'
  | 'apple'
  | 'mushroom'
  | 'frog'
  | 'mouse'
  | 'lizard'
  | 'egg'
  | 'star'
  | 'heart'
  | 'shield'
  | 'speed'
  | 'crystal'
  | 'coupon_box'
  | 'super_star'
  | 'snake_remains'
  | 'boss_drop';

export interface FoodItem {
  id: string;
  x: number;
  y: number;
  value: number;
  type: CollectibleType;
  color: string;
  icon?: string;
  hpRestore?: number;
  buff?: 'shield' | 'speed' | 'super';   // active power-up granted on pickup
  buffDuration?: number;       // seconds
  couponData?: CouponReward;
  // §3 Moving stars — slow natural drift with occasional stops / direction changes
  vx?: number;
  vy?: number;
  wanderTimer?: number;
}

// §2 Dynamic obstacles — decorative + soft-collision props that never fully block the map
export type ObstacleType = 'tree' | 'rock' | 'bush' | 'cactus' | 'flowerbed' | 'log' | 'pond' | 'hill' | 'lava' | 'poison' | 'cave' | 'signpost' | 'explosion';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  radius: number;
  icon: string;
  blocking: boolean; // true = soft-pushes snakes out (rock/tree/hill/cave); false = passable zone or trigger
  damage?: number;   // §3 hazard damage dealt on contact (cactus/lava/poison/explosion)
  variant?: number;  // deterministic visual sprite index within asset bundle
  interactCooldownUntil?: number; // tick until interactive prop can spawn/grant again
}

export interface SafeZone {
  centerX: number;
  centerY: number;
  radius: number;
  targetRadius: number;
  shrinkRate: number;
  damagePerSecond: number;
}

export interface WorldEvent {
  id: string;
  type: 'rain_storm' | 'volcano_eruption' | 'boss_anaconda_raid' | 'treasure_balloon';
  title: string;
  description: string;
  active: boolean;
  timerSeconds: number;
  icon: string;
}

export interface CouponReward {
  id: string;
  storeName: string;
  discountText: string;
  promoCode: string;
  expiryDate: string;
  icon: string;
  definitionId?: string; // links an issued voucher back to its CouponDefinition
}

// §7 Server-driven coupon definition (admin-managed template). Player-facing vouchers
// (CouponReward) are minted from these. No brand is hard-coded into the client — the
// definition carries the provider/label so partners are configured on the backend only.
export interface CouponDefinition {
  id: string;
  title: string;              // e.g. "10% Off at Partner Cafe"
  storeName: string;         // provider / partner label (configurable, not hard-coded client-side)
  discountText: string;      // human-readable reward text
  icon: string;
  enabled: boolean;          // admin enable/disable toggle
  expiryDate: string;        // ISO date; issued vouchers inherit this
  regions: string[] | 'all'; // regional availability
  minLevel: number;          // eligibility: minimum account level
  minPrestige: number;       // eligibility: minimum prestige
  costStars: number;         // Stars charged on claim (0 = free grant / earned reward)
  redemptionLimit: number;   // max total redemptions across all players (-1 = unlimited)
  perUserLimit: number;      // max redemptions per player (usually 1)
  redemptionCount: number;   // running total issued (tracking)
  autoGrant: boolean;        // true = auto-issued the moment a player becomes eligible
  createdAt: string;
  updatedAt: string;
}

export interface CouponRedemption {
  definitionId: string;
  userId: string;
  voucherId: string;
  promoCode: string;
  redeemedAt: string;
}

// §8 Per-user social graph (friend ids, pending requests both directions, blocked ids).
export interface SocialGraph {
  friends: string[];
  incoming: string[];   // requests awaiting THIS user's accept/reject
  outgoing: string[];   // requests THIS user has sent
  blocked: string[];
}

// §social A stored "come play" invite. Delivery used to be a live socket emit and nothing
// else, so inviting an offline friend simply failed. Invites are now persisted per recipient
// and handed over the moment they next connect. The original match is long gone by then, so
// what carries is the MODE — the invite reads "Alpha invited you to Battle Royale" and the
// accept button drops you into that mode.
export interface MatchInvite {
  id: string;
  fromUserId: string;
  fromName: string;
  fromAvatar: string;
  toUserId: string;
  mode: string;        // UI mode id (free_roam | explorer | battle_royale | team | nokia | event)
  createdAt: number;   // epoch ms
  expiresAt: number;   // epoch ms — pruned on read and on save
  deliveredAt?: number; // set when it has been pushed to a live socket
}

// Every trackable gameplay event. Collectible names here must match the food `type` the
// simulation emits, so a NEW collectible only has to be added in one place to start counting
// toward missions, achievements and lifetime stats.
export type ProgressMetric =
  | 'cherry' | 'apple' | 'frog' | 'star' | 'crystal' | 'egg' | 'kill' | 'treasure'
  | 'heal' | 'shield' | 'boost' | 'win'
  | 'mushroom' | 'speed' | 'powerup' | 'magnet' | 'fire' | 'gift'
  | 'assist' | 'death'
  | 'distance' | 'match' | 'survive' | 'score' | 'explore';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'legend';
  metric: ProgressMetric;
  target: number;
  progress: number;
  isUnlocked: boolean;
  rewardStars: number;
  icon: string;
}

export type MatchType = 'local' | 'global';

export interface RankInfo {
  tier: string;      // Bronze / Silver / Gold / Platinum / Diamond / Master / Legend
  division: string;  // III / II / I
  label: string;     // "Silver III"
  color: string;
}

export interface EvolutionRequirement {
  evolution: Evolution;
  level: number;
  evoXp: number;
}

export interface GameModeConfig {
  mode: GameMode;
  label: string;
  tagline: string;
  shrinkingZone: boolean;   // battle royale style storm
  teamsEnabled: boolean;    // 4v4 team mode
  worldEvents: boolean;     // dynamic world events
  botCount: number;
  matchDurationSeconds?: number; // §2 round length for timed modes (undefined = untimed)
}

export interface SanctuaryZone {
  centerX: number;
  centerY: number;
  radius: number;
  label: string;
  icon: string;
}

export interface PortalShortcut {
  id: string;
  targetId: string;
  x: number;
  y: number;
  label: string;
  color: string;
  timerSeconds?: number; // §7 remaining lifetime of a dynamic wormhole
  wormhole?: boolean;    // §7 dynamic wormhole (vs. legacy paired shortcut)
}

export interface GameWorldState {
  matchId: string;
  mode: GameMode;
  region: string;
  status: 'waiting' | 'in_progress' | 'ended';
  tick: number;
  worldSize: number;
  safeZone: SafeZone;
  sanctuaryZone?: SanctuaryZone;
  portals?: PortalShortcut[];
  obstacles?: Obstacle[];
  npcs?: WorldNpc[];       // §explorer villagers/elders/guards standing in the world
  snakes: Record<string, SnakeState>;
  food: Record<string, FoodItem>;
  leaderboard: Array<{ id: string; name: string; score: number; kills: number; team?: 'red' | 'blue' }>;
  teamScores?: { red: number; blue: number };
  teamZones?: TeamControlZone[];
  teamRelics?: TeamRelic[];
  teamBases?: { red: Vector2D; blue: Vector2D };
  teamObjectiveBreakdown?: {
    red: { kills: number; zones: number; relics: number; resources: number };
    blue: { kills: number; zones: number; relics: number; resources: number };
  };
  currentEvent?: WorldEvent;
  // §2 Competitive round clock — the same clock that drives the shrinking zone, so the HUD
  // countdown always matches the storm the player can see.
  matchTimer?: number;   // whole seconds remaining in the round (timed modes only)
  matchOver?: boolean;   // round finished — clients show results during the intermission
  round?: number;        // 1-based round counter for this long-lived mode session
}

export interface ClientInputPacket {
  seq: number;
  angle: number;
  boosting: boolean;
  timestamp: number;
}

export interface AntiCheatViolation {
  userId: string;
  timestamp: string | number;
  type?: string;
  rule?: string;
  actionTaken?: string;
  severity: string;
  details: string;
}

export interface MissionObjective {
  id: string;
  title: string;
  description: string;
  category: 'daily' | 'weekly' | 'event';
  metric: ProgressMetric;
  icon: string;
  targetCount: number;
  currentCount: number;
  rewardStars: number;
  rewardXP: number;
  rewardEvoXP: number;
  isCompleted: boolean;
  isClaimed: boolean;
  periodKey?: string;
}

export interface AdminTelemetry {
  activeInstances: number;
  activeMatches?: number;
  activeSockets: number;
  connectedPlayers?: number;
  totalPlayersOnline: number;
  serverTickRateHz: number;
  serverTickMs?: number;
  memoryUsageMb: number;
  cpuUsagePct?: number;
  cpuUsagePercent?: number;
  antiCheatFlagsCount?: number;
  uptimeSeconds: number;
}

export interface GameEventNotification {
  id: string;
  type: 'kill' | 'boss_spawn' | 'event_start' | 'coupon_found';
  message: string;
  timestamp: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  ip?: string;
  userAgent?: string;
}

export type AdPlacement =
  | 'home_screen'
  | 'between_sessions'
  | 'game_over'
  | 'story_menu'
  | 'rewarded_opt_in';

export interface Advertisement {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  destinationUrl: string;
  placement: AdPlacement;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
}

export interface AdEventRecord {
  id: string;
  adId: string;
  userId?: string;
  placement: AdPlacement;
  eventType: 'impression' | 'click';
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminUsername?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
  ip?: string;
  createdAt: string;
}

export type AnalyticsEventType =
  | 'user_register'
  | 'user_login'
  | 'user_logout'
  | 'user_upgrade'
  | 'session_start'
  | 'session_end'
  | 'mode_select'
  | 'match_start'
  | 'match_end'
  | 'match_complete'
  | 'match_abandon'
  | 'story_quest_complete'
  | 'story_boss_defeat'
  | 'ad_impression'
  | 'ad_click'
  | 'adventure_level_start'
  | 'adventure_level_complete'
  | 'adventure_level_fail'
  | 'adventure_level_abandon'
  | 'npc_encounter'
  | 'quest_offer'
  | 'quest_accept'
  | 'quest_later'
  | 'quest_skip'
  | 'quest_complete'
  | 'quest_fail'
  | 'quest_abandon'
  | 'quest_claim'
  | 'quiz_start'
  | 'quiz_answer'
  | 'quiz_complete'
  | 'boss_attempt'
  | 'boss_victory'
  | 'boss_fail'
  | 'boss_milestone_abandon'
  | 'team_zone_capture'
  | 'team_relic_deliver'
  | 'private_room_create'
  | 'private_room_invite'
  | 'private_room_join';

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  userId?: string;
  sessionId?: string;
  mode?: string;
  roomId?: string;
  durationSeconds?: number;
  score?: number;
  metadata?: Record<string, any>;
}

export interface LobbyRoomMember {
  userId: string;
  displayName: string;
  ready: boolean;
  team?: 'red' | 'blue';
  isHost?: boolean;
}

export interface LobbyRoomInfo {
  roomId: string;
  roomCode?: string;
  mode: GameMode;
  region: string;
  playerCount: number;
  humanCount?: number;
  botCount?: number;
  maxPlayers: number;
  status: 'lobby' | 'open' | 'intermission';
  stageStatus?: 'lobby' | 'open';
  matchTimer?: number;
  matchOver?: boolean;
  hostUserId?: string;
  hostName?: string;
  isPrivate?: boolean;
  isCustom?: boolean;
  mapTheme?: string;
  durationSeconds?: number;
  aiBackfill?: boolean;
  members?: LobbyRoomMember[];
  createdAt?: string;
  players?: Array<{ id: string; displayName: string; team?: 'red' | 'blue'; score: number; contribution?: number }>;
}

// ── Adventure RPG, 1,000-Level Campaign, Quest State Machine & Quiz Types ──

export type QuestState =
  | 'AVAILABLE'
  | 'APPROACHABLE'
  | 'OFFERED'
  | 'ACCEPTED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CLAIMABLE'
  | 'CLAIMED'
  | 'SKIPPED'
  | 'ABANDONED'
  | 'FAILED';

export type LevelType =
  | 'exploration'
  | 'collection'
  | 'survival'
  | 'navigation'
  | 'word_puzzle'
  | 'math'
  | 'memory'
  | 'logic'
  | 'rescue'
  | 'boss_challenge'
  | 'multi_stage'
  | 'secret';

export type QuizCategory = 'word' | 'math' | 'memory' | 'logic';

export interface TeamControlZone {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  owner: 'neutral' | 'red' | 'blue';
  capturePct: number; // -100 (red) to +100 (blue)
}

export interface TeamRelic {
  id: string;
  x: number;
  y: number;
  carrierId?: string;
  carrierTeam?: 'red' | 'blue';
  points: number;
}

export interface QuestRewardBundle {
  stars: number;
  xp: number;
  evoXp: number;
  tickets?: number;
  badge?: string;
  unlockItem?: string;
}

export interface QuestStageSpec {
  index: number;
  kind: 'collect' | 'navigate' | 'survive' | 'quiz' | 'rescue' | 'switches' | 'boss_objective' | 'kill';
  label: string;
  metric?: string;
  category?: QuizCategory;
  target: number;
  timeLimitSec?: number;
  waypoints?: Array<{ id: string; label: string; x: number; y: number; radius: number }>;
  switches?: Array<{ id: string; label: string; x: number; y: number; radius: number }>;
  rescueNpcId?: string;
  untimed?: boolean;
}

export interface CampaignLevelDef {
  levelId: string;
  levelNumber: number;
  worldNumber: number;
  worldId: string;
  worldName: string;
  theme: string;
  title: string;
  description: string;
  levelType: LevelType;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  expectedDurationSec: number;
  isBossCheckpoint: boolean;
  isMajorMilestone: boolean;
  bossId?: string;
  bossName?: string;
  bossArchetype?: string;
  npcId?: string;
  npcName?: string;
  stages: QuestStageSpec[];
  difficultyParams: {
    enemySpeedMult: number;
    hazardDensity: number;
    puzzleDifficulty: 1 | 2 | 3 | 4 | 5;
    timeLimitSec: number;
    environmentalEffect: string;
  };
  rewards: QuestRewardBundle;
  unlockRequirement: number;
}

export interface QuestSessionView {
  sessionId: string;
  questId: string;
  levelNumber: number;
  npcId?: string;
  title: string;
  description: string;
  difficultyTier: number;
  expectedDurationSec: number;
  questType: LevelType;
  state: QuestState;
  stageIndex: number;
  stageTotal: number;
  currentStage: QuestStageSpec;
  progress: number;
  target: number;
  pct: number;
  timeRemainingSec?: number;
  completedWaypoints?: string[];
  activatedSwitches?: string[];
  quizSessionId?: string;
  rewards: QuestRewardBundle;
  attempts: number;
}

export interface NpcQuotaStatus {
  npcId: string;
  completedInCycle: number;
  maxPerCycle: number;
  totalCompleted: number;
  onCooldown: boolean;
  cooldownUntil?: string;
  cooldownRemainingSec: number;
}

export interface RewardBoxEntry {
  id: string;
  userId: string;
  sourceType: 'quest' | 'level' | 'boss' | 'bonus';
  sourceId: string;
  title: string;
  stars: number;
  xp: number;
  evoXp: number;
  tickets: number;
  status: 'unclaimed' | 'collected';
  createdAt: string;
  collectedAt?: string;
}

export interface NpcEncounterPayload {
  npcId: string;
  npcName: string;
  npcRole: string;
  npcIcon: string;
  npcAccessory?: string;
  greeting: string;
  questId: string;
  levelNumber: number;
  title: string;
  description: string;
  questType: LevelType;
  difficultyTier: number;
  expectedDurationSec: number;
  rewards: QuestRewardBundle;
  questState: QuestState;
  sessionId?: string;
  canAccept: boolean;
  canClaim: boolean;
  npcQuota?: NpcQuotaStatus;
  cooldownMessage?: string;
}

export interface QuizQuestionClient {
  quizSessionId: string;
  questionId: string;
  index: number;
  total: number;
  category: QuizCategory;
  subcategory: string;
  difficulty: number;
  questionText: string;
  options: string[];
  untimed: boolean;
  timeLimitSec: number;
  correctCount: number;
  wrongCount: number;
  passThreshold: number;
  mediaUrl?: string;
}

export interface HeartState {
  hearts: number;
  maxHearts: number;
  heartShards: number;
  shardsRequired: number;
  restoreIntervalSec: number;
  nextRestoreInSec: number;
  nextRestoreAtMs: number;
}
