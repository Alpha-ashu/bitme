import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '../db/Database';
import { AdPlacement, Advertisement } from '../types';

export const VALID_AD_PLACEMENTS: ReadonlyArray<AdPlacement> = [
  'home_screen',
  'between_sessions',
  'game_over',
  'story_menu',
  'rewarded_opt_in',
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;  // 5 MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20 MB

export interface ValidatedUpload {
  mediaType: 'image' | 'video';
  ext: string;
  mimeType: string;
}

export class AdManagerService {
  public static getUploadDir(): string {
    const dir = process.env.AD_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'ads');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /** Detect image/video format via file magic bytes and enforce strict size limits. */
  public static validateCreativeBuffer(buf: Buffer): { ok: true; info: ValidatedUpload } | { ok: false; error: string } {
    if (!buf || !Buffer.isBuffer(buf) || buf.length < 12) {
      return { ok: false, error: 'Uploaded file is empty or corrupted' };
    }

    let info: ValidatedUpload | null = null;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
      info = { mediaType: 'image', ext: '.png', mimeType: 'image/png' };
    } else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      info = { mediaType: 'image', ext: '.jpg', mimeType: 'image/jpeg' };
    } else if (buf.slice(0, 4).toString('ascii') === 'GIF8') {
      info = { mediaType: 'image', ext: '.gif', mimeType: 'image/gif' };
    } else if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
      info = { mediaType: 'image', ext: '.webp', mimeType: 'image/webp' };
    } else if (buf.slice(4, 8).toString('ascii') === 'ftyp') {
      info = { mediaType: 'video', ext: '.mp4', mimeType: 'video/mp4' };
    } else if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      info = { mediaType: 'video', ext: '.webm', mimeType: 'video/webm' };
    }

    if (!info) {
      return { ok: false, error: 'Unsupported file format. Allowed: PNG, JPG, GIF, WEBP, MP4, WEBM' };
    }

    const limit = info.mediaType === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (buf.length > limit) {
      return { ok: false, error: `File too large. Max ${info.mediaType === 'image' ? '5MB' : '20MB'} allowed.` };
    }

    return { ok: true, info };
  }

  /** Save a validated uploaded creative to local storage and return its public serving path. */
  public static saveCreativeFile(buf: Buffer): { ok: true; mediaUrl: string; mediaType: 'image' | 'video' } | { ok: false; error: string } {
    const check = this.validateCreativeBuffer(buf);
    if (!check.ok) return check;
    const filename = `ad_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${check.info.ext}`;
    const fullPath = path.join(this.getUploadDir(), filename);
    fs.writeFileSync(fullPath, buf);
    return {
      ok: true,
      mediaUrl: `/uploads/ads/${filename}`,
      mediaType: check.info.mediaType,
    };
  }

  public static isSafeUrl(url: string): boolean {
    if (!url) return true;
    const trimmed = String(url).trim();
    if (!trimmed) return true;
    if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  public static isValidPlacement(p: string): p is AdPlacement {
    return VALID_AD_PLACEMENTS.includes(p as AdPlacement);
  }

  private static rowToAd(r: any): Advertisement {
    const impressions = r.impressions ?? 0;
    const clicks = r.clicks ?? 0;
    return {
      id: r.id,
      title: r.title,
      description: r.description || '',
      mediaUrl: r.media_url,
      mediaType: r.media_type === 'video' ? 'video' : 'image',
      destinationUrl: r.destination_url || '',
      placement: r.placement as AdPlacement,
      enabled: !!r.enabled,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      impressions,
      clicks,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    };
  }

  public static listAll(): Advertisement[] {
    const rows = db.getRawDb().prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.event_type = 'impression') AS impressions,
        (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.event_type = 'click') AS clicks
      FROM advertisements a
      ORDER BY a.created_at DESC
    `).all();
    return rows.map(r => this.rowToAd(r));
  }

  public static getById(id: string): Advertisement | undefined {
    const row = db.getRawDb().prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.event_type = 'impression') AS impressions,
        (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.event_type = 'click') AS clicks
      FROM advertisements a WHERE a.id = ?
    `).get(id);
    return row ? this.rowToAd(row) : undefined;
  }

  public static create(
    actorAdmin: { id: string; username: string },
    input: {
      title: string;
      description?: string;
      mediaUrl: string;
      mediaType: 'image' | 'video';
      destinationUrl?: string;
      placement: AdPlacement;
      enabled?: boolean;
      startsAt: string;
      endsAt: string;
    },
    ip?: string
  ): { ok: true; ad: Advertisement } | { ok: false; error: string } {
    const title = String(input.title || '').trim().slice(0, 80);
    if (!title) return { ok: false, error: 'Advertisement title is required' };
    if (!input.mediaUrl || !this.isSafeUrl(input.mediaUrl)) {
      return { ok: false, error: 'Valid creative media URL or uploaded asset is required' };
    }
    if (input.destinationUrl && !this.isSafeUrl(input.destinationUrl)) {
      return { ok: false, error: 'Destination URL must use https:// or http://' };
    }
    if (!this.isValidPlacement(input.placement)) {
      return { ok: false, error: 'Invalid advertisement placement' };
    }

    const startsMs = Date.parse(input.startsAt);
    const endsMs = Date.parse(input.endsAt);
    if (Number.isNaN(startsMs) || Number.isNaN(endsMs) || endsMs <= startsMs) {
      return { ok: false, error: 'End date must be after start date' };
    }

    const id = `ad_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();
    db.getRawDb().prepare(`
      INSERT INTO advertisements (
        id, title, description, media_url, media_type, destination_url,
        placement, enabled, starts_at, ends_at, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      String(input.description || '').trim().slice(0, 300),
      input.mediaUrl.trim(),
      input.mediaType === 'video' ? 'video' : 'image',
      String(input.destinationUrl || '').trim(),
      input.placement,
      input.enabled === false ? 0 : 1,
      new Date(startsMs).toISOString(),
      new Date(endsMs).toISOString(),
      actorAdmin.id,
      now,
      now
    );

    db.recordAdminAuditLog({
      adminId: actorAdmin.id,
      adminUsername: actorAdmin.username,
      action: 'ad_created',
      targetType: 'advertisement',
      targetId: id,
      details: { title, placement: input.placement },
      ip,
    });

    return { ok: true, ad: this.getById(id)! };
  }

  public static update(
    actorAdmin: { id: string; username: string },
    adId: string,
    patch: Partial<{
      title: string;
      description: string;
      mediaUrl: string;
      mediaType: 'image' | 'video';
      destinationUrl: string;
      placement: AdPlacement;
      enabled: boolean;
      startsAt: string;
      endsAt: string;
    }>,
    ip?: string
  ): { ok: true; ad: Advertisement } | { ok: false; error: string } {
    const existing = this.getById(adId);
    if (!existing) return { ok: false, error: 'Advertisement not found' };

    const title = patch.title !== undefined ? String(patch.title).trim().slice(0, 80) : existing.title;
    if (!title) return { ok: false, error: 'Advertisement title cannot be empty' };

    const mediaUrl = patch.mediaUrl !== undefined ? String(patch.mediaUrl).trim() : existing.mediaUrl;
    if (!mediaUrl || !this.isSafeUrl(mediaUrl)) return { ok: false, error: 'Invalid media URL' };

    const destinationUrl = patch.destinationUrl !== undefined ? String(patch.destinationUrl).trim() : existing.destinationUrl;
    if (destinationUrl && !this.isSafeUrl(destinationUrl)) return { ok: false, error: 'Destination URL must use https:// or http://' };

    const placement = patch.placement !== undefined ? patch.placement : existing.placement;
    if (!this.isValidPlacement(placement)) return { ok: false, error: 'Invalid placement' };

    const startsAt = patch.startsAt !== undefined ? patch.startsAt : existing.startsAt;
    const endsAt = patch.endsAt !== undefined ? patch.endsAt : existing.endsAt;
    const startsMs = Date.parse(startsAt);
    const endsMs = Date.parse(endsAt);
    if (Number.isNaN(startsMs) || Number.isNaN(endsMs) || endsMs <= startsMs) {
      return { ok: false, error: 'End date must be after start date' };
    }

    const enabled = patch.enabled !== undefined ? patch.enabled : existing.enabled;
    const mediaType = patch.mediaType !== undefined ? (patch.mediaType === 'video' ? 'video' : 'image') : existing.mediaType;
    const description = patch.description !== undefined ? String(patch.description).trim().slice(0, 300) : existing.description;
    const now = new Date().toISOString();

    db.getRawDb().prepare(`
      UPDATE advertisements
      SET title = ?, description = ?, media_url = ?, media_type = ?, destination_url = ?,
          placement = ?, enabled = ?, starts_at = ?, ends_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title, description, mediaUrl, mediaType, destinationUrl,
      placement, enabled ? 1 : 0, new Date(startsMs).toISOString(), new Date(endsMs).toISOString(), now, adId
    );

    db.recordAdminAuditLog({
      adminId: actorAdmin.id,
      adminUsername: actorAdmin.username,
      action: 'ad_updated',
      targetType: 'advertisement',
      targetId: adId,
      details: { enabled, placement },
      ip,
    });

    return { ok: true, ad: this.getById(adId)! };
  }

  public static remove(actorAdmin: { id: string; username: string }, adId: string, ip?: string): boolean {
    const existing = this.getById(adId);
    if (!existing) return false;
    const res = db.getRawDb().prepare('DELETE FROM advertisements WHERE id = ?').run(adId);
    if (Number(res.changes) > 0) {
      if (existing.mediaUrl.startsWith('/uploads/ads/')) {
        const fname = path.basename(existing.mediaUrl);
        const fpath = path.join(this.getUploadDir(), fname);
        try { if (fs.existsSync(fpath)) fs.unlinkSync(fpath); } catch { /* ignore */ }
      }
      db.recordAdminAuditLog({
        adminId: actorAdmin.id,
        adminUsername: actorAdmin.username,
        action: 'ad_deleted',
        targetType: 'advertisement',
        targetId: adId,
        details: { title: existing.title },
        ip,
      });
      return true;
    }
    return false;
  }

  /** Serve currently enabled & scheduled ads for a specific safe UI placement. */
  public static serveForPlacement(placement: AdPlacement, nowIso = new Date().toISOString()): Advertisement[] {
    if (!this.isValidPlacement(placement)) return [];
    const rows = db.getRawDb().prepare(`
      SELECT a.*,
        (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.event_type = 'impression') AS impressions,
        (SELECT COUNT(*) FROM ad_events e WHERE e.ad_id = a.id AND e.event_type = 'click') AS clicks
      FROM advertisements a
      WHERE a.placement = ? AND a.enabled = 1 AND a.starts_at <= ? AND a.ends_at >= ?
      ORDER BY a.updated_at DESC
    `).all(placement, nowIso, nowIso);
    return rows.map(r => this.rowToAd(r));
  }

  /** Record a verified impression or click for an active ad. */
  public static trackEvent(adId: string, placement: string, eventType: 'impression' | 'click', userId?: string): boolean {
    const ad = this.getById(adId);
    if (!ad) return false;
    if (eventType !== 'impression' && eventType !== 'click') return false;
    const safePlacement = this.isValidPlacement(placement) ? placement : ad.placement;
    const id = `adev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    db.getRawDb().prepare(`
      INSERT INTO ad_events (id, ad_id, user_id, placement, event_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, adId, userId || null, safePlacement, eventType, new Date().toISOString());
    return true;
  }

  /** Issue a signed, single-use reward watch token before claiming a rewarded ad bonus. */
  public static issueRewardToken(userId: string, adId?: string): { tokenId: string; minWatchMs: number; expiresAt: number } {
    const tokenId = `adt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 5 * 60 * 1000;
    const minWatchMs = Math.max(0, Number(process.env.AD_REWARD_MIN_MS ?? 4000));
    db.getRawDb().prepare(`
      INSERT INTO ad_reward_tokens (id, user_id, ad_id, issued_at, expires_at, consumed_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(tokenId, userId, adId || null, issuedAt, expiresAt);
    return { tokenId, minWatchMs, expiresAt };
  }

  /** Verify & atomically consume a rewarded ad watch token. */
  public static consumeRewardToken(userId: string, tokenId: string): { ok: true; adId?: string } | { ok: false; error: string } {
    if (!tokenId) return { ok: false, error: 'Missing rewarded ad verification token' };
    const conn = db.getRawDb();
    const row = conn.prepare('SELECT * FROM ad_reward_tokens WHERE id = ? AND user_id = ?').get(tokenId, userId) as any;
    if (!row) return { ok: false, error: 'Invalid rewarded ad token' };
    if (row.consumed_at) return { ok: false, error: 'Reward token already redeemed' };
    const now = Date.now();
    if (now > row.expires_at) return { ok: false, error: 'Reward token expired' };
    const minWatchMs = Math.max(0, Number(process.env.AD_REWARD_MIN_MS ?? 4000));
    if (now - row.issued_at < minWatchMs) {
      return { ok: false, error: 'Please finish watching the advertisement before claiming' };
    }
    const upd = conn.prepare('UPDATE ad_reward_tokens SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL').run(now, tokenId);
    if (Number(upd.changes) === 0) return { ok: false, error: 'Reward token already redeemed' };
    return { ok: true, adId: row.ad_id || undefined };
  }
}

