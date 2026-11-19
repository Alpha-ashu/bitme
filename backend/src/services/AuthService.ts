import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from '../db/Database';
import { AnalyticsService } from './AnalyticsService';
import { UserRole, UserStatus } from '../types';

// Never ship the fallback secret to production — anyone knowing it can forge tokens.
const DEV_FALLBACK_SECRET = 'anaconda_park_dev_only_secret_change_me';
const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_FALLBACK_SECRET) {
  throw new Error('[security] JWT_SECRET must be set in production — refusing to boot with the dev fallback secret.');
}
if (JWT_SECRET === DEV_FALLBACK_SECRET) {
  console.warn('[security] Using the development JWT secret. Set JWT_SECRET before deploying.');
}

// §5 Username rules — reserved handles + a small profanity guard (extend as needed).
const RESERVED_NAMES = new Set(['admin', 'administrator', 'root', 'system', 'moderator', 'mod', 'staff', 'support', 'anacondapark', 'anaconda', 'official', 'server', 'null', 'undefined', 'guest', 'player', 'you']);
const PROFANITY = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'asshole', 'dick', 'porn', 'rape'];

export interface VerifiedToken {
  userId: string;
  username: string;
  isGuest: boolean;
  role: UserRole;
  sessionId?: string;
}

export class AuthService {
  // §5 Validate a username against the rules (length, charset, reserved, profanity).
  public static validateUsername(name: string): { ok: boolean; reason?: string } {
    const n = (name || '').trim();
    if (n.length < 3) return { ok: false, reason: 'At least 3 characters' };
    if (n.length > 16) return { ok: false, reason: 'At most 16 characters' };
    if (!/^[A-Za-z0-9_]+$/.test(n)) return { ok: false, reason: 'Use letters, numbers and _ only' };
    const lower = n.toLowerCase();
    if (RESERVED_NAMES.has(lower)) return { ok: false, reason: 'This name is reserved' };
    if (PROFANITY.some(w => lower.includes(w))) return { ok: false, reason: 'Please choose a friendlier name' };
    return { ok: true };
  }

  // §5 Availability = valid AND not already taken. Suggests alternatives when taken.
  public static checkUsername(name: string): { available: boolean; reason?: string; suggestions?: string[] } {
    const v = this.validateUsername(name);
    if (!v.ok) return { available: false, reason: v.reason, suggestions: this.suggestUsernames(name) };
    if (db.getUserByUsername(name.trim())) return { available: false, reason: 'Username already taken', suggestions: this.suggestUsernames(name) };
    return { available: true };
  }

  public static suggestUsernames(name: string): string[] {
    const base = (name || 'Snake').replace(/[^A-Za-z0-9_]/g, '').slice(0, 12) || 'Snake';
    const cands = [`${base}_${Math.floor(10 + Math.random() * 89)}`, `${base}_Play`, `${base}_Pro`, `${base}_${Math.floor(100 + Math.random() * 899)}`, `${base}X`];
    return cands.filter(c => this.validateUsername(c).ok && !db.getUserByUsername(c)).slice(0, 3);
  }

  private static issueSessionToken(
    user: { id: string; username: string; isGuest: boolean; role: UserRole },
    ttlSeconds: number,
    meta?: { ip?: string; userAgent?: string }
  ): string {
    const sessionId = `ses_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    db.createAuthSession({
      id: sessionId,
      userId: user.id,
      role: user.role,
      createdAt: now.toISOString(),
      expiresAt,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return jwt.sign(
      { userId: user.id, username: user.username, isGuest: user.isGuest, role: user.role, jti: sessionId },
      JWT_SECRET,
      { expiresIn: ttlSeconds }
    );
  }

  // §5 Create a named guest during first-time onboarding (unique username enforced).
  public static onboardGuest(
    name: string,
    country?: string,
    language?: string,
    meta?: { ip?: string; userAgent?: string }
  ): { token: string; user: any; profile: any } | { error: string; suggestions?: string[] } {
    const check = this.checkUsername(name);
    if (!check.available) return { error: check.reason || 'Username unavailable', suggestions: check.suggestions };
    const clean = name.trim();
    const { user } = db.createUser(clean, `${clean.toLowerCase()}@guest.local`, '', true, 'player');
    db.updateProfile(user.id, { country, language } as any);
    const token = this.issueSessionToken(user, 30 * 86400, meta);
    AnalyticsService.track({ eventType: 'user_register', userId: user.id, metadata: { isGuest: true, country, language } });
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, isGuest: user.isGuest, role: user.role },
      profile: db.getProfile(user.id),
    };
  }

  public static async login(
    username: string,
    password: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ token: string; user: any; profile: any } | { error: string }> {
    const user = db.getUserByUsername(username);
    if (!user || user.isGuest || !user.passwordHash) {
      return { error: 'Invalid username or password' };
    }
    if (user.role !== 'player') {
      return { error: 'Administrative accounts must sign in via the Admin Portal' };
    }
    if (user.status !== 'active') {
      return { error: 'This account has been suspended or disabled' };
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return { error: 'Invalid username or password' };
    }

    const nowIso = new Date().toISOString();
    db.updateUserRoleStatus(user.id, { lastLoginAt: nowIso, lastActiveAt: nowIso });
    const profile = db.getProfile(user.id);
    const token = this.issueSessionToken(user, 24 * 3600, meta);
    AnalyticsService.track({ eventType: 'user_login', userId: user.id });

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, isGuest: false, role: user.role },
      profile,
    };
  }

  public static async register(
    username: string,
    email: string,
    passwordPlain: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ token: string; user: any; profile: any } | { error: string }> {
    const valid = this.validateUsername(username);
    if (!valid.ok) {
      return { error: valid.reason || 'Invalid username' };
    }
    if (db.getUserByUsername(username.trim())) {
      return { error: 'Username is already taken' };
    }
    if (!passwordPlain || passwordPlain.length < 4) {
      return { error: 'Password must be at least 4 characters' };
    }

    const cleanName = username.trim();
    const hash = await bcrypt.hash(passwordPlain, 10);
    const { user, profile } = db.createUser(cleanName, (email || '').trim(), hash, false, 'player');
    const nowIso = new Date().toISOString();
    db.updateUserRoleStatus(user.id, { lastLoginAt: nowIso, lastActiveAt: nowIso });

    const token = this.issueSessionToken(user, 24 * 3600, meta);
    AnalyticsService.track({ eventType: 'user_register', userId: user.id, metadata: { isGuest: false } });

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, isGuest: false, role: user.role },
      profile,
    };
  }

  public static createGuestAccount(meta?: { ip?: string; userAgent?: string }): { token: string; user: any; profile: any } {
    let guestName = `Explorer_${Math.floor(1000 + Math.random() * 9000)}`;
    let guard = 0;
    while (db.getUserByUsername(guestName) && guard < 10) {
      guestName = `Explorer_${Math.floor(1000 + Math.random() * 89999)}`;
      guard++;
    }
    const { user, profile } = db.createUser(guestName, `${guestName.toLowerCase()}@guest.local`, '', true, 'player');
    const token = this.issueSessionToken(user, 30 * 86400, meta);
    AnalyticsService.track({ eventType: 'user_register', userId: user.id, metadata: { isGuest: true } });

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, isGuest: true, role: user.role },
      profile,
    };
  }

  public static async upgradeGuest(
    userId: string,
    username: string,
    email: string,
    passwordPlain: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ token: string; user: any; profile: any } | { error: string }> {
    const existing = db.getUserById(userId);
    if (!existing) return { error: 'Account not found' };
    if (!existing.isGuest) return { error: 'Account is already registered' };

    const cleanName = (username || '').trim();
    const valid = this.validateUsername(cleanName);
    if (!valid.ok) return { error: valid.reason || 'Invalid username' };

    const conflict = db.getUserByUsername(cleanName);
    if (conflict && conflict.id !== userId) {
      return { error: 'Username is already taken' };
    }
    if (!passwordPlain || passwordPlain.length < 6) {
      return { error: 'Password must be at least 6 characters' };
    }

    const hash = await bcrypt.hash(passwordPlain, 10);
    const updated = db.upgradeUserAccount(userId, cleanName, (email || '').trim(), hash);
    if (!updated) return { error: 'Upgrade failed' };

    db.revokeAllUserSessions(userId);
    const nowIso = new Date().toISOString();
    db.updateUserRoleStatus(userId, { lastLoginAt: nowIso, lastActiveAt: nowIso });
    const token = this.issueSessionToken(updated, 24 * 3600, meta);
    AnalyticsService.track({ eventType: 'user_upgrade', userId });

    return {
      token,
      user: { id: updated.id, username: updated.username, email: updated.email, isGuest: false, role: updated.role },
      profile: db.getProfile(userId),
    };
  }

  /** Dedicated Admin & Super-Admin authentication. Never allows player or guest logins. */
  public static async loginAdmin(
    username: string,
    password: string,
    meta?: { ip?: string; userAgent?: string }
  ): Promise<{ token: string; user: { id: string; username: string; email: string; role: UserRole } } | { error: string }> {
    const user = db.getUserByUsername(username);
    if (!user || !user.passwordHash || (user.role !== 'admin' && user.role !== 'super_admin')) {
      db.recordAdminAuditLog({
        adminId: user?.id || 'anonymous',
        adminUsername: String(username || '').slice(0, 32),
        action: 'admin_login_failed',
        details: { reason: 'not_admin_or_missing' },
        ip: meta?.ip,
      });
      return { error: 'Invalid administrator credentials' };
    }
    if (user.status !== 'active') {
      return { error: 'Administrator account is suspended or disabled' };
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      db.recordAdminAuditLog({
        adminId: user.id,
        adminUsername: user.username,
        action: 'admin_login_failed',
        details: { reason: 'wrong_password' },
        ip: meta?.ip,
      });
      return { error: 'Invalid administrator credentials' };
    }

    const nowIso = new Date().toISOString();
    db.updateUserRoleStatus(user.id, { lastLoginAt: nowIso, lastActiveAt: nowIso });
    const token = this.issueSessionToken(user, 12 * 3600, meta);
    db.recordAdminAuditLog({
      adminId: user.id,
      adminUsername: user.username,
      action: 'admin_login_success',
      ip: meta?.ip,
    });

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    };
  }

  /** Provision an additional admin account. Restricted strictly to super_admin callers. */
  public static async createAdminAccount(
    actorAdminId: string,
    username: string,
    email: string,
    passwordPlain: string,
    role: 'admin' | 'super_admin' = 'admin',
    ip?: string
  ): Promise<{ user: { id: string; username: string; email: string; role: UserRole; status: UserStatus; createdAt: string } } | { error: string }> {
    const actor = db.getUserById(actorAdminId);
    if (!actor || actor.role !== 'super_admin' || actor.status !== 'active') {
      return { error: 'Only an active super_admin can provision admin accounts' };
    }
    const clean = (username || '').trim();
    if (clean.length < 3 || clean.length > 24 || !/^[A-Za-z0-9_]+$/.test(clean)) {
      return { error: 'Admin username must be 3-24 alphanumeric/underscore characters' };
    }
    if (db.getUserByUsername(clean)) {
      return { error: 'Username is already taken' };
    }
    if (!passwordPlain || passwordPlain.length < 8) {
      return { error: 'Admin password must be at least 8 characters' };
    }

    const hash = await bcrypt.hash(passwordPlain, 12);
    const { user } = db.createUser(clean, (email || '').trim(), hash, false, role);
    db.recordAdminAuditLog({
      adminId: actor.id,
      adminUsername: actor.username,
      action: 'admin_account_created',
      targetType: 'user',
      targetId: user.id,
      details: { createdUsername: user.username, role },
      ip,
    });
    return {
      user: { id: user.id, username: user.username, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt },
    };
  }

  public static setUserStatus(
    actorAdminId: string,
    targetUserId: string,
    status: UserStatus,
    ip?: string
  ): { ok: boolean; error?: string; user?: any } {
    const actor = db.getUserById(actorAdminId);
    if (!actor || (actor.role !== 'admin' && actor.role !== 'super_admin') || actor.status !== 'active') {
      return { ok: false, error: 'Unauthorized' };
    }
    const target = db.getUserById(targetUserId);
    if (!target) return { ok: false, error: 'User not found' };
    if (target.id === actor.id) return { ok: false, error: 'Cannot suspend or disable your own account' };
    if (target.role === 'super_admin' && actor.role !== 'super_admin') {
      return { ok: false, error: 'Only super_admin can modify another super_admin' };
    }

    const updated = db.updateUserRoleStatus(targetUserId, { status });
    if (status !== 'active') {
      db.revokeAllUserSessions(targetUserId);
    }
    db.recordAdminAuditLog({
      adminId: actor.id,
      adminUsername: actor.username,
      action: `user_status_${status}`,
      targetType: 'user',
      targetId: targetUserId,
      details: { username: target.username, status },
      ip,
    });
    return {
      ok: true,
      user: updated ? { id: updated.id, username: updated.username, role: updated.role, status: updated.status } : undefined,
    };
  }

  public static logout(sessionId?: string, userId?: string) {
    if (sessionId) db.revokeSession(sessionId);
    if (userId) AnalyticsService.track({ eventType: 'user_logout', userId, sessionId });
  }

  public static verifyToken(token: string): VerifiedToken | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded?.userId) return null;
      const user = db.getUserById(decoded.userId);
      if (!user || user.status !== 'active') return null;
      if (decoded.jti && !db.isSessionValid(decoded.jti)) return null;
      return {
        userId: decoded.userId,
        username: user.username || decoded.username,
        isGuest: !!user.isGuest,
        role: user.role,
        sessionId: decoded.jti,
      };
    } catch {
      return null;
    }
  }
}
