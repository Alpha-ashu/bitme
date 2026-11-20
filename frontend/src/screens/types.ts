import { GameMode, GameStateTick, HeartStateData, SnakeData } from '../game/GameClient';

export type Screen = 'splash' | 'app' | 'matchmaking' | 'play' | 'pause' | 'respawn' | 'gameover' | 'victory' | 'admin';
export type Page =
  | 'home'
  | 'play'
  | 'lobby'
  | 'story'
  | 'missions'
  | 'inventory'
  | 'rewards'
  | 'leaderboard'
  | 'social'
  | 'events'
  | 'profile'
  | 'settings';

export type UIMode = 'free_roam' | 'explorer' | 'battle_royale' | 'team' | 'nokia' | 'event' | 'boss';

export interface UIModeDef {
  id: UIMode;
  icon: string;
  name: string;
  tag: string;
  rules: string;
  backend: GameMode;
  enabled: boolean;
  solo?: boolean;
  story?: boolean;
  timed?: boolean;
  multiplayer?: boolean;
}

export const UI_MODES: Record<UIMode, UIModeDef> = {
  free_roam: {
    id: 'free_roam', icon: '🌿', name: 'Free Roam', tag: 'Open Park',
    rules: 'Roam freely, collect stars, finish missions.',
    backend: 'classic', enabled: true, multiplayer: true,
  },
  explorer: {
    id: 'explorer', icon: '📜', name: 'Story Mode', tag: '1,000 Levels',
    rules: '10 Worlds, NPC quests, quizzes & Boss Trials.',
    backend: 'classic', enabled: true, story: true, multiplayer: true,
  },
  battle_royale: {
    id: 'battle_royale', icon: '⚔️', name: 'Battle Royale', tag: 'Last Standing',
    rules: 'Outlast rivals inside the closing storm ring.',
    backend: 'battle_royale', enabled: true, timed: true, multiplayer: true,
  },
  team: {
    id: 'team', icon: '🛡️', name: 'Team Battle', tag: 'Red vs Blue',
    rules: 'Capture zones, deliver relics & outscore rivals.',
    backend: 'team', enabled: true, timed: true, multiplayer: true,
  },
  nokia: {
    id: 'nokia', icon: '🕹️', name: 'Classic Arcade', tag: 'Solo Grid',
    rules: 'Retro walled arena with instant tail growth.',
    backend: 'classic', enabled: true, solo: true,
  },
  boss: {
    id: 'boss', icon: '🐲', name: 'Boss Arena', tag: '1v1 Duel',
    rules: 'Power up fast and defeat Kingdom Guardians.',
    backend: 'boss', enabled: true, timed: true, story: true,
  },
  event: {
    id: 'event', icon: '🎪', name: 'World Events', tag: 'Live Rules',
    rules: 'Monsoon stars, lava hazards & relic drops.',
    backend: 'event', enabled: true, timed: true, multiplayer: true,
  },
};

export const UI_MODE_ORDER: UIMode[] = ['explorer', 'free_roam', 'battle_royale', 'team', 'boss', 'nokia', 'event'];

export interface SkinDef { id: string; name: string; grad: string; family: string; premium?: boolean; }
export const SKIN_FAMILIES: Array<{ family: string; icon: string; skins: SkinDef[] }> = [
  { family: 'Forest', icon: '🌳', skins: [
    { id: 'Forest', name: 'Forest', family: 'Forest', grad: 'linear-gradient(90deg,#1B5E20,#8BC34A)' },
    { id: 'Jungle', name: 'Jungle', family: 'Forest', grad: 'linear-gradient(90deg,#2E7D32,#81C784)' },
  ]},
  { family: 'Ocean', icon: '🌊', skins: [
    { id: 'Ocean', name: 'Ocean', family: 'Ocean', grad: 'linear-gradient(90deg,#0D47A1,#64B5F6)' },
    { id: 'Ice', name: 'Ice', family: 'Ocean', grad: 'linear-gradient(90deg,#0097A7,#E0F7FA)' },
  ]},
  { family: 'Fire', icon: '🔥', skins: [
    { id: 'Fire', name: 'Fire', family: 'Fire', grad: 'linear-gradient(90deg,#C62828,#FFB74D)' },
    { id: 'Electric', name: 'Electric', family: 'Fire', grad: 'linear-gradient(90deg,#F57F17,#FFF9C4)' },
  ]},
  { family: 'Mystical', icon: '🌌', skins: [
    { id: 'Galaxy', name: 'Galaxy', family: 'Mystical', grad: 'linear-gradient(90deg,#0D0221,#E040FB)' },
    { id: 'Shadow', name: 'Shadow', family: 'Mystical', grad: 'linear-gradient(90deg,#311B92,#9575CD)' },
    { id: 'Mythical', name: 'Mythical', family: 'Mystical', grad: 'linear-gradient(90deg,#4A0072,#EA80FC)', premium: true },
  ]},
  { family: 'Elegant', icon: '👑', skins: [
    { id: 'Golden', name: 'Golden', family: 'Elegant', grad: 'linear-gradient(90deg,#FF8F00,#FFE082)', premium: true },
    { id: 'Royal', name: 'Royal', family: 'Elegant', grad: 'linear-gradient(90deg,#311B92,#D1C4E9)', premium: true },
  ]},
  { family: 'Nature', icon: '🌸', skins: [
    { id: 'Sakura', name: 'Sakura', family: 'Nature', grad: 'linear-gradient(90deg,#AD1457,#FCE4EC)' },
    { id: 'Desert', name: 'Desert', family: 'Nature', grad: 'linear-gradient(90deg,#8B5E0A,#F0D060)' },
  ]},
  { family: 'Seasonal', icon: '🎄', skins: [
    { id: 'Christmas', name: 'Christmas', family: 'Seasonal', grad: 'linear-gradient(90deg,#C62828,#1B5E20)' },
    { id: 'Halloween', name: 'Halloween', family: 'Seasonal', grad: 'linear-gradient(90deg,#212121,#FF6D00)' },
  ]},
];
export const SKINS: SkinDef[] = SKIN_FAMILIES.flatMap(f => f.skins);

export interface AccessoryDef { id: string; name: string; icon: string; slot: string; rarity: string; costStars?: number; costTickets?: number; minLevel?: number; seasonal?: boolean; owned?: boolean; equipped?: boolean; affordable?: boolean; levelMet?: boolean; }
export const DEFAULT_ACCESSORIES: AccessoryDef[] = [
  { id: 'flower_crown', name: 'Flower Crown', icon: '🌸', slot: 'hat', rarity: 'common', costStars: 0, costTickets: 0, minLevel: 1 },
  { id: 'explorer_hat', name: 'Explorer Hat', icon: '🤠', slot: 'hat', rarity: 'common', costStars: 250, costTickets: 0, minLevel: 1 },
  { id: 'headphones', name: 'Headphones', icon: '🎧', slot: 'hat', rarity: 'common', costStars: 300, costTickets: 0, minLevel: 2 },
  { id: 'scarf', name: 'Scarf', icon: '🧣', slot: 'neck', rarity: 'common', costStars: 350, costTickets: 0, minLevel: 3 },
  { id: 'pirate_hat', name: 'Pirate Hat', icon: '🏴‍☠️', slot: 'hat', rarity: 'rare', costStars: 700, costTickets: 0, minLevel: 5 },
  { id: 'wizard_hat', name: 'Wizard Hat', icon: '🎩', slot: 'hat', rarity: 'rare', costStars: 800, costTickets: 0, minLevel: 7 },
  { id: 'backpack', name: 'Tiny Backpack', icon: '🎒', slot: 'back', rarity: 'rare', costStars: 900, costTickets: 0, minLevel: 8 },
  { id: 'christmas_hat', name: 'Christmas Hat', icon: '🎅', slot: 'hat', rarity: 'rare', seasonal: true, costStars: 1200, costTickets: 1, minLevel: 10 },
  { id: 'ramadan_lantern', name: 'Ramadan Lantern', icon: '🏮', slot: 'hat', rarity: 'epic', seasonal: true, costStars: 1600, costTickets: 1, minLevel: 12 },
  { id: 'diwali_crown', name: 'Diwali Crown', icon: '👑', slot: 'hat', rarity: 'epic', seasonal: true, costStars: 1600, costTickets: 1, minLevel: 12 },
  { id: 'golden_wings', name: 'Golden Wings', icon: '✨', slot: 'back', rarity: 'legendary', costStars: 3200, costTickets: 4, minLevel: 20 },
];

export const EVO_LADDER = [
  { name: 'Baby', scoreReq: 0, evoXpReq: 0, desc: 'Hatchling' },
  { name: 'Young', scoreReq: 500, evoXpReq: 500, desc: 'Growing fast' },
  { name: 'Teen', scoreReq: 1000, evoXpReq: 1000, desc: 'Finding strength' },
  { name: 'Adult', scoreReq: 1500, evoXpReq: 2500, desc: 'Formidable force' },
  { name: 'Elite', scoreReq: 2000, evoXpReq: 8000, desc: 'Apex predator' },
  { name: 'Titan', scoreReq: 2500, evoXpReq: 20000, desc: 'Colossal serpent' },
  { name: 'Legend', scoreReq: 3000, evoXpReq: 40000, desc: 'Prestige I required' },
  { name: 'King', scoreReq: 3500, evoXpReq: 80000, desc: 'Prestige II Crown' },
];

export const ONB_AVATARS = ['🐍', '🐲', '🦎', '🐢', '🦊', '🦉', '🐸', '🐝'];
export const ONB_COUNTRIES = ['Global', 'India', 'United States', 'United Kingdom', 'Brazil', 'Japan', 'Germany', 'France', 'Australia', 'Canada', 'Indonesia'];
export const ONB_LANGUAGES = ['English', 'हिन्दी', 'Español', 'Português', '日本語', 'Deutsch', 'Français'];
export const REGIONS = ['Global', 'India', 'USA', 'Europe', 'Brazil', 'Japan', 'Australia'];

export const LANDMARKS = [
  { name: 'Ranger Post', x: 665, y: 1445 },
  { name: 'Sanctuary Plaza', x: 2265, y: 1445 },
  { name: 'Crown Gazebo', x: 1465, y: 645 },
  { name: 'Emerald Crossing', x: 1565, y: 2445 },
];

export const TUTORIAL_SLIDES = [
  { icon: '🕹️', title: 'Steer & Sprint', text: 'Move with your mouse, WASD/Arrows, or touch joystick. Push the stick rim or press Space/Shift to boost.' },
  { icon: '⚔️', title: 'Head-to-Head Combat', text: 'Only head-to-head impacts eliminate snakes — higher score wins! Use Coil Guard (Q) for a 3s shield + dash burst.' },
  { icon: '📜', title: 'Save the Seven Kingdoms', text: 'Approach NPC elders in Story Explorer, complete 21 campaign quests and challenge Kingdom Bosses 1v1!' },
];

export interface Settings {
  sfx: boolean;
  music: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  controlPos: 'left' | 'right';
  joySize: 'small' | 'medium' | 'large';
  joyDeadZone: number;
  joySensitivity: number;
  cameraPreset: 'near' | 'medium' | 'far' | 'ultra_wide';
  missionTracker: boolean;
  trackerPos: 'left' | 'right';
  showMinimap: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  sfx: true,
  music: false,
  largeText: false,
  reduceMotion: false,
  highContrast: false,
  controlPos: 'left',
  joySize: 'medium',
  joyDeadZone: 6,
  joySensitivity: 1.0,
  cameraPreset: 'medium',
  missionTracker: true,
  trackerPos: 'left',
  showMinimap: true,
};

export interface AppRuntimeState {
  screen: Screen;
  page: Page;
  isGuest: boolean;
  user: any;
  profile: any;
  settings: Settings;
  selectedUIMode: UIMode;
  selectedKingdom: number;
  selectedSkin: string;
  equippedAccessory: string;
  selectedRegion: string;
  selectedRoomId?: string;
  selectedRoomCode?: string;
  invTab: 'skins' | 'accessories' | 'eggs' | 'coupons';
  missionCat: 'daily' | 'weekly' | 'event' | 'achievements';
  shopCatalog: { skins: any[]; accessories: AccessoryDef[] };
  missions: any[];
  achievements: any[];
  rewards: any[];
  availableCoupons: any[];
  explorer: any;
  adventure: any;
  rewardBox: { items: any[]; unclaimedCount: number; totals: { stars: number; xp: number; evoXp: number; tickets: number }; powerups: any[] };
  heartState: HeartStateData;
  npcQuotas: Record<string, any>;
  activeQuest: any;
  activeNpcEncounter: any;
  activeQuizQuestion: any;
  stagedRoom: any;
  social: any;
  invites: any[];
  lobbies: any[];
  events: { live: any[]; scheduled: any[]; season?: string };
  leaderboard: { category: string; scope: string; entries: any[] };
  history: any[];
  milestones: any[];
  mapThemes?: Array<{ id: string; name: string; sky?: string; ground?: string; grid?: string; accent?: string }>;
  respawnCostStars?: number;
  // Active match runtime
  lastState: GameStateTick | null;
  lastSnake: SnakeData | null;
  matchStats: Record<string, number>;
  matchStartTs: number;
  summary: any;
  lastBossWin: any;
  adRewardClaimedThisMatch: boolean;
  nearbyNpcId: string | null;
  npcDialogOpen: boolean;
}

export interface AppContext {
  state: AppRuntimeState;
  render: () => void;
  go: (page: Page) => void;
  setScreen: (screen: Screen) => void;
  toast: (msg: string, durationMs?: number) => void;
  refreshProfile: () => Promise<void>;
  refreshCollectionData: () => Promise<void>;
  refreshLobbies: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  refreshExplorer: () => Promise<void>;
  refreshAdventure: (opts?: { world?: number; page?: number }) => Promise<void>;
  refreshRewardBox: () => Promise<void>;
  refreshHearts: () => Promise<void>;
  getLiveHeartState: () => HeartStateData;
  setQuizActive: (active: boolean) => void;
  usePowerup: (powerupId: 'pw_boost' | 'pw_shield' | 'pw_super') => Promise<void>;
  getZoomLabel: () => string;
  startAdventureLevel: (levelNumber: number) => Promise<void>;
  openNpcInteraction: (npcId: string) => Promise<void>;
  respondNpcEncounter: (action: 'accept' | 'later' | 'skip' | 'claim') => Promise<void>;
  submitQuizAnswer: (quizSessionId: string, questionId: string, answer: string, responseMs: number) => Promise<any>;
  closeQuizModal: () => void;
  claimActiveQuest: () => Promise<void>;
  abandonActiveQuest: () => Promise<void>;
  startMatch: (opts?: { mode?: UIMode; roomId?: string; roomCode?: string; kingdom?: number }) => void;
  abandonMatch: () => Promise<void>;
  resumeMatch: () => void;
  requestRespawn: (method: 'stars' | 'ticket' | 'ad' | 'wait', adToken?: string) => void;
  activateAbility: () => void;
  cycleZoom: () => string;
  toggleMinimap: () => void;
  openTacticalMap: () => void;
  openAuthModal: (tab: 'login' | 'register' | 'upgrade') => void;
  openTutorialModal: () => void;
  logoutPlayer: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
}

export type ViewportTier = 'tiny' | 'mobile' | 'landscape' | 'tablet' | 'desktop';

export function getViewportTier(): ViewportTier {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h <= 520) return 'landscape';
  if (w < 370) return 'tiny';
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

