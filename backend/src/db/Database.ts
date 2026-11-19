import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import {
  UserAccount,
  UserRole,
  UserStatus,
  PlayerProfile,
  PlayerStats,
  MissionObjective,
  Achievement,
  AntiCheatViolation,
  ProgressMetric,
  Evolution,
  CouponDefinition,
  CouponRedemption,
  SocialGraph,
  MatchRecord,
  MatchInvite,
  AuthSession,
  AdminAuditLog,
} from '../types';
import { ProgressionService } from '../services/ProgressionService';
import { gameConfig } from '../config/GameConfig';
import { SQLITE_SCHEMA } from './schema';

export interface RewardCatalogRow {
  id: string;
  title: string;
  category: 'giftcard' | 'merch' | 'cosmetic' | 'eventpass' | 'partner';
  icon: string;
  baseStarCost: number;
  regions: string[] | 'all';
  stock: number;
  minLevel: number;
  provider: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}

export class Database {
  private conn: DatabaseSync;
  private readonly legacyJsonFile: string;
  private readonly dbFile: string;

  // Hot/reference-stable caches for 30Hz ticks and existing test compatibility
  private usersById: Map<string, UserAccount> = new Map();
  private usersByName: Map<string, UserAccount> = new Map();
  private profiles: Map<string, PlayerProfile> = new Map();
  private friendCodeIndex: Map<string, string> = new Map();
  private missionsCache: Map<string, MissionObjective[]> = new Map();
  private achievementsCache: Map<string, Achievement[]> = new Map();
  private socialCache: Map<string, SocialGraph> = new Map();
  private invitesCache: Map<string, MatchInvite[]> = new Map();
  private closed = false;

  constructor() {
    this.legacyJsonFile = process.env.DATA_FILE || path.join(process.cwd(), 'data', 'anaconda-db.json');
    this.dbFile = process.env.SQLITE_FILE
      || (process.env.DATA_FILE
        ? process.env.DATA_FILE.replace(/\.json$/i, '') + '.db'
        : path.join(process.cwd(), 'data', 'anaconda.db'));

    fs.mkdirSync(path.dirname(this.dbFile), { recursive: true });
    this.conn = new DatabaseSync(this.dbFile);
    this.conn.exec(SQLITE_SCHEMA);

    this.initializeData();
    this.registerHooks();
  }

  public getRawDb(): DatabaseSync {
    return this.conn;
  }

  // ------------------------------------------------------------- lifecycle & bootstrap
  private registerHooks() {
    const cleanExit = () => this.close();
    process.once('beforeExit', () => this.flush());
    process.once('SIGINT', () => { cleanExit(); process.exit(0); });
    process.once('SIGTERM', () => { cleanExit(); process.exit(0); });
  }

  public flush(): void {
    if (this.closed) return;
    // Sync any reference-mutated caches back to SQLite before checkpointing
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      for (const [userId, list] of this.missionsCache) {
        if (this.usersById.has(userId)) this.saveMissionsRows(userId, list);
      }
      for (const [userId, list] of this.achievementsCache) {
        if (this.usersById.has(userId)) this.saveAchievementsRows(userId, list);
      }
      for (const [userId, g] of this.socialCache) {
        if (this.usersById.has(userId)) this.saveSocialRow(userId, g);
      }
      for (const [userId, list] of this.invitesCache) this.saveInvitesRows(userId, list);
      this.conn.exec('COMMIT');
    } catch (e) {
      try { this.conn.exec('ROLLBACK'); } catch { /* */ }
      throw e;
    }
    try { this.conn.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch { /* */ }
  }

  /** Create a consistent hot SQLite backup file using VACUUM INTO. */
  public backupDatabase(targetFile?: string): { filePath: string; sizeBytes: number } {
    this.flush();
    const backupsDir = path.join(path.dirname(this.dbFile), 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outPath = targetFile || path.join(backupsDir, `anaconda-backup-${stamp}.db`);
    const safeSqlPath = outPath.replace(/'/g, "''");
    this.conn.exec(`VACUUM INTO '${safeSqlPath}'`);
    const stat = fs.statSync(outPath);
    return { filePath: outPath, sizeBytes: stat.size };
  }

  public close(): void {
    if (this.closed) return;
    try { this.flush(); } catch { /* */ }
    try { this.conn.close(); } catch { /* */ }
    this.closed = true;
  }

  private initializeData() {
    const countRow = this.conn.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
    if (countRow.cnt === 0) {
      if (fs.existsSync(this.legacyJsonFile)) {
        try {
          const snapshot = JSON.parse(fs.readFileSync(this.legacyJsonFile, 'utf8'));
          this.importLegacySnapshot(snapshot);
        } catch {
          this.seedDefaultData();
        }
      } else {
        this.seedDefaultData();
      }
    } else {
      this.loadHotCaches();
    }

    this.seedRewardsCatalogIfEmpty();
    this.bootstrapEnvAdmin();
  }

  private bootstrapEnvAdmin() {
    const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim();
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || 'admin@anacondapark.local';
    if (!username || !password || password.length < 8) return;
    const existing = this.getUserByUsername(username);
    if (existing) {
      if (existing.role !== 'super_admin') {
        this.updateUserRoleStatus(existing.id, { role: 'super_admin', status: 'active' });
      }
      return;
    }
    const hash = bcrypt.hashSync(password, 12);
    this.createUser(username, email, hash, false, 'super_admin');
  }

  private importLegacySnapshot(data: any) {
    this.conn.exec('BEGIN IMMEDIATE');
    try {
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          const user: UserAccount = {
            id: u.id,
            username: u.username,
            email: u.email || '',
            passwordHash: u.passwordHash || '',
            role: (u.role as UserRole) || 'player',
            status: (u.status as UserStatus) || 'active',
            isGuest: !!u.isGuest,
            createdAt: u.createdAt || new Date().toISOString(),
            lastLoginAt: u.lastLoginAt,
            lastActiveAt: u.lastActiveAt,
            mfaEnabled: !!u.mfaEnabled,
          };
          this.insertUserRow(user);
        }
      }
      if (Array.isArray(data.profiles)) {
        for (const raw of data.profiles) {
          const p = this.migrateProfile(raw);
          this.upsertProfileRow(p);
        }
      }
      if (Array.isArray(data.missions)) {
        for (const [userId, list] of data.missions) {
          if (this.usersById.has(userId)) this.saveMissionsRows(userId, list);
        }
      }
      if (Array.isArray(data.achievements)) {
        for (const [userId, list] of data.achievements) {
          if (this.usersById.has(userId)) this.saveAchievementsRows(userId, list);
        }
      }
      if (Array.isArray(data.leaderboard)) {
        const stmt = this.conn.prepare(
          'INSERT OR REPLACE INTO leaderboard (user_id, display_name, score, wins, updated_at) VALUES (?, ?, ?, ?, ?)'
        );
        const now = new Date().toISOString();
        for (const [userId, entry] of data.leaderboard) {
          stmt.run(userId, entry.displayName, Math.round(entry.score || 0), entry.wins || 0, now);
        }
      }
      if (Array.isArray(data.couponDefs)) {
        for (const d of data.couponDefs) this.upsertCouponRow(d);
      }
      if (Array.isArray(data.couponRedemptions)) {
        const stmt = this.conn.prepare(
          'INSERT INTO coupon_redemptions (definition_id, user_id, voucher_id, promo_code, redeemed_at) VALUES (?, ?, ?, ?, ?)'
        );
        for (const r of data.couponRedemptions) {
          stmt.run(r.definitionId, r.userId, r.voucherId, r.promoCode, r.redeemedAt);
        }
      }
      if (Array.isArray(data.social)) {
        for (const [userId, g] of data.social) {
          if (this.usersById.has(userId)) this.saveSocialRow(userId, g);
        }
      }
      if (Array.isArray(data.matchHistory)) {
        for (const [userId, list] of data.matchHistory) {
          if (!this.usersById.has(userId) || !Array.isArray(list)) continue;
          for (const rec of list) this.insertMatchRow(userId, rec);
        }
      }
      if (Array.isArray(data.matchInvites)) {
        for (const [userId, list] of data.matchInvites) {
          if (Array.isArray(list)) this.saveInvitesRows(userId, list);
        }
      }
      this.conn.exec('COMMIT');
    } catch (e) {
      this.conn.exec('ROLLBACK');
      throw e;
    }
    this.loadHotCaches();
  }

  private loadHotCaches() {
    this.usersById.clear();
    this.usersByName.clear();
    this.profiles.clear();
    this.friendCodeIndex.clear();

    const userRows = this.conn.prepare('SELECT * FROM users').all();
    for (const r of userRows) {
      const u = this.rowToUser(r);
      this.usersById.set(u.id, u);
      this.usersByName.set(u.username.toLowerCase(), u);
    }

    const profRows = this.conn.prepare('SELECT * FROM player_profiles').all();
    for (const r of profRows) {
      const p = this.migrateProfile(this.rowToProfile(r));
      this.profiles.set(p.userId, p);
      this.indexFriendCode(p);
    }
  }

  // ------------------------------------------------------------- helpers & migrations
  private static todayKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }

  private static weekKey(now = new Date()): string {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  private periodKeyFor(category: MissionObjective['category']): string {
    if (category === 'daily') return Database.todayKey();
    if (category === 'weekly') return Database.weekKey();
    return 'event';
  }

  private migrateProfile(p: PlayerProfile): PlayerProfile {
    if (!Array.isArray(p.unlockedSkins)) {
      const owned = new Set(gameConfig.cosmetics.starterSkins);
      if (p.equippedSkin) owned.add(p.equippedSkin);
      p.unlockedSkins = Array.from(owned);
    }
    if (!Array.isArray(p.unlockedAccessories)) {
      const ownedAcc = new Set(gameConfig.cosmetics.starterAccessories);
      if (p.equippedAccessory) ownedAcc.add(p.equippedAccessory);
      p.unlockedAccessories = Array.from(ownedAcc);
    }
    if (!p.friendCode) p.friendCode = this.generateFriendCode();
    if (!p.stats) p.stats = Database.defaultStats();
    if (!p.modeStats) p.modeStats = {};
    this.indexFriendCode(p);
    return p;
  }

  // ------------------------------------------------------------- row mappers
  private rowToUser(r: any): UserAccount {
    return {
      id: r.id,
      username: r.username,
      email: r.email || '',
      passwordHash: r.password_hash || undefined,
      role: (r.role as UserRole) || 'player',
      status: (r.status as UserStatus) || 'active',
      isGuest: !!r.is_guest,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at || undefined,
      lastActiveAt: r.last_active_at || undefined,
      mfaEnabled: false,
    };
  }

  private insertUserRow(u: UserAccount) {
    this.conn.prepare(`
      INSERT OR REPLACE INTO users (
        id, username, username_lower, email, password_hash, role, status, is_guest, created_at, last_login_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      u.id, u.username, u.username.toLowerCase(), u.email || '', u.passwordHash || '',
      u.role || 'player', u.status || 'active', u.isGuest ? 1 : 0,
      u.createdAt, u.lastLoginAt || null, u.lastActiveAt || null
    );
    this.usersById.set(u.id, u);
    this.usersByName.set(u.username.toLowerCase(), u);
  }

  private rowToProfile(r: any): PlayerProfile {
    const parse = (s: string | null, fallback: any) => {
      if (!s) return fallback;
      try { return JSON.parse(s); } catch { return fallback; }
    };
    return {
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url || '',
      avatar: r.avatar || undefined,
      title: r.title || undefined,
      country: r.country || undefined,
      language: r.language || undefined,
      preferredRegion: r.preferred_region || undefined,
      level: r.level,
      xp: r.xp,
      evolutionXp: r.evolution_xp,
      prestige: r.prestige,
      rating: r.rating,
      stars: r.stars,
      tickets: r.tickets,
      friendCode: r.friend_code,
      equippedSkin: r.equipped_skin,
      unlockedSkins: parse(r.unlocked_skins_json, [...gameConfig.cosmetics.starterSkins]),
      equippedEvolution: (r.equipped_evolution as Evolution) || 'Baby',
      unlockedEvolutions: parse(r.unlocked_evolutions_json, ['Baby']),
      equippedTrail: r.equipped_trail || 'Classic Dust',
      equippedAccessory: r.equipped_accessory || undefined,
      unlockedAccessories: parse(r.unlocked_accessories_json, [...gameConfig.cosmetics.starterAccessories]),
      stats: parse(r.stats_json, Database.defaultStats()),
      modeStats: parse(r.mode_stats_json, {}),
      coupons: parse(r.coupons_json, []),
      milestones: parse(r.milestones_json, []),
      explorer: parse(r.explorer_json, { kingdom: 1, accepted: [], claimed: [], kingdomsDone: [], bossesDefeated: [], baseline: {} }),
      inventory: parse(r.inventory_json, {}),
      lastNameChange: r.last_name_change ?? undefined,
      lastAdClaim: r.last_ad_claim ?? undefined,
      lastDailyBonus: r.last_daily_bonus || undefined,
      dailyStreak: r.daily_streak ?? 0,
      lastStreakDate: r.last_streak_date || undefined,
    };
  }

  private upsertProfileRow(p: PlayerProfile) {
    this.conn.prepare(`
      INSERT OR REPLACE INTO player_profiles (
        user_id, display_name, avatar_url, avatar, title, country, language, preferred_region,
        level, xp, evolution_xp, prestige, rating, stars, tickets, friend_code,
        equipped_skin, unlocked_skins_json, equipped_evolution, unlocked_evolutions_json,
        equipped_trail, equipped_accessory, unlocked_accessories_json,
        stats_json, mode_stats_json, coupons_json, milestones_json, explorer_json, inventory_json,
        last_name_change, last_ad_claim, last_daily_bonus, daily_streak, last_streak_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      p.userId, p.displayName, p.avatarUrl || '', p.avatar || null, p.title || null,
      p.country || null, p.language || null, p.preferredRegion || null,
      p.level, p.xp, p.evolutionXp, p.prestige, p.rating, p.stars, p.tickets, p.friendCode,
      p.equippedSkin, JSON.stringify(p.unlockedSkins || []), p.equippedEvolution, JSON.stringify(p.unlockedEvolutions || ['Baby']),
      p.equippedTrail || 'Classic Dust', p.equippedAccessory || null, JSON.stringify(p.unlockedAccessories || []),
      JSON.stringify(p.stats || Database.defaultStats()), JSON.stringify(p.modeStats || {}),
      JSON.stringify(p.coupons || []), JSON.stringify(p.milestones || []),
      JSON.stringify(p.explorer || { kingdom: 1, accepted: [], claimed: [], kingdomsDone: [], bossesDefeated: [], baseline: {} }),
      JSON.stringify(p.inventory || {}),
      p.lastNameChange ?? null, p.lastAdClaim ?? null, p.lastDailyBonus || null,
      p.dailyStreak ?? 0, p.lastStreakDate || null
    );
    this.profiles.set(p.userId, p);
    this.indexFriendCode(p);
  }

  // ------------------------------------------------------------- templates & seeds
  private defaultMissions(): MissionObjective[] {
    const dailyKey = Database.todayKey();
    const weeklyKey = Database.weekKey();
    return [
      { id: 'ms_cherry', title: '🍒 Feed the Hungry Village', description: 'Gather 30 cherries for the starving village', category: 'daily', metric: 'cherry', icon: '🍒', targetCount: 30, currentCount: 0, rewardStars: 150, rewardXP: 120, rewardEvoXP: 40, isCompleted: false, isClaimed: false, periodKey: dailyKey },
      { id: 'ms_frog', title: '🐸 A Feast for the Frog Chef', description: 'Bring 10 frogs to the royal kitchen', category: 'daily', metric: 'frog', icon: '🐸', targetCount: 10, currentCount: 0, rewardStars: 150, rewardXP: 120, rewardEvoXP: 40, isCompleted: false, isClaimed: false, periodKey: dailyKey },
      { id: 'ms_star', title: '⭐ Recover Lost Crown Fragments', description: 'Reclaim 100 shattered Star Fragments', category: 'daily', metric: 'star', icon: '⭐', targetCount: 100, currentCount: 0, rewardStars: 200, rewardXP: 150, rewardEvoXP: 50, isCompleted: false, isClaimed: false, periodKey: dailyKey },
      { id: 'ms_eat', title: '🛡️ Defeat 5 Venom Soldiers', description: 'Drive back 5 soldiers of the Venom Order', category: 'daily', metric: 'kill', icon: '🛡️', targetCount: 5, currentCount: 0, rewardStars: 250, rewardXP: 180, rewardEvoXP: 60, isCompleted: false, isClaimed: false, periodKey: dailyKey },
      { id: 'ms_boost', title: '⚡ Master the Royal Dash', description: 'Use the royal dash 20 times', category: 'daily', metric: 'boost', icon: '⚡', targetCount: 20, currentCount: 0, rewardStars: 120, rewardXP: 90, rewardEvoXP: 30, isCompleted: false, isClaimed: false, periodKey: dailyKey },
      { id: 'ms_win', title: '👑 Claim a Royal Victory', description: 'Finish #1 to honour the crown', category: 'daily', metric: 'win', icon: '👑', targetCount: 1, currentCount: 0, rewardStars: 300, rewardXP: 220, rewardEvoXP: 80, isCompleted: false, isClaimed: false, periodKey: dailyKey },
      { id: 'ms_cherry1k', title: '🍒 Restore the Great Orchard', description: 'Harvest 1000 cherries this week', category: 'weekly', metric: 'cherry', icon: '🍒', targetCount: 1000, currentCount: 0, rewardStars: 800, rewardXP: 500, rewardEvoXP: 200, isCompleted: false, isClaimed: false, periodKey: weeklyKey },
      { id: 'ms_travel', title: '🗺️ Explore the Ancient Roads', description: 'Travel 50 km along the old kingdom roads', category: 'weekly', metric: 'distance', icon: '🗺️', targetCount: 50, currentCount: 0, rewardStars: 700, rewardXP: 450, rewardEvoXP: 180, isCompleted: false, isClaimed: false, periodKey: weeklyKey },
      { id: 'ms_win20', title: '👑 Rally the Seven Kingdoms', description: 'Win 20 matches to unite the clans', category: 'weekly', metric: 'win', icon: '👑', targetCount: 20, currentCount: 0, rewardStars: 1000, rewardXP: 700, rewardEvoXP: 300, isCompleted: false, isClaimed: false, periodKey: weeklyKey },
      { id: 'ms_treasure25', title: '🎁 Unearth Royal Relics', description: 'Recover 25 lost royal relics', category: 'weekly', metric: 'treasure', icon: '🎁', targetCount: 25, currentCount: 0, rewardStars: 900, rewardXP: 600, rewardEvoXP: 250, isCompleted: false, isClaimed: false, periodKey: weeklyKey },
      { id: 'ms_survive', title: '⏳ Endure the Venom Siege', description: 'Survive 30 minutes against the Venom Order', category: 'event', metric: 'survive', icon: '⏳', targetCount: 1800, currentCount: 0, rewardStars: 1200, rewardXP: 800, rewardEvoXP: 300, isCompleted: false, isClaimed: false, periodKey: 'event' },
      { id: 'ms_score5k', title: '🐉 Awaken the Titan Within', description: 'Reach 5,000 score in a single match', category: 'event', metric: 'score', icon: '🐉', targetCount: 5000, currentCount: 0, rewardStars: 2000, rewardXP: 1000, rewardEvoXP: 500, isCompleted: false, isClaimed: false, periodKey: 'event' },
    ];
  }

  private defaultAchievements(): Achievement[] {
    return [
      { id: 'ach_first', title: 'First Steps', description: 'Reach Score 100', tier: 'bronze', metric: 'score', target: 100, progress: 0, isUnlocked: false, rewardStars: 100, icon: '⭐' },
      { id: 'ach_cherry', title: 'Cherry Lover', description: 'Collect 500 Cherries', tier: 'silver', metric: 'cherry', target: 500, progress: 0, isUnlocked: false, rewardStars: 500, icon: '🍒' },
      { id: 'ach_hunter', title: 'Snake Hunter', description: 'Eat 50 Snakes', tier: 'gold', metric: 'kill', target: 50, progress: 0, isUnlocked: false, rewardStars: 800, icon: '💀' },
      { id: 'ach_explorer', title: 'World Explorer', description: 'Visit all areas of the park', tier: 'gold', metric: 'explore', target: 6, progress: 0, isUnlocked: false, rewardStars: 600, icon: '🗺️' },
      { id: 'ach_champion', title: 'Park Champion', description: 'Reach Score 10,000', tier: 'diamond', metric: 'score', target: 10000, progress: 0, isUnlocked: false, rewardStars: 2000, icon: '🏆' },
    ];
  }

  public static defaultStats(): PlayerStats {
    return {
      matchesPlayed: 0, matchesWon: 0, matchesLost: 0, totalFoodEaten: 0, highestScore: 0,
      survivalTimeSeconds: 0, longestSurvivalSeconds: 0, totalDistanceKm: 0, totalStars: 0,
      cherriesCollected: 0, applesCollected: 0, frogsCollected: 0, powerupsCollected: 0, couponsEarned: 0,
      totalKills: 0, totalDeaths: 0, longestKillStreak: 0, mostKillsInMatch: 0,
      totalDamageDealt: 0, totalDamageReceived: 0, mostDamageDealt: 0, mostDamageReceived: 0, bossKills: 0,
    };
  }

  private seedDefaultData() {
    const now = new Date().toISOString();
    // RangerAlpha is a normal player showcase account — NEVER a default admin.
    const demoUser: UserAccount = {
      id: 'usr_ranger_alpha',
      username: 'RangerAlpha',
      email: 'alpha@anacondapark.io',
      passwordHash: bcrypt.hashSync('Anaconda2026!', 10),
      role: 'player',
      status: 'active',
      isGuest: false,
      createdAt: now,
    };
    const demoProfile: PlayerProfile = {
      userId: demoUser.id,
      displayName: 'Apex Anaconda',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=AnacondaAlpha',
      level: 176, xp: 3450, evolutionXp: 2100, prestige: 0, rating: 1420, stars: 1250, tickets: 15,
      friendCode: 'AP-RANG-ER01',
      equippedSkin: 'Forest', unlockedSkins: [...gameConfig.cosmetics.starterSkins],
      equippedEvolution: 'Young', unlockedEvolutions: ['Baby', 'Young'], equippedTrail: 'Jungle Glow',
      equippedAccessory: undefined, unlockedAccessories: [...gameConfig.cosmetics.starterAccessories],
      stats: { ...Database.defaultStats(), matchesPlayed: 42, matchesWon: 11, matchesLost: 31, totalKills: 156, totalFoodEaten: 4200, highestScore: 18500, survivalTimeSeconds: 14200, cherriesCollected: 320, totalStars: 5200 },
      modeStats: {},
    };

    this.conn.exec('BEGIN IMMEDIATE');
    try {
      this.insertUserRow(demoUser);
      this.upsertProfileRow(demoProfile);
      this.saveMissionsRows(demoUser.id, this.defaultMissions());
      this.saveAchievementsRows(demoUser.id, this.defaultAchievements());

      const lbStmt = this.conn.prepare(
        'INSERT OR REPLACE INTO leaderboard (user_id, display_name, score, wins, updated_at) VALUES (?, ?, ?, ?, ?)'
      );
      lbStmt.run('usr_ranger_alpha', 'Apex Anaconda', 18500, 11, now);
      lbStmt.run('bot_1', 'ViperKing', 16200, 9, now);
      lbStmt.run('bot_2', 'JunglePython', 14100, 7, now);
      lbStmt.run('bot_3', 'CobraNova', 12800, 5, now);
      lbStmt.run('bot_4', 'MambaMint', 9400, 3, now);

      const seedCoupons: CouponDefinition[] = [
        { id: 'cpn_partner_cafe', title: '10% Off at Partner Cafe', storeName: 'Approved Food Partner', discountText: '10% off your next order', icon: '☕', enabled: true, expiryDate: '2026-12-31', regions: 'all', minLevel: 3, minPrestige: 0, costStars: 800, redemptionLimit: 500, perUserLimit: 1, redemptionCount: 0, autoGrant: false, createdAt: now, updatedAt: now },
        { id: 'cpn_partner_retail', title: 'Partner Retail Voucher', storeName: 'Approved Retail Partner', discountText: '₹100 store credit', icon: '🛍️', enabled: true, expiryDate: '2026-12-31', regions: ['India', 'Global'], minLevel: 8, minPrestige: 0, costStars: 2000, redemptionLimit: 200, perUserLimit: 1, redemptionCount: 0, autoGrant: false, createdAt: now, updatedAt: now },
        { id: 'cpn_welcome', title: 'Welcome Explorer Gift', storeName: 'Anaconda Park', discountText: 'Free seasonal trail effect', icon: '🎁', enabled: true, expiryDate: '2026-12-31', regions: 'all', minLevel: 1, minPrestige: 0, costStars: 0, redemptionLimit: -1, perUserLimit: 1, redemptionCount: 0, autoGrant: true, createdAt: now, updatedAt: now },
      ];
      for (const c of seedCoupons) this.upsertCouponRow(c);

      this.conn.exec('COMMIT');
    } catch (e) {
      this.conn.exec('ROLLBACK');
      throw e;
    }
  }

  private seedRewardsCatalogIfEmpty() {
    const row = this.conn.prepare('SELECT COUNT(*) AS cnt FROM rewards_catalog').get() as { cnt: number };
    if (row.cnt > 0) return;
    const now = new Date().toISOString();
    const defaults: RewardCatalogRow[] = [
      { id: 'rw_giftcard_10', title: 'Digital Gift Card (10 credits)', category: 'giftcard', icon: '🎟️', baseStarCost: 5000, regions: 'all', stock: 50, minLevel: 5, provider: 'Approved Gift Provider', description: 'Redeemable digital gift credit via an authorized provider.', enabled: true, updatedAt: now },
      { id: 'rw_giftcard_25', title: 'Digital Gift Card (25 credits)', category: 'giftcard', icon: '💳', baseStarCost: 12000, regions: ['Global', 'USA', 'Europe', 'India'], stock: 20, minLevel: 15, provider: 'Approved Gift Provider', description: 'Higher-value digital gift credit, region-gated.', enabled: true, updatedAt: now },
      { id: 'rw_merch_tee', title: 'Anaconda Park T-Shirt', category: 'merch', icon: '👕', baseStarCost: 8000, regions: ['USA', 'Europe', 'India', 'Brazil'], stock: 15, minLevel: 10, provider: 'Official Merch Partner', description: 'Physical merch — shipping where the partner operates.', enabled: true, updatedAt: now },
      { id: 'rw_bundle_cosmetic', title: 'Legend Cosmetic Bundle', category: 'cosmetic', icon: '✨', baseStarCost: 3000, regions: 'all', stock: -1, minLevel: 1, provider: 'In-Game', description: 'A bundle of premium skins & trails, granted instantly.', enabled: true, updatedAt: now },
      { id: 'rw_eventpass', title: 'Seasonal Event Pass', category: 'eventpass', icon: '🎫', baseStarCost: 4000, regions: 'all', stock: -1, minLevel: 3, provider: 'In-Game', description: 'Unlocks the current season event track.', enabled: true, updatedAt: now },
      { id: 'rw_partner_promo', title: 'Partner Promo Voucher', category: 'partner', icon: '🤝', baseStarCost: 2000, regions: ['India', 'Brazil'], stock: 30, minLevel: 5, provider: 'Regional Partner', description: 'A partner promotion available in select regions.', enabled: true, updatedAt: now },
    ];
    for (const r of defaults) this.upsertRewardItem(r);
  }

  // ------------------------------------------------------------- users & auth sessions
  public createUser(
    username: string,
    email: string,
    passwordHash: string,
    isGuest: boolean = false,
    role: UserRole = 'player'
  ): { user: UserAccount; profile: PlayerProfile } {
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const user: UserAccount = {
      id, username, email, passwordHash, role, status: 'active', isGuest, createdAt: now, lastActiveAt: now,
    };
    const profile: PlayerProfile = {
      userId: id,
      displayName: username,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      level: 1, xp: 0, evolutionXp: 0, prestige: 0, rating: 1000, stars: 500, tickets: 5,
      friendCode: this.generateFriendCode(),
      equippedSkin: 'Forest', unlockedSkins: [...gameConfig.cosmetics.starterSkins],
      equippedEvolution: 'Baby', unlockedEvolutions: ['Baby'], equippedTrail: 'Classic Dust',
      equippedAccessory: undefined, unlockedAccessories: [...gameConfig.cosmetics.starterAccessories],
      stats: Database.defaultStats(),
      modeStats: {},
    };

    this.conn.exec('BEGIN IMMEDIATE');
    try {
      this.insertUserRow(user);
      this.upsertProfileRow(profile);
      const missions = this.defaultMissions();
      const achs = this.defaultAchievements();
      this.saveMissionsRows(id, missions);
      this.saveAchievementsRows(id, achs);
      this.missionsCache.set(id, missions);
      this.achievementsCache.set(id, achs);
      this.conn.exec('COMMIT');
    } catch (e) {
      this.conn.exec('ROLLBACK');
      throw e;
    }

    return { user, profile };
  }

  public getUserByUsername(username: string): UserAccount | undefined {
    const key = String(username || '').toLowerCase();
    const cached = this.usersByName.get(key);
    if (cached) return cached;
    const row = this.conn.prepare('SELECT * FROM users WHERE username_lower = ?').get(key);
    if (!row) return undefined;
    const u = this.rowToUser(row);
    this.usersById.set(u.id, u);
    this.usersByName.set(key, u);
    return u;
  }

  public getUserById(id: string): UserAccount | undefined {
    const cached = this.usersById.get(id);
    if (cached) return cached;
    const row = this.conn.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return undefined;
    const u = this.rowToUser(row);
    this.usersById.set(u.id, u);
    this.usersByName.set(u.username.toLowerCase(), u);
    return u;
  }

  public upgradeUserAccount(userId: string, username: string, email: string, passwordHash: string): UserAccount | undefined {
    const existing = this.getUserById(userId);
    if (!existing) return undefined;
    const oldLower = existing.username.toLowerCase();
    const next: UserAccount = { ...existing, username, email, passwordHash, isGuest: false };
    this.usersByName.delete(oldLower);
    this.insertUserRow(next);
    const prof = this.getProfile(userId);
    if (prof) this.updateProfile(userId, { displayName: username });
    return next;
  }

  public updateUserRoleStatus(
    userId: string,
    patch: Partial<Pick<UserAccount, 'role' | 'status' | 'lastLoginAt' | 'lastActiveAt' | 'passwordHash'>>
  ): UserAccount | undefined {
    const existing = this.getUserById(userId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.insertUserRow(updated);
    return updated;
  }

  public touchUserActivity(userId: string) {
    const u = this.getUserById(userId);
    if (!u) return;
    const now = new Date().toISOString();
    if (u.lastActiveAt && Date.now() - Date.parse(u.lastActiveAt) < 60_000) return;
    u.lastActiveAt = now;
    this.conn.prepare('UPDATE users SET last_active_at = ? WHERE id = ?').run(now, userId);
  }

  public listUsers(filter?: { search?: string; role?: string; status?: string; limit?: number; offset?: number }) {
    const limit = Math.min(200, Math.max(1, filter?.limit || 50));
    const offset = Math.max(0, filter?.offset || 0);
    const where: string[] = [];
    const params: any[] = [];
    if (filter?.search) {
      where.push('(u.username_lower LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(p.display_name) LIKE ? OR u.id = ?)');
      const q = `%${filter.search.toLowerCase()}%`;
      params.push(q, q, q, filter.search);
    }
    if (filter?.role) { where.push('u.role = ?'); params.push(filter.role); }
    if (filter?.status) { where.push('u.status = ?'); params.push(filter.status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (this.conn.prepare(`
      SELECT COUNT(*) AS cnt FROM users u LEFT JOIN player_profiles p ON p.user_id = u.id ${whereSql}
    `).get(...params) as { cnt: number }).cnt;
    const rows = this.conn.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.status, u.is_guest, u.created_at, u.last_login_at, u.last_active_at,
             p.display_name, p.level, p.stars, p.tickets, p.country, p.stats_json
      FROM users u LEFT JOIN player_profiles p ON p.user_id = u.id
      ${whereSql}
      ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    return {
      total,
      users: rows.map((r: any) => {
        let stats: any = {};
        try { stats = JSON.parse(r.stats_json || '{}'); } catch { /* */ }
        return {
          id: r.id,
          username: r.username,
          displayName: r.display_name || r.username,
          email: r.email,
          role: r.role,
          status: r.status,
          isGuest: !!r.is_guest,
          level: r.level || 1,
          stars: r.stars || 0,
          tickets: r.tickets || 0,
          country: r.country || '',
          matchesPlayed: stats.matchesPlayed || 0,
          highestScore: stats.highestScore || 0,
          createdAt: r.created_at,
          lastLoginAt: r.last_login_at,
          lastActiveAt: r.last_active_at,
        };
      }),
    };
  }

  public createAuthSession(session: AuthSession) {
    this.conn.prepare(`
      INSERT INTO auth_sessions (id, user_id, role, created_at, expires_at, revoked_at, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(session.id, session.userId, session.role, session.createdAt, session.expiresAt, session.ip || null, session.userAgent || null);
  }

  public isSessionValid(sessionId: string): boolean {
    const row = this.conn.prepare('SELECT revoked_at, expires_at FROM auth_sessions WHERE id = ?').get(sessionId) as any;
    if (!row) return false;
    if (row.revoked_at) return false;
    return Date.parse(row.expires_at) > Date.now();
  }

  public revokeSession(sessionId: string) {
    this.conn.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), sessionId);
  }

  public revokeAllUserSessions(userId: string) {
    this.conn.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(new Date().toISOString(), userId);
  }

  // ------------------------------------------------------------- profiles & friend codes
  private static readonly CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXY2346789';

  public static normalizeFriendCode(raw: string): string {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private generateFriendCode(): string {
    const A = Database.CODE_ALPHABET;
    for (let attempt = 0; attempt < 50; attempt++) {
      let body = '';
      for (let i = 0; i < 8; i++) body += A[Math.floor(Math.random() * A.length)];
      const code = `AP-${body.slice(0, 4)}-${body.slice(4)}`;
      if (!this.friendCodeIndex.has(Database.normalizeFriendCode(code))) return code;
    }
    return `AP-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  }

  private indexFriendCode(profile: PlayerProfile) {
    if (profile.friendCode) this.friendCodeIndex.set(Database.normalizeFriendCode(profile.friendCode), profile.userId);
  }

  public getProfileByFriendCode(code: string): PlayerProfile | undefined {
    const userId = this.friendCodeIndex.get(Database.normalizeFriendCode(code));
    return userId ? this.getProfile(userId) : undefined;
  }

  public getProfile(userId: string): PlayerProfile | undefined {
    return this.profiles.get(userId);
  }

  public updateProfile(userId: string, updates: Partial<PlayerProfile>): PlayerProfile | undefined {
    const existing = this.profiles.get(userId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.upsertProfileRow(updated);
    return updated;
  }

  public grantItem(userId: string, itemId: string, qty = 1): PlayerProfile | undefined {
    const profile = this.profiles.get(userId);
    if (!profile) return undefined;
    const inv = { ...(profile.inventory || {}) };
    inv[itemId] = Math.max(0, (inv[itemId] || 0) + qty);
    if (inv[itemId] === 0) delete inv[itemId];
    return this.updateProfile(userId, { inventory: inv });
  }

  // ------------------------------------------------------------- missions & achievements
  private saveMissionsRows(userId: string, list: MissionObjective[]) {
    const stmt = this.conn.prepare(`
      INSERT OR REPLACE INTO missions (
        user_id, mission_id, title, description, category, metric, icon,
        target_count, current_count, reward_stars, reward_xp, reward_evo_xp,
        is_completed, is_claimed, period_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of list) {
      stmt.run(
        userId, m.id, m.title, m.description, m.category, m.metric, m.icon,
        m.targetCount, m.currentCount, m.rewardStars, m.rewardXP, m.rewardEvoXP,
        m.isCompleted ? 1 : 0, m.isClaimed ? 1 : 0, m.periodKey || ''
      );
    }
  }

  private saveAchievementsRows(userId: string, list: Achievement[]) {
    const stmt = this.conn.prepare(`
      INSERT OR REPLACE INTO achievements (
        user_id, achievement_id, title, description, tier, metric, target,
        progress, is_unlocked, reward_stars, icon, unlocked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of list) {
      stmt.run(
        userId, a.id, a.title, a.description, a.tier, a.metric, a.target,
        a.progress, a.isUnlocked ? 1 : 0, a.rewardStars, a.icon,
        a.isUnlocked ? (new Date().toISOString()) : null
      );
    }
  }

  public getMissions(userId: string): MissionObjective[] {
    let list = this.missionsCache.get(userId);
    if (!list) {
      const rows = this.conn.prepare('SELECT * FROM missions WHERE user_id = ?').all(userId);
      if (rows.length) {
        list = rows.map((r: any) => ({
          id: r.mission_id, title: r.title, description: r.description,
          category: r.category, metric: r.metric, icon: r.icon,
          targetCount: r.target_count, currentCount: r.current_count,
          rewardStars: r.reward_stars, rewardXP: r.reward_xp, rewardEvoXP: r.reward_evo_xp,
          isCompleted: !!r.is_completed, isClaimed: !!r.is_claimed, periodKey: r.period_key || '',
        }));
      } else {
        list = this.defaultMissions();
        if (this.usersById.has(userId)) this.saveMissionsRows(userId, list);
      }
      this.missionsCache.set(userId, list);
    }

    let resetChanged = false;
    for (const m of list) {
      if (m.category === 'event') continue;
      const expectedKey = this.periodKeyFor(m.category);
      if (!m.periodKey) {
        m.periodKey = expectedKey;
        resetChanged = true;
      } else if (m.periodKey !== expectedKey) {
        m.periodKey = expectedKey;
        m.currentCount = 0;
        m.isCompleted = false;
        m.isClaimed = false;
        resetChanged = true;
      }
    }
    if (resetChanged && this.usersById.has(userId)) this.saveMissionsRows(userId, list);
    return list;
  }

  public getAchievements(userId: string): Achievement[] {
    let list = this.achievementsCache.get(userId);
    if (!list) {
      const rows = this.conn.prepare('SELECT * FROM achievements WHERE user_id = ?').all(userId);
      if (rows.length) {
        list = rows.map((r: any) => ({
          id: r.achievement_id, title: r.title, description: r.description,
          tier: r.tier, metric: r.metric, target: r.target, progress: r.progress,
          isUnlocked: !!r.is_unlocked, rewardStars: r.reward_stars, icon: r.icon,
        }));
      } else {
        list = this.defaultAchievements();
        if (this.usersById.has(userId)) this.saveAchievementsRows(userId, list);
      }
      this.achievementsCache.set(userId, list);
    }
    return list;
  }

  public incrementCollectible(userId: string, metric: ProgressMetric, amount: number = 1) {
    this.applyProgress(userId, metric, amount, false);
  }

  public recordPeakMetric(userId: string, metric: ProgressMetric, value: number) {
    this.applyProgress(userId, metric, value, true);
  }

  private applyProgress(userId: string, metric: ProgressMetric, amount: number, isPeak: boolean) {
    const missions = this.getMissions(userId);
    let missionsDirty = false;
    for (const m of missions) {
      if (m.metric !== metric || m.isCompleted) continue;
      const next = isPeak ? Math.max(m.currentCount, amount) : m.currentCount + amount;
      m.currentCount = Math.min(m.targetCount, next);
      if (m.currentCount >= m.targetCount) m.isCompleted = true;
      missionsDirty = true;
    }
    if (missionsDirty && this.usersById.has(userId)) this.saveMissionsRows(userId, missions);

    const achs = this.getAchievements(userId);
    let achsDirty = false;
    for (const a of achs) {
      if (a.metric !== metric || a.isUnlocked) continue;
      const next = isPeak ? Math.max(a.progress, amount) : a.progress + amount;
      a.progress = Math.min(a.target, next);
      if (a.progress >= a.target) {
        a.isUnlocked = true;
        const profile = this.getProfile(userId);
        if (profile) this.updateProfile(userId, { stars: profile.stars + a.rewardStars });
      }
      achsDirty = true;
    }
    if (achsDirty && this.usersById.has(userId)) this.saveAchievementsRows(userId, achs);

    this.applyLifetimeStat(userId, metric, amount, isPeak);
  }

  private static readonly NAMED_COLLECTIBLE_STAT: Partial<Record<ProgressMetric, keyof PlayerStats>> = {
    cherry: 'cherriesCollected', apple: 'applesCollected', frog: 'frogsCollected',
    star: 'totalStars', kill: 'totalKills', assist: 'totalAssists', death: 'totalDeaths',
  };
  private static readonly POWERUP_METRICS = new Set<ProgressMetric>(['shield', 'speed', 'mushroom', 'powerup', 'magnet', 'fire']);
  private static readonly FOOD_METRICS = new Set<ProgressMetric>(['cherry', 'apple', 'frog', 'egg', 'mushroom']);

  private applyLifetimeStat(userId: string, metric: ProgressMetric, amount: number, isPeak: boolean) {
    const profile = this.profiles.get(userId);
    if (!profile || amount <= 0) return;
    const s: PlayerStats = { ...profile.stats };

    const collectibles = { ...(s.collectibles || {}) };
    collectibles[metric] = isPeak ? Math.max(collectibles[metric] || 0, amount) : (collectibles[metric] || 0) + amount;
    s.collectibles = collectibles;

    const named = Database.NAMED_COLLECTIBLE_STAT[metric];
    if (named) {
      const cur = (s[named] as number) || 0;
      (s[named] as number) = isPeak ? Math.max(cur, amount) : cur + amount;
    }
    if (Database.POWERUP_METRICS.has(metric)) s.powerupsCollected = (s.powerupsCollected || 0) + amount;
    if (Database.FOOD_METRICS.has(metric)) s.totalFoodEaten = (s.totalFoodEaten || 0) + amount;
    if (metric === 'score') s.highestScore = Math.max(s.highestScore || 0, amount);

    this.updateProfile(userId, { stats: s });
  }

  public claimMissionReward(userId: string, missionId: string): { success: boolean; stars: number; xp: number; evoXp: number; updatedMissions: MissionObjective[]; profile?: PlayerProfile } {
    const userMissions = this.getMissions(userId);
    const target = userMissions.find(m => m.id === missionId);
    if (!target || !target.isCompleted || target.isClaimed) {
      return { success: false, stars: 0, xp: 0, evoXp: 0, updatedMissions: userMissions };
    }
    target.isClaimed = true;
    if (this.usersById.has(userId)) this.saveMissionsRows(userId, userMissions);
    const { profile } = this.grantRewards(userId, { stars: target.rewardStars, xp: target.rewardXP, evoXp: target.rewardEvoXP });
    return { success: true, stars: target.rewardStars, xp: target.rewardXP, evoXp: target.rewardEvoXP, updatedMissions: userMissions, profile };
  }

  // ------------------------------------------------------------- progression
  public grantRewards(userId: string, r: { stars?: number; xp?: number; evoXp?: number }): { profile?: PlayerProfile; levelsGained: number } {
    const profile = this.getProfile(userId);
    if (!profile) return { levelsGained: 0 };

    const evoXp = profile.evolutionXp + (r.evoXp || 0);
    const leveled = ProgressionService.applyXp(profile.level, profile.xp, r.xp || 0);
    const unlocked = ProgressionService.unlockedEvolutions(leveled.level, evoXp, profile.prestige);
    const merged = Array.from(new Set([...profile.unlockedEvolutions, ...unlocked])) as PlayerProfile['unlockedEvolutions'];

    const updated = this.updateProfile(userId, {
      stars: profile.stars + (r.stars || 0),
      xp: leveled.xp,
      level: leveled.level,
      evolutionXp: evoXp,
      unlockedEvolutions: merged,
    });
    return { profile: updated, levelsGained: leveled.levelsGained };
  }

  public equipEvolution(userId: string, evolution: Evolution): { success: boolean; message: string; profile?: PlayerProfile } {
    const profile = this.getProfile(userId);
    if (!profile) return { success: false, message: 'No profile' };
    if (!profile.unlockedEvolutions.includes(evolution)) return { success: false, message: `${evolution} not unlocked yet` };
    return { success: true, message: `Now playing as ${evolution}`, profile: this.updateProfile(userId, { equippedEvolution: evolution }) };
  }

  public prestige(userId: string): { success: boolean; message: string; profile?: PlayerProfile } {
    const profile = this.getProfile(userId);
    if (!profile) return { success: false, message: 'No profile' };
    if (profile.level < 1000) return { success: false, message: 'Reach Level 1000 to Prestige' };
    const prestige = profile.prestige + 1;
    const unlocked = ProgressionService.unlockedEvolutions(1000, profile.evolutionXp, prestige);
    const merged = Array.from(new Set([...profile.unlockedEvolutions, ...unlocked])) as PlayerProfile['unlockedEvolutions'];
    const updated = this.updateProfile(userId, {
      level: 1, xp: 0, prestige, tickets: profile.tickets + 10, stars: profile.stars + 5000, unlockedEvolutions: merged,
    });
    return { success: true, message: `Prestige ${prestige} unlocked! Kept all skins & evolutions.`, profile: updated };
  }

  // ------------------------------------------------------------- audit & anticheat logs
  public recordAuditLog(log: AntiCheatViolation) {
    const ts = typeof log.timestamp === 'number' ? new Date(log.timestamp).toISOString() : String(log.timestamp || new Date().toISOString());
    this.conn.prepare(
      'INSERT INTO anti_cheat_logs (user_id, rule, severity, details, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(log.userId, log.rule || log.type || 'violation', log.severity, log.details, ts);
  }

  public getAuditLogs(limit = 200): AntiCheatViolation[] {
    const rows = this.conn.prepare('SELECT * FROM anti_cheat_logs ORDER BY id DESC LIMIT ?').all(limit);
    return rows.map((r: any) => ({
      userId: r.user_id,
      timestamp: r.created_at,
      rule: r.rule,
      severity: r.severity,
      details: r.details,
    }));
  }

  public recordAdminAuditLog(entry: Omit<AdminAuditLog, 'id' | 'createdAt'>) {
    const id = `adm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    this.conn.prepare(`
      INSERT INTO admin_audit_logs (id, admin_id, admin_username, action, target_type, target_id, details_json, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, entry.adminId, entry.adminUsername || '', entry.action,
      entry.targetType || null, entry.targetId || null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ip || null, now
    );
  }

  public getAdminAuditLogs(limit = 100): AdminAuditLog[] {
    const rows = this.conn.prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map((r: any) => ({
      id: r.id,
      adminId: r.admin_id,
      adminUsername: r.admin_username,
      action: r.action,
      targetType: r.target_type || undefined,
      targetId: r.target_id || undefined,
      details: r.details_json ? JSON.parse(r.details_json) : undefined,
      ip: r.ip || undefined,
      createdAt: r.created_at,
    }));
  }

  // ------------------------------------------------------------- leaderboard
  public updateLeaderboard(userId: string, displayName: string, score: number, won: boolean) {
    const existing = this.conn.prepare('SELECT score, wins FROM leaderboard WHERE user_id = ?').get(userId) as any;
    const newScore = Math.max(existing?.score || 0, Math.round(score));
    const newWins = (existing?.wins || 0) + (won ? 1 : 0);
    this.conn.prepare(
      'INSERT OR REPLACE INTO leaderboard (user_id, display_name, score, wins, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, displayName, newScore, newWins, new Date().toISOString());
  }

  public getLeaderboard(): Array<{ rank: number; userId: string; displayName: string; score: number; wins: number }> {
    const rows = this.conn.prepare('SELECT user_id, display_name, score, wins FROM leaderboard ORDER BY score DESC LIMIT 100').all();
    return rows.map((r: any, index: number) => ({
      rank: index + 1, userId: r.user_id, displayName: r.display_name, score: r.score, wins: r.wins,
    }));
  }

  public getCategoryLeaderboard(
    category: string,
    limit = 50,
    filter?: { userIds?: string[]; region?: string }
  ): Array<{ rank: number; userId: string; displayName: string; avatar: string; level: number; value: number }> {
    const metricOf: Record<string, (p: PlayerProfile) => number> = {
      level: p => p.level * 1_000_000 + p.prestige * 1000 + p.xp / 1000,
      score: p => p.stats.highestScore,
      kills: p => p.stats.totalKills,
      wins: p => p.stats.matchesWon,
      survival: p => p.stats.longestSurvivalSeconds,
      stars: p => p.stats.totalStars,
      explorer: p => (p.explorer?.kingdomsDone?.length || p.modeStats?.explorer?.chaptersCompleted || 0) * 1000 + (p.modeStats?.explorer?.highestScore || 0) / 1000,
    };
    const metric = metricOf[category] || metricOf.score;
    let entries = Array.from(this.profiles.values()).filter(p => {
      const u = this.getUserById(p.userId);
      return !u || u.status === 'active';
    });
    if (filter?.userIds) { const set = new Set(filter.userIds); entries = entries.filter(p => set.has(p.userId)); }
    if (filter?.region) entries = entries.filter(p => (p.preferredRegion || p.country) === filter.region);
    return entries
      .map(p => ({ userId: p.userId, displayName: p.displayName, avatar: p.avatar || '🐍', level: p.level, value: Math.round(metric(p)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map((e, i) => ({ rank: i + 1, ...e }));
  }

  // ------------------------------------------------------------- coupons
  private rowToCoupon(r: any): CouponDefinition {
    let regions: string[] | 'all' = 'all';
    try { regions = JSON.parse(r.regions_json); } catch { regions = 'all'; }
    return {
      id: r.id, title: r.title, storeName: r.store_name, discountText: r.discount_text, icon: r.icon,
      enabled: !!r.enabled, expiryDate: r.expiry_date, regions, minLevel: r.min_level, minPrestige: r.min_prestige,
      costStars: r.cost_stars, redemptionLimit: r.redemption_limit, perUserLimit: r.per_user_limit,
      redemptionCount: r.redemption_count, autoGrant: !!r.auto_grant, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  private upsertCouponRow(def: CouponDefinition) {
    this.conn.prepare(`
      INSERT OR REPLACE INTO coupon_definitions (
        id, title, store_name, discount_text, icon, enabled, expiry_date, regions_json,
        min_level, min_prestige, cost_stars, redemption_limit, per_user_limit,
        redemption_count, auto_grant, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      def.id, def.title, def.storeName, def.discountText, def.icon, def.enabled ? 1 : 0,
      def.expiryDate, JSON.stringify(def.regions ?? 'all'), def.minLevel, def.minPrestige,
      def.costStars, def.redemptionLimit, def.perUserLimit, def.redemptionCount,
      def.autoGrant ? 1 : 0, def.createdAt, def.updatedAt
    );
  }

  public listCouponDefs(): CouponDefinition[] {
    return this.conn.prepare('SELECT * FROM coupon_definitions ORDER BY created_at DESC').all().map(r => this.rowToCoupon(r));
  }
  public getCouponDef(id: string): CouponDefinition | undefined {
    const r = this.conn.prepare('SELECT * FROM coupon_definitions WHERE id = ?').get(id);
    return r ? this.rowToCoupon(r) : undefined;
  }
  public upsertCouponDef(def: CouponDefinition): CouponDefinition { this.upsertCouponRow(def); return def; }
  public deleteCouponDef(id: string): boolean {
    const res = this.conn.prepare('DELETE FROM coupon_definitions WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  public recordCouponRedemption(r: CouponRedemption) {
    this.conn.prepare(
      'INSERT INTO coupon_redemptions (definition_id, user_id, voucher_id, promo_code, redeemed_at) VALUES (?, ?, ?, ?, ?)'
    ).run(r.definitionId, r.userId, r.voucherId, r.promoCode, r.redeemedAt);
  }
  public getCouponRedemptions(definitionId?: string): CouponRedemption[] {
    const rows = definitionId
      ? this.conn.prepare('SELECT * FROM coupon_redemptions WHERE definition_id = ? ORDER BY id DESC LIMIT 1000').all(definitionId)
      : this.conn.prepare('SELECT * FROM coupon_redemptions ORDER BY id DESC LIMIT 1000').all();
    return rows.map((r: any) => ({
      definitionId: r.definition_id, userId: r.user_id, voucherId: r.voucher_id, promoCode: r.promo_code, redeemedAt: r.redeemed_at,
    }));
  }
  public countUserCouponRedemptions(definitionId: string, userId: string): number {
    const row = this.conn.prepare(
      'SELECT COUNT(*) AS cnt FROM coupon_redemptions WHERE definition_id = ? AND user_id = ?'
    ).get(definitionId, userId) as { cnt: number };
    return row.cnt;
  }

  // ------------------------------------------------------------- rewards catalog (durable DB stock)
  private rowToReward(r: any): RewardCatalogRow {
    let regions: string[] | 'all' = 'all';
    try { regions = JSON.parse(r.regions_json); } catch { regions = 'all'; }
    return {
      id: r.id, title: r.title, category: r.category, icon: r.icon,
      baseStarCost: r.base_star_cost, regions, stock: r.stock, minLevel: r.min_level,
      provider: r.provider, description: r.description, enabled: !!r.enabled, updatedAt: r.updated_at,
    };
  }

  public listRewardsCatalog(includeDisabled = false): RewardCatalogRow[] {
    const rows = includeDisabled
      ? this.conn.prepare('SELECT * FROM rewards_catalog ORDER BY base_star_cost ASC').all()
      : this.conn.prepare('SELECT * FROM rewards_catalog WHERE enabled = 1 ORDER BY base_star_cost ASC').all();
    return rows.map(r => this.rowToReward(r));
  }

  public getRewardItem(id: string): RewardCatalogRow | undefined {
    const r = this.conn.prepare('SELECT * FROM rewards_catalog WHERE id = ?').get(id);
    return r ? this.rowToReward(r) : undefined;
  }

  public upsertRewardItem(item: RewardCatalogRow) {
    this.conn.prepare(`
      INSERT OR REPLACE INTO rewards_catalog (
        id, title, category, icon, base_star_cost, regions_json, stock, min_level, provider, description, enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id, item.title, item.category, item.icon, item.baseStarCost,
      JSON.stringify(item.regions), item.stock, item.minLevel, item.provider,
      item.description, item.enabled ? 1 : 0, item.updatedAt
    );
  }

  public decrementRewardStock(id: string): boolean {
    const res = this.conn.prepare(
      'UPDATE rewards_catalog SET stock = stock - 1, updated_at = ? WHERE id = ? AND stock > 0'
    ).run(new Date().toISOString(), id);
    return Number(res.changes) > 0;
  }

  // ------------------------------------------------------------- match history
  private insertMatchRow(userId: string, r: MatchRecord & { roomId?: string; abandoned?: boolean }) {
    this.conn.prepare(`
      INSERT OR REPLACE INTO match_history (
        id, user_id, mode, room_id, duration_seconds, score, kills, deaths, assists,
        highest_combo, food_collected, stars, xp, evo_xp, rank, rewards, map, result, abandoned, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      r.id, userId, r.mode, r.roomId || null, r.durationSeconds, r.score, r.kills, r.deaths, r.assists,
      r.highestCombo, r.foodCollected, r.stars, r.xp, r.evoXp, r.rank ?? null, r.rewards || null,
      r.map || null, r.result, r.abandoned ? 1 : 0, r.at
    );
  }

  public addMatchRecord(userId: string, record: MatchRecord & { roomId?: string; abandoned?: boolean }) {
    this.insertMatchRow(userId, record);
  }

  public getMatchHistory(userId: string, limit = 25): MatchRecord[] {
    const rows = this.conn.prepare(
      'SELECT * FROM match_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(userId, limit);
    return rows.map((r: any) => ({
      id: r.id, at: r.created_at, mode: r.mode, durationSeconds: r.duration_seconds,
      score: r.score, kills: r.kills, deaths: r.deaths, assists: r.assists,
      highestCombo: r.highest_combo, foodCollected: r.food_collected,
      stars: r.stars, xp: r.xp, evoXp: r.evo_xp,
      rank: r.rank ?? undefined, rewards: r.rewards || undefined, map: r.map || undefined,
      result: r.result,
    }));
  }

  // ------------------------------------------------------------- social graph
  private saveSocialRow(userId: string, g: SocialGraph) {
    this.conn.prepare(`
      INSERT OR REPLACE INTO social_graphs (user_id, friends_json, incoming_json, outgoing_json, blocked_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId, JSON.stringify(g.friends), JSON.stringify(g.incoming), JSON.stringify(g.outgoing), JSON.stringify(g.blocked)
    );
  }

  public getSocial(userId: string): SocialGraph {
    let g = this.socialCache.get(userId);
    if (!g) {
      const r = this.conn.prepare('SELECT * FROM social_graphs WHERE user_id = ?').get(userId) as any;
      if (r) {
        g = {
          friends: JSON.parse(r.friends_json || '[]'),
          incoming: JSON.parse(r.incoming_json || '[]'),
          outgoing: JSON.parse(r.outgoing_json || '[]'),
          blocked: JSON.parse(r.blocked_json || '[]'),
        };
      } else {
        g = { friends: [], incoming: [], outgoing: [], blocked: [] };
        if (this.usersById.has(userId)) this.saveSocialRow(userId, g);
      }
      this.socialCache.set(userId, g);
    }
    return g;
  }

  public saveSocial() {
    for (const [userId, g] of this.socialCache) {
      if (this.usersById.has(userId)) this.saveSocialRow(userId, g);
    }
  }

  // ------------------------------------------------------------- match invites
  private static readonly INVITE_TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly MAX_INVITES_PER_USER = 20;

  private saveInvitesRows(userId: string, list: MatchInvite[]) {
    this.conn.prepare('DELETE FROM match_invites WHERE to_user_id = ?').run(userId);
    const stmt = this.conn.prepare(`
      INSERT INTO match_invites (id, from_user_id, from_name, from_avatar, to_user_id, mode, room_id, created_at, expires_at, delivered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const i of list) {
      stmt.run(i.id, i.fromUserId, i.fromName, i.fromAvatar, i.toUserId, i.mode, (i as any).roomId || null, i.createdAt, i.expiresAt, i.deliveredAt ?? null);
    }
  }

  public addMatchInvite(invite: Omit<MatchInvite, 'id' | 'createdAt' | 'expiresAt'> & { roomId?: string }): MatchInvite {
    const list = this.getMatchInvites(invite.toUserId);
    const existing = list.findIndex(i => i.fromUserId === invite.fromUserId);
    if (existing >= 0) list.splice(existing, 1);

    const now = Date.now();
    const full: MatchInvite & { roomId?: string } = {
      ...invite,
      id: `inv_${now}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      expiresAt: now + Database.INVITE_TTL_MS,
    };
    list.unshift(full);
    const trimmed = list.slice(0, Database.MAX_INVITES_PER_USER);
    this.invitesCache.set(invite.toUserId, trimmed);
    this.saveInvitesRows(invite.toUserId, trimmed);
    return full;
  }

  public getMatchInvites(userId: string): MatchInvite[] {
    let list = this.invitesCache.get(userId);
    if (!list) {
      const rows = this.conn.prepare('SELECT * FROM match_invites WHERE to_user_id = ? ORDER BY created_at DESC').all(userId);
      list = rows.map((r: any) => ({
        id: r.id, fromUserId: r.from_user_id, fromName: r.from_name, fromAvatar: r.from_avatar,
        toUserId: r.to_user_id, mode: r.mode, roomId: r.room_id || undefined,
        createdAt: r.created_at, expiresAt: r.expires_at, deliveredAt: r.delivered_at ?? undefined,
      }));
      this.invitesCache.set(userId, list);
    }
    const now = Date.now();
    const live = list.filter(i => i.expiresAt > now);
    if (live.length !== list.length) {
      this.invitesCache.set(userId, live);
      this.saveInvitesRows(userId, live);
    }
    return live;
  }

  public getMatchInvite(userId: string, inviteId: string): MatchInvite | undefined {
    return this.getMatchInvites(userId).find(i => i.id === inviteId);
  }

  public removeMatchInvite(userId: string, inviteId: string): boolean {
    const list = this.getMatchInvites(userId);
    const next = list.filter(i => i.id !== inviteId);
    if (next.length === list.length) return false;
    this.invitesCache.set(userId, next);
    this.saveInvitesRows(userId, next);
    return true;
  }

  public markInvitesDelivered(userId: string): MatchInvite[] {
    const live = this.getMatchInvites(userId);
    if (!live.length) return live;
    const now = Date.now();
    for (const i of live) if (!i.deliveredAt) i.deliveredAt = now;
    this.saveInvitesRows(userId, live);
    return live;
  }
}

export const db = new Database();
