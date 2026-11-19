import { GameMode, LobbyRoomInfo, LobbyRoomMember } from '../types';
import { GameSessionService } from './GameSessionService';
import { AnalyticsService } from './AnalyticsService';

interface ManagedRoom {
  roomId: string;
  mode: GameMode;
  roomCode?: string;
  region: string;
  kingdom: number;
  maxPlayers: number;
  isPrivate: boolean;
  isCustom: boolean;
  hostUserId?: string;
  hostName?: string;
  mapTheme: string;
  durationSeconds: number;
  aiBackfill: boolean;
  stageStatus: 'lobby' | 'open';
  members: Map<string, LobbyRoomMember>;
  invitedUserIds: Set<string>;
  createdAt: string;
  lastActiveAt: number;
  session: GameSessionService;
}

export class GameSessionManager {
  private rooms: Map<string, ManagedRoom> = new Map();
  private primaryByKey: Map<string, string> = new Map(); // `${mode}:${kingdom}` -> roomId
  private codeToRoomId: Map<string, string> = new Map();
  private onBossDefeat?: (winnerUserId: string, bossId: string) => void;

  public setBossDefeatHandler(cb: (winnerUserId: string, bossId: string) => void) {
    this.onBossDefeat = cb;
    for (const r of this.rooms.values()) {
      r.session.setOnBossDefeat(cb);
    }
  }

  private createRoomInternal(opts: {
    mode: GameMode;
    region?: string;
    kingdom?: number;
    maxPlayers?: number;
    isPrivate?: boolean;
    isCustom?: boolean;
    hostUserId?: string;
    hostName?: string;
    withCode?: boolean;
    backfillCount?: number;
    mapTheme?: string;
    durationSeconds?: number;
    aiBackfill?: boolean;
    stageInLobby?: boolean;
  }): ManagedRoom {
    const kingdom = Math.max(1, Math.min(10, opts.kingdom || 1));
    const roomId = `room_${opts.mode}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let roomCode: string | undefined;
    if (opts.withCode || opts.isCustom) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 20; attempt++) {
        let c = '';
        for (let i = 0; i < 6; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
        if (!this.codeToRoomId.has(c)) { roomCode = c; break; }
      }
      if (roomCode) this.codeToRoomId.set(roomCode, roomId);
    }

    const session = new GameSessionService(roomId, opts.mode, {
      kingdom,
      region: opts.region || 'Global',
      onBossDefeat: this.onBossDefeat,
    });
    if (opts.backfillCount && opts.backfillCount > 0 && !opts.stageInLobby) {
      session.backfillBots(opts.backfillCount);
    }

    const members = new Map<string, LobbyRoomMember>();
    if (opts.hostUserId) {
      members.set(opts.hostUserId, {
        userId: opts.hostUserId,
        displayName: opts.hostName || 'Host',
        ready: true,
        team: opts.mode === 'team' ? 'blue' : undefined,
        isHost: true,
      });
    }

    const room: ManagedRoom = {
      roomId,
      mode: opts.mode,
      roomCode,
      region: opts.region || 'Global',
      kingdom,
      maxPlayers: Math.max(2, Math.min(24, opts.maxPlayers || (opts.mode === 'boss' ? 1 : 24))),
      isPrivate: !!opts.isPrivate,
      isCustom: !!opts.isCustom,
      hostUserId: opts.hostUserId,
      hostName: opts.hostName,
      mapTheme: opts.mapTheme || 'forest',
      durationSeconds: Math.max(60, Math.min(600, opts.durationSeconds || 180)),
      aiBackfill: opts.aiBackfill ?? !!(opts.backfillCount && opts.backfillCount > 0),
      stageStatus: opts.stageInLobby ? 'lobby' : 'open',
      members,
      invitedUserIds: new Set<string>(opts.hostUserId ? [opts.hostUserId] : []),
      createdAt: new Date().toISOString(),
      lastActiveAt: Date.now(),
      session,
    };
    this.rooms.set(roomId, room);
    console.log(`[SESSION] Spun up room "${roomId}" for mode "${opts.mode}" (kingdom ${kingdom}).`);
    return room;
  }

  private humanCount(session: GameSessionService): number {
    let n = 0;
    const snakes = session.getState().snakes;
    for (const id in snakes) {
      if (!snakes[id].isBot) n++;
    }
    return n;
  }

  /** Legacy helper: returns the primary shared simulation for `mode`. */
  public getSession(mode: GameMode, kingdom = 1): GameSessionService {
    const key = mode === 'classic' || mode === 'boss' ? `${mode}:${kingdom}` : `${mode}:0`;
    const existingId = this.primaryByKey.get(key);
    if (existingId) {
      const r = this.rooms.get(existingId);
      if (r) { r.lastActiveAt = Date.now(); return r.session; }
    }
    const room = this.createRoomInternal({ mode, kingdom });
    this.primaryByKey.set(key, room.roomId);
    return room.session;
  }

  /** Find an available public room for matchmaking or spin up a fresh room. */
  public findOrCreateMatchmakingRoom(
    mode: GameMode,
    region = 'Global',
    kingdom = 1,
    withBots = false
  ): ManagedRoom {
    if (mode === 'boss') {
      // Dedicated 1v1 arena per challenger
      return this.createRoomInternal({ mode, kingdom, region, maxPlayers: 1, isCustom: true, isPrivate: true });
    }

    for (const room of this.rooms.values()) {
      if (room.mode !== mode || room.isPrivate || room.isCustom) continue;
      if (mode === 'classic' && room.kingdom !== kingdom) continue;
      if (room.region !== 'Global' && region !== 'Global' && room.region !== region) continue;
      if (this.humanCount(room.session) < room.maxPlayers) {
        room.lastActiveAt = Date.now();
        return room;
      }
    }

    const backfillCount = withBots && (mode === 'battle_royale' || mode === 'team') ? 8 : 0;
    const created = this.createRoomInternal({ mode, region, kingdom, backfillCount });
    const key = mode === 'classic' ? `${mode}:${kingdom}` : `${mode}:0`;
    if (!this.primaryByKey.has(key)) this.primaryByKey.set(key, created.roomId);
    return created;
  }

  public createCustomRoom(opts: {
    mode: GameMode;
    hostUserId: string;
    hostName: string;
    maxPlayers?: number;
    region?: string;
    isPrivate?: boolean;
    kingdom?: number;
    withBots?: boolean;
    mapTheme?: string;
    durationSeconds?: number;
    stageInLobby?: boolean;
  }): LobbyRoomInfo & { roomCode: string } {
    const backfillCount = opts.withBots && (opts.mode === 'battle_royale' || opts.mode === 'team') ? 6 : 0;
    const room = this.createRoomInternal({
      ...opts,
      isCustom: true,
      withCode: true,
      backfillCount,
      aiBackfill: !!opts.withBots,
      stageInLobby: !!opts.stageInLobby,
    });
    AnalyticsService.track({
      eventType: 'private_room_create',
      userId: opts.hostUserId,
      mode: opts.mode,
      roomId: room.roomId,
      metadata: { isPrivate: room.isPrivate, maxPlayers: room.maxPlayers, mapTheme: room.mapTheme, aiBackfill: room.aiBackfill },
    });
    return {
      ...this.toRoomInfo(room),
      roomCode: room.roomCode!,
    };
  }

  public getRoomInfoById(roomId: string): LobbyRoomInfo | undefined {
    const r = this.rooms.get(roomId);
    return r ? this.toRoomInfo(r) : undefined;
  }

  public authorizeAndJoinLobby(
    roomId: string,
    userId: string,
    displayName: string,
    suppliedCode?: string
  ): { ok: boolean; error?: string; room?: LobbyRoomInfo } {
    const r = this.rooms.get(roomId);
    if (!r) return { ok: false, error: 'Room not found' };
    r.lastActiveAt = Date.now();
    const codeMatches = suppliedCode && r.roomCode && suppliedCode.trim().toUpperCase() === r.roomCode;
    if (r.isPrivate && r.hostUserId !== userId && !r.invitedUserIds.has(userId) && !codeMatches) {
      return { ok: false, error: 'Unauthorized: private room requires invite or valid room code' };
    }
    if (r.members.has(userId)) {
      return { ok: true, room: this.toRoomInfo(r) }; // idempotent: prevent duplicate member rows
    }
    if (r.members.size >= r.maxPlayers) {
      return { ok: false, error: 'Room is at full capacity' };
    }
    const redCnt = Array.from(r.members.values()).filter(m => m.team === 'red').length;
    const blueCnt = Array.from(r.members.values()).filter(m => m.team === 'blue').length;
    r.members.set(userId, {
      userId,
      displayName,
      ready: false,
      team: r.mode === 'team' ? (blueCnt <= redCnt ? 'blue' : 'red') : undefined,
      isHost: r.hostUserId === userId,
    });
    r.invitedUserIds.add(userId);
    AnalyticsService.track({ eventType: 'private_room_join', userId, mode: r.mode, roomId: r.roomId });
    return { ok: true, room: this.toRoomInfo(r) };
  }

  public authorizeSocketJoin(roomId: string, userId: string, suppliedCode?: string): { ok: boolean; error?: string } {
    const r = this.rooms.get(roomId);
    if (!r) return { ok: false, error: 'Room not found' };
    if (!r.isPrivate) return { ok: true };
    const codeMatches = suppliedCode && r.roomCode && suppliedCode.trim().toUpperCase() === r.roomCode;
    if (r.hostUserId === userId || r.invitedUserIds.has(userId) || r.members.has(userId) || codeMatches) {
      r.invitedUserIds.add(userId);
      return { ok: true };
    }
    return { ok: false, error: 'Unauthorized private room access' };
  }

  public inviteUserToRoom(roomId: string, hostUserId: string, targetUserId: string): { ok: boolean; error?: string; room?: LobbyRoomInfo } {
    const r = this.rooms.get(roomId);
    if (!r) return { ok: false, error: 'Room not found' };
    if (r.hostUserId && r.hostUserId !== hostUserId && !r.members.has(hostUserId)) {
      return { ok: false, error: 'Only room participants can invite friends' };
    }
    r.invitedUserIds.add(targetUserId);
    AnalyticsService.track({ eventType: 'private_room_invite', userId: hostUserId, mode: r.mode, roomId: r.roomId, metadata: { targetUserId } });
    return { ok: true, room: this.toRoomInfo(r) };
  }

  public setMemberReady(roomId: string, userId: string, ready: boolean): { ok: boolean; error?: string; room?: LobbyRoomInfo } {
    const r = this.rooms.get(roomId);
    if (!r) return { ok: false, error: 'Room not found' };
    const m = r.members.get(userId);
    if (!m) return { ok: false, error: 'Join the room first' };
    m.ready = ready;
    r.lastActiveAt = Date.now();
    return { ok: true, room: this.toRoomInfo(r) };
  }

  public updateRoomSettings(
    roomId: string,
    hostUserId: string,
    patch: { maxPlayers?: number; mapTheme?: string; durationSeconds?: number; aiBackfill?: boolean; isPrivate?: boolean }
  ): { ok: boolean; error?: string; room?: LobbyRoomInfo } {
    const r = this.rooms.get(roomId);
    if (!r) return { ok: false, error: 'Room not found' };
    if (r.hostUserId !== hostUserId) return { ok: false, error: 'Only the host can modify match settings' };
    if (patch.maxPlayers !== undefined) {
      const mp = Math.round(Number(patch.maxPlayers));
      if (!Number.isFinite(mp) || mp < 2 || mp > 24) return { ok: false, error: 'maxPlayers must be between 2 and 24' };
      r.maxPlayers = mp;
    }
    if (patch.mapTheme !== undefined) r.mapTheme = String(patch.mapTheme || 'forest').slice(0, 32);
    if (patch.durationSeconds !== undefined) {
      const ds = Math.round(Number(patch.durationSeconds));
      if (!Number.isFinite(ds) || ds < 60 || ds > 600) return { ok: false, error: 'durationSeconds must be 60–600' };
      r.durationSeconds = ds;
    }
    if (patch.aiBackfill !== undefined) r.aiBackfill = !!patch.aiBackfill;
    if (patch.isPrivate !== undefined) r.isPrivate = !!patch.isPrivate;
    r.lastActiveAt = Date.now();
    return { ok: true, room: this.toRoomInfo(r) };
  }

  public startCustomMatch(roomId: string, hostUserId: string): { ok: boolean; error?: string; room?: LobbyRoomInfo } {
    const r = this.rooms.get(roomId);
    if (!r) return { ok: false, error: 'Room not found' };
    if (r.hostUserId !== hostUserId) return { ok: false, error: 'Only the host can start the match' };
    r.stageStatus = 'open';
    if (r.aiBackfill && (r.mode === 'battle_royale' || r.mode === 'team')) {
      r.session.backfillBots(Math.min(r.maxPlayers, Math.max(6, r.members.size + 4)));
    }
    r.lastActiveAt = Date.now();
    return { ok: true, room: this.toRoomInfo(r) };
  }

  public getRoomById(roomId: string): GameSessionService | undefined {
    const r = this.rooms.get(roomId);
    if (r) { r.lastActiveAt = Date.now(); return r.session; }
    return undefined;
  }

  public getRoomByCode(code: string): LobbyRoomInfo | undefined {
    const clean = String(code || '').trim().toUpperCase();
    const id = this.codeToRoomId.get(clean);
    if (!id) return undefined;
    const r = this.rooms.get(id);
    return r ? this.toRoomInfo(r) : undefined;
  }

  private toRoomInfo(r: ManagedRoom): LobbyRoomInfo {
    const st = r.session.getState();
    const humanLive = this.humanCount(r.session);
    return {
      roomId: r.roomId,
      roomCode: r.roomCode,
      mode: r.mode,
      region: r.region,
      playerCount: Math.max(humanLive, r.members.size),
      humanCount: humanLive,
      maxPlayers: r.maxPlayers,
      status: st.matchOver ? 'intermission' : r.stageStatus,
      stageStatus: r.stageStatus,
      hostUserId: r.hostUserId,
      hostName: r.hostName,
      isPrivate: r.isPrivate,
      isCustom: r.isCustom,
      mapTheme: r.mapTheme,
      durationSeconds: r.durationSeconds,
      aiBackfill: r.aiBackfill,
      members: Array.from(r.members.values()),
      createdAt: r.createdAt,
    };
  }

  public listRooms(mode?: GameMode): LobbyRoomInfo[] {
    this.pruneIdleCustomRooms();
    const out: LobbyRoomInfo[] = [];
    for (const r of this.rooms.values()) {
      if (r.isPrivate) continue;
      if (mode && r.mode !== mode) continue;
      out.push(this.toRoomInfo(r));
    }
    return out.sort((a, b) => b.playerCount - a.playerCount);
  }

  public pruneIdleCustomRooms(maxIdleMs = 5 * 60 * 1000) {
    const now = Date.now();
    for (const [id, r] of this.rooms) {
      if (!r.isCustom) continue;
      if (this.humanCount(r.session) > 0) {
        r.lastActiveAt = now;
        continue;
      }
      if (now - r.lastActiveAt > maxIdleMs) {
        r.session.stop();
        if (r.roomCode) this.codeToRoomId.delete(r.roomCode);
        this.rooms.delete(id);
      }
    }
  }

  public findPlayerSession(userId: string): GameSessionService | undefined {
    for (const r of this.rooms.values()) {
      if (r.session.getState().snakes[userId]) return r.session;
    }
    return undefined;
  }

  public getActiveSessions(): GameSessionService[] {
    return Array.from(this.rooms.values()).map(r => r.session);
  }

  public getActiveModeCount(): number {
    return this.rooms.size;
  }

  public getAverageTickMs(): number {
    if (this.rooms.size === 0) return 0;
    let total = 0;
    for (const r of this.rooms.values()) total += r.session.getAverageTickMs();
    return total / this.rooms.size;
  }

  public stopAll(): void {
    for (const r of this.rooms.values()) r.session.stop();
    this.rooms.clear();
    this.primaryByKey.clear();
    this.codeToRoomId.clear();
  }

  public getPlayerPeak(userId: string): { score: number; kills: number; killStreak: number; survivalSeconds: number } | null {
    for (const r of this.rooms.values()) {
      const peak = r.session.getPeakStats(userId);
      if (peak) return peak;
    }
    return null;
  }

  public consumePlayerPeak(userId: string): { score: number; kills: number; killStreak: number; survivalSeconds: number } | null {
    for (const r of this.rooms.values()) {
      const peak = r.session.consumePeakStats(userId);
      if (peak) return peak;
    }
    return null;
  }
}

export const sessionManager = new GameSessionManager();
