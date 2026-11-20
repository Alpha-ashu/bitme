import { io, Socket } from 'socket.io-client';

export type GameMode = 'classic' | 'battle_royale' | 'team' | 'event' | 'boss';
export type GrowthStage = 'Baby' | 'Young' | 'Adult' | 'Elite' | 'Titan';

export interface SnakeSegment { x: number; y: number; }

export interface SnakeData {
  id: string;
  userId: string;
  displayName: string;
  skin: string;
  head: { x: number; y: number };
  body: SnakeSegment[];
  angle: number;
  speed: number;
  speedPct: number;
  boosting: boolean;
  score: number;
  level: number;
  length: number;
  radius: number;
  hp?: number;
  maxHp?: number;
  defense: number;
  stage: GrowthStage;
  evolution?: string;
  region?: string;
  distanceTravelled?: number;
  isAlive: boolean;
  kills: number;
  shieldTimer: number;
  speedBoostTimer: number;
  superTimer?: number; // 🍄 super power (invincible + faster)
  abilityCooldown: number;
  abilityActiveTimer: number;
  poisonTimer?: number;
  team?: 'red' | 'blue';
  isBoss?: boolean;
  isInvisible?: boolean; // invisible & untargetable while answering a quiz
  inQuiz?: boolean;
  equippedAccessory?: string;
  respawnAt?: number; // local-engine only: timestamp (ms) at which a dead bot respawns
}

export interface HeartStateData {
  hearts: number;
  maxHearts: number;
  heartShards: number;
  shardsRequired: number;
  restoreIntervalSec: number;
  nextRestoreInSec: number;
  nextRestoreAtMs: number;
}

export interface FoodData {
  id: string; x: number; y: number; value: number; type: string; color: string; icon?: string;
  vx?: number; vy?: number; wanderTimer?: number; // §3 moving stars
}

export interface SafeZoneData {
  centerX: number; centerY: number; radius: number; targetRadius: number; damagePerSecond: number;
}

export interface SanctuaryZoneData { centerX: number; centerY: number; radius: number; label: string; icon: string; }
export interface PortalData { id: string; targetId: string; x: number; y: number; label: string; color: string; timerSeconds?: number; wormhole?: boolean; }
export interface ObstacleData { id: string; type: string; x: number; y: number; radius: number; icon: string; blocking: boolean; damage?: number; }

// §explorer A villager standing in the world. Static, so it arrives with the cached world
// layout rather than every tick — only what they SAY changes, and that comes from the API.
export interface NpcData {
  id: string; name: string; role: string; icon: string; accessory?: string;
  kingdom: number; x: number; y: number; radius: number;
}

export interface WorldEventData {
  id: string; type: string; title: string; description: string; active: boolean; timerSeconds: number; icon: string;
}

export interface GameStateTick {
  tick: number;
  timestamp: number;
  mode: GameMode;
  snakes: SnakeData[];
  food: FoodData[];
  safeZone: SafeZoneData;
  sanctuaryZone?: SanctuaryZoneData;
  portals?: PortalData[];
  obstacles?: ObstacleData[];
  npcs?: NpcData[];
  leaderboard: Array<{ id: string; name: string; score: number; kills: number; team?: 'red' | 'blue' }>;
  teamScores?: { red: number; blue: number };
  teamZones?: Array<{ id: string; label: string; x: number; y: number; radius: number; owner: 'neutral' | 'red' | 'blue'; capturePct: number }>;
  teamRelics?: Array<{ id: string; x: number; y: number; carrierId?: string; carrierTeam?: 'red' | 'blue'; points: number }>;
  teamBases?: { red: { x: number; y: number }; blue: { x: number; y: number } };
  teamObjectiveBreakdown?: {
    red: { kills: number; zones: number; relics: number; resources: number };
    blue: { kills: number; zones: number; relics: number; resources: number };
  };
  currentEvent?: WorldEventData;
  matchTimer?: number;  // §2 Battle Royale — seconds remaining
  matchOver?: boolean;  // §2 match ended (timer/last-standing)
}

// §social A stored friend invite waiting for this player.
export interface MatchInviteData {
  id: string;
  fromName: string;
  fromAvatar: string;
  mode: string;
  createdAt: number;
  expiresAt: number;
  fromOnline: boolean;
}

export interface ModeConfig {
  mode: GameMode; label: string; tagline: string;
  shrinkingZone: boolean; teamsEnabled: boolean; worldEvents: boolean; botCount: number;
}

// Where the authoritative backend lives, in priority order.
//
// The game server is a long-lived 30 Hz Socket.IO process, so it CANNOT run on a serverless
// static host (Vercel/Netlify/Pages) — it has to be deployed somewhere that keeps a process
// alive, and the client is pointed at it. See DEPLOY.md.
export function serverBase(): string {
  // 1. ?server=… — ad-hoc override for testing against any backend.
  const override = new URLSearchParams(location.search).get('server');
  if (override) return override;

  // 2. Build-time env (VITE_SERVER_URL) — how a Vercel/Netlify build targets its backend
  //    without editing HTML. Set it in the host's environment variables.
  const envUrl = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // 3. Packaged (Capacitor/Play Store) build: a meta tag baked into index.html.
  const meta = document.querySelector('meta[name="anaconda-server"]')?.getAttribute('content');
  if (meta && !meta.includes('your-backend.example.com')) return meta.replace(/\/$/, '');

  // 4. Local dev — Vite on :3000..3009/:4173/:5173..5179 talks to backend on :4000.
  const devPorts = ['3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '4173', '5173', '5174', '5175', '5176', '5177', '5178', '5179'];
  if (devPorts.includes(location.port)) return `${location.protocol}//${location.hostname}:4000`;

  // 5. capacitor:// or file:// origins can't reach a server → the offline local engine takes over.
  if (location.protocol === 'capacitor:' || location.protocol === 'file:') return '';

  // 6. Same-origin: only correct when a real backend is served from this origin. A static-only
  //    deploy has none, so every /api call would 404/500 — detect that and go offline instead.
  return location.origin;
}

// True when we have reason to believe a backend exists at serverBase().
export function hasConfiguredServer(): boolean {
  if (new URLSearchParams(location.search).get('server')) return true;
  if ((import.meta as any).env?.VITE_SERVER_URL || (import.meta as any).env?.VITE_API_URL) return true;
  const meta = document.querySelector('meta[name="anaconda-server"]')?.getAttribute('content');
  if (meta && !meta.includes('your-backend.example.com')) return true;
  const localPorts = ['3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '4000', '4173', '5173', '5174', '5175', '5176', '5177', '5178', '5179'];
  return localPorts.includes(location.port);
}

// §8 World size — single source of truth shared with the Renderer. Larger map = wide
// exploration that never feels crowded, room for ~25 players.
export const WORLD = 6000;
const HALF = WORLD / 2;

// §2 Competitive round pacing — mirrors the server's world config (GameConfig.world) so the
// offline engine shrinks the storm on exactly the same curve the authoritative server uses.
const MATCH_SECONDS = 180;      // Battle Royale AND Team Battle both run a 3-minute round
const ZONE_GRACE = 15;          // zone holds full size while players spawn in
const ZONE_CLOSE_AT_PCT = 0.9;  // fully closed at 90% of the round → final showdown
const ZONE_START_R = WORLD * 0.47;
const ZONE_FINAL_R = WORLD * 0.09;

const FOOD_TYPES = [
  { type: 'cherry', val: 10, icon: '🍒', color: '#ff4d4d' },
  { type: 'apple', val: 20, icon: '🫑', color: '#f59e0b' },
  { type: 'mushroom', val: 20, icon: '🌻', color: '#ff9933' },
  { type: 'frog', val: 25, icon: '💎', color: '#10b981' },
  { type: 'crystal', val: 35, icon: '🔷', color: '#38bdf8' },
  // ⭐ stars are a dedicated moving set (§3), not part of the random food roll
  { type: 'heart', val: 15, icon: '❤️', color: '#ef4444' },
  { type: 'shield', val: 25, icon: '💚', color: '#3399ff' },
  { type: 'speed', val: 25, icon: '⚡', color: '#facc15' },
];

// §2/§3 obstacle palette for the local engine (mirrors the server table)
const OBSTACLE_TYPES: Array<{ type: string; icon: string; radius: number; blocking: boolean; damage?: number; isPoison?: boolean }> = [
  { type: 'tree', icon: '🌳', radius: 46, blocking: true, damage: 0 },
  { type: 'rock', icon: '🪨', radius: 34, blocking: true, damage: 0 },
  { type: 'bush', icon: '🌿', radius: 34, blocking: false, damage: 0 },
  { type: 'cactus', icon: '🏜️', radius: 38, blocking: true, damage: 15 }, // 15% HP damage on contact
  { type: 'flowerbed', icon: '🌻', radius: 32, blocking: false, damage: 0 },
  { type: 'log', icon: '🛢️', radius: 30, blocking: true, damage: 0 },
  { type: 'pond', icon: '🏝️', radius: 54, blocking: false, damage: 0 },
  { type: 'hill', icon: '🧊', radius: 48, blocking: true, damage: 0 },
  { type: 'cave', icon: '⛏️', radius: 56, blocking: true, damage: 0 },
  { type: 'signpost', icon: '🪧', radius: 28, blocking: false, damage: 0 },
  { type: 'lava', icon: '🌋', radius: 44, blocking: false, damage: 35 },  // Volcano heat damage
  { type: 'poison', icon: '☠️', radius: 38, blocking: false, damage: 6, isPoison: true }, // Cursed skull DoT
  { type: 'explosion', icon: '💣', radius: 32, blocking: false, damage: 40 }, // Pirate bomb blast
];

// §3 hp restored per food type (local engine health loop)
const LOCAL_HEAL: Record<string, number> = { cherry: 5, apple: 8, mushroom: 5, frog: 4, crystal: 6, heart: 10, shield: 10, egg: 25 };

// §power Buff duration + stacking rules. Defaults mirror GameConfig.powers; when a server is
// reachable, /api/config overwrites these so offline and online play stay on one curve.
const POWERS = { baseSeconds: 5, bonusPerLevels: 8, maxSeconds: 10, maxStackedSeconds: 30 };
export function applyPowerConfig(p?: Partial<typeof POWERS>) {
  if (!p) return;
  for (const k of Object.keys(POWERS) as Array<keyof typeof POWERS>) {
    if (typeof p[k] === 'number' && p[k]! > 0) POWERS[k] = p[k]!;
  }
}

// Ceiling on the local world's collectibles. Eaten food is replaced 1-for-1, but corpse drops
// are pure additions — with bots dying and respawning every few seconds the array would grow
// without bound, and food collision is O(snakes × food) every tick.
const MAX_LOCAL_FOOD = 420;

const BOT_NAMES = ['AlphaViper', 'KobraX', 'Slinky', 'GigaPython', 'NeonSnake', 'ShadowSerpent', 'TitanApex'];
const BOT_SKINS = ['Jungle', 'Ocean', 'Fire', 'Ice', 'Galaxy', 'Golden', 'Shadow'];

export class GameClient {
  private socket: Socket | null = null;
  private inputSeq = 0;

  public localUserId: string = '';
  public isConnected: boolean = false;
  public modeConfig: ModeConfig | null = null;

  public onStateUpdate?: (state: GameStateTick) => void;
  public onAuthSuccess?: (userId: string, snake: SnakeData, config: ModeConfig) => void;
  public onRespawnResult?: (result: { success: boolean; message?: string; profile?: any; method?: string }) => void;
  public onAbilityResult?: (used: boolean) => void;
  // §social Pending "come play" invites pushed by the server — on arrival, and again the
  // moment we authenticate (which is how invites sent while we were offline reach us).
  public onMatchInvite?: (r: { invites: MatchInviteData[] }) => void;
  public onCollect?: (type: string, value: number) => void;
  public onPickupEvent?: (r: { foodId: string; foodType: string; updatedMissions: any[]; profile: any }) => void;
  public onBossDefeat?: (r: any) => void;
  public onWorldFeedback?: (ev: { x: number; y: number; text: string; color: string; shake?: number; boomRadius?: number }) => void;
  public onNpcEncounter?: (encounter: any) => void;
  public onQuestUpdate?: (update: any) => void;
  public onHeartState?: (payload: { heartState: HeartStateData; rechargedCount?: number; deducted?: number; reason?: string }) => void;
  public onAuthQuestSync?: (data: { activeQuest: any; activeQuiz: any; npcQuotas?: Record<string, any>; heartState?: HeartStateData; unclaimedRewardBoxCount?: number }) => void;
  public onRoomMatchStarted?: (room: any) => void;
  public preferredServer = '';

  // Local Authoritative Simulation Engine (for serverless environments like Vercel Cloud)
  private isLocalEngineRunning = false;
  private localEngineTimer: any = null;
  private lastServerTickTime = 0;
  private fallbackTimer: any = null;
  private localState: GameStateTick | null = null;
  private localInput = { angle: 0, boosting: false };
  private localPaused = false; // §12 freeze the local player while backgrounded
  // §3/§7/§8 local-engine timers (seconds)
  private starCooldown = 0;
  private wormholeRelocate = 120; // §7 four linked wormholes relocate periodically
  private sanctuaryTimer = 90;    // relocate sanctuary periodically in the local sim
  // §2 per-mode flags + state
  private modeUI = 'free_roam';
  private modeSolo = false;
  private modeStory = false;
  private localNokia = false;      // solo classic snake — walls + self kill, no wrap
  private localBR = false;         // battle royale — timer + shrinking storm + last standing
  private localTeam = false;       // team battle — team scoring
  private localMatchTimer = 0;     // seconds remaining (BR / Team); 0 = untimed
  private localMatchOver = false;
  private localMatchLastTs = 0;    // wall clock of the last match tick → real dt, no drift
  private localKingdom = 1;

  constructor() {
    this.localUserId = 'usr_' + Math.random().toString(36).substring(2, 9);
  }

  public connect(
    token: string,
    skinName: string = 'Forest',
    mode: GameMode = 'classic',
    region = 'Global',
    matchType: 'local' | 'global' = 'global',
    extra?: { roomId?: string; roomCode?: string; kingdom?: number; withBots?: boolean }
  ) {
    this.localKingdom = Math.max(1, Math.min(7, extra?.kingdom || 1));
    // §2 Solo modes (Classic Snake / Nokia) never touch the multiplayer server.
    if (this.modeSolo) { this.startLocalEngine(skinName, mode, region); return; }
    if (!this.preferredServer && !hasConfiguredServer()) { this.startLocalEngine(skinName, mode, region); return; }
    const authPayload = { token, skin: skinName, mode, region, matchType, ...extra };
    this.lastServerTickTime = 0;

    if (this.socket && this.socket.connected) {
      this.socket.emit('authenticate', authPayload);
      return;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    try {
      // §7 Global Adventure may pick a lower-latency regional server; '' = default origin.
      this.socket = io(this.preferredServer || serverBase(), {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 2000,
        closeOnBeforeunload: true,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.socket?.emit('authenticate', authPayload);
      });

      this.socket.on('authenticated', (data: { userId: string; snake: SnakeData; config: ModeConfig; activeQuest?: any; activeQuiz?: any; npcQuotas?: Record<string, any>; heartState?: HeartStateData; unclaimedRewardBoxCount?: number }) => {
        this.localUserId = data.userId || this.localUserId;
        this.modeConfig = data.config;
        this.onAuthSuccess?.(this.localUserId, data.snake, data.config);
        this.onAuthQuestSync?.({
          activeQuest: data.activeQuest || null,
          activeQuiz: data.activeQuiz || null,
          npcQuotas: data.npcQuotas,
          heartState: data.heartState,
          unclaimedRewardBoxCount: data.unclaimedRewardBoxCount,
        });
      });

      this.socket.on('game_state_tick', (tick: GameStateTick) => {
        this.lastServerTickTime = Date.now();
        if (this.isLocalEngineRunning) this.stopLocalEngine();
        this.onStateUpdate?.(this.decodeTick(tick));
      });

      this.socket.on('respawn_result', (r: any) => this.onRespawnResult?.(r));
      this.socket.on('ability_result', (r: { used: boolean }) => this.onAbilityResult?.(r.used));
      this.socket.on('match_invite', (r: { invites: MatchInviteData[] }) => this.onMatchInvite?.(r)); // §social
      this.socket.on('pickup_event', (r: any) => this.onPickupEvent?.(r));
      this.socket.on('heart_state', (r: any) => this.onHeartState?.(r));
      this.socket.on('boss_defeated', (r: any) => this.onBossDefeat?.(r));
      this.socket.on('npc_encounter', (enc: any) => this.onNpcEncounter?.(enc));
      this.socket.on('quest_update', (upd: any) => this.onQuestUpdate?.(upd));
      this.socket.on('world_feedback', (ev: any) => this.onWorldFeedback?.(ev));
      this.socket.on('room_match_started', (d: any) => this.onRoomMatchStarted?.(d?.room));
      this.socket.on('disconnect', () => { this.isConnected = false; });
    } catch { /* ignored */ }

    // Set fallback to start local simulation engine if server ticks fail to arrive within 600ms
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      if (this.lastServerTickTime === 0 && !this.isLocalEngineRunning) {
        this.startLocalEngine(skinName, mode, region);
      }
    }, 600);
  }

  // §net The server sends the near-static world layout (obstacles + wormholes) only when its
  // `worldVersion` changes, instead of re-transmitting it 30×/second. Ticks that omit it carry
  // the last known layout forward so the Renderer always receives a complete world.
  private cachedObstacles: ObstacleData[] = [];
  private cachedPortals: PortalData[] = [];
  private cachedNpcs: NpcData[] = [];
  private decodeTick(tick: GameStateTick): GameStateTick {
    if (tick.obstacles) this.cachedObstacles = tick.obstacles;
    else tick.obstacles = this.cachedObstacles;
    if (tick.portals) this.cachedPortals = tick.portals;
    else tick.portals = this.cachedPortals;
    if (tick.npcs) this.cachedNpcs = tick.npcs;
    else tick.npcs = this.cachedNpcs;
    // Rehydrate the flat body encoding ([x0,y0,x1,y1,…] → [{x,y},…]) so the Renderer keeps
    // working with plain segment objects and knows nothing about the wire format.
    for (const s of tick.snakes) {
      const flat = (s as any).b as number[] | undefined;
      if (!flat) { if (!s.body) s.body = []; continue; } // never hand the Renderer an undefined body
      const body: SnakeSegment[] = new Array(flat.length >> 1);
      for (let i = 0, k = 0; i < flat.length; i += 2, k++) body[k] = { x: flat[i], y: flat[i + 1] };
      s.body = body;
      delete (s as any).b;
    }
    return tick;
  }

  public disconnect() {
    if (this.socket) { this.socket.disconnect(); this.socket = null; }
    this.isConnected = false;
    this.cachedObstacles = [];
    this.cachedPortals = [];
    this.stopLocalEngine();
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
  }

  // §net Tell the server how much world we can see, so it culls the tick to match. Only
  // resent when it moves meaningfully (zoom step / rotation / resize) — not every frame.
  private sentViewRadius = 0;
  public setViewRadius(radius: number) {
    if (!this.socket || !this.isConnected) return;
    if (!Number.isFinite(radius) || radius <= 0) return;
    if (Math.abs(radius - this.sentViewRadius) < this.sentViewRadius * 0.12) return;
    this.sentViewRadius = radius;
    this.socket.emit('view_radius', { radius: Math.round(radius) });
  }

  public sendInput(angle: number, boosting: boolean) {
    this.localInput = { angle, boosting };
    if (this.socket && this.isConnected) {
      this.inputSeq++;
      this.socket.emit('client_input', { seq: this.inputSeq, angle, boosting });
    }
  }

  // §12 Tell the server we've backgrounded/foregrounded so it can mark us inactive
  // (invisible, no damage) and resume us cleanly. No-op under the local engine.
  // §2 Carry the selected mode's rules into the engine before connecting.
  public setModeFlags(flags: { ui: string; solo: boolean; story: boolean }) {
    this.modeUI = flags.ui; this.modeSolo = flags.solo; this.modeStory = flags.story;
  }

  public notifyPause(paused: boolean) {
    this.localPaused = paused;
    if (this.socket && this.isConnected) this.socket.emit(paused ? 'player_pause' : 'player_resume');
  }

  public requestNpcInteract(npcId: string) {
    if (this.isLocalEngineRunning) {
      this.localPaused = true;
      return;
    }
    if (this.socket && this.isConnected) {
      this.socket.emit('npc_interact_request', { npcId });
    }
  }

  public endInteraction() {
    this.localPaused = false;
    if (this.isLocalEngineRunning && this.localState) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me && me.isInvisible) {
        me.isInvisible = false;
        me.inQuiz = false;
        me.shieldTimer = Math.max(me.shieldTimer || 0, 2.5);
      }
    }
    if (this.socket && this.isConnected) {
      this.socket.emit('interaction_end');
    }
  }

  /** Make the player snake invisible & immune while taking a quiz; grants 2.5s shield on exit. */
  public setQuizMode(active: boolean) {
    this.localPaused = active;
    if (this.isLocalEngineRunning && this.localState) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me) {
        me.isInvisible = active;
        me.inQuiz = active;
        me.boosting = false;
        if (!active) me.shieldTimer = Math.max(me.shieldTimer || 0, 2.5);
      }
    }
    if (this.socket && this.isConnected) {
      this.socket.emit('quiz_state', { active });
    }
  }

  /** Pause & protect the player while planning on the Tactical Arena Map (enemies cannot attack). */
  public setMapPlanning(active: boolean) {
    this.localPaused = active;
    if (this.isLocalEngineRunning && this.localState && !active) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me) me.shieldTimer = Math.max(me.shieldTimer || 0, 1.5);
    }
    if (this.socket && this.isConnected) {
      this.socket.emit('map_planning', { active });
    }
  }

  /** Apply a purchased power-up locally when in offline fallback engine. */
  public applyLocalPowerup(powerupId: 'pw_boost' | 'pw_shield' | 'pw_super') {
    if (!this.isLocalEngineRunning || !this.localState) return;
    const me = this.localState.snakes.find(s => s.id === this.localUserId);
    if (!me || !me.isAlive) return;
    if (powerupId === 'pw_boost') {
      me.speedBoostTimer = Math.max(me.speedBoostTimer || 0, 10);
      this.onWorldFeedback?.({ x: me.head.x, y: me.head.y, text: 'SPEED BOOST +10s!', color: '#D97706' });
    } else if (powerupId === 'pw_shield') {
      me.shieldTimer = Math.max(me.shieldTimer || 0, 10);
      this.onWorldFeedback?.({ x: me.head.x, y: me.head.y, text: 'GUARD SHIELD +10s!', color: '#0284C7' });
    } else if (powerupId === 'pw_super') {
      me.superTimer = Math.max(me.superTimer || 0, 8);
      me.speedBoostTimer = Math.max(me.speedBoostTimer || 0, 8);
      this.onWorldFeedback?.({ x: me.head.x, y: me.head.y, text: 'SUPER SURGE +8s!', color: '#DB2777' });
    }
  }

  public activateAbility() {
    if (this.isLocalEngineRunning && this.localState) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me && me.abilityCooldown <= 0) {
        me.abilityCooldown = 12;
        me.abilityActiveTimer = 3;
        me.shieldTimer = Math.max(me.shieldTimer, 3);
        me.speedBoostTimer = Math.max(me.speedBoostTimer, 2);
        me.poisonTimer = 0;
        this.onWorldFeedback?.({ x: me.head.x, y: me.head.y, text: 'GUARD +3s!', color: '#059669' });
        this.onAbilityResult?.(true);
      }
      return;
    }
    if (this.socket && this.isConnected) this.socket.emit('activate_ability');
  }

  public requestRespawn(method: 'stars' | 'ticket' | 'ad' | 'wait', adToken?: string) {
    if (this.isLocalEngineRunning && this.localState) {
      const me = this.localState.snakes.find(s => s.id === this.localUserId);
      if (me) {
        me.isAlive = true;
        me.hp = 100;
        me.poisonTimer = 0;
        me.score = 150; me.level = 1; me.radius = 13; me.length = 9;
        const sz = this.localState.safeZone;
        const spawnR = Math.min(200, Math.max(0, sz.radius * 0.5));
        const ang = Math.random() * Math.PI * 2, d = Math.random() * spawnR;
        me.head = { x: this.wrapLocal(sz.centerX + Math.cos(ang) * d), y: this.wrapLocal(sz.centerY + Math.sin(ang) * d) };
        me.body = Array.from({ length: 9 }, (_, i) => ({ x: me.head.x - i * 10, y: me.head.y }));
        (me as any).stormT = 0;
        this.onRespawnResult?.({ success: true, method });
      }
      return;
    }
    if (this.socket && this.isConnected) this.socket.emit('respawn', { method, adToken });
  }

  // ---------------------------------------------------------------- Local Simulation Engine
  private startLocalEngine(skinName: string, mode: GameMode, region: string) {
    this.isLocalEngineRunning = true;

    // §2 Resolve this match's rules from the selected mode.
    this.localNokia = this.modeSolo || this.modeUI === 'nokia';
    this.localBR = mode === 'battle_royale';
    this.localTeam = mode === 'team';
    const isBossMode = mode === 'boss';
    this.localMatchTimer = isBossMode ? 150 : (this.localBR || this.localTeam) ? MATCH_SECONDS : 0;
    this.localMatchOver = false;
    this.localMatchLastTs = 0;

    const me: SnakeData = {
      id: this.localUserId,
      userId: this.localUserId,
      displayName: 'You (Explorer)',
      skin: skinName,
      head: { x: HALF, y: HALF },
      body: Array.from({ length: 9 }, (_, i) => ({ x: HALF - i * 12, y: HALF })),
      angle: 0,
      speed: 4,
      speedPct: 1,
      boosting: false,
      score: 150,
      level: 1,
      length: 9,
      radius: 13,
      hp: 100,
      maxHp: 100,
      defense: 0,
      stage: 'Baby',
      region,
      isAlive: true,
      kills: 0,
      shieldTimer: 0,
      speedBoostTimer: 0,
      abilityCooldown: 0,
      abilityActiveTimer: 0,
      team: this.localTeam ? 'blue' : undefined,
    };

    const bossRoster = [
      { id: 'boss_thornmaw', name: '🐲 Thornmaw', hp: 600, radius: 30, score: 4000 },
      { id: 'boss_tidecoil', name: '🐉 Tidecoil', hp: 900, radius: 32, score: 5500 },
      { id: 'boss_cinderfang', name: '🔥 Cinderfang', hp: 1200, radius: 34, score: 7500 },
      { id: 'boss_frostscale', name: '❄️ Frostscale', hp: 1500, radius: 36, score: 9500 },
      { id: 'boss_petalwyrm', name: '🌺 Petalwyrm', hp: 1850, radius: 38, score: 12000 },
      { id: 'boss_duskshroud', name: '👁️ Duskshroud', hp: 2200, radius: 40, score: 15000 },
      { id: 'boss_venom_emperor', name: '👑 Venom Emperor', hp: 3000, radius: 44, score: 20000 },
    ];

    const botCount = (this.localNokia || isBossMode) ? 0 : (this.localBR ? 24 : 18);
    const bots: SnakeData[] = Array.from({ length: botCount }, (_, idx) => {
      const name = BOT_NAMES[idx % BOT_NAMES.length] + (idx >= BOT_NAMES.length ? ` ${Math.floor(idx / BOT_NAMES.length) + 1}` : '');
      const bx = 400 + Math.random() * (WORLD - 800);
      const by = 400 + Math.random() * (WORLD - 800);
      return {
        id: `bot_${idx}`,
        userId: `bot_${idx}`,
        displayName: name,
        skin: BOT_SKINS[idx % BOT_SKINS.length],
        head: { x: bx, y: by },
        body: Array.from({ length: 9 }, (_, i) => ({ x: bx - i * 10, y: by })),
        angle: Math.random() * Math.PI * 2,
        speed: 3.5,
        speedPct: 1,
        boosting: false,
        score: Math.floor(100 + Math.random() * 400),
        level: 1,
        length: 9,
        radius: 13,
        hp: 100,
        maxHp: 100,
        defense: 0,
        stage: 'Baby',
        isAlive: true,
        kills: Math.floor(Math.random() * 3),
        shieldTimer: 0,
        speedBoostTimer: 0,
        abilityCooldown: 0,
        abilityActiveTimer: 0,
        team: this.localTeam ? (idx % 2 === 0 ? 'red' : 'blue') : undefined,
      };
    });

    if (isBossMode) {
      const b = bossRoster[Math.min(bossRoster.length - 1, Math.max(0, this.localKingdom - 1))];
      const bx = HALF + 520;
      const by = HALF;
      bots.push({
        id: b.id,
        userId: b.id,
        displayName: b.name,
        skin: 'Shadow',
        head: { x: bx, y: by },
        body: Array.from({ length: 34 }, (_, i) => ({ x: bx + i * 16, y: by })),
        angle: Math.PI,
        speed: 6.5,
        speedPct: 75,
        boosting: false,
        score: b.score,
        level: 50,
        length: 34,
        radius: b.radius,
        hp: b.hp,
        maxHp: b.hp,
        defense: 40,
        stage: 'Titan',
        isAlive: true,
        kills: 0,
        shieldTimer: 0,
        speedBoostTimer: 0,
        abilityCooldown: 0,
        abilityActiveTimer: 0,
        isBoss: true,
      });
    }

    const foodItems: FoodData[] = Array.from({ length: this.localNokia ? 65 : 260 }, (_, i) => this.genFood(`f_${i}`));
    if (!this.localNokia) for (let i = 0; i < 24; i++) foodItems.push(this.genStar(`star_${i}`));

    this.localState = {
      tick: 1,
      timestamp: Date.now(),
      mode,
      snakes: [me, ...bots],
      food: foodItems,
      safeZone: {
        centerX: HALF,
        centerY: HALF,
        radius: this.localBR || this.localTeam || isBossMode ? ZONE_START_R : HALF * 0.94,
        targetRadius: this.localBR || this.localTeam || isBossMode ? ZONE_FINAL_R : HALF * 0.94,
        damagePerSecond: 15,
      },
      sanctuaryZone: this.localNokia ? undefined : { centerX: HALF, centerY: HALF, radius: 360, label: '🛡️ Safe Sanctuary', icon: '🛡️' },
      portals: this.localNokia ? [] : this.genWormholes(),
      obstacles: this.localNokia ? [] : this.genObstacles(68),
      npcs: (!this.localNokia && mode === 'classic') ? [
        { id: 'npc_elder_moss', name: 'Elder Moss', role: 'elder', icon: '🐍', accessory: '🧙', kingdom: this.localKingdom, x: WORLD * 0.50, y: WORLD * 0.46, radius: 46 },
        { id: 'npc_guard_bram', name: 'Guard Bram', role: 'guard', icon: '🐍', accessory: '🛡️', kingdom: this.localKingdom, x: WORLD * 0.58, y: WORLD * 0.52, radius: 46 },
        { id: 'npc_merchant_fen', name: 'Fen the Trader', role: 'merchant', icon: '🐍', accessory: '🎒', kingdom: this.localKingdom, x: WORLD * 0.44, y: WORLD * 0.54, radius: 46 },
        { id: 'npc_villager_pip', name: 'Pip', role: 'villager', icon: '🐍', accessory: '🌸', kingdom: this.localKingdom, x: WORLD * 0.53, y: WORLD * 0.41, radius: 46 },
        { id: 'npc_trainer_kess', name: 'Kess the Coil', role: 'trainer', icon: '🐍', accessory: '⚔️', kingdom: this.localKingdom, x: WORLD * 0.47, y: WORLD * 0.58, radius: 46 },
      ] : [],
      teamScores: this.localTeam ? { red: 0, blue: 0 } : undefined,
      matchTimer: (this.localBR || this.localTeam || isBossMode) ? this.localMatchTimer : undefined,
      leaderboard: [],
    };

    this.modeConfig = {
      mode,
      label: mode.toUpperCase(),
      tagline: 'Local 30Hz Simulation Engine',
      shrinkingZone: mode === 'battle_royale',
      teamsEnabled: mode === 'team',
      worldEvents: true,
      botCount: bots.length,
    };
    this.onAuthSuccess?.(this.localUserId, me, this.modeConfig);

    if (this.localEngineTimer) clearInterval(this.localEngineTimer);
    this.localEngineTimer = setInterval(() => this.updateLocalEngine(), 33);
  }

  private stopLocalEngine() {
    this.isLocalEngineRunning = false;
    if (this.localEngineTimer) {
      clearInterval(this.localEngineTimer);
      this.localEngineTimer = null;
    }
  }

  private genFood(id: string): FoodData {
    const fType = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    const min = this.localNokia ? HALF - 1050 : 100;
    const span = this.localNokia ? 2100 : (WORLD - 200);
    return {
      id,
      x: min + Math.random() * span,
      y: min + Math.random() * span,
      value: fType.val,
      type: fType.type,
      color: fType.color,
      icon: fType.icon,
    };
  }

  private isInsideSanctuaryLocal(s: SnakeData): boolean {
    const sz = this.localState?.sanctuaryZone;
    if (!sz) return false;
    const dx = this.wrapDeltaLocal(s.head.x - sz.centerX);
    const dy = this.wrapDeltaLocal(s.head.y - sz.centerY);
    return dx * dx + dy * dy < sz.radius * sz.radius;
  }

  // §6 Toroidal wrap helpers for the local engine (world = WORLD).
  private wrapLocal(v: number): number { return ((v % WORLD) + WORLD) % WORLD; }
  private wrapDeltaLocal(d: number): number { let r = ((d % WORLD) + WORLD) % WORLD; if (r > HALF) r -= WORLD; return r; }
  private followBodyLocal(s: SnakeData) {
    let prev = { x: s.head.x, y: s.head.y };
    for (let i = 0; i < s.body.length; i++) {
      const seg = s.body[i];
      const dx = this.wrapDeltaLocal(prev.x - seg.x);
      const dy = this.wrapDeltaLocal(prev.y - seg.y);
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        seg.x = this.wrapLocal(seg.x + (dx / dist) * (dist - 10));
        seg.y = this.wrapLocal(seg.y + (dy / dist) * (dist - 10));
      }
      prev = { x: seg.x, y: seg.y };
    }
  }

  // §3 A slow-drifting star collectible.
  private genStar(id: string): FoodData {
    return { id, x: 200 + Math.random() * (WORLD - 400), y: 200 + Math.random() * (WORLD - 400), value: 50, type: 'star', icon: '⭐', color: '#ffcc00', vx: 0, vy: 0, wanderTimer: Math.random() * 2 };
  }

  // §2 Scatter rich bundle obstacles with a discoverable starter ring (stone, pond, volcano, bomb, skull, tree, cave) + wide lanes
  private genObstacles(count: number): ObstacleData[] {
    const list: ObstacleData[] = [];
    const ringTypes = ['rock', 'pond', 'lava', 'explosion', 'poison', 'tree', 'cave', 'flowerbed', 'bush', 'log'];
    for (let i = 0; i < ringTypes.length; i++) {
      const t = OBSTACLE_TYPES.find(o => o.type === ringTypes[i]) || OBSTACLE_TYPES[0];
      const ang = (i / ringTypes.length) * Math.PI * 2 + 0.35;
      const dist = 310 + (i % 2) * 190;
      const x = Math.round(HALF + Math.cos(ang) * dist);
      const y = Math.round(HALF + Math.sin(ang) * dist);
      list.push({ id: `ob_ring_${i}`, type: t.type, icon: t.icon, x, y, radius: t.radius, blocking: t.blocking, damage: t.damage, isPoison: t.isPoison } as any);
    }

    let guard = 0;
    while (list.length < count && guard++ < 420) {
      const t = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      const x = 240 + Math.random() * (WORLD - 480);
      const y = 240 + Math.random() * (WORLD - 480);
      const dcx = x - HALF, dcy = y - HALF;
      if (dcx * dcx + dcy * dcy < 280 * 280) continue; // keep immediate spawn center free
      let ok = true;
      for (const o of list) { const dx = x - o.x, dy = y - o.y, gap = t.radius + o.radius + 120; if (dx * dx + dy * dy < gap * gap) { ok = false; break; } }
      if (ok) list.push({ id: `ob_${list.length}`, type: t.type, icon: t.icon, x, y, radius: t.radius, blocking: t.blocking, damage: t.damage, isPoison: t.isPoison } as any);
    }
    return list;
  }

  private updateLocalEngine() {
    if (!this.localState) return;
    const state = this.localState;
    state.tick++;
    state.timestamp = Date.now();

    // Tick down power & poison timers for every snake (§power)
    for (const s of state.snakes) {
      if (s.shieldTimer > 0) s.shieldTimer = Math.max(0, s.shieldTimer - 0.033);
      if (s.speedBoostTimer > 0) s.speedBoostTimer = Math.max(0, s.speedBoostTimer - 0.033);
      if ((s.superTimer ?? 0) > 0) s.superTimer = Math.max(0, (s.superTimer ?? 0) - 0.033);
      if (s.abilityActiveTimer > 0) s.abilityActiveTimer = Math.max(0, s.abilityActiveTimer - 0.033);
      if ((s.poisonTimer ?? 0) > 0 && s.isAlive) {
        s.poisonTimer = Math.max(0, (s.poisonTimer ?? 0) - 0.033);
        if (s.shieldTimer > 0 || (s.superTimer ?? 0) > 0 || s.abilityActiveTimer > 0) {
          s.poisonTimer = 0;
        } else {
          s.hp = Math.max(0, (s.hp ?? 100) - 6 * 0.033);
          if (s.id === this.localUserId && state.tick % 24 === 0) {
            this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: '-6 POISON', color: '#65A30D' });
          }
          if ((s.hp ?? 100) <= 0) this.eliminateLocal(s, null);
        }
      }
    }

    // 1. Update Player Snake Movement (frozen while backgrounded or invisible in quiz)
    const me = state.snakes.find(s => s.id === this.localUserId);
    if (me && me.isAlive && !this.localPaused && !me.isInvisible && !me.inQuiz) {
      if (this.localNokia) {
        // Cardinal 90° snap steering with 180° instant-reverse protection
        const q = Math.round(this.localInput.angle / (Math.PI / 2)) * (Math.PI / 2);
        let diff = q - me.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        if (Math.abs(Math.abs(diff) - Math.PI) > 0.25) me.angle = q;
      } else {
        me.angle = this.localInput.angle;
      }
      me.boosting = this.localInput.boosting && me.score > 20;
      let speed = me.boosting ? 13.6 : 8;
      if ((me.speedBoostTimer ?? 0) > 0) speed *= 1.4;
      if ((me.superTimer ?? 0) > 0) speed *= 1.5;
      if (me.boosting) me.score = Math.max(10, me.score - 0.2);

      const nx = me.head.x + Math.cos(me.angle) * speed;
      const ny = me.head.y + Math.sin(me.angle) * speed;
      if (this.localNokia) {
        const minB = HALF - 1100 + me.radius;
        const maxB = HALF + 1100 - me.radius;
        if (nx < minB || nx > maxB || ny < minB || ny > maxB) {
          this.eliminateLocal(me, null);
        } else {
          me.head.x = nx; me.head.y = ny; this.followBodyLocal(me);
          if (this.selfCollide(me)) this.eliminateLocal(me, null);
        }
      } else {
        me.head.x = this.wrapLocal(nx);
        me.head.y = this.wrapLocal(ny);
        this.followBodyLocal(me);
      }
      if (me.abilityCooldown > 0) me.abilityCooldown = Math.max(0, me.abilityCooldown - 0.033);
    }

    // 2. Update Bot / Boss AI Movement
    for (const b of state.snakes) {
      if (b.id === this.localUserId || !b.isAlive) continue;
      let tx = 0, ty = 0, best = 700 * 700, found = false;
      if (b.isBoss && me && me.isAlive && !me.isInvisible && !me.inQuiz) {
        tx = this.wrapDeltaLocal(me.head.x - b.head.x);
        ty = this.wrapDeltaLocal(me.head.y - b.head.y);
        found = true;
      } else {
        for (const f of state.food) {
          const dx = this.wrapDeltaLocal(f.x - b.head.x);
          const dy = this.wrapDeltaLocal(f.y - b.head.y);
          const d = dx * dx + dy * dy;
          if (d < best) { best = d; tx = dx; ty = dy; found = true; }
        }
      }
      if (found) {
        const target = Math.atan2(ty, tx);
        let diff = target - b.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        b.angle += diff * 0.08;
      } else if (Math.random() < 0.04) {
        b.angle += (Math.random() - 0.5) * 1.2;
      }
      if (state.obstacles?.length) {
        for (const ob of state.obstacles) {
          if (!ob.blocking && !ob.damage) continue;
          const dx = this.wrapDeltaLocal(ob.x - b.head.x), dy = this.wrapDeltaLocal(ob.y - b.head.y);
          const av = ob.radius + b.radius + 70;
          if (dx * dx + dy * dy < av * av) {
            let diff = Math.atan2(-dy, -dx) - b.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            b.angle += diff * 0.25;
            break;
          }
        }
      }
      const bSpeed = (b.speedBoostTimer ?? 0) > 0 ? 9 : 6.5; // a touch slower than the player
      b.head.x = this.wrapLocal(b.head.x + Math.cos(b.angle) * bSpeed);
      b.head.y = this.wrapLocal(b.head.y + Math.sin(b.angle) * bSpeed);
      this.followBodyLocal(b);
    }

    // 2.5 Round clock first (it sets this frame's zone radius), then the world systems that
    // read it — same ordering as the server tick.
    this.updateLocalMatch(0.033); // §2 Battle Royale / Team Battle timer + shrinking storm
    if (!this.localNokia) {
      this.updateLocalStars(0.033);
      this.updateLocalWormhole(0.033);
      this.updateLocalSanctuary(0.033);
      this.resolveLocalObstacles();
      this.resolveLocalWormholeTeleport();
    }

    // 3. Check Food Collisions & Spawning
    for (const s of state.snakes) {
      if (!s.isAlive) continue;
      for (let i = state.food.length - 1; i >= 0; i--) {
        const f = state.food[i];
        const dx = this.wrapDeltaLocal(s.head.x - f.x);
        const dy = this.wrapDeltaLocal(s.head.y - f.y);
        if (dx * dx + dy * dy < (s.radius + 14) * (s.radius + 14)) {
          s.score += f.value;
          if (LOCAL_HEAL[f.type]) s.hp = Math.min(s.maxHp ?? 100, (s.hp ?? 100) + LOCAL_HEAL[f.type]); // §3 heal
          s.level = Math.floor(s.score / 250) + 1; // drives level-scaled power durations
          // Milestone-gated growth (matches the server): grow only past 500, small caps so
          // the snake never fills the screen. Radius jumps at 500/1500/3000/5000/8000.
          s.radius = s.score >= 8000 ? 23 : s.score >= 5000 ? 21 : s.score >= 3000 ? 19 : s.score >= 1500 ? 17 : s.score >= 500 ? 15 : 13;
          s.stage = s.score >= 5000 ? 'Titan' : s.score >= 3000 ? 'Elite' : s.score >= 1500 ? 'Adult' : s.score >= 500 ? 'Young' : 'Baby';
          s.length = this.localNokia
            ? Math.min(80, 9 + Math.floor(Math.max(0, s.score - 150) / 25))
            : (s.score < 500 ? 9 : Math.min(40, 9 + Math.floor((s.score - 500) / 220)));
          while (s.body.length < s.length) {
            const last = s.body[s.body.length - 1] || s.head;
            s.body.push({ x: last.x, y: last.y });
          }
          // §power Level-scaled buffs (⚡ speed, 🛡️ shield, 🍄 super), stacked exactly the way
          // the authoritative server does: a re-pickup EXTENDS the time left rather than
          // replacing it (2s left + a 5s power = 7s), capped so it can't become permanent.
          const dur = Math.min(POWERS.maxSeconds, POWERS.baseSeconds + Math.floor(s.level / POWERS.bonusPerLevels));
          const stack = (remaining: number) => Math.min(POWERS.maxStackedSeconds, Math.max(0, remaining) + dur);
          if (f.type === 'shield') {
            s.shieldTimer = stack(s.shieldTimer);
            s.poisonTimer = 0;
            if (s.id === this.localUserId) this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: `SHIELD +${dur}s`, color: '#0284C7' });
          } else if (f.type === 'speed') {
            s.speedBoostTimer = stack(s.speedBoostTimer);
            if (s.id === this.localUserId) this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: `SPEED +${dur}s`, color: '#D97706' });
          } else if (f.type === 'mushroom') {
            s.superTimer = stack(s.superTimer ?? 0);
            s.poisonTimer = 0;
            if (s.id === this.localUserId) this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: `SUPER +${dur}s`, color: '#7C3AED' });
          }
          if (s.id === this.localUserId) this.onCollect?.(f.type, f.value); // §V7 real-time mission/stat tracking
          state.food.splice(i, 1);
          state.food.push(this.genFood(`f_${Date.now()}_${i}`));
        }
      }
    }

    // 3b. Head-to-Head Snake Combat (Sprint V4 Section 1) — only heads colliding eliminate a
    // snake; the higher score survives, an exact tie destroys both. Body contact never kills.
    for (let i = 0; i < state.snakes.length; i++) {
      const a = state.snakes[i];
      if (!a.isAlive) continue;
      for (let j = i + 1; j < state.snakes.length; j++) {
        const b = state.snakes[j];
        if (!b.isAlive) continue;
        if (this.localTeam && a.team && a.team === b.team) continue; // no friendly fire
        if (this.localPaused && (a.id === this.localUserId || b.id === this.localUserId)) continue; // §12
        if (a.isInvisible || b.isInvisible || a.inQuiz || b.inQuiz) continue; // quiz invisibility immunity
        const dx = this.wrapDeltaLocal(a.head.x - b.head.x);
        const dy = this.wrapDeltaLocal(a.head.y - b.head.y);
        const clashDist = a.radius + b.radius;
        if (dx * dx + dy * dy >= clashDist * clashDist) continue; // heads not touching

        const aSafe = a.shieldTimer > 0 || (a.superTimer ?? 0) > 0 || this.isInsideSanctuaryLocal(a);
        const bSafe = b.shieldTimer > 0 || (b.superTimer ?? 0) > 0 || this.isInsideSanctuaryLocal(b);
        if (a.score > b.score) {
          if (!bSafe) this.eliminateLocal(b, a);
        } else if (b.score > a.score) {
          if (!aSafe) this.eliminateLocal(a, b);
        } else {
          if (!aSafe) this.eliminateLocal(a, null);
          if (!bSafe) this.eliminateLocal(b, null);
        }
        if (!a.isAlive) break; // a eliminated — stop scanning its opponents
      }
    }

    // 3c. Respawn eliminated bots after a short delay (disabled in Battle Royale & 1v1 Boss).
    if (!this.localBR && state.mode !== 'boss') {
      for (const s of state.snakes) {
        if (s.isAlive || s.id === this.localUserId || s.isBoss) continue;
        s.respawnAt = s.respawnAt ?? state.timestamp + 4000;
        if (state.timestamp >= s.respawnAt) {
          const bx = 300 + Math.random() * (WORLD - 600);
          const by = 300 + Math.random() * (WORLD - 600);
          s.isAlive = true;
          s.head = { x: bx, y: by };
          s.body = Array.from({ length: 9 }, (_, i) => ({ x: bx - i * 10, y: by }));
          s.score = Math.floor(100 + Math.random() * 400);
          s.length = 9;
          s.radius = 13;
          s.shieldTimer = 1.5;
          s.respawnAt = undefined;
        }
      }
    }

    // 4. Update Leaderboard
    state.leaderboard = state.snakes
      .filter(s => s.isAlive)
      .sort((a, b) => b.score - a.score)
      .map(s => ({ id: s.id, name: s.displayName, score: Math.round(s.score), kills: s.kills }));

    // 5. Emit State Update Tick
    this.onStateUpdate?.(state);
  }

  // §3 Move + maintain the dedicated set of drifting stars.
  private updateLocalStars(dt: number) {
    if (!this.localState) return;
    const food = this.localState.food;
    const snakes = this.localState.snakes;
    let count = 0;
    for (const f of food) {
      if (f.type !== 'star') continue;
      count++;
      // Evasive: dart away from the nearest snake head; otherwise drift smoothly.
      let fleeX = 0, fleeY = 0, nearestSq = Infinity;
      for (const s of snakes) {
        if (!s.isAlive) continue;
        const dx = this.wrapDeltaLocal(f.x - s.head.x);
        const dy = this.wrapDeltaLocal(f.y - s.head.y);
        const d = dx * dx + dy * dy;
        if (d < nearestSq) { nearestSq = d; fleeX = dx; fleeY = dy; }
      }
      if (nearestSq < 240 * 240 && nearestSq > 1) {
        const dist = Math.sqrt(nearestSq);
        f.vx = (fleeX / dist) * 5.8;  // per-tick, < player 8 → catchable
        f.vy = (fleeY / dist) * 5.8;
        f.wanderTimer = 0.25;
      } else {
        f.wanderTimer = (f.wanderTimer ?? 0) - dt;
        if (f.wanderTimer <= 0) { const a = Math.random() * Math.PI * 2; const spd = 1.3 + Math.random() * 1.4; f.vx = Math.cos(a) * spd; f.vy = Math.sin(a) * spd; f.wanderTimer = 1.2 + Math.random() * 2; }
      }
      f.x = this.wrapLocal(f.x + (f.vx ?? 0));
      f.y = this.wrapLocal(f.y + (f.vy ?? 0));
    }
    this.starCooldown -= dt;
    if (count < 16 && this.starCooldown <= 0 && count < 20) { food.push(this.genStar(`star_${Date.now()}`)); this.starCooldown = 1.5; }
  }

  // §7 Four linked wormholes — always present, relocate periodically to stay dynamic.
  private genWormholes(): PortalData[] {
    const colors = ['#8B5CF6', '#EC4899', '#3B82F6', '#F59E0B'];
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 4; i++) {
      let p: { x: number; y: number } | null = null;
      for (let t = 0; t < 20; t++) {
        const c = { x: 320 + Math.random() * (WORLD - 640), y: 320 + Math.random() * (WORLD - 640) };
        if (pts.every(q => (q.x - c.x) ** 2 + (q.y - c.y) ** 2 > 700 * 700)) { p = c; break; }
      }
      pts.push(p || { x: 320 + Math.random() * (WORLD - 640), y: 320 + Math.random() * (WORLD - 640) });
    }
    return pts.map((p, i) => ({ id: `wh_${i}`, targetId: `wh_${(i + 1) % 4}`, x: p.x, y: p.y, label: '🌀 Wormhole', color: colors[i], wormhole: true }));
  }

  private updateLocalWormhole(dt: number) {
    if (!this.localState) return;
    if (!this.localState.portals || this.localState.portals.length < 4) { this.localState.portals = this.genWormholes(); this.wormholeRelocate = 120; return; }
    this.wormholeRelocate -= dt;
    if (this.wormholeRelocate <= 0) { this.localState.portals = this.genWormholes(); this.wormholeRelocate = 120; }
  }

  // §8 Relocate the sanctuary periodically.
  private updateLocalSanctuary(dt: number) {
    if (!this.localState?.sanctuaryZone) return;
    this.sanctuaryTimer -= dt;
    if (this.sanctuaryTimer <= 0) {
      this.sanctuaryTimer = 300;
      const s = this.localState.sanctuaryZone;
      if (this.localBR || this.localTeam) {
        // §2 Players spawn in the sanctuary, so in storm modes it has to stay inside the zone.
        const sz = this.localState.safeZone;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * Math.max(0, sz.radius - s.radius - 60);
        s.centerX = this.wrapLocal(sz.centerX + Math.cos(angle) * dist);
        s.centerY = this.wrapLocal(sz.centerY + Math.sin(angle) * dist);
      } else {
        s.centerX = s.radius + Math.random() * (WORLD - 2 * s.radius);
        s.centerY = s.radius + Math.random() * (WORLD - 2 * s.radius);
      }
    }

    // §2 The storm closes continuously, so the shelter scales down with it and gets pulled
    // back inside whenever the ring passes over it (mirrors the server).
    if (this.localBR || this.localTeam) {
      const sz = this.localState.safeZone;
      const s = this.localState.sanctuaryZone;
      s.radius = Math.min(360, Math.max(120, sz.radius * 0.33));
      const dx = this.wrapDeltaLocal(s.centerX - sz.centerX);
      const dy = this.wrapDeltaLocal(s.centerY - sz.centerY);
      const d = Math.hypot(dx, dy);
      const maxD = Math.max(0, sz.radius - s.radius - 60);
      if (d > maxD) {
        const k = d > 0 ? maxD / d : 0;
        s.centerX = this.wrapLocal(sz.centerX + dx * k);
        s.centerY = this.wrapLocal(sz.centerY + dy * k);
      }
    }
  }

  // §2 Blocking obstacles soft-push snake heads out; bundle props trigger heal/boost/loot; hazards deal i-framed damage.
  private resolveLocalObstacles() {
    const obs = this.localState?.obstacles;
    if (!obs?.length || !this.localState) return;
    const tick = this.localState.tick;
    for (const s of this.localState.snakes) {
      if (!s.isAlive) continue;
      if (((s as any).hazardCd ?? 0) > 0) (s as any).hazardCd -= 0.033;
      const isMe = s.id === this.localUserId;
      const shielded = (s.superTimer ?? 0) > 0 || s.shieldTimer > 0 || s.abilityActiveTimer > 0;
      for (const ob of obs) {
        const dx = this.wrapDeltaLocal(s.head.x - ob.x), dy = this.wrapDeltaLocal(s.head.y - ob.y);
        const minDist = ob.radius + s.radius, distSq = dx * dx + dy * dy;
        const touchDist = ob.type === 'cave' || ob.type === 'tree' || ob.type === 'log' ? (minDist + 10) : minDist;
        if (distSq >= touchDist * touchDist) continue;

        if (ob.type === 'pond') {
          if ((s.poisonTimer ?? 0) > 0) {
            s.poisonTimer = 0;
            if (isMe) this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: 'CLEANSED!', color: '#0284C7' });
          }
          if ((s.hp ?? 100) < (s.maxHp ?? 100)) {
            s.hp = Math.min(s.maxHp ?? 100, (s.hp ?? 100) + 15 * 0.033);
            if (isMe && tick % 25 === 0) this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: '+HP', color: '#10B981' });
          }
        } else if (ob.type === 'flowerbed') {
          s.speedBoostTimer = Math.max(s.speedBoostTimer || 0, 0.5);
          if ((s.hp ?? 100) < (s.maxHp ?? 100)) s.hp = Math.min(s.maxHp ?? 100, (s.hp ?? 100) + 5 * 0.033);
        } else if (ob.type === 'bush' && (s.hp ?? 100) < (s.maxHp ?? 100)) {
          s.hp = Math.min(s.maxHp ?? 100, (s.hp ?? 100) + 3.5 * 0.033);
        } else if ((ob.type === 'tree' || ob.type === 'cave' || ob.type === 'log') && tick >= ((ob as any).interactCooldownUntil ?? 0)) {
          (ob as any).interactCooldownUntil = tick + (ob.type === 'cave' ? 300 : 240);
          const ang = Math.atan2(dy || 1, dx || 1);
          const dropDist = ob.radius + 36;
          const dropType = ob.type === 'cave' ? 'crystal' : (ob.type === 'log' ? 'super_star' : 'cherry');
          this.localState.food.push({
            id: `prop_${tick}_${Math.random().toString(36).slice(2, 6)}`,
            x: this.wrapLocal(ob.x + Math.cos(ang) * dropDist),
            y: this.wrapLocal(ob.y + Math.sin(ang) * dropDist),
            value: ob.type === 'cave' ? 40 : (ob.type === 'log' ? 35 : 15),
            type: dropType,
            icon: ob.type === 'cave' ? '🔷' : '🍒',
            color: ob.type === 'cave' ? '#38bdf8' : '#e63950',
          });
          if (isMe) {
            this.onWorldFeedback?.({
              x: ob.x, y: ob.y,
              text: ob.type === 'cave' ? 'CRYSTAL!' : (ob.type === 'log' ? 'BONUS STAR!' : 'FRUIT DROP!'),
              color: '#D97706',
            });
          }
        }

        if (distSq >= minDist * minDist) continue;
        if (ob.blocking && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist, ny = dy / dist;
          const push = minDist - dist;
          s.head.x = this.wrapLocal(s.head.x + nx * push);
          s.head.y = this.wrapLocal(s.head.y + ny * push);
          const dot = Math.cos(s.angle) * nx + Math.sin(s.angle) * ny;
          if (dot < -0.25) {
            const cross = Math.cos(s.angle) * ny - Math.sin(s.angle) * nx;
            s.angle += (cross >= 0 ? -0.18 : 0.18);
          }
        }
        if (ob.damage) {
          if (shielded) {
            if (ob.type === 'explosion') {
              s.score += 15;
              if (isMe) this.onWorldFeedback?.({ x: ob.x, y: ob.y, text: 'DEFUSED +15', color: '#059669', boomRadius: ob.radius * 2 });
              ob.x = 240 + Math.random() * (WORLD - 480);
              ob.y = 240 + Math.random() * (WORLD - 480);
            } else if (isMe && tick % 24 === 0) {
              this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: 'BLOCKED!', color: '#0284C7' });
            }
            continue;
          }
          if ((ob as any).isPoison || ob.type === 'poison') {
            if (((s as any).hazardCd ?? 0) <= 0) {
              s.hp = Math.max(0, (s.hp ?? 100) - ob.damage);
              s.poisonTimer = 3.5;
              (s as any).hazardCd = 0.8;
              if (isMe) this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: `-${ob.damage} POISON!`, color: '#65A30D', shake: 3 });
            }
          } else if (((s as any).hazardCd ?? 0) <= 0) {
            s.hp = Math.max(0, (s.hp ?? 100) - ob.damage);
            (s as any).hazardCd = 0.8;
            if (ob.type === 'explosion') {
              if (isMe) this.onWorldFeedback?.({ x: ob.x, y: ob.y, text: `-${ob.damage} BOOM!`, color: '#E11D48', shake: 8, boomRadius: ob.radius * 3 });
              ob.x = 240 + Math.random() * (WORLD - 480);
              ob.y = 240 + Math.random() * (WORLD - 480);
            } else if (isMe) {
              this.onWorldFeedback?.({ x: s.head.x, y: s.head.y, text: `-${ob.damage}`, color: ob.type === 'lava' ? '#EA580C' : '#E11D48', shake: 5 });
            }
          }
          if ((s.hp ?? 100) <= 0) { this.eliminateLocal(s, null); break; }
        }
      }
    }
  }

  // §7 Entering wh_i exits from its LINKED wormhole (escape route) + short cooldown.
  private resolveLocalWormholeTeleport() {
    const holes = this.localState?.portals;
    if (!holes || holes.length < 2) return;
    for (const s of this.localState!.snakes) {
      if (!s.isAlive) continue;
      if ((s as any).teleportCd > 0) { (s as any).teleportCd -= 0.033; continue; }
      for (const wh of holes) {
        const dx = this.wrapDeltaLocal(s.head.x - wh.x);
        const dy = this.wrapDeltaLocal(s.head.y - wh.y);
        if (dx * dx + dy * dy < 44 * 44) {
          const target = holes.find(p => p.id === wh.targetId) || holes.find(p => p.id !== wh.id);
          if (!target) break;
          const ang = Math.random() * Math.PI * 2;
          const nx = this.wrapLocal(target.x + Math.cos(ang) * 80);
          const ny = this.wrapLocal(target.y + Math.sin(ang) * 80);
          const offX = nx - s.head.x, offY = ny - s.head.y;
          s.head.x = nx; s.head.y = ny;
          s.body.forEach(seg => { seg.x = this.wrapLocal(seg.x + offX); seg.y = this.wrapLocal(seg.y + offY); });
          (s as any).teleportCd = 3.0;
          break;
        }
      }
    }
  }

  // Local-engine elimination: mark the loser dead, reward the winner, scatter a little food.
  // §2 Classic Snake self-collision — head touching its own body (past a small gap) = death.
  private selfCollide(s: SnakeData): boolean {
    for (let i = 6; i < s.body.length; i++) {
      const dx = s.head.x - s.body[i].x, dy = s.head.y - s.body[i].y;
      if (dx * dx + dy * dy < (s.radius * 0.8) * (s.radius * 0.8)) return true;
    }
    return false;
  }

  // §2 Battle Royale & Team Battle — timer, shrinking storm that eliminates snakes left outside, victory on timer / last standing / team wipe.
  private updateLocalMatch(_dt: number) {
    const state = this.localState;
    if (!state) return;
    const isCompetitive = this.localBR || this.localTeam || state.mode === 'boss';
    if (!isCompetitive || this.localMatchOver) return;

    // Real elapsed time, not the nominal 33 ms: a throttled/backgrounded tab would otherwise
    // let the HUD countdown drift away from the storm the player is actually standing in.
    const now = Date.now();
    const dt = this.localMatchLastTs ? Math.min(0.5, (now - this.localMatchLastTs) / 1000) : 0;
    this.localMatchLastTs = now;

    // §12 The round is frozen while the app is backgrounded — the player can't steer, so the
    // clock must not run and the storm must not close in or bite.
    if (this.localPaused) return;

    this.localMatchTimer = Math.max(0, this.localMatchTimer - dt);
    state.matchTimer = Math.ceil(this.localMatchTimer);

    // Same curve as the server: hold full size through the grace period, then close smoothly
    // and reach the final radius at ZONE_CLOSE_AT_PCT of the round.
    const sz = state.safeZone;
    const totalDur = state.mode === 'boss' ? 150 : MATCH_SECONDS;
    const elapsed = Math.max(0, totalDur - this.localMatchTimer);
    const shrinkWindow = Math.max(1, totalDur * ZONE_CLOSE_AT_PCT - ZONE_GRACE);
    const progress = Math.min(1, Math.max(0, (elapsed - ZONE_GRACE) / shrinkWindow));
    sz.radius = ZONE_FINAL_R + (ZONE_START_R - ZONE_FINAL_R) * (1 - progress);
    sz.targetRadius = ZONE_FINAL_R;

    const sanctuary = state.sanctuaryZone;
    for (const s of state.snakes) {
      if (!s.isAlive || (s.shieldTimer ?? 0) > 0) continue;
      // Inside the 🛡️ Safe Sanctuary the storm can't reach you (matches the server).
      if (sanctuary) {
        const sdx = this.wrapDeltaLocal(s.head.x - sanctuary.centerX);
        const sdy = this.wrapDeltaLocal(s.head.y - sanctuary.centerY);
        if (sdx * sdx + sdy * sdy < sanctuary.radius * sanctuary.radius) { (s as any).stormT = 0; continue; }
      }
      const dx = this.wrapDeltaLocal(s.head.x - sz.centerX), dy = this.wrapDeltaLocal(s.head.y - sz.centerY);
      if (dx * dx + dy * dy > sz.radius * sz.radius) {
        (s as any).stormT = ((s as any).stormT ?? 0) + dt;
        if ((s as any).stormT > 2) {
          s.hp = Math.max(0, (s.hp ?? 100) - sz.damagePerSecond * dt);
          if (s.hp <= 0) this.eliminateLocal(s, null);
        }
      } else {
        (s as any).stormT = 0;
      }
    }

    if (this.localBR) {
      const alive = state.snakes.filter(s => s.isAlive);
      if (this.localMatchTimer <= 0 || alive.length <= 1) {
        this.localMatchOver = true;
        state.matchOver = true;
      }
    } else if (this.localTeam) {
      const blueAlive = state.snakes.filter(s => s.isAlive && s.team === 'blue').length;
      const redAlive = state.snakes.filter(s => s.isAlive && s.team === 'red').length;
      if (this.localMatchTimer <= 0 || blueAlive === 0 || redAlive === 0) {
        this.localMatchOver = true;
        state.matchOver = true;
      }
    } else if (state.mode === 'boss') {
      const bossAlive = state.snakes.some(s => s.isBoss && s.isAlive);
      if (this.localMatchTimer <= 0 || !bossAlive) {
        this.localMatchOver = true;
        state.matchOver = true;
      }
    }
  }

  private eliminateLocal(loser: SnakeData, winner: SnakeData | null) {
    if (!loser.isAlive) return;
    loser.isAlive = false;
    if (winner) {
      winner.kills++;
      winner.score += 200 + Math.floor(loser.score * 0.25);
      if (this.localTeam && winner.team && this.localState?.teamScores) this.localState.teamScores[winner.team]++;
      if (loser.isBoss && this.localState && this.localState.mode === 'boss') {
        this.localMatchOver = true;
        this.localState.matchOver = true;
        this.onBossDefeat?.({ bossId: loser.id, kingdom: this.localKingdom, local: true });
      }
    }
    if (!this.localState) return;
    const food = this.localState.food;
    for (let k = 0; k < loser.body.length; k += 4) {
      const seg = loser.body[k];
      food.push({
        id: `drop_${Date.now()}_${k}_${Math.random().toString(36).slice(2, 5)}`,
        x: seg.x + (Math.random() - 0.5) * 20,
        y: seg.y + (Math.random() - 0.5) * 20,
        value: 15, type: 'apple', color: '#ff3333', icon: '🍎',
      });
    }
    this.trimLocalFood();
  }

  // Keep the collectible count bounded by retiring the oldest corpse drops first, so the base
  // food/star population (and anything a player is chasing) is never the thing that vanishes.
  private trimLocalFood() {
    const food = this.localState?.food;
    if (!food || food.length <= MAX_LOCAL_FOOD) return;
    let excess = food.length - MAX_LOCAL_FOOD;
    for (let i = 0; i < food.length && excess > 0; ) {
      if (food[i].id.startsWith('drop_')) { food.splice(i, 1); excess--; } else i++;
    }
  }
}
