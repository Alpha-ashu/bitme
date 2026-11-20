import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import { AuthService } from './services/AuthService';
import { EconomyService } from './services/EconomyService';
import { MissionService } from './services/MissionService';
import { AdminService } from './services/AdminService';
import { RewardsService } from './services/RewardsService';
import { CouponService } from './services/CouponService';
import { SocialService } from './services/SocialService';
import { StatsService } from './services/StatsService';
import { MilestoneService } from './services/MilestoneService';
import { ExplorerService } from './services/ExplorerService';
import { AnalyticsService, ReportPeriod } from './services/AnalyticsService';
import { AdManagerService } from './services/AdManagerService';
import { AdventureProgressionService } from './services/AdventureProgressionService';
import { QuestEngineService } from './services/QuestEngineService';
import { QuestionBankService } from './services/QuestionBankService';
import { BossProgressionService } from './services/BossProgressionService';
import { RewardBoxService } from './services/RewardBoxService';
import { HeartService } from './services/HeartService';
import { presence } from './services/Presence';
import { sessionManager } from './services/GameSessionManager';
import { getModeConfig, GameSessionService } from './services/GameSessionService';
import { ProgressionService } from './services/ProgressionService';
import { gameConfig, clientConfig, eventIsLive, activeSeasonId } from './config/GameConfig';
import { antiCheat } from './services/AntiCheatService';
import { GameMode, Evolution, UserStatus, AdPlacement } from './types';
import { db } from './db/Database';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
const corsOrigin: any = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '512kb' }));

// Serve validated uploaded ad creatives statically
app.use('/uploads/ads', express.static(AdManagerService.getUploadDir(), {
  maxAge: '7d',
  fallthrough: true,
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] } });

const clientIp = (req: express.Request): string =>
  (req.headers['x-forwarded-for']?.toString().split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

function rateLimit(bucket: string, windowMs: number, max: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, windowMs).unref?.();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = bucket + ':' + clientIp(req);
    const now = Date.now();
    let e = hits.get(key);
    if (!e || e.reset < now) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count++;
    if (e.count > max) {
      const retry = Math.ceil((e.reset - now) / 1000);
      res.setHeader('Retry-After', String(retry));
      return res.status(429).json({ error: `Too many requests — retry in ${retry}s` });
    }
    next();
  };
}

const authLimiter = rateLimit('auth', 60_000, 30);
const writeLimiter = rateLimit('write', 60_000, 120);

interface SocketUser {
  userId: string;
  username: string;
  mode: GameMode;
  roomId: string;
  skin: string;
  evolution: string;
  region?: string;
  lastSeq: number;
  worldVersion: number;
  viewRadius: number;
  joinedAt: number;
}
const connectedSockets: Map<string, SocketUser> = new Map();

const VALID_MODES: GameMode[] = ['classic', 'battle_royale', 'team', 'event', 'boss'];
const asMode = (m: any): GameMode => (VALID_MODES.includes(m) ? m : 'classic');

const RESPAWN_COST = gameConfig.economy.respawn;

const auth = (req: express.Request, res: express.Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  const a = AuthService.verifyToken(token);
  if (!a) { res.status(401).json({ error: 'Invalid or expired token' }); return null; }
  return a;
};

// Strict RBAC guard: accepts ONLY verified sessions belonging to active admin/super_admin roles.
const adminAuth = (req: express.Request, res: express.Response) => {
  const a = auth(req, res); if (!a) return null;
  if (a.role !== 'admin' && a.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden — administrator role required' });
    return null;
  }
  return a;
};

const superAdminAuth = (req: express.Request, res: express.Response) => {
  const a = auth(req, res); if (!a) return null;
  if (a.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden — super_admin role required' });
    return null;
  }
  return a;
};

const withRank = (profile: any) => profile ? {
  ...profile,
  rank: ProgressionService.getRank(profile.level, profile.prestige),
  xpToNext: ProgressionService.xpToNext(profile.level),
  nextEvolution: ProgressionService.nextEvolution(profile.level, profile.evolutionXp, profile.prestige),
  derivedStats: profile.stats ? StatsService.derive(profile.stats) : undefined,
} : profile;

// Notify live player socket immediately on authoritative Kingdom Boss defeat
sessionManager.setBossDefeatHandler((winnerUserId, bossId) => {
  const res = ExplorerService.recordBossDefeat(winnerUserId, bossId);
  for (const [sid, u] of connectedSockets) {
    if (u.userId === winnerUserId) {
      io.to(sid).emit('boss_defeated', {
        ...res,
        profile: res.profile ? withRank(res.profile) : undefined,
      });
    }
  }
});

// --------------------------------------------------------------- Player Auth
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Missing required registration fields' });
  if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const result = await AuthService.register(String(username), String(email), password, {
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  if ('error' in result) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
  const result = await AuthService.login(String(username), String(password), {
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  if ('error' in result) return res.status(401).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.post('/api/auth/guest', authLimiter, (req, res) => {
  const result = AuthService.createGuestAccount({ ip: clientIp(req), userAgent: req.headers['user-agent'] });
  res.json({ ...result, profile: withRank(result.profile) });
});

app.get('/api/auth/username-check', authLimiter, (req, res) => res.json(AuthService.checkUsername(String(req.query.name || ''))));

app.post('/api/auth/onboard', authLimiter, (req, res) => {
  const { name, country, language } = req.body || {};
  const result = AuthService.onboardGuest(name, country, language, {
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  if ('error' in result) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.post('/api/auth/upgrade', writeLimiter, async (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return res.status(400).json({ error: 'Username, email, and password are required' });
  const result = await AuthService.upgradeGuest(a.userId, String(username), String(email), String(password), {
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  if ('error' in result) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.post('/api/auth/logout', (req, res) => {
  const a = auth(req, res); if (!a) return;
  AuthService.logout(a.sessionId, a.userId);
  res.json({ success: true });
});

// --------------------------------------------------------------- Admin Auth (Isolated)
app.post('/api/admin/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
  const result = await AuthService.loginAdmin(String(username), String(password), {
    ip: clientIp(req),
    userAgent: req.headers['user-agent'],
  });
  if ('error' in result) return res.status(401).json(result);
  res.json(result);
});

app.post('/api/admin/auth/logout', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  AuthService.logout(a.sessionId);
  res.json({ success: true });
});

app.get('/api/admin/auth/me', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const u = db.getUserById(a.userId);
  res.json({ admin: { id: a.userId, username: a.username, email: u?.email || '', role: a.role } });
});

// --------------------------------------------------------------- Player Profile & Progression
app.get('/api/player/profile', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const rawProfile = db.getProfile(a.userId);
  const isAdmin = a.role === 'admin' || a.role === 'super_admin';
  res.json({
    user: { id: a.userId, username: a.username, isGuest: a.isGuest, role: a.role, isAdmin },
    profile: withRank(rawProfile),
    heartState: HeartService.getHeartState(a.userId),
  });
});

app.post('/api/player/evolution', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = db.equipEvolution(a.userId, req.body?.evolution as Evolution);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.post('/api/player/prestige', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = db.prestige(a.userId);
  res.json({ ...result, profile: withRank(result.profile) });
});

app.get('/api/player/coupons', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ coupons: db.getProfile(a.userId)?.coupons || [] });
});

const NAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
app.post('/api/player/edit-profile', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const { displayName, avatar, title, country, region } = req.body || {};
  const updates: any = {};
  if (avatar !== undefined) updates.avatar = String(avatar).slice(0, 12);
  if (title !== undefined) updates.title = String(title).slice(0, 40);
  if (country !== undefined) updates.country = String(country).slice(0, 40);
  if (region !== undefined) updates.preferredRegion = String(region).slice(0, 40);

  if (displayName !== undefined && displayName !== profile.displayName) {
    const v = AuthService.validateUsername(String(displayName));
    if (!v.ok) return res.status(400).json({ error: v.reason });
    const last = profile.lastNameChange || 0;
    const remaining = NAME_COOLDOWN_MS - (Date.now() - last);
    if (last && remaining > 0) return res.status(400).json({ error: `You can change your display name again in ${Math.ceil(remaining / 86400000)} day(s)` });
    updates.displayName = String(displayName).trim();
    updates.lastNameChange = Date.now();
  }

  const updated = db.updateProfile(a.userId, updates);
  res.json({ success: true, profile: withRank(updated) });
});

app.post('/api/player/equip', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { skin } = req.body || {};
  if (!skin || typeof skin !== 'string') return res.status(400).json({ error: 'skin is required' });
  const result = EconomyService.equipSkin(a.userId, skin);
  res.status(result.success ? 200 : 403).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

app.post('/api/player/equip-accessory', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = EconomyService.equipAccessory(a.userId, String(req.body?.accessoryId || ''));
  res.status(result.success ? 200 : 403).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

// --------------------------------------------------------------- Config, Modes, Events, Lobbies
app.get('/api/modes', (_req, res) => res.json({ modes: VALID_MODES.map(getModeConfig) }));
app.get('/api/config', (_req, res) => res.json(clientConfig()));

app.get('/api/world/events', (_req, res) => {
  const events = sessionManager.getActiveSessions().map(s => s.getState().currentEvent).filter(Boolean);
  res.json({ events });
});

app.get('/api/events', (_req, res) => {
  const now = new Date();
  const live = sessionManager.getActiveSessions()
    .map(s => ({ session: s.getState().mode, event: s.getState().currentEvent }))
    .filter(e => !!e.event)
    .map(e => ({
      id: e.event!.id, icon: e.event!.icon, name: e.event!.title,
      description: e.event!.description, mode: e.session,
      timerSeconds: e.event!.timerSeconds, live: true,
    }));

  const scheduled = gameConfig.events.map(e => ({
    id: e.id, icon: e.icon, name: e.name, description: e.description,
    rewardHint: e.rewardHint, live: eventIsLive(e, now),
    months: e.months, startsAt: e.startsAt, endsAt: e.endsAt,
  }));

  res.json({ live, scheduled, season: activeSeasonId(now), serverTime: now.toISOString() });
});

app.get('/api/lobbies', (req, res) => {
  const mode = req.query.mode ? asMode(req.query.mode) : undefined;
  res.json({ rooms: sessionManager.listRooms(mode) });
});

app.post('/api/lobbies/create', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const mode = asMode(req.body?.mode || 'battle_royale');
  const maxPlayers = Math.min(24, Math.max(2, Number(req.body?.maxPlayers) || 24));
  const room = sessionManager.createCustomRoom({
    mode,
    hostUserId: a.userId,
    hostName: a.username,
    maxPlayers,
    region: String(req.body?.region || 'Global'),
    isPrivate: Boolean(req.body?.isPrivate),
    kingdom: Number(req.body?.kingdom) || 1,
    withBots: Boolean(req.body?.withBots),
    mapTheme: req.body?.mapTheme ? String(req.body.mapTheme) : undefined,
    durationSeconds: req.body?.durationSeconds ? Number(req.body.durationSeconds) : undefined,
    stageInLobby: Boolean(req.body?.stageInLobby),
  });
  res.json({ success: true, room });
});

app.post('/api/lobbies/join-code', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const code = String(req.body?.code || '').trim().toUpperCase();
  const room = sessionManager.getRoomByCode(code);
  if (!room) return res.status(404).json({ error: 'Room code not found' });
  const joined = sessionManager.authorizeAndJoinLobby(room.roomId, a.userId, a.username, code);
  if (!joined.ok) return res.status(403).json({ error: joined.error });
  res.json({ success: true, room: joined.room });
});

app.get('/api/lobbies/:roomId', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const room = sessionManager.getRoomInfoById(String(req.params.roomId || ''));
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const check = sessionManager.authorizeSocketJoin(room.roomId, a.userId, String(req.query.code || ''));
  if (!check.ok) return res.status(403).json({ error: check.error });
  res.json({ room });
});

app.post('/api/lobbies/:roomId/join', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = sessionManager.authorizeAndJoinLobby(String(req.params.roomId || ''), a.userId, a.username, req.body?.code);
  res.status(r.ok ? 200 : 403).json(r);
});

app.post('/api/lobbies/:roomId/ready', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = sessionManager.setMemberReady(String(req.params.roomId || ''), a.userId, Boolean(req.body?.ready));
  res.status(r.ok ? 200 : 400).json(r);
});

app.patch('/api/lobbies/:roomId/settings', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = sessionManager.updateRoomSettings(String(req.params.roomId || ''), a.userId, req.body || {});
  res.status(r.ok ? 200 : 403).json(r);
});

app.post('/api/lobbies/:roomId/invite', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const targetUserId = String(req.body?.targetUserId || '');
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
  const r = sessionManager.inviteUserToRoom(String(req.params.roomId || ''), a.userId, targetUserId);
  if (!r.ok || !r.room) return res.status(403).json(r);
  SocialService.invite(a.userId, targetUserId, r.room.mode, r.room.roomId);
  deliverInvites(targetUserId);
  res.json({ ok: true, room: r.room });
});

app.post('/api/lobbies/:roomId/start', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = sessionManager.startCustomMatch(String(req.params.roomId || ''), a.userId);
  if (!r.ok || !r.room) return res.status(403).json(r);
  io.to(r.room.roomId).emit('room_match_started', { room: r.room });
  res.json({ ok: true, room: r.room });
});

// --------------------------------------------------------------- Shop & Inventory & Rewards
app.get('/api/shop/catalog', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const a = token ? AuthService.verifyToken(token) : null;
  res.json({
    ...EconomyService.getCatalog(a?.userId),
    ...EconomyService.getAccessoryCatalog(a?.userId),
  });
});

app.post('/api/shop/purchase', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const skinId = req.body?.skinId ?? req.body?.itemId;
  if (!skinId || typeof skinId !== 'string') return res.status(400).json({ error: 'skinId is required' });
  const result = EconomyService.purchaseSkin(a.userId, skinId);
  res.status(result.success ? 200 : 400).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

app.post('/api/shop/purchase-accessory', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const accessoryId = req.body?.accessoryId;
  if (!accessoryId || typeof accessoryId !== 'string') return res.status(400).json({ error: 'accessoryId is required' });
  const result = EconomyService.purchaseAccessory(a.userId, accessoryId);
  res.status(result.success ? 200 : 400).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

app.post('/api/inventory/open', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const itemId = String(req.body?.itemId || '');
  const result = EconomyService.openInventoryItem(a.userId, itemId);
  res.status(result.success ? 200 : 400).json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

app.get('/api/rewards/catalog', (req, res) => {
  const region = (req.query.region as string) || 'Global';
  res.json(RewardsService.getCatalog(region));
});

app.post('/api/rewards/redeem', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const { itemId, region } = req.body || {};
  if (!itemId || typeof itemId !== 'string') return res.status(400).json({ error: 'itemId is required' });
  const result = RewardsService.redeem(a.userId, itemId, region || 'Global');
  res.json({ ...result, profile: result.profile ? withRank(result.profile) : undefined });
});

// --------------------------------------------------------------- Missions, Milestones, Progress
app.get('/api/missions', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ missions: MissionService.getUserMissions(a.userId) });
});

app.post('/api/missions/claim', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const result = MissionService.claimReward(a.userId, req.body?.missionId);
  if (result.success) {
    const profile = db.getProfile(a.userId);
    const grantedCoupons = CouponService.autoGrantEligible(a.userId, profile?.preferredRegion || 'Global');
    return res.json({ ...result, grantedCoupons, profile: grantedCoupons.length ? withRank(db.getProfile(a.userId)) : withRank(result.profile) });
  }
  res.json(result);
});

app.post('/api/missions/claim-all', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  let stars = 0, xp = 0, evoXp = 0; const claimed: string[] = [];
  for (const m of db.getMissions(a.userId)) {
    if (m.isCompleted && !m.isClaimed) {
      const r = db.claimMissionReward(a.userId, m.id);
      if (r.success) { stars += r.stars; xp += r.xp; evoXp += r.evoXp; claimed.push(m.id); }
    }
  }
  const profile = db.getProfile(a.userId);
  res.json({ success: true, claimed, stars, xp, evoXp, missions: db.getMissions(a.userId), profile: withRank(profile) });
});

app.post('/api/missions/daily-bonus', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  const daily = db.getMissions(a.userId).filter(m => m.category === 'daily');
  const allDone = daily.length > 0 && daily.every(m => m.isCompleted);
  const today = new Date().toISOString().slice(0, 10);
  if (!allDone) return res.json({ success: false, allDone: false, message: 'Finish all daily missions first' });
  if (profile.lastDailyBonus === today) return res.json({ success: false, alreadyClaimed: true, message: 'Daily bonus already claimed today' });
  const b = gameConfig.economy.dailyBonus;
  db.grantRewards(a.userId, { stars: b.stars, xp: b.xp, evoXp: b.evoXp });
  db.grantItem(a.userId, b.item, 1);
  const updated = db.updateProfile(a.userId, { lastDailyBonus: today });
  res.json({ success: true, rewards: { stars: b.stars, xp: b.xp, evoXp: b.evoXp, item: b.itemName, itemIcon: b.itemIcon }, profile: withRank(updated) });
});

app.get('/api/milestones', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json(MilestoneService.overview(a.userId, String(req.query.mode || 'explorer')));
});

app.post('/api/match/checkpoint', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const id = String(req.body?.milestoneId || '');
  if (!id) return res.status(400).json({ success: false, message: 'milestoneId is required' });
  const r = MilestoneService.claim(a.userId, id);
  res.status(r.success || r.alreadyClaimed ? 200 : 400).json({ ...r, profile: r.profile ? withRank(r.profile) : undefined });
});

app.post('/api/match/checkpoint-all', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const claimed = MilestoneService.claimAllReached(a.userId, String(req.body?.mode || 'explorer'));
  res.json({
    success: true,
    claimed: claimed.map(c => ({ id: c.milestone!.id, title: c.milestone!.title, icon: c.milestone!.icon, rewards: c.rewards })),
    profile: withRank(db.getProfile(a.userId)),
  });
});

const PROGRESS_SYNC_CAPS: Record<string, number> = {
  cherry: 2000, apple: 2000, frog: 1000, star: 1000, egg: 200, mushroom: 500,
  shield: 500, speed: 500, powerup: 1000, magnet: 500, fire: 500, gift: 200,
  treasure: 200, kill: 200, assist: 200, boost: 2000, heal: 1000,
};
app.post('/api/progress/sync', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const progress = req.body?.progress;
  if (!progress || typeof progress !== 'object') return res.status(400).json({ error: 'progress object is required' });

  const applied: Record<string, number> = {};
  for (const [metric, raw] of Object.entries(progress)) {
    const cap = PROGRESS_SYNC_CAPS[metric];
    if (!cap) continue;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n <= 0) continue;
    const amount = Math.min(n, cap);
    db.incrementCollectible(a.userId, metric as any, amount);
    applied[metric] = amount;
  }

  res.json({
    success: true, applied,
    missions: db.getMissions(a.userId),
    achievements: db.getAchievements(a.userId),
    profile: withRank(db.getProfile(a.userId)),
  });
});

// --------------------------------------------------------------- Story / Explorer Campaign
app.get('/api/explorer/state', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const ov = ExplorerService.overview(a.userId);
  if (!ov) return res.status(404).json({ error: 'Profile not found' });
  res.json(ov);
});

app.post('/api/explorer/kingdom/select', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = ExplorerService.selectKingdom(a.userId, Number(req.body?.kingdom));
  res.status(r.success ? 200 : 400).json(r);
});

app.post('/api/explorer/quest/accept', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = ExplorerService.acceptQuest(a.userId, String(req.body?.questId || ''));
  res.status(r.success ? 200 : 400).json({ ...r, state: ExplorerService.overview(a.userId) });
});

app.post('/api/explorer/quest/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r: any = ExplorerService.claimQuest(a.userId, String(req.body?.questId || ''));
  res.status(r.success || r.alreadyClaimed ? 200 : 400).json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
    state: ExplorerService.overview(a.userId),
  });
});

app.post('/api/explorer/boss/defeat', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r: any = ExplorerService.recordBossDefeat(a.userId, String(req.body?.bossId || ''));
  res.status(r.success ? 200 : 400).json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
  });
});

// --------------------------------------------------------------- 1,000-Level Adventure Campaign, Quest Engine & Quiz API
app.get('/api/adventure/overview', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const world = req.query.world ? Number(req.query.world) : undefined;
  const page = req.query.page !== undefined ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 20;
  const overview = AdventureProgressionService.getOverview(a.userId, { world, page, pageSize });
  const activeQuest = QuestEngineService.getActiveMainQuest(a.userId);
  const clearedBosses = BossProgressionService.listClearedBosses(a.userId);
  const npcQuotas = QuestEngineService.getAllNpcQuotas(a.userId);
  const rewardBox = RewardBoxService.listBox(a.userId);
  res.json({ ...overview, activeQuest, clearedBosses, npcQuotas, rewardBox });
});

app.get('/api/adventure/npc-quotas', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ ok: true, quotas: QuestEngineService.getAllNpcQuotas(a.userId) });
});

// --------------------------------------------------------------- Reward Box & Power-Up Supply Store
app.get('/api/reward-box', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ ok: true, ...RewardBoxService.listBox(a.userId) });
});

app.post('/api/reward-box/collect', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const itemId = String(req.body?.itemId || '');
  if (!itemId) return res.status(400).json({ ok: false, error: 'itemId required' });
  const r = RewardBoxService.collectItem(a.userId, itemId);
  res.status(r.ok ? 200 : 400).json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
    rewardBox: RewardBoxService.listBox(a.userId),
  });
});

app.post('/api/reward-box/collect-all', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = RewardBoxService.collectAll(a.userId);
  res.json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
    rewardBox: RewardBoxService.listBox(a.userId),
  });
});

app.post('/api/shop/purchase-powerup', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const powerupId = String(req.body?.powerupId || '');
  const r = RewardBoxService.purchasePowerup(a.userId, powerupId);
  res.status(r.ok ? 200 : 400).json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
    rewardBox: RewardBoxService.listBox(a.userId),
  });
});

app.post('/api/player/use-powerup', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const powerupId = String(req.body?.powerupId || '') as 'pw_boost' | 'pw_shield' | 'pw_super';
  const liveSession = sessionManager.findPlayerSession(a.userId);
  const consumed = RewardBoxService.consumePowerup(a.userId, powerupId);
  if (!consumed.ok) return res.status(400).json(consumed);
  if (liveSession) liveSession.applyPurchasedPowerup(a.userId, powerupId);
  res.json({
    ...consumed,
    appliedInMatch: !!liveSession,
    profile: consumed.profile ? withRank(consumed.profile) : undefined,
  });
});

app.get('/api/player/hearts', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ ok: true, heartState: HeartService.getHeartState(a.userId) });
});

app.post('/api/player/hearts/collect', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const count = Math.max(1, Math.min(30, Math.floor(Number(req.body?.count) || 1)));
  const r = HeartService.collectHeartPickup(a.userId, count);
  res.json({ ok: true, heartState: r.state, rechargedCount: r.rechargedCount, shardsAdded: r.shardsAdded });
});

app.get('/api/adventure/level/:levelNumber', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const lvl = Math.max(1, Math.min(1000, Math.floor(Number(req.params.levelNumber) || 1)));
  const def = AdventureProgressionService.getLevelDef(lvl);
  const prog = AdventureProgressionService.getProgress(a.userId);
  res.json({
    level: def,
    unlocked: lvl <= prog.highestUnlockedLevel,
    completed: prog.completedLevels.includes(lvl),
    bossProgress: def.isBossCheckpoint ? BossProgressionService.getBossProgress(a.userId, lvl) : undefined,
  });
});

app.post('/api/adventure/npc/interact', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const npcId = String(req.body?.npcId || '');
  if (!npcId) return res.status(400).json({ ok: false, error: 'npcId required' });
  const liveSession = sessionManager.findPlayerSession(a.userId);
  if (liveSession) {
    const check = liveSession.validateManualNpcInteract(a.userId, npcId);
    if (!check.ok) return res.status(400).json(check);
    return res.json({ ok: true, encounter: check.encounter });
  }
  // Offline / menu fallback still validates NPC & quest eligibility on the server
  const encounter = QuestEngineService.recordOffer(a.userId, npcId);
  if (!encounter) return res.status(404).json({ ok: false, error: 'No available quest from this NPC' });
  res.json({ ok: true, encounter });
});

app.post('/api/adventure/quest/accept', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = QuestEngineService.acceptQuest(a.userId, {
    questId: req.body?.questId ? String(req.body.questId) : undefined,
    levelNumber: req.body?.levelNumber ? Number(req.body.levelNumber) : undefined,
    npcId: req.body?.npcId ? String(req.body.npcId) : undefined,
  });
  const liveSession = sessionManager.findPlayerSession(a.userId);
  let deployedTo: { ok: boolean; x?: number; y?: number; minEnemyDistance?: number } | undefined;
  if (liveSession && r.ok) {
    if (r.quizQuestion) {
      // Make player snake invisible & untargetable while answering the quiz!
      liveSession.setPlayerQuizMode(a.userId, true);
    } else {
      // Deploy player into a fresh, enemy-free quest area with 4.5s spawn shield so no snake immediately ambushes them!
      const stg = r.session?.currentStage;
      const hint = stg?.waypoints?.[0] || stg?.switches?.[0] || null;
      deployedTo = liveSession.deployPlayerToSafeQuestArea(a.userId, hint ? { x: hint.x, y: hint.y } : null);
    }
  }
  const status = r.ok ? 200 : (r.cooldownRemainingSec ? 429 : 400);
  res.status(status).json({
    ...r,
    deployedTo,
    heartState: HeartService.getHeartState(a.userId),
    overview: AdventureProgressionService.getOverview(a.userId),
    npcQuotas: QuestEngineService.getAllNpcQuotas(a.userId),
  });
});

app.post('/api/adventure/quest/later', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = QuestEngineService.deferQuest(a.userId, String(req.body?.npcId || ''), String(req.body?.questId || ''));
  sessionManager.findPlayerSession(a.userId)?.setPlayerInteraction(a.userId, false);
  res.json(r);
});

app.post('/api/adventure/quest/skip', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = QuestEngineService.skipQuest(
    a.userId,
    String(req.body?.npcId || ''),
    String(req.body?.questId || ''),
    Number(req.body?.levelNumber) || 0
  );
  sessionManager.findPlayerSession(a.userId)?.setPlayerInteraction(a.userId, false);
  res.json(r);
});

app.post('/api/adventure/quest/abandon', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = QuestEngineService.abandonActiveQuest(a.userId);
  const s = sessionManager.findPlayerSession(a.userId);
  if (s) { s.setPlayerInteraction(a.userId, false); s.setPlayerQuizMode(a.userId, false); }
  res.status(r.ok ? 200 : 400).json(r);
});

app.post('/api/adventure/quest/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = QuestEngineService.claimQuest(a.userId, req.body?.sessionId ? String(req.body.sessionId) : undefined);
  const s = sessionManager.findPlayerSession(a.userId);
  if (s) { s.setPlayerInteraction(a.userId, false); s.setPlayerQuizMode(a.userId, false); }
  res.status(r.ok || r.alreadyClaimed ? 200 : 400).json({
    ...r,
    profile: r.profile ? withRank(r.profile) : undefined,
    overview: AdventureProgressionService.getOverview(a.userId),
  });
});

app.get('/api/adventure/quiz/:quizSessionId', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const data = QuestionBankService.getSession(a.userId, String(req.params.quizSessionId || ''));
  if (!data) return res.status(404).json({ ok: false, error: 'Quiz session not found' });
  if (data.currentQuestion) {
    sessionManager.findPlayerSession(a.userId)?.setPlayerQuizMode(a.userId, true);
  }
  res.json({
    ok: true,
    session: { id: data.session.id, status: data.session.status, correctCount: data.session.correctCount, wrongCount: data.session.wrongCount, passThreshold: data.session.passThreshold },
    currentQuestion: data.currentQuestion,
    heartState: HeartService.getHeartState(a.userId),
  });
});

app.post('/api/adventure/quiz/answer', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const quizSessionId = String(req.body?.quizSessionId || '');
  const questionId = String(req.body?.questionId || '');
  const answer = String(req.body?.answer ?? '');
  const responseMs = Number(req.body?.responseMs) || 0;
  const result = QuestionBankService.submitAnswer(a.userId, quizSessionId, questionId, answer, responseMs);
  if (!result.ok) return res.status(400).json(result);

  // Wrong quiz answer deducts 1 Heart (15-min restore per heart, or 30 in-game hearts to recharge +1)
  let heartState = HeartService.getHeartState(a.userId);
  let heartDeducted = false;
  if (!result.isCorrect) {
    const hr = HeartService.deductHeart(a.userId, 1);
    heartState = hr.state;
    heartDeducted = hr.deducted > 0;
    const liveSession = sessionManager.findPlayerSession(a.userId);
    if (liveSession) {
      // Emit live heart_state update to player's socket
      io.sockets.sockets.forEach((s) => {
        const u = connectedSockets.get(s.id);
        if (u?.userId === a.userId) s.emit('heart_state', { heartState, deducted: hr.deducted, reason: 'quiz_wrong' });
      });
    }
  }

  let questUpdate: any = null;
  if (result.completed && result.questSessionId) {
    questUpdate = QuestEngineService.handleQuizOutcome(
      a.userId,
      result.questSessionId,
      !!result.passed,
      result.correctCount || 0
    );
  }
  res.json({ ...result, questUpdate, heartState, heartDeducted });
});

app.get('/api/achievements', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ achievements: db.getAchievements(a.userId) });
});

// --------------------------------------------------------------- Leaderboards
const LEADERBOARD_CATEGORIES = ['level', 'score', 'kills', 'wins', 'survival', 'stars', 'explorer'];
const publicBoard = (entries: Array<{ rank: number; userId: string; displayName: string; avatar: string; level: number; value: number }>, viewerId?: string) =>
  entries.map(({ userId, ...e }) => ({ ...e, isYou: !!viewerId && userId === viewerId }));

app.get('/api/leaderboard', (req, res) => {
  const category = req.query.category as string | undefined;
  if (!category) return res.json({ leaderboard: db.getLeaderboard().map(({ userId: _u, ...r }) => r) });

  const token = req.headers.authorization?.replace('Bearer ', '');
  const a = token ? AuthService.verifyToken(token) : null;
  const scope = (req.query.scope as string) || 'global';
  if (scope === 'friends') {
    if (!a) return res.status(401).json({ error: 'Unauthorized' });
    const ids = [a.userId, ...db.getSocial(a.userId).friends];
    return res.json({ category, scope, entries: publicBoard(db.getCategoryLeaderboard(category, 100, { userIds: ids }), a.userId) });
  }
  if (scope === 'local') {
    const region = String(req.query.region || 'Global');
    return res.json({ category, scope, region, entries: publicBoard(db.getCategoryLeaderboard(category, 100, { region }), a?.userId) });
  }
  res.json({ category, scope: 'global', entries: publicBoard(db.getCategoryLeaderboard(category, 100), a?.userId) });
});

app.get('/api/leaderboard/categories', (_req, res) => res.json({ categories: LEADERBOARD_CATEGORIES }));

// --------------------------------------------------------------- Player Advertisements & Rewarded Opt-In
app.get('/api/ads/serve', (req, res) => {
  const placement = String(req.query.placement || 'home_screen') as AdPlacement;
  if (!AdManagerService.isValidPlacement(placement)) {
    return res.status(400).json({ error: 'Invalid ad placement' });
  }
  const ads = AdManagerService.serveForPlacement(placement);
  res.json({ placement, ad: ads[0] || null, ads });
});

app.post('/api/ads/track', writeLimiter, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const a = token ? AuthService.verifyToken(token) : null;
  const { adId, placement, eventType } = req.body || {};
  if (!adId || (eventType !== 'impression' && eventType !== 'click')) {
    return res.status(400).json({ error: 'adId and valid eventType (impression|click) required' });
  }
  const ok = AdManagerService.trackEvent(String(adId), String(placement || 'home_screen'), eventType, a?.userId);
  if (!ok) return res.status(404).json({ error: 'Advertisement not found' });
  res.json({ success: true });
});

app.post('/api/ads/reward-start', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const adId = req.body?.adId ? String(req.body.adId) : undefined;
  const issued = AdManagerService.issueRewardToken(a.userId, adId);
  res.json({ success: true, ...issued });
});

// Server-side record of last match rewards so Watch Ad can legitimately DOUBLE (2×) run rewards once per match
const lastMatchRewards = new Map<string, { stars: number; xp: number; doubled: boolean; at: number }>();

app.post('/api/ads/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const profile = db.getProfile(a.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const adToken = String(req.body?.adToken || '');
  const verified = AdManagerService.consumeRewardToken(a.userId, adToken);
  if (!verified.ok) return res.status(400).json({ error: verified.error });

  const { stars: defaultBonusStars, tickets: bonusTickets, cooldownMs } = gameConfig.economy.ad;
  const doubleMatch = Boolean(req.body?.doubleMatch);
  const last = profile.lastAdClaim || 0;
  const remaining = cooldownMs - (Date.now() - last);
  if (!doubleMatch && remaining > 0) {
    return res.status(429).json({ error: `Please wait ${Math.ceil(remaining / 1000)}s before claiming another ad reward` });
  }

  let bonusStars = defaultBonusStars;
  let bonusXp = 0;
  const prevMatch = lastMatchRewards.get(a.userId);
  if (doubleMatch && prevMatch && !prevMatch.doubled) {
    prevMatch.doubled = true;
    bonusStars = Math.min(2500, Math.max(defaultBonusStars, prevMatch.stars));
    bonusXp = Math.min(2500, Math.max(0, prevMatch.xp));
  } else if (doubleMatch && prevMatch?.doubled) {
    return res.status(400).json({ error: 'Match reward was already doubled' });
  }

  if (bonusXp > 0) {
    db.grantRewards(a.userId, { stars: bonusStars, xp: bonusXp, evoXp: 0 });
    const afterXp = db.getProfile(a.userId)!;
    const updated = db.updateProfile(a.userId, { tickets: afterXp.tickets + bonusTickets, lastAdClaim: Date.now() });
    return res.json({
      success: true,
      doubled: true,
      message: `2× Reward Doubled! +${bonusStars} Stars, +${bonusXp} XP & +${bonusTickets} Tickets.`,
      bonusStars,
      bonusXp,
      bonusTickets,
      profile: withRank(updated),
    });
  }

  const updated = db.updateProfile(a.userId, { stars: profile.stars + bonusStars, tickets: profile.tickets + bonusTickets, lastAdClaim: Date.now() });
  res.json({
    success: true,
    doubled: doubleMatch,
    message: `2× Reward Claimed! +${bonusStars} Stars & +${bonusTickets} Tickets.`,
    bonusStars,
    bonusXp: 0,
    bonusTickets,
    profile: withRank(updated),
  });
});

// --------------------------------------------------------------- Analytics Client Beacon & Match Summary
app.post('/api/analytics/event', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const allowed = new Set(['session_start', 'session_end', 'mode_select']);
  const eventType = String(req.body?.eventType || '');
  if (!allowed.has(eventType)) return res.status(400).json({ error: 'Unsupported client event type' });
  const id = AnalyticsService.track({
    eventType: eventType as any,
    userId: a.userId,
    sessionId: a.sessionId,
    mode: req.body?.mode ? String(req.body.mode).slice(0, 32) : undefined,
    durationSeconds: Number.isFinite(Number(req.body?.durationSeconds)) ? Math.max(0, Math.min(86400, Number(req.body.durationSeconds))) : undefined,
    metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
  });
  res.json({ success: true, id });
});

app.post('/api/match/summary', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const paced = antiCheat.validateMatchSubmission(a.userId, Number(req.body?.survivalSeconds) || 0);
  if (!paced.ok) {
    if (paced.retryAfterMs) res.setHeader('Retry-After', String(Math.ceil(paced.retryAfterMs / 1000)));
    return res.status(429).json({ error: paced.reason || 'Match result rejected' });
  }
  const serverPeak = sessionManager.consumePlayerPeak(a.userId);
  const result = StatsService.recordMatch(a.userId, req.body || {}, serverPeak);
  if (!result) return res.status(404).json({ error: 'Profile not found' });
  const { authoritative, ...rest } = result;
  lastMatchRewards.set(a.userId, {
    stars: Math.max(0, Math.round(rest.earnedStars || 0)),
    xp: Math.max(0, Math.round(rest.earnedXP || 0)),
    doubled: false,
    at: Date.now(),
  });
  res.json({
    success: true,
    earnedStars: rest.earnedStars, earnedXP: rest.earnedXP, earnedEvoXP: rest.earnedEvoXP,
    levelsGained: rest.levelsGained, scoreEvolution: rest.scoreEvolution,
    score: authoritative.score, kills: authoritative.kills, placement: rest.match.rank,
    grantedCoupons: rest.grantedCoupons, match: rest.match,
    profile: withRank(rest.profile),
  });
});

app.get('/api/player/history', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 25));
  res.json({ history: db.getMatchHistory(a.userId, limit) });
});

app.post('/api/match/abandon', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const peak = sessionManager.consumePlayerPeak(a.userId);
  sessionManager.findPlayerSession(a.userId)?.removePlayer(a.userId);
  StatsService.recordMatch(a.userId, {
    mode: String(req.body?.mode || 'classic'),
    survivalSeconds: peak?.survivalSeconds ?? (Number(req.body?.survivalSeconds) || 0),
    score: peak?.score ?? (Number(req.body?.score) || 0),
    kills: peak?.kills ?? 0,
    deaths: 0,
    placement: 99,
    abandoned: true,
  }, peak);
  res.json({ success: true, message: 'Match abandoned cleanly' });
});

app.get('/api/screens/:screenId', (req, res) => {
  if (!auth(req, res)) return;
  const valid = ['menu', 'matchmaking', 'play', 'pause', 'gameover', 'respawn', 'ad-reward', 'spectate'];
  if (!valid.includes(req.params.screenId)) return res.status(404).json({ error: `Screen not found` });
  res.json({ screenId: req.params.screenId, status: 'active', config: { adInventoryReady: true, region: 'Global 30Hz' } });
});

// --------------------------------------------------------------- Admin Portal API (Strict RBAC)
app.get('/api/admin/telemetry', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({
    telemetry: AdminService.getTelemetry(
      sessionManager.getActiveModeCount(),
      connectedSockets.size,
      presence.onlineCount(),
      sessionManager.getAverageTickMs()
    ),
    auditLogs: AdminService.getAuditLogs(),
  });
});

app.get('/api/admin/audit-logs', (req, res) => {
  if (!adminAuth(req, res)) return;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  res.json({
    adminLogs: AdminService.getAdminAuditLogs(limit),
    antiCheatLogs: AdminService.getAuditLogs(),
  });
});

app.post('/api/admin/system/backup', (req, res) => {
  const a = superAdminAuth(req, res); if (!a) return;
  const result = db.backupDatabase();
  db.recordAdminAuditLog({
    adminId: a.userId,
    adminUsername: a.username,
    action: 'database_backup_created',
    details: { sizeBytes: result.sizeBytes },
    ip: clientIp(req),
  });
  res.json({ success: true, fileName: result.filePath.split(/[\\/]/).pop(), sizeBytes: result.sizeBytes });
});

app.get('/api/admin/users', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json(db.listUsers({
    search: req.query.search ? String(req.query.search) : undefined,
    role: req.query.role ? String(req.query.role) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    limit: Number(req.query.limit) || 50,
    offset: Number(req.query.offset) || 0,
  }));
});

app.post('/api/admin/users/:id/status', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const status = String(req.body?.status || '') as UserStatus;
  if (!['active', 'disabled', 'banned'].includes(status)) {
    return res.status(400).json({ error: 'status must be active, disabled, or banned' });
  }
  const r = AuthService.setUserStatus(a.userId, req.params.id, status, clientIp(req));
  if (!r.ok) return res.status(400).json(r);
  res.json(r);
});

app.get('/api/admin/admins', (req, res) => {
  if (!adminAuth(req, res)) return;
  const admins = db.listUsers({ role: 'admin', limit: 100 }).users;
  const supers = db.listUsers({ role: 'super_admin', limit: 100 }).users;
  res.json({ admins: [...supers, ...admins] });
});

app.post('/api/admin/admins', async (req, res) => {
  const a = superAdminAuth(req, res); if (!a) return;
  const { username, email, password, role } = req.body || {};
  const targetRole = role === 'super_admin' ? 'super_admin' : 'admin';
  const r = await AuthService.createAdminAccount(a.userId, String(username || ''), String(email || ''), String(password || ''), targetRole, clientIp(req));
  if ('error' in r) return res.status(400).json(r);
  res.json({ success: true, ...r });
});

// Admin Analytics & Reports
app.get('/api/admin/analytics/overview', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json(AnalyticsService.getOverview());
});

app.get('/api/admin/analytics/rpg', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json(AnalyticsService.getRpgAnalytics());
});

// Admin RPG Content Management (Question Bank & Campaign/Quest/Boss/Event Overrides)
app.get('/api/admin/content/questions', (req, res) => {
  if (!adminAuth(req, res)) return;
  const questions = QuestionBankService.listQuestions({
    category: req.query.category ? String(req.query.category) : undefined,
    difficulty: req.query.difficulty ? Number(req.query.difficulty) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 120,
  });
  res.json({ questions });
});

app.post('/api/admin/content/questions', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const r = QuestionBankService.upsertQuestion(req.body || {});
  if (!r.ok) return res.status(400).json(r);
  db.recordAdminAuditLog({
    adminId: a.userId,
    adminUsername: a.username,
    action: 'question_upserted',
    targetType: 'question_bank',
    targetId: r.question!.questionId,
    details: { category: r.question!.category, difficulty: r.question!.difficulty, status: r.question!.status },
    ip: clientIp(req),
  });
  res.json(r);
});

app.delete('/api/admin/content/questions/:id', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const ok = QuestionBankService.deleteQuestion(String(req.params.id || ''));
  if (!ok) return res.status(404).json({ error: 'Question not found' });
  db.recordAdminAuditLog({
    adminId: a.userId,
    adminUsername: a.username,
    action: 'question_deleted',
    targetType: 'question_bank',
    targetId: String(req.params.id),
    ip: clientIp(req),
  });
  res.json({ ok: true });
});

app.get('/api/admin/content/overrides', (req, res) => {
  if (!adminAuth(req, res)) return;
  const rows = db.getRawDb().prepare('SELECT * FROM content_overrides ORDER BY updated_at DESC LIMIT 200').all() as any[];
  res.json({
    overrides: rows.map(r => ({
      entityType: r.entity_type,
      entityId: r.entity_id,
      payload: JSON.parse(r.payload_json || '{}'),
      status: r.status,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    })),
  });
});

app.put('/api/admin/content/overrides', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const entityType = String(req.body?.entityType || '').trim();
  const entityId = String(req.body?.entityId || '').trim();
  const payload = req.body?.payload;
  const status = ['published', 'draft'].includes(String(req.body?.status)) ? String(req.body.status) : 'published';
  const validTypes = ['campaign_level', 'quest', 'npc', 'boss', 'world_event', 'team_objective'];
  if (!validTypes.includes(entityType) || !entityId || !payload || typeof payload !== 'object') {
    return res.status(400).json({ error: `Invalid override: entityType must be one of ${validTypes.join(', ')}` });
  }
  const now = new Date().toISOString();
  db.getRawDb().prepare(`
    INSERT OR REPLACE INTO content_overrides (entity_type, entity_id, payload_json, status, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, JSON.stringify(payload), status, a.username, now);

  db.recordAdminAuditLog({
    adminId: a.userId,
    adminUsername: a.username,
    action: 'content_override_saved',
    targetType: entityType,
    targetId: entityId,
    details: { status },
    ip: clientIp(req),
  });
  res.json({
    ok: true,
    override: { entityType, entityId, payload, status, updatedBy: a.username, updatedAt: now },
    preview: entityType === 'campaign_level' && /^lvl_\d+$/.test(entityId)
      ? AdventureProgressionService.getLevelDef(Number(entityId.slice(4)))
      : payload,
  });
});

app.delete('/api/admin/content/overrides/:type/:id', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  db.getRawDb().prepare('DELETE FROM content_overrides WHERE entity_type = ? AND entity_id = ?')
    .run(String(req.params.type), String(req.params.id));
  db.recordAdminAuditLog({
    adminId: a.userId,
    adminUsername: a.username,
    action: 'content_override_deleted',
    targetType: String(req.params.type),
    targetId: String(req.params.id),
    ip: clientIp(req),
  });
  res.json({ ok: true });
});

app.get('/api/admin/analytics/reports', (req, res) => {
  if (!adminAuth(req, res)) return;
  const periodRaw = String(req.query.period || 'weekly');
  const period: ReportPeriod = ['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(periodRaw)
    ? (periodRaw as ReportPeriod)
    : 'weekly';
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
  res.json(AnalyticsService.getReport(period, startDate, endDate));
});

app.get('/api/admin/analytics/reports/export', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const periodRaw = String(req.query.period || 'weekly');
  const period: ReportPeriod = ['daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(periodRaw)
    ? (periodRaw as ReportPeriod)
    : 'weekly';
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
  const report = AnalyticsService.getReport(period, startDate, endDate);
  const csv = AnalyticsService.toCsv(report);
  db.recordAdminAuditLog({
    adminId: a.userId,
    adminUsername: a.username,
    action: 'report_exported_csv',
    details: { period, startDate: report.startDate, endDate: report.endDate },
    ip: clientIp(req),
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="anaconda-report-${period}-${report.startDate}-to-${report.endDate}.csv"`);
  res.send(csv);
});

// Admin Advertisement CMS
app.get('/api/admin/ads', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ ads: AdManagerService.listAll() });
});

app.post('/api/admin/ads/upload', (req, res, next) => {
  if (!adminAuth(req, res)) return;
  upload.single('file')(req, res, (err: any) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'No file attached in "file" field' });
    const saved = AdManagerService.saveCreativeFile(req.file.buffer);
    if (!saved.ok) return res.status(400).json({ error: saved.error });
    res.json({ success: true, mediaUrl: saved.mediaUrl, mediaType: saved.mediaType });
  });
});

app.post('/api/admin/ads', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const r = AdManagerService.create({ id: a.userId, username: a.username }, req.body || {}, clientIp(req));
  if (!r.ok) return res.status(400).json({ error: r.error });
  res.json({ success: true, ad: r.ad });
});

app.patch('/api/admin/ads/:id', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const r = AdManagerService.update({ id: a.userId, username: a.username }, req.params.id, req.body || {}, clientIp(req));
  if (!r.ok) return res.status(r.error === 'Advertisement not found' ? 404 : 400).json({ error: r.error });
  res.json({ success: true, ad: r.ad });
});

app.post('/api/admin/ads/:id/enable', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const r = AdManagerService.update({ id: a.userId, username: a.username }, req.params.id, { enabled: true }, clientIp(req));
  if (!r.ok) return res.status(404).json({ error: r.error });
  res.json({ success: true, ad: r.ad });
});

app.post('/api/admin/ads/:id/disable', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const r = AdManagerService.update({ id: a.userId, username: a.username }, req.params.id, { enabled: false }, clientIp(req));
  if (!r.ok) return res.status(404).json({ error: r.error });
  res.json({ success: true, ad: r.ad });
});

app.delete('/api/admin/ads/:id', (req, res) => {
  const a = adminAuth(req, res); if (!a) return;
  const deleted = AdManagerService.remove({ id: a.userId, username: a.username }, req.params.id, clientIp(req));
  res.json({ success: deleted });
});

// Admin Coupon Management
app.get('/api/admin/coupons', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ coupons: CouponService.list() });
});
app.post('/api/admin/coupons', (req, res) => {
  if (!adminAuth(req, res)) return;
  if (!req.body?.title || !req.body?.storeName) return res.status(400).json({ error: 'title and storeName are required' });
  res.json({ success: true, coupon: CouponService.create(req.body) });
});
app.patch('/api/admin/coupons/:id', (req, res) => {
  if (!adminAuth(req, res)) return;
  const updated = CouponService.update(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true, coupon: updated });
});
app.post('/api/admin/coupons/:id/enable', (req, res) => {
  if (!adminAuth(req, res)) return;
  const updated = CouponService.setEnabled(req.params.id, true);
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true, coupon: updated });
});
app.post('/api/admin/coupons/:id/disable', (req, res) => {
  if (!adminAuth(req, res)) return;
  const updated = CouponService.setEnabled(req.params.id, false);
  if (!updated) return res.status(404).json({ error: 'Coupon not found' });
  res.json({ success: true, coupon: updated });
});
app.delete('/api/admin/coupons/:id', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ success: CouponService.remove(req.params.id) });
});
app.get('/api/admin/coupons/:id/redemptions', (req, res) => {
  if (!adminAuth(req, res)) return;
  res.json({ redemptions: CouponService.redemptions(req.params.id) });
});

app.get('/api/coupons/available', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ coupons: CouponService.availableFor(a.userId, (req.query.region as string) || 'Global') });
});
app.post('/api/coupons/claim', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  if (!req.body?.couponId || typeof req.body.couponId !== 'string') return res.status(400).json({ error: 'couponId is required' });
  const result = CouponService.claim(a.userId, req.body.couponId, req.body?.region || 'Global');
  if (!result.success) return res.status(400).json(result);
  res.json({ ...result, profile: withRank(result.profile) });
});

// --------------------------------------------------------------- Social & Presence
app.post('/api/presence/ping', (req, res) => {
  const a = auth(req, res); if (!a) return;
  presence.heartbeat(a.userId);
  db.touchUserActivity(a.userId);
  res.json({ ok: true });
});

app.get('/api/social/overview', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json(SocialService.overview(a.userId));
});
app.post('/api/social/request', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const query = req.body?.query ?? req.body?.friendCode ?? req.body?.username;
  const r = SocialService.sendRequest(a.userId, query);
  res.status(r.success ? 200 : 400).json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/respond', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const action = req.body?.action === 'accept' ? 'accept' : 'reject';
  const r = SocialService.respond(a.userId, String(req.body?.userId || ''), action);
  res.status(r.success ? 200 : 400).json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/unfriend', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.unfriend(a.userId, String(req.body?.userId || ''));
  res.json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/block', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.block(a.userId, String(req.body?.userId || ''));
  res.status(r.success ? 200 : 400).json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/unblock', (req, res) => {
  const a = auth(req, res); if (!a) return;
  const r = SocialService.unblock(a.userId, String(req.body?.userId || ''));
  res.json({ ...r, ...SocialService.overview(a.userId) });
});
app.post('/api/social/invite', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const otherId = String(req.body?.userId || '');
  const liveMode = connectedSockets.get([...connectedSockets].find(([, u]) => u.userId === a.userId)?.[0] || '')?.mode;
  const mode = String(req.body?.mode || liveMode || 'free_roam');
  const result = SocialService.invite(a.userId, otherId, mode);
  if (!result.success) return res.status(400).json({ success: false, message: result.message });
  if (result.online) deliverInvites(otherId);
  res.json({ success: true, message: result.message, online: result.online });
});
app.get('/api/social/invites', (req, res) => {
  const a = auth(req, res); if (!a) return;
  res.json({ invites: SocialService.pendingInvites(a.userId) });
});
app.post('/api/social/invites/respond', writeLimiter, (req, res) => {
  const a = auth(req, res); if (!a) return;
  const action = req.body?.action === 'accept' ? 'accept' : 'decline';
  const r = SocialService.respondToInvite(a.userId, String(req.body?.inviteId || ''), action);
  res.status(r.success ? 200 : 400).json({ ...r, invites: SocialService.pendingInvites(a.userId) });
});

// Health & Error Handling
const health = (_req: express.Request, res: express.Response) =>
  res.json({ status: 'ok', uptime: process.uptime(), modes: sessionManager.getActiveModeCount() });
app.get('/health', health);
app.get('/api/health', health);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api-error]', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

function deliverInvites(userId: string) {
  const invites = db.getMatchInvites(userId);
  if (!invites.length) return;
  const payload = { invites: SocialService.pendingInvites(userId) };
  let delivered = false;
  for (const [sid, u] of connectedSockets) {
    if (u.userId === userId) { io.to(sid).emit('match_invite', payload); delivered = true; }
  }
  if (delivered) db.markInvitesDelivered(userId);
}

function resolveUserSession(user: SocketUser): GameSessionService {
  return sessionManager.getRoomById(user.roomId) || sessionManager.getSession(user.mode);
}

// --------------------------------------------------------------- Realtime Socket.IO
io.on('connection', (socket) => {
  socket.on('authenticate', (data: {
    token: string;
    skin?: string;
    mode?: GameMode;
    region?: string;
    matchType?: string;
    roomId?: string;
    roomCode?: string;
    kingdom?: number;
    withBots?: boolean;
  }) => {
    const a = AuthService.verifyToken(data.token);
    if (!a) { socket.emit('auth_error', { message: 'Authentication failed' }); return; }

    const mode = asMode(data.mode);
    const profile = db.getProfile(a.userId);
    const skin = data.skin || profile?.equippedSkin || 'Forest';
    const evolution = profile?.equippedEvolution || 'Baby';
    const regionRaw = String(data.region || 'Global');
    const region = (data.matchType === 'local' ? '📍 ' : '') + regionRaw;
    const kingdom = Number(data.kingdom) || (profile?.explorer as any)?.kingdom || 1;

    // Resolve target room (explicit roomId, roomCode, or matchmaking)
    let session: GameSessionService | undefined;
    let roomId = '';
    if (data.roomId) {
      const authRoom = sessionManager.authorizeSocketJoin(String(data.roomId), a.userId, data.roomCode);
      if (!authRoom.ok) {
        socket.emit('auth_error', { message: authRoom.error || 'Unauthorized room access' });
        return;
      }
      session = sessionManager.getRoomById(String(data.roomId));
      if (session) roomId = session.getState().matchId;
    } else if (data.roomCode) {
      const found = sessionManager.getRoomByCode(String(data.roomCode));
      if (found) {
        sessionManager.authorizeAndJoinLobby(found.roomId, a.userId, a.username, data.roomCode);
        session = sessionManager.getRoomById(found.roomId);
        roomId = found.roomId;
      }
    }
    if (!session) {
      const room = sessionManager.findOrCreateMatchmakingRoom(mode, regionRaw, kingdom, data.withBots ?? (mode === 'battle_royale' || mode === 'team'));
      session = room.session;
      roomId = room.roomId;
    }

    const prev = connectedSockets.get(socket.id);
    if (prev && prev.roomId !== roomId) {
      socket.leave(prev.roomId);
      resolveUserSession(prev).removePlayer(a.userId);
    }

    connectedSockets.set(socket.id, {
      userId: a.userId,
      username: a.username,
      mode,
      roomId,
      skin,
      evolution,
      region,
      lastSeq: 0,
      worldVersion: 0,
      viewRadius: DEFAULT_VIEW_RADIUS,
      joinedAt: Date.now(),
    });
    presence.add(a.userId);
    socket.join(roomId);

    const emitToUser = (targetUid: string, event: string, dataPayload: any) => {
      for (const [sid, conn] of connectedSockets) {
        if (conn.userId === targetUid) io.to(sid).emit(event, dataPayload);
      }
    };

    session.setOnPickupCallback((userId, foodId, foodType, updatedMissions) => {
      emitToUser(userId, 'pickup_event', {
        type: 'pickup_event',
        foodId,
        foodType,
        updatedMissions,
        profile: db.getProfile(userId),
      });
    });

    session.setOnNpcEncounter((userId, encounter) => {
      emitToUser(userId, 'npc_encounter', encounter);
    });

    session.setOnQuestUpdate((userId, update) => {
      emitToUser(userId, 'quest_update', update);
    });

    session.setOnWorldFeedback((userId, x, y, text, color) => {
      emitToUser(userId, 'world_feedback', { x, y, text, color });
    });

    session.setOnHeartUpdateCallback((userId, heartState, rechargedCount) => {
      emitToUser(userId, 'heart_state', { heartState, rechargedCount });
    });

    const snake = session.registerPlayer(a.userId, a.username, skin, false, evolution, region);
    AnalyticsService.track({
      eventType: 'match_start',
      userId: a.userId,
      sessionId: a.sessionId,
      mode,
      roomId,
      metadata: { kingdom, region: regionRaw },
    });

    const activeQuest = QuestEngineService.getActiveMainQuest(a.userId);
    const activeQuiz = activeQuest?.quizSessionId
      ? QuestionBankService.getSession(a.userId, activeQuest.quizSessionId)?.currentQuestion || null
      : null;
    if (activeQuiz) {
      session.setPlayerQuizMode(a.userId, true);
    }
    const npcQuotas = QuestEngineService.getAllNpcQuotas(a.userId);
    const rewardBox = RewardBoxService.listBox(a.userId);
    const heartState = HeartService.getHeartState(a.userId);

    socket.emit('authenticated', {
      userId: a.userId,
      snake,
      mode,
      roomId,
      region,
      config: session.getConfig(),
      activeQuest,
      activeQuiz,
      npcQuotas,
      heartState,
      unclaimedRewardBoxCount: rewardBox.unclaimedCount,
    });
    deliverInvites(a.userId);
  });

  socket.on('client_input', (data: { seq: number; angle: number; boosting: boolean }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const seq = Number(data?.seq);
    if (!Number.isFinite(seq) || seq <= user.lastSeq) return;
    user.lastSeq = seq;
    resolveUserSession(user).handlePlayerInput(user.userId, data.angle, !!data.boosting, seq);
  });

  socket.on('view_radius', (data: { radius?: number }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const r = Number(data?.radius);
    if (!Number.isFinite(r)) return;
    user.viewRadius = Math.min(MAX_VIEW_RADIUS, Math.max(MIN_VIEW_RADIUS, r));
  });

  socket.on('activate_ability', () => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const used = resolveUserSession(user).activateAbility(user.userId);
    socket.emit('ability_result', { used });
  });

  socket.on('respawn', (data: { method?: string; adToken?: string }) => {
    const user = connectedSockets.get(socket.id);
    if (!user) return;
    const session = resolveUserSession(user);
    if (session.getState().mode === 'battle_royale') {
      socket.emit('respawn_result', { success: false, message: 'No respawns allowed in Battle Royale' });
      return;
    }
    const method = data?.method || 'wait';
    if (method === 'ad') {
      const verified = AdManagerService.consumeRewardToken(user.userId, String(data?.adToken || ''));
      if (!verified.ok) {
        socket.emit('respawn_result', { success: false, message: verified.error });
        return;
      }
    }
    const cost = RESPAWN_COST[method] || RESPAWN_COST.wait;
    const profile = db.getProfile(user.userId);
    if (!profile) { socket.emit('respawn_result', { success: false, message: 'No profile' }); return; }
    if (profile.stars < cost.stars || profile.tickets < cost.tickets) {
      socket.emit('respawn_result', { success: false, message: `Not enough ${cost.label}` });
      return;
    }
    const updatedProfile = (cost.stars || cost.tickets)
      ? db.updateProfile(user.userId, { stars: profile.stars - cost.stars, tickets: profile.tickets - cost.tickets })
      : profile;

    const snake = session.respawnPlayer(user.userId, user.username, user.skin, user.evolution, user.region);
    socket.emit('respawn_result', { success: true, snake, profile: withRank(updatedProfile), method });
  });

  socket.on('player_pause', () => {
    const user = connectedSockets.get(socket.id);
    if (user) resolveUserSession(user).setPlayerInactive(user.userId, true);
  });
  socket.on('player_resume', () => {
    const user = connectedSockets.get(socket.id);
    if (user) resolveUserSession(user).setPlayerInactive(user.userId, false);
  });
  socket.on('npc_interact_request', (data: { npcId?: string }) => {
    const user = connectedSockets.get(socket.id);
    if (!user || !data?.npcId) return;
    const check = resolveUserSession(user).validateManualNpcInteract(user.userId, String(data.npcId));
    if (check.ok && check.encounter) {
      socket.emit('npc_encounter', check.encounter);
    } else {
      socket.emit('npc_interact_error', { error: check.error || 'Cannot interact' });
    }
  });
  socket.on('interaction_end', () => {
    const user = connectedSockets.get(socket.id);
    if (user) {
      const sess = resolveUserSession(user);
      sess.setPlayerInteraction(user.userId, false);
      sess.setPlayerQuizMode(user.userId, false);
    }
  });
  socket.on('quiz_state', (data: { active?: boolean }) => {
    const user = connectedSockets.get(socket.id);
    if (user) resolveUserSession(user).setPlayerQuizMode(user.userId, Boolean(data?.active));
  });
  socket.on('map_planning', (data: { active?: boolean }) => {
    const user = connectedSockets.get(socket.id);
    if (user) resolveUserSession(user).setPlayerMapPlanning(user.userId, Boolean(data?.active));
  });
  socket.on('use_powerup', (data: { powerupId?: string }) => {
    const user = connectedSockets.get(socket.id);
    if (!user || !data?.powerupId) return;
    const pid = String(data.powerupId) as 'pw_boost' | 'pw_shield' | 'pw_super';
    const consumed = RewardBoxService.consumePowerup(user.userId, pid);
    if (consumed.ok) {
      resolveUserSession(user).applyPurchasedPowerup(user.userId, pid);
      socket.emit('powerup_used', { ok: true, powerupId: pid, remaining: consumed.remaining });
    } else {
      socket.emit('powerup_used', { ok: false, error: consumed.error });
    }
  });

  socket.on('disconnect', () => {
    const user = connectedSockets.get(socket.id);
    if (user) {
      const session = resolveUserSession(user);
      session.handlePlayerDisconnect(user.userId);
      connectedSockets.delete(socket.id);
      const hasOtherSocket = Array.from(connectedSockets.values()).some(u => u.userId === user.userId);
      if (!hasOtherSocket) {
        antiCheat.forget(user.userId);
      }
      presence.remove(user.userId);
      const dur = Math.max(0, Math.round((Date.now() - user.joinedAt) / 1000));
      AnalyticsService.track({
        eventType: 'session_end',
        userId: user.userId,
        mode: user.mode,
        roomId: user.roomId,
        durationSeconds: dur,
      });
    }
  });
});

// --------------------------------------------------------------- 30 Hz Interest-Managed Broadcast
const DEFAULT_VIEW_RADIUS = 2200;
const MIN_VIEW_RADIUS = 700;
const MAX_VIEW_RADIUS = 4400;

const broadcastTimer = setInterval(() => {
  if (connectedSockets.size === 0) return;

  const shared = new Map<string, ReturnType<GameSessionService['buildSharedSnapshot']>>();
  for (const session of sessionManager.getActiveSessions()) {
    const roomId = session.getState().matchId;
    shared.set(roomId, session.buildSharedSnapshot());
  }

  const now = Date.now();
  for (const [sid, user] of connectedSockets) {
    const session = resolveUserSession(user);
    const base = shared.get(session.getState().matchId);
    if (!base) continue;
    const head = session.getHeadPosition(user.userId);

    const radius = user.viewRadius || DEFAULT_VIEW_RADIUS;
    const payload: any = {
      ...base,
      roomId: user.roomId,
      timestamp: now,
      snakes: session.viewSnakes(base.snakes, head, radius),
      food: session.foodNear(head, radius),
    };
    if (user.worldVersion !== base.worldVersion) {
      const layout = session.getWorldLayout();
      payload.obstacles = layout.obstacles;
      payload.portals = layout.portals;
      payload.npcs = layout.npcs;
      user.worldVersion = base.worldVersion;
    }
    io.to(sid).emit('game_state_tick', payload);
  }
}, 1000 / 30);
broadcastTimer.unref?.();

const PORT = Number(process.env.PORT) || 4000;
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` ANACONDA PARK — AUTHORITATIVE SERVER RUNNING ON :${PORT}`);
    console.log(` Modes: Classic · Battle Royale · Team · Event · Boss @ 30Hz`);
    console.log(`=======================================================`);
  });
}

export { app, server, io };
export default app;
