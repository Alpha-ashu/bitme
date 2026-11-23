import './style.css';
import { api, getPlayerToken, setPlayerToken } from './api/ApiClient';
import { applyPowerConfig, GameClient, GameStateTick, hasConfiguredServer, HeartStateData } from './game/GameClient';
import { Renderer } from './game/Renderer';
import { audio } from './game/AudioSystem';
import * as story from './game/story';
import { renderAdminScreen } from './screens/AdminScreen';
import {
  renderSplashScreen,
  showOnboardingModal,
  showPlayerAuthModal,
  showTutorialModal,
} from './screens/AuthSplashScreens';
import { renderAppShell } from './screens/CoreMenuScreens';
import {
  patchActiveQuestHud,
  patchGameplayHudValues,
  patchHeartHudBar,
  patchNpcApproachChip,
  patchNpcEncounterOverlay,
  patchQuizOverlay,
  renderGameplayScreen,
  renderMatchmakingOverlay,
  renderPauseModal,
  renderRespawnModal,
  renderResultScreen,
  toggleTacticalMapOverlay,
} from './screens/PlayOverlayScreens';
import {
  AppContext,
  AppRuntimeState,
  DEFAULT_SETTINGS,
  getViewportTier,
  LANDMARKS,
  Page,
  Screen,
  Settings,
  UI_MODES,
  UIMode,
} from './screens/types';

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem('ap_settings_v2') || '{}');
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

class AnacondaParkApp {
  private root: HTMLElement;
  private client = new GameClient();
  private renderer: Renderer | null = null;
  private ctx: AppContext;

  private animFrameId = 0;
  private inputIntervalId: any = null;
  private leaderboardExpanded = false;
  private lastAlive = true;
  private visitedAreas = new Set<string>();
  private lastKills = 0;
  private offlineQueue: Record<string, number> = {};
  private renderPending = false;

  // Steering & Input State
  private angle = 0;
  private keyBoost = false;
  private mouseBoost = false;
  private joyBoost = false;
  private activeKeys = new Set<string>();
  private joyId: number | null = null;
  private joyCenter = { x: 0, y: 0 };
  private joyRadius = 56;
  private pinchDist = 0;
  private inputBound = false;

  // Viewport tracking & responsive metrics
  private lastViewportTier: ViewportTier = getViewportTier();
  private lastViewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
  private lastViewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;
  private resizeDebounceTimer: any = null;

  public state: AppRuntimeState;

  constructor() {
    this.root = document.getElementById('app')!;
    const settings = loadSettings();
    this.state = {
      screen: 'splash',
      page: 'home',
      isGuest: true,
      user: null,
      profile: null,
      settings,
      selectedUIMode: 'free_roam',
      selectedKingdom: 1,
      equippedAccessory: '',
      selectedRegion: 'Global',
      invTab: 'accessories',
      missionCat: 'daily',
      shopCatalog: { accessories: [] },
      missions: [],
      achievements: [],
      rewards: [],
      availableCoupons: [],
      explorer: null,
      adventure: null,
      rewardBox: { items: [], unclaimedCount: 0, totals: { stars: 0, xp: 0, evoXp: 0, tickets: 0 }, powerups: [] },
      heartState: {
        hearts: 5,
        maxHearts: 5,
        heartShards: 0,
        shardsRequired: 30,
        restoreIntervalSec: 900,
        nextRestoreInSec: 0,
        nextRestoreAtMs: 0,
      },
      npcQuotas: {},
      activeQuest: null,
      activeNpcEncounter: null,
      activeQuizQuestion: null,
      stagedRoom: null,
      social: { friends: [], incoming: [], outgoing: [] },
      invites: [],
      lobbies: [],
      events: { live: [], scheduled: [], season: 'Season 1 — The Lost Prince' },
      leaderboard: { category: 'score', scope: 'global', entries: [] },
      history: [],
      milestones: [],
      lastState: null,
      lastSnake: null,
      matchStats: {},
      matchStartTs: 0,
      summary: null,
      lastBossWin: null,
      adRewardClaimedThisMatch: false,
      nearbyNpcId: null,
      npcDialogOpen: false,
    };

    this.ctx = {
      state: this.state,
      render: () => this.render(),
      go: (page: Page) => this.go(page),
      setScreen: (screen: Screen) => this.setScreen(screen),
      toast: (msg: string, ms?: number) => this.toast(msg, ms),
      refreshProfile: () => this.refreshProfile(),
      refreshCollectionData: () => this.refreshCollectionData(),
      refreshLobbies: () => this.refreshLobbies(),
      refreshLeaderboard: () => this.refreshLeaderboard(),
      refreshExplorer: () => this.refreshExplorer(),
      refreshAdventure: (opts) => this.refreshAdventure(opts),
      refreshRewardBox: () => this.refreshRewardBox(),
      refreshHearts: () => this.refreshHearts(),
      getLiveHeartState: () => this.getLiveHeartState(),
      setQuizActive: (active) => this.setQuizActive(active),
      usePowerup: (pid) => this.usePowerup(pid),
      getZoomLabel: () => this.renderer?.getZoomLabel() || '1.0×',
      startAdventureLevel: (lvl) => this.startAdventureLevel(lvl),
      openNpcInteraction: (npcId) => this.openNpcInteraction(npcId),
      respondNpcEncounter: (action) => this.respondNpcEncounter(action),
      submitQuizAnswer: (qsid, qid, ans, ms) => this.submitQuizAnswer(qsid, qid, ans, ms),
      closeQuizModal: () => this.closeQuizModal(),
      claimActiveQuest: () => this.claimActiveQuest(),
      abandonActiveQuest: () => this.abandonActiveQuest(),
      startMatch: (opts) => this.startMatch(opts),
      abandonMatch: () => this.abandonMatch(),
      resumeMatch: () => this.resumeMatch(),
      requestRespawn: (m, tok) => this.requestRespawn(m, tok),
      activateAbility: () => { this.client.activateAbility(); audio.playClick(); },
      cycleZoom: () => {
        const lbl = this.renderer?.cycleZoom() || '1.0×';
        const l = document.getElementById('touch-zoom-label');
        if (l) l.textContent = lbl;
        const dl = document.getElementById('desk-zoom-lbl');
        if (dl) dl.textContent = lbl;
        this.toast(`Camera Zoom: ${lbl}`, 1400);
        return lbl;
      },
      toggleMinimap: () => this.updateSettings({ showMinimap: !this.state.settings.showMinimap }),
      openTacticalMap: () => toggleTacticalMapOverlay(
        this.state.lastState,
        this.client.localUserId || this.state.user?.id || '',
        {
          onTogglePause: (paused) => this.client.setMapPlanning(paused),
          npcQuotas: this.state.npcQuotas,
          activeQuest: this.state.activeQuest,
        }
      ),
      openAuthModal: (tab) => showPlayerAuthModal(this.ctx, tab),
      openTutorialModal: () => showTutorialModal(),
      logoutPlayer: () => this.logoutPlayer(),
      updateSettings: (patch) => this.updateSettings(patch),
    };

    this.applySettingsToDom();
    audio.setSfxEnabled(settings.sfx);
    audio.setMusicEnabled(settings.music);
    (window as any).__coilQuestApp = this;
    (window as any).__coilQuestCtx = this.ctx;

    this.syncViewportMetrics(true);
    window.addEventListener('resize', () => this.handleViewportResize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.syncViewportMetrics(true), 120);
    });
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.handleViewportResize());
    }

    void this.boot();
  }

  private syncViewportMetrics(forceRender = false) {
    if (typeof window === 'undefined') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dvh = window.visualViewport ? window.visualViewport.height : h;
    const root = document.documentElement;
    root.style.setProperty('--app-vw', `${w}px`);
    root.style.setProperty('--app-vh', `${h}px`);
    root.style.setProperty('--app-dvh', `${dvh}px`);
    root.style.setProperty('--vh', `${h * 0.01}px`);

    const tier = getViewportTier();
    root.setAttribute('data-tier', tier);
    root.setAttribute('data-orientation', w >= h ? 'landscape' : 'portrait');

    const tierChanged = tier !== this.lastViewportTier;
    const sizeDelta = Math.abs(w - this.lastViewportWidth) > 16 || Math.abs(h - this.lastViewportHeight) > 16;

    if (tierChanged || sizeDelta || forceRender) {
      this.lastViewportTier = tier;
      this.lastViewportWidth = w;
      this.lastViewportHeight = h;

      if (this.state.screen === 'play') {
        this.renderer?.resize();
      } else if (this.state.screen === 'app' || this.state.screen === 'pause' || this.state.screen === 'summary') {
        this.render();
      }
    }
  }

  private handleViewportResize() {
    clearTimeout(this.resizeDebounceTimer);
    this.resizeDebounceTimer = setTimeout(() => {
      this.syncViewportMetrics();
    }, 80);
  }

  private applySettingsToDom() {
    const s = this.state.settings;
    document.documentElement.classList.toggle('large-text', !!s.largeText);
    document.documentElement.classList.toggle('high-contrast', !!s.highContrast);
    document.documentElement.classList.toggle('reduce-motion', !!s.reduceMotion);
    this.renderer?.setCameraPreset(s.cameraPreset);
    this.renderer?.setOptions({
      reduceMotion: s.reduceMotion,
      showMinimap: s.showMinimap,
      controlPos: s.controlPos,
      classicBounded: this.state.selectedUIMode === 'nokia',
    });
    this.applyMatchTheme();
  }

  private applyMatchTheme() {
    if (!this.renderer) return;
    const mode = this.state.selectedUIMode;
    const kingdomTheme = story.KINGDOMS.find(k => k.n === this.state.selectedKingdom)?.theme || 'forest';
    const targetId = (mode === 'explorer' || mode === 'boss')
      ? kingdomTheme
      : mode === 'battle_royale'
        ? 'volcano'
        : mode === 'team'
          ? 'riverlands'
          : mode === 'nokia'
            ? 'ancient_ruins'
            : mode === 'event'
              ? 'tropical'
              : 'forest';
    const found = this.state.mapThemes?.find(t => t.id === targetId) || this.state.mapThemes?.[0];
    if (found) {
      this.renderer.applyTheme({
        sky: found.sky,
        ground: found.ground || found.sky,
        grid: found.grid,
        accent: found.accent,
      });
    }
  }

  public updateSettings(patch: Partial<Settings>) {
    this.state.settings = { ...this.state.settings, ...patch };
    try { localStorage.setItem('ap_settings_v2', JSON.stringify(this.state.settings)); } catch { /* */ }
    this.applySettingsToDom();
    if (patch.sfx !== undefined) audio.setSfxEnabled(this.state.settings.sfx);
    if (patch.music !== undefined) audio.setMusicEnabled(this.state.settings.music);
    if (patch.masterVolume !== undefined) audio.setMasterVolume(this.state.settings.masterVolume ?? 80);
    if (patch.sfxVolume !== undefined) audio.setSfxVolume(this.state.settings.sfxVolume ?? 85);
    if (patch.musicVolume !== undefined) audio.setMusicVolume(this.state.settings.musicVolume ?? 60);
    if (patch.ambientAudio !== undefined) audio.setAmbientEnabled(this.state.settings.ambientAudio ?? true);
    if (patch.uiClicks !== undefined) audio.setUiClicksEnabled(this.state.settings.uiClicks !== false);
    if (patch.haptics !== undefined) audio.setHapticsEnabled(this.state.settings.haptics !== false);
    this.render();
  }

  private async boot() {
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#/admin' || window.location.hash === '#admin') {
        this.setScreen('admin');
      } else if (this.state.screen === 'admin') {
        this.setScreen('app');
      }
    });

    if (window.location.hash === '#/admin' || window.location.hash === '#admin') {
      this.setScreen('admin');
      return;
    }

    renderSplashScreen(this.root, 'Synchronising arena config…');
    const cfgRes = await api('/api/config');
    if (cfgRes.ok && cfgRes.data) {
      if (cfgRes.data.powers) applyPowerConfig(cfgRes.data.powers);
      if (cfgRes.data.maps?.themes) this.state.mapThemes = cfgRes.data.maps.themes;
      if (typeof cfgRes.data.economy?.respawn?.stars?.stars === 'number') {
        this.state.respawnCostStars = cfgRes.data.economy.respawn.stars.stars;
      }
    }

    if (getPlayerToken()) {
      const me = await api('/api/player/profile');
      if (me.ok && me.data?.profile) {
        this.applyProfilePayload(me.data);
      } else if (me.status === 401) {
        setPlayerToken(null);
      }
    }

    if (!this.state.profile && (cfgRes.ok || hasConfiguredServer())) {
      const guest = await api('/api/auth/guest', { method: 'POST' });
      if (guest.ok && guest.data?.token) {
        setPlayerToken(guest.data.token);
        this.applyProfilePayload(guest.data);
      }
    }

    if (!this.state.profile) {
      this.state.user = { id: this.client.localUserId, username: 'OfflineExplorer', isGuest: true };
      this.state.profile = {
        userId: this.client.localUserId,
        displayName: 'Explorer',
        avatar: '🐍',
        level: 1, xp: 0, xpToNext: 100, stars: 500, tickets: 5,
        equippedSkin: 'Forest', unlockedSkins: ['Forest', 'Jungle'],
        equippedAccessory: '', unlockedAccessories: ['flower_crown'],
        stats: { matchesPlayed: 0, matchesWon: 0, highestScore: 0, totalKills: 0 },
      };
    }

    await Promise.all([
      this.refreshCollectionData(),
      this.refreshExplorer(),
      this.refreshAdventure(),
      this.refreshRewardBox(),
      this.refreshLeaderboard(),
      this.refreshLobbies(),
    ]);

    setInterval(() => {
      if (document.visibilityState === 'visible' && getPlayerToken() && this.state.screen !== 'admin') {
        void api('/api/presence/ping', { method: 'POST' });
      }
    }, 45_000);

    document.addEventListener('visibilitychange', () => {
      if (this.state.screen === 'play' && document.hidden) {
        this.client.notifyPause(true);
      }
    });

    this.setScreen('app');
    if (this.state.isGuest && localStorage.getItem('ap_onboarded_v2') !== '1' && hasConfiguredServer()) {
      showOnboardingModal(this.ctx);
    }
  }

  private applyProfilePayload(data: any) {
    if (data.user) {
      this.state.user = data.user;
      this.state.isGuest = !!data.user.isGuest;
    }
    if (data.profile) {
      this.state.profile = data.profile;
      this.state.equippedAccessory = data.profile.equippedAccessory || '';
      if (data.profile.explorer?.kingdom) {
        this.state.selectedKingdom = data.profile.explorer.kingdom;
      }
    }
    if (data?.heartState) {
      this.applyHeartState(data.heartState);
    }
  }

  private applyHeartState(hs: Partial<HeartStateData>) {
    const maxHearts = Math.max(1, Number(hs.maxHearts) || 5);
    const hearts = Math.max(0, Math.min(maxHearts, hs.hearts ?? this.state.heartState.hearts));
    const restoreIntervalSec = Math.max(60, Number(hs.restoreIntervalSec) || 900);
    const nextRestoreInSec = hearts < maxHearts ? Math.max(0, Number(hs.nextRestoreInSec) || 0) : 0;
    const nextRestoreAtMs = hearts < maxHearts && nextRestoreInSec > 0
      ? Date.now() + nextRestoreInSec * 1000
      : 0;
    this.state.heartState = {
      hearts,
      maxHearts,
      heartShards: Math.max(0, Number(hs.heartShards) || 0),
      shardsRequired: Math.max(1, Number(hs.shardsRequired) || 30),
      restoreIntervalSec,
      nextRestoreInSec,
      nextRestoreAtMs,
    };
    if (this.state.screen === 'play') {
      patchHeartHudBar(this.root, this.ctx);
    }
  }

  public getLiveHeartState(): HeartStateData {
    const cur = this.state.heartState;
    if (cur.hearts >= cur.maxHearts) {
      return { ...cur, nextRestoreInSec: 0, nextRestoreAtMs: 0 };
    }
    const now = Date.now();
    const intervalMs = (cur.restoreIntervalSec || 900) * 1000;
    if (cur.nextRestoreAtMs > 0 && now >= cur.nextRestoreAtMs) {
      const gained = 1 + Math.floor((now - cur.nextRestoreAtMs) / intervalMs);
      const nextHearts = Math.min(cur.maxHearts, cur.hearts + gained);
      const nextAt = nextHearts >= cur.maxHearts ? 0 : cur.nextRestoreAtMs + gained * intervalMs;
      this.state.heartState = {
        ...cur,
        hearts: nextHearts,
        nextRestoreAtMs: nextAt,
        nextRestoreInSec: nextAt > now ? Math.max(1, Math.ceil((nextAt - now) / 1000)) : 0,
      };
      if (getPlayerToken()) void this.refreshHearts();
      return this.state.heartState;
    }
    const remSec = cur.nextRestoreAtMs > now
      ? Math.max(1, Math.ceil((cur.nextRestoreAtMs - now) / 1000))
      : cur.nextRestoreInSec;
    return { ...cur, nextRestoreInSec: remSec };
  }

  public async refreshHearts() {
    if (!getPlayerToken()) return;
    const r = await api('/api/player/hearts');
    if (r.ok && r.data?.heartState) {
      this.applyHeartState(r.data.heartState);
    }
  }

  public deductHeartOnDeath() {
    const hs = this.getLiveHeartState();
    const before = hs.hearts;
    const after = Math.max(0, before - 1);
    const now = Date.now();
    let nextAt = hs.nextRestoreAtMs;
    if (before >= hs.maxHearts && after < hs.maxHearts) {
      nextAt = now + (hs.restoreIntervalSec || 900) * 1000;
    }
    const remSec = nextAt > now ? Math.max(1, Math.ceil((nextAt - now) / 1000)) : 0;
    this.state.heartState = {
      ...hs,
      hearts: after,
      nextRestoreAtMs: nextAt,
      nextRestoreInSec: remSec,
    };
    if (getPlayerToken()) {
      void api('/api/player/hearts/deduct', { method: 'POST', body: JSON.stringify({ count: 1, reason: 'knockout' }) });
    }
  }

  public setQuizActive(active: boolean) {
    this.client.setQuizMode(active);
  }

  private collectLocalHeartShard() {
    const hs = this.getLiveHeartState();
    let hearts = hs.hearts;
    let shards = hs.heartShards + 1;
    let recharged = 0;
    while (shards >= hs.shardsRequired && hearts < hs.maxHearts) {
      shards -= hs.shardsRequired;
      hearts += 1;
      recharged += 1;
    }
    if (hearts >= hs.maxHearts) {
      shards = Math.min(shards, hs.shardsRequired - 1);
    }
    this.applyHeartState({
      ...hs,
      hearts,
      heartShards: shards,
      nextRestoreInSec: hearts < hs.maxHearts ? (hs.nextRestoreInSec || hs.restoreIntervalSec) : 0,
    });
    const me = this.state.lastSnake;
    if (recharged > 0) {
      this.toast('+1 ♥ Heart Recharged (30/30 Hearts collected)!', 3000);
      if (me) this.renderer?.spawnFeedback(me.head.x, me.head.y, '+1 ♥ RECHARGED!', '#E11D48');
    } else if (me) {
      this.renderer?.spawnFeedback(me.head.x, me.head.y, `♥ ${shards}/${hs.shardsRequired}`, '#FB7185');
    }
    if (getPlayerToken()) {
      void api('/api/player/hearts/collect', { method: 'POST', body: JSON.stringify({ count: 1 }) }).then(r => {
        if (r.ok && r.data?.heartState) this.applyHeartState(r.data.heartState);
      });
    }
  }

  public async refreshProfile() {
    if (!getPlayerToken()) return;
    const r = await api('/api/player/profile');
    if (r.ok) {
      this.applyProfilePayload(r.data);
      this.render();
    }
  }

  public async refreshCollectionData() {
    const [shop, ms, ach, rw, soc, invs, ev, hist] = await Promise.all([
      api('/api/shop/catalog'),
      getPlayerToken() ? api('/api/missions') : Promise.resolve({ ok: false, data: null }),
      getPlayerToken() ? api('/api/achievements') : Promise.resolve({ ok: false, data: null }),
      api(`/api/rewards/catalog?region=${encodeURIComponent(this.state.profile?.country || 'Global')}`),
      getPlayerToken() ? api('/api/social/overview') : Promise.resolve({ ok: false, data: null }),
      getPlayerToken() ? api('/api/social/invites') : Promise.resolve({ ok: false, data: null }),
      api('/api/events'),
      getPlayerToken() ? api('/api/player/history?limit=25') : Promise.resolve({ ok: false, data: null }),
    ]);
    if (shop.ok) this.state.shopCatalog = { accessories: shop.data.accessories || [] };
    if (ms.ok) this.state.missions = ms.data.missions || [];
    if (ach.ok) this.state.achievements = ach.data.achievements || [];
    if (rw.ok) this.state.rewards = rw.data.items || [];
    if (soc.ok) this.state.social = soc.data;
    if (invs.ok) this.state.invites = invs.data.invites || [];
    if (ev.ok) this.state.events = ev.data;
    if (hist.ok) this.state.history = hist.data.history || [];
    this.render();
  }

  public async refreshLobbies() {
    const r = await api('/api/lobbies');
    if (r.ok) this.state.lobbies = r.data.rooms || [];
  }

  public async refreshLeaderboard() {
    const { category, scope } = this.state.leaderboard;
    const q = new URLSearchParams({ category, scope });
    if (scope === 'local') q.set('region', this.state.profile?.country || 'Global');
    const r = await api(`/api/leaderboard?${q.toString()}`);
    if (r.ok) this.state.leaderboard.entries = r.data.entries || [];
  }

  public async refreshExplorer() {
    if (!getPlayerToken()) return;
    const r = await api('/api/explorer/state');
    if (r.ok) {
      this.state.explorer = r.data;
      if (r.data.kingdom?.n) this.state.selectedKingdom = r.data.kingdom.n;
    }
  }

  public async refreshAdventure(opts?: { world?: number; page?: number }) {
    if (!getPlayerToken()) return;
    const qs = new URLSearchParams();
    if (opts?.world) qs.set('world', String(opts.world));
    if (opts?.page !== undefined) qs.set('page', String(opts.page));
    qs.set('pageSize', '20');
    const r = await api(`/api/adventure/overview?${qs.toString()}`);
    if (r.ok && r.data) {
      this.state.adventure = r.data;
      this.state.activeQuest = r.data.activeQuest || null;
      if (r.data.npcQuotas) {
        this.state.npcQuotas = r.data.npcQuotas;
        this.renderer?.setNpcQuotas(this.state.npcQuotas);
      }
      if (r.data.rewardBox) this.state.rewardBox = r.data.rewardBox;
      this.renderer?.setActiveQuest(this.state.activeQuest);
      if (this.state.screen === 'play') patchActiveQuestHud(this.root, this.ctx);
    }
  }

  public async refreshRewardBox() {
    if (!getPlayerToken()) return;
    const r = await api('/api/reward-box');
    if (r.ok && r.data) {
      this.state.rewardBox = {
        items: r.data.items || [],
        unclaimedCount: r.data.unclaimedCount || 0,
        totals: r.data.totals || { stars: 0, xp: 0, evoXp: 0, tickets: 0 },
        powerups: r.data.powerups || [],
      };
    }
  }

  public async usePowerup(powerupId: 'pw_boost' | 'pw_shield' | 'pw_super') {
    const r = await api('/api/player/use-powerup', {
      method: 'POST',
      body: JSON.stringify({ powerupId }),
    });
    if (!r.ok) {
      this.toast(r.data?.error || 'No charge available');
      return;
    }
    if (r.data.profile) this.state.profile = r.data.profile;
    this.client.applyLocalPowerup(powerupId);
    audio.playEat();
    const label = powerupId === 'pw_boost' ? 'Speed Boost +10s' : powerupId === 'pw_shield' ? 'Guard Shield +10s' : 'Super Surge +8s';
    this.toast(`${label} activated! (${r.data.remaining ?? 0} left)`);
    if (this.state.screen === 'play') {
      const btn = this.root.querySelector(`[data-use-pw="${powerupId}"]`);
      const left = Number(r.data.remaining ?? 0);
      if (btn) {
        if (left <= 0) btn.remove();
        else {
          const sp = btn.querySelector('span');
          if (sp) sp.textContent = `×${left}`;
        }
      }
    }
  }

  public async startAdventureLevel(levelNumber: number) {
    const worldNum = Math.min(10, Math.max(1, Math.floor((levelNumber - 1) / 100) + 1));
    this.state.selectedKingdom = worldNum;
    const r = await api('/api/adventure/quest/accept', {
      method: 'POST',
      body: JSON.stringify({ levelNumber }),
    });
    if (!r.ok) {
      this.toast(r.data?.error || 'Could not start adventure level');
      return;
    }
    this.state.activeQuest = r.data.session || null;
    this.state.activeNpcEncounter = null;
    this.state.activeQuizQuestion = r.data.quizQuestion || null;
    if (r.data.heartState) this.applyHeartState(r.data.heartState);
    if (r.data.overview) this.state.adventure = { ...r.data.overview, activeQuest: this.state.activeQuest };
    this.renderer?.setActiveQuest(this.state.activeQuest);

    if (this.state.screen !== 'play') {
      this.startMatch({ mode: 'explorer', kingdom: worldNum, preserveQuiz: Boolean(this.state.activeQuizQuestion) });
    } else {
      patchActiveQuestHud(this.root, this.ctx);
      patchNpcEncounterOverlay(this.root, this.ctx);
      patchQuizOverlay(this.root, this.ctx);
    }
    if (this.state.activeQuizQuestion) {
      this.setQuizActive(true);
    }
  }

  public async openNpcInteraction(npcId: string) {
    if (this.state.activeNpcEncounter || this.state.activeQuizQuestion) return;
    this.client.requestNpcInteract(npcId);
    const r = await api('/api/adventure/npc/interact', {
      method: 'POST',
      body: JSON.stringify({ npcId }),
    });
    if (r.ok && r.data?.encounter) {
      this.state.activeNpcEncounter = r.data.encounter;
      if (this.state.screen === 'play') {
        patchNpcApproachChip(this.root, this.ctx);
        patchNpcEncounterOverlay(this.root, this.ctx);
      }
    } else {
      this.client.endInteraction();
      if (r.data?.error) this.toast(r.data.error);
    }
  }

  public async respondNpcEncounter(action: 'accept' | 'later' | 'skip' | 'claim') {
    const enc = this.state.activeNpcEncounter;
    if (!enc) return;

    if (action === 'later') {
      await api('/api/adventure/quest/later', {
        method: 'POST',
        body: JSON.stringify({ npcId: enc.npcId, questId: enc.questId }),
      });
      this.state.activeNpcEncounter = null;
      this.client.endInteraction();
      if (this.state.screen === 'play') {
        patchNpcEncounterOverlay(this.root, this.ctx);
        patchNpcApproachChip(this.root, this.ctx);
      }
      return;
    }

    if (action === 'skip') {
      await api('/api/adventure/quest/skip', {
        method: 'POST',
        body: JSON.stringify({ npcId: enc.npcId, questId: enc.questId, levelNumber: enc.levelNumber || 0 }),
      });
      this.state.activeNpcEncounter = null;
      this.client.endInteraction();
      this.toast('Quest skipped — continue exploring!');
      if (this.state.screen === 'play') {
        patchNpcEncounterOverlay(this.root, this.ctx);
        patchNpcApproachChip(this.root, this.ctx);
      }
      return;
    }

    if (action === 'claim') {
      this.state.activeNpcEncounter = null;
      await this.claimActiveQuest();
      this.client.endInteraction();
      if (this.state.screen === 'play') {
        patchNpcEncounterOverlay(this.root, this.ctx);
        patchNpcApproachChip(this.root, this.ctx);
      }
      return;
    }

    // ACCEPT
    const r = await api('/api/adventure/quest/accept', {
      method: 'POST',
      body: JSON.stringify({
        questId: enc.questId,
        levelNumber: enc.levelNumber || undefined,
        npcId: enc.npcId,
      }),
    });
    if (!r.ok) {
      this.toast(r.data?.error || 'Could not accept quest');
      this.state.activeNpcEncounter = null;
      this.client.endInteraction();
      if (this.state.screen === 'play') patchNpcEncounterOverlay(this.root, this.ctx);
      return;
    }

    this.state.activeNpcEncounter = null;
    this.state.activeQuest = r.data.session || null;
    this.state.activeQuizQuestion = r.data.quizQuestion || null;
    if (r.data.heartState) this.applyHeartState(r.data.heartState);
    if (r.data.npcQuotas) {
      this.state.npcQuotas = r.data.npcQuotas;
      this.renderer?.setNpcQuotas(this.state.npcQuotas);
    }
    this.renderer?.setActiveQuest(this.state.activeQuest);
    if (this.state.activeQuizQuestion) {
      this.setQuizActive(true);
    } else {
      this.client.endInteraction();
    }
    this.toast(r.data.deployedTo?.ok
      ? `Quest Active! Deployed to Fresh Safe Area (4.5s Shield)`
      : `Quest Active: ${this.state.activeQuest?.title || 'Adventure'}`, 3200);

    if (this.state.screen === 'play') {
      patchNpcEncounterOverlay(this.root, this.ctx);
      patchNpcApproachChip(this.root, this.ctx);
      patchActiveQuestHud(this.root, this.ctx);
      patchQuizOverlay(this.root, this.ctx);
    }
  }

  public async submitQuizAnswer(quizSessionId: string, questionId: string, answer: string, responseMs: number) {
    const r = await api('/api/adventure/quiz/answer', {
      method: 'POST',
      body: JSON.stringify({ quizSessionId, questionId, answer, responseMs }),
    });
    if (!r.ok) return { ok: false, error: r.data?.error || 'Answer rejected' };
    if (r.data?.heartState) {
      this.applyHeartState(r.data.heartState);
    }
    if (r.data?.heartDeducted) {
      this.toast('Wrong answer! −1 ♥ (Restores in 15m or collect 30 ♥ in park)', 3600);
    }
    if (r.data?.questUpdate) {
      const qu = r.data.questUpdate;
      if (qu.autoClaimedToBox) {
        this.state.activeQuest = null;
        this.renderer?.setActiveQuest(null);
        if (qu.npcQuota) {
          this.state.npcQuotas = { ...this.state.npcQuotas, [qu.npcQuota.npcId]: qu.npcQuota };
          this.renderer?.setNpcQuotas(this.state.npcQuotas);
        }
        void Promise.all([this.refreshRewardBox(), this.refreshAdventure()]);
        const rw = qu.rewardBoxItem || {};
        this.toast(`Quest Complete! +${rw.stars || 0} Stars sent to Reward Box!`, 3600);
      } else if (qu.session) {
        this.state.activeQuest = qu.session;
        this.renderer?.setActiveQuest(this.state.activeQuest);
      }
      if (this.state.screen === 'play') patchActiveQuestHud(this.root, this.ctx);
    }
    return r.data;
  }

  public closeQuizModal() {
    this.state.activeQuizQuestion = null;
    this.setQuizActive(false);
    this.client.endInteraction();
    if (this.state.screen === 'play') {
      patchQuizOverlay(this.root, this.ctx);
      patchActiveQuestHud(this.root, this.ctx);
      patchNpcApproachChip(this.root, this.ctx);
      patchHeartHudBar(this.root, this.ctx);
    }
  }

  public async claimActiveQuest() {
    const sid = this.state.activeQuest?.sessionId;
    const r = await api('/api/adventure/quest/claim', {
      method: 'POST',
      body: JSON.stringify({ sessionId: sid }),
    });
    if (!r.ok) {
      this.toast(r.data?.error || 'Cannot claim reward yet');
      return;
    }
    const rw = r.data.rewards || {};
    this.state.activeQuest = null;
    this.state.activeQuizQuestion = null;
    this.renderer?.setActiveQuest(null);
    if (r.data.profile) this.state.profile = r.data.profile;
    if (r.data.overview) this.state.adventure = r.data.overview;
    audio.playEat();
    const extra = r.data.legendaryUnlocked ? ` · 🌟 ${r.data.legendaryUnlocked}!` : r.data.nextUnlockedLevel ? ` · Lv.${r.data.nextUnlockedLevel} Unlocked!` : '';
    this.toast(`🏆 Claimed +${rw.stars || 0}★ +${rw.xp || 0} XP${extra}`, 3800);
    if (this.state.screen === 'play') {
      patchActiveQuestHud(this.root, this.ctx);
      patchQuizOverlay(this.root, this.ctx);
    } else {
      this.render();
    }
  }

  public async abandonActiveQuest() {
    const r = await api('/api/adventure/quest/abandon', { method: 'POST' });
    if (!r.ok) return;
    this.state.activeQuest = null;
    this.state.activeQuizQuestion = null;
    this.renderer?.setActiveQuest(null);
    this.client.endInteraction();
    this.toast('Quest abandoned. You can retry anytime.');
    if (this.state.screen === 'play') {
      patchActiveQuestHud(this.root, this.ctx);
      patchQuizOverlay(this.root, this.ctx);
    }
  }

  public async logoutPlayer() {
    await api('/api/auth/logout', { method: 'POST' });
    setPlayerToken(null);
    const guest = await api('/api/auth/guest', { method: 'POST' });
    if (guest.ok && guest.data?.token) {
      setPlayerToken(guest.data.token);
      this.applyProfilePayload(guest.data);
    }
    await this.refreshCollectionData();
    this.toast('Signed out cleanly. Switched to Guest mode.');
    this.go('home');
  }

  public go(page: Page) {
    audio.playClick();
    this.state.page = page;
    if (page === 'lobby') void this.refreshLobbies().then(() => this.render());
    if (page === 'leaderboard') void this.refreshLeaderboard().then(() => this.render());
    if (page === 'story') void Promise.all([this.refreshExplorer(), this.refreshAdventure()]).then(() => this.render());
    if (page === 'rewards') void Promise.all([this.refreshRewardBox(), this.refreshCollectionData()]).then(() => this.render());
    if (page === 'profile') void this.refreshCollectionData();
    this.render();
  }

  public setScreen(screen: Screen) {
    this.state.screen = screen;
    if (screen === 'pause') this.client.notifyPause(true);
    if (screen === 'play') this.client.notifyPause(false);
    this.render();
  }

  public startMatch(opts?: { mode?: UIMode; roomId?: string; roomCode?: string; kingdom?: number; preserveQuiz?: boolean }) {
    if (opts?.mode) this.state.selectedUIMode = opts.mode;
    if (opts?.kingdom) this.state.selectedKingdom = opts.kingdom;
    this.state.selectedRoomId = opts?.roomId;
    this.state.selectedRoomCode = opts?.roomCode;

    const mDef = UI_MODES[this.state.selectedUIMode];
    this.state.matchStartTs = Date.now();
    this.state.lastState = null;
    this.state.lastSnake = null;
    this.state.summary = null;
    this.state.lastBossWin = null;
    this.state.activeNpcEncounter = null;
    this.state.nearbyNpcId = null;
    if (!opts?.preserveQuiz) this.state.activeQuizQuestion = null;
    document.getElementById('tactical-overlay')?.remove();
    this.state.adRewardClaimedThisMatch = false;
    this.state.matchStats = {};
    this.lastAlive = true;
    this.lastKills = 0;
    this.visitedAreas.clear();
    this.offlineQueue = {};

    this.setScreen(mDef.multiplayer && hasConfiguredServer() ? 'matchmaking' : 'play');
    audio.startMusic();
    if (getPlayerToken() || hasConfiguredServer()) {
      void api('/api/analytics/event', {
        method: 'POST',
        body: JSON.stringify({ eventType: 'session_start', mode: this.state.selectedUIMode }),
      });
    }

    this.client.onStateUpdate = (tick) => this.onTick(tick);
    this.client.onRespawnResult = (r) => {
      if (r.success) {
        this.lastAlive = true;
        if (r.method === 'ad') {
          this.state.heartState.hearts = Math.min(this.state.heartState.maxHearts, this.state.heartState.hearts + 1);
        }
        this.setScreen('play');
        this.startRenderLoop();
      } else {
        this.toast(r.message || 'Could not respawn');
      }
    };
    this.client.onCollect = (type) => {
      this.offlineQueue[type] = (this.offlineQueue[type] || 0) + 1;
      this.recordMatchPickup(type);
      if (type === 'heart') this.collectLocalHeartShard();
      audio.playEat();
    };
    this.client.onHeartState = (payload) => {
      if (payload?.heartState) this.applyHeartState(payload.heartState);
      if ((payload?.rechargedCount || 0) > 0) {
        this.toast(`+${payload.rechargedCount} ♥ Heart Recharged (30/30 Hearts collected)!`, 3400);
        audio.playEat();
      }
    };
    this.client.onPickupEvent = (ev: any) => {
      if (ev?.foodType) {
        this.recordMatchPickup(ev.foodType);
        const me = this.state.lastSnake;
        if (me) {
          if (ev.foodType === 'shield') this.renderer?.spawnFeedback(me.head.x, me.head.y, 'SHIELD!', '#0284C7');
          else if (ev.foodType === 'speed') this.renderer?.spawnFeedback(me.head.x, me.head.y, 'SPEED!', '#D97706');
          else if (ev.foodType === 'mushroom') this.renderer?.spawnFeedback(me.head.x, me.head.y, 'SUPER!', '#7C3AED');
        }
      }
      if (Array.isArray(ev?.updatedMissions)) this.state.missions = ev.updatedMissions;
      audio.playEat();
    };
    this.client.onWorldFeedback = (ev) => {
      this.renderer?.spawnFeedback(ev.x, ev.y, ev.text, ev.color);
      if (ev.shake) this.renderer?.triggerCameraShake(ev.shake, 0.25);
      if (ev.boomRadius) this.renderer?.spawnShockwave(ev.x, ev.y, ev.boomRadius);
    };
    this.client.onBossDefeat = async (ev) => {
      this.state.lastBossWin = ev;
      if (ev.local && ev.bossId) {
        const r = await api('/api/explorer/boss/defeat', { method: 'POST', body: JSON.stringify({ bossId: ev.bossId }) });
        if (r.ok) this.state.lastBossWin = r.data;
      }
      await this.endMatch(true);
    };
    this.client.onNpcEncounter = (encounter) => {
      if (this.state.selectedUIMode !== 'explorer' && this.state.selectedUIMode !== 'free_roam') return;
      if (this.state.activeQuizQuestion) return;
      this.state.activeNpcEncounter = encounter;
      this.state.nearbyNpcId = encounter?.npcId || this.state.nearbyNpcId;
      audio.playClick();
      if (this.state.screen === 'play') {
        patchNpcApproachChip(this.root, this.ctx);
        patchNpcEncounterOverlay(this.root, this.ctx);
      }
    };
    this.client.onQuestUpdate = (upd) => {
      if (upd?.npcQuota) {
        this.state.npcQuotas = { ...this.state.npcQuotas, [upd.npcQuota.npcId]: upd.npcQuota };
        this.renderer?.setNpcQuotas(this.state.npcQuotas);
      }
      if (upd?.autoClaimedToBox || upd?.completed) {
        this.state.activeQuest = null;
        this.renderer?.setActiveQuest(null);
        const rw = upd.rewardBoxItem || {};
        const quotaMsg = upd.npcQuota?.onCooldown
          ? ` (5/5 Done — Quest Master resting 30m)`
          : upd.npcQuota
            ? ` (${upd.npcQuota.completedInCycle}/5 Tasks)`
            : '';
        this.toast(`Quest Complete! +${rw.stars || 0} Stars saved to Reward Box${quotaMsg}`, 4000);
        audio.playEat();
        void Promise.all([this.refreshRewardBox(), this.refreshAdventure()]);
      } else if (upd?.session) {
        this.state.activeQuest = upd.session;
        this.renderer?.setActiveQuest(upd.session);
        if (upd?.stageAdvanced) {
          this.toast(`Stage Cleared! Advancing to Stage ${(upd.session?.stageIndex || 0) + 1}/${upd.session?.stageTotal || 1}`, 2600);
        } else if (upd?.failed) {
          this.toast(upd.feedback || 'Challenge failed — retry anytime!', 3000);
        }
      }
      if (upd?.nextQuiz) {
        this.state.activeQuizQuestion = upd.nextQuiz;
        this.setQuizActive(true);
      }
      if (this.state.screen === 'play') {
        patchActiveQuestHud(this.root, this.ctx);
        patchNpcApproachChip(this.root, this.ctx);
        if (upd?.nextQuiz) patchQuizOverlay(this.root, this.ctx);
      }
    };
    this.client.onAuthQuestSync = ({ activeQuest, activeQuiz, npcQuotas, heartState }) => {
      if (heartState) {
        this.applyHeartState(heartState);
      }
      if (npcQuotas) {
        this.state.npcQuotas = npcQuotas;
        this.renderer?.setNpcQuotas(npcQuotas);
      }
      if (activeQuest) {
        this.state.activeQuest = activeQuest;
        this.renderer?.setActiveQuest(activeQuest);
      }
      if (activeQuiz && !this.state.activeQuizQuestion) {
        this.state.activeQuizQuestion = activeQuiz;
      }
      if (this.state.activeQuizQuestion) {
        this.setQuizActive(true);
      }
      if (this.state.screen === 'play') {
        patchActiveQuestHud(this.root, this.ctx);
        patchNpcApproachChip(this.root, this.ctx);
        patchHeartHudBar(this.root, this.ctx);
        if (this.state.activeQuizQuestion) patchQuizOverlay(this.root, this.ctx);
      }
    };

    this.client.setModeFlags({
      ui: this.state.selectedUIMode,
      solo: !!mDef.solo,
      story: !!mDef.story,
    });

    this.client.connect(
      getPlayerToken() || '',
      'Forest',
      mDef.backend,
      this.state.selectedRegion,
      'global',
      {
        roomId: this.state.selectedRoomId,
        roomCode: this.state.selectedRoomCode,
        kingdom: this.state.selectedKingdom,
      }
    );

    this.setupGameInput();
    this.startRenderLoop();
  }

  private startRenderLoop() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const loop = () => {
      if (this.state.screen === 'play' || this.state.screen === 'pause' || this.state.screen === 'respawn' || this.state.screen === 'matchmaking') {
        if (this.renderer && this.state.lastState) {
          this.renderer.setActiveQuest(this.state.activeQuest);
          this.renderer.render(this.state.lastState, this.client.localUserId || this.state.user?.id || '');
          this.client.setViewRadius(this.renderer.getViewRadius());
        }
        this.animFrameId = requestAnimationFrame(loop);
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private onTick(tick: GameStateTick) {
    this.state.lastState = tick;
    if (this.state.screen === 'matchmaking') {
      this.setScreen('play');
    }
    const myId = this.client.localUserId || this.state.user?.id;
    const me = tick.snakes.find(s => s.id === myId || s.userId === myId);
    if (me) this.state.lastSnake = me;

    if (me && me.isAlive) {
      this.lastAlive = true;
      for (const l of LANDMARKS) {
        const dx = me.head.x - l.x, dy = me.head.y - l.y;
        if (dx * dx + dy * dy < 240 * 240) this.visitedAreas.add(l.name);
      }
      if ((me.kills || 0) > this.lastKills) {
        this.lastKills = me.kills;
        this.renderer?.triggerCameraShake(5, 0.2);
      }
      if ((this.state.selectedUIMode === 'explorer' || this.state.selectedUIMode === 'free_roam') && tick.npcs?.length) {
        const wrapD = (d: number) => { let r = ((d % 6000) + 6000) % 6000; if (r > 3000) r -= 6000; return r; };
        const near = tick.npcs.find(n => {
          const dx = wrapD(n.x - me.head.x);
          const dy = wrapD(n.y - me.head.y);
          const r = (n.radius || 46) + me.radius + 95;
          return dx * dx + dy * dy <= r * r;
        });
        const nextId = near?.id || null;
        if (nextId !== this.state.nearbyNpcId) {
          this.state.nearbyNpcId = nextId;
          if (this.state.screen === 'play') {
            patchNpcApproachChip(this.root, this.ctx);
          }
        }
      }
    }

    if ((tick as any).matchOver && (this.state.screen === 'play' || this.state.screen === 'respawn')) {
      const boardTop = tick.leaderboard?.[0];
      const brWinner = !!me?.isAlive || (boardTop?.id === myId);
      const teamWin = tick.teamScores && me?.team ? tick.teamScores[me.team] >= tick.teamScores[me.team === 'red' ? 'blue' : 'red'] : false;
      const isWin = this.state.selectedUIMode === 'team' ? teamWin : (this.state.selectedUIMode === 'boss' ? !!this.state.lastBossWin : brWinner);
      void this.endMatch(isWin);
      return;
    }

    if (me && !me.isAlive && this.lastAlive && this.state.screen === 'play') {
      this.lastAlive = false;
      audio.playDeath();
      this.deductHeartOnDeath();
      const noRespawn = this.state.selectedUIMode === 'battle_royale' || this.state.selectedUIMode === 'nokia' || this.state.selectedUIMode === 'boss';
      if (noRespawn) {
        void this.endMatch(false);
      } else {
        this.setScreen('respawn');
      }
      return;
    }

    if (this.state.screen === 'play') {
      patchGameplayHudValues(this.root, tick, this.ctx);
    }
  }

  private recordMatchPickup(type: string) {
    const ms = this.state.matchStats;
    ms[type] = (ms[type] || 0) + 1;
    ms.totalItems = (ms.totalItems || 0) + 1;
    const starGain = type === 'super_star' ? 3 : type === 'star' ? 1 : (type === 'crystal' || type === 'coupon_box' || type === 'egg') ? 1 : 0;
    if (starGain > 0) {
      ms.starsEarned = (ms.starsEarned || 0) + starGain;
      if (this.state.profile) this.state.profile.stars = (this.state.profile.stars || 0) + starGain;
    }
    if (Array.isArray(this.state.missions)) {
      for (const m of this.state.missions) {
        const matchesMetric = m.metric === type || (m.metric === 'powerup' && (type === 'shield' || type === 'speed' || type === 'mushroom')) || (m.metric === 'treasure' && (type === 'egg' || type === 'coupon_box' || type === 'crystal'));
        if (matchesMetric && !m.claimed) {
          m.currentCount = (m.currentCount || 0) + 1;
          if (m.currentCount >= (m.targetCount || 1)) m.isCompleted = true;
        }
      }
    }
  }

  public requestRespawn(method: 'stars' | 'ticket' | 'ad' | 'wait', adToken?: string) {
    this.client.requestRespawn(method, adToken);
  }

  public async abandonMatch() {
    this.stopGameLoopAndInput();
    this.client.disconnect();
    this.state.activeNpcEncounter = null;
    this.state.nearbyNpcId = null;
    this.state.activeQuizQuestion = null;
    document.getElementById('tactical-overlay')?.remove();
    const dur = Math.max(1, Math.round((Date.now() - this.state.matchStartTs) / 1000));
    if (getPlayerToken() || hasConfiguredServer()) {
      await api('/api/match/abandon', {
        method: 'POST',
        body: JSON.stringify({
          mode: this.state.selectedUIMode,
          score: Math.round(this.state.lastSnake?.score || 0),
          survivalSeconds: dur,
        }),
      });
    }
    await this.refreshProfile();
    this.setScreen('app');
  }

  private async endMatch(isVictory: boolean) {
    this.stopGameLoopAndInput();
    this.client.disconnect();
    this.state.activeNpcEncounter = null;
    this.state.nearbyNpcId = null;
    this.state.activeQuizQuestion = null;
    document.getElementById('tactical-overlay')?.remove();

    if (Object.keys(this.offlineQueue).length && getPlayerToken()) {
      await api('/api/progress/sync', { method: 'POST', body: JSON.stringify({ progress: this.offlineQueue }) });
      this.offlineQueue = {};
    }

    const dur = Math.max(1, Math.round((Date.now() - this.state.matchStartTs) / 1000));
    const me = this.state.lastSnake;
    const board = this.state.lastState?.leaderboard || [];
    const rankPos = board.findIndex((e: any) => e.id === me?.id) + 1;
    const placement = isVictory ? 1 : (rankPos > 1 ? rankPos : 2);

    const matchId = `match_${this.state.matchStartTs || Date.now()}`;
    const res = (getPlayerToken() || hasConfiguredServer())
      ? await api('/api/match/summary', {
          method: 'POST',
          body: JSON.stringify({
            matchId,
            mode: this.state.selectedUIMode,
            roomId: this.state.selectedRoomId,
            score: Math.round(me?.score || 0),
            kills: me?.kills || 0,
            deaths: isVictory ? 0 : 1,
            placement,
            survivalSeconds: dur,
            areasVisited: this.visitedAreas.size,
            longestSnake: me?.length || 9,
          }),
        })
      : { ok: false, status: 0, data: null };
    if (res.ok && res.data) {
      this.state.summary = { matchId, ...res.data };
      if (res.data.profile) this.state.profile = res.data.profile;
    } else {
      const runScore = Math.round(me?.score || 0);
      const runKills = me?.kills || 0;
      const fallbackStars = Math.max(50, Math.floor(runScore / 10) + runKills * 50 + (isVictory ? 500 : 0));
      const fallbackXp = Math.max(25, Math.floor(runScore / 5) + runKills * 100 + (isVictory ? 300 : 0));
      this.state.summary = {
        matchId,
        score: runScore,
        kills: runKills,
        placement,
        earnedStars: fallbackStars,
        earnedXP: fallbackXp,
      };
    }

    const bestBefore = this.state.profile?.stats?.highestScore || 0;
    const classicBeat = this.state.selectedUIMode === 'nokia' && (me?.score || 0) >= 300 && (me?.score || 0) >= bestBefore;
    await Promise.all([this.refreshCollectionData(), this.refreshExplorer()]);
    this.setScreen(isVictory || classicBeat ? 'victory' : 'gameover');
  }

  private stopGameLoopAndInput() {
    if (this.animFrameId) { cancelAnimationFrame(this.animFrameId); this.animFrameId = 0; }
    if (this.inputIntervalId) { clearInterval(this.inputIntervalId); this.inputIntervalId = null; }
  }

  // ------------------------------------------------------------- Input Controls
  private setupGameInput() {
    if (!this.inputBound) {
      this.inputBound = true;
      window.addEventListener('mousemove', (e) => {
        if (this.state.screen !== 'play' || this.joyId !== null) return;
        const vp = window.visualViewport;
        const cx = (vp ? vp.width : window.innerWidth) / 2;
        const cy = (vp ? vp.height : window.innerHeight) / 2;
        if (Math.hypot(e.clientX - cx, e.clientY - cy) > 8) {
          this.angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        }
      });
      window.addEventListener('mousedown', (e) => {
        if (this.state.screen !== 'play') return;
        if ((e.target as HTMLElement)?.closest('.hud-overlay button, .touch-btn, .npc-prompt')) return;
        this.mouseBoost = true;
      });
      window.addEventListener('mouseup', () => { this.mouseBoost = false; });

      window.addEventListener('keydown', (e) => {
        const rawKey = typeof e.key === 'string' ? e.key : '';
        if (!rawKey) return;
        const k = rawKey.toLowerCase();
        if (rawKey === 'Escape' || (k === 'p' && (this.state.screen === 'play' || this.state.screen === 'pause'))) {
          if (this.state.screen === 'play') this.setScreen('pause');
          else if (this.state.screen === 'pause') this.resumeMatch();
          return;
        }
        if (this.state.screen !== 'play') return;
        this.activeKeys.add(k);
        this.updateKeyboardAngle();
        if (k === ' ' || k === 'shift') this.keyBoost = true;
        if (k === 'q') this.ctx.activateAbility();
        if (k === 'z') this.ctx.cycleZoom();
        if (k === 'm') this.ctx.openTacticalMap();
        if (k === 'e' && this.state.nearbyNpcId && !this.state.activeNpcEncounter && !this.state.activeQuizQuestion) {
          void this.openNpcInteraction(this.state.nearbyNpcId);
        }
      });
      window.addEventListener('keyup', (e) => {
        const rawKey = typeof e.key === 'string' ? e.key : '';
        if (!rawKey) return;
        const k = rawKey.toLowerCase();
        this.activeKeys.delete(k);
        if (k === ' ' || k === 'shift') this.keyBoost = false;
        this.updateKeyboardAngle();
      });

      window.addEventListener('touchstart', (e) => {
        if (this.state.screen !== 'play') return;
        if (e.touches.length === 2) {
          this.pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          return;
        }
        const t = e.touches[0];
        if (this.renderer?.isPointInMinimap(t.clientX, t.clientY)) {
          this.ctx.openTacticalMap();
          triggerHaptics(15);
          return;
        }
        if ((e.target as HTMLElement)?.closest('button, .touch-btn, .hud-board, .npc-prompt, .desk-actions')) return;
        const joyEl = document.getElementById('touch-joystick');
        if (!joyEl) return;

        const isFloating = this.state.settings.joyMode === 'floating';
        if (isFloating) {
          const yPct = t.clientY / window.innerHeight;
          // Floating mode: tap anywhere in lower 65% of screen to spawn joystick
          if (yPct >= 0.35) {
            joyEl.style.left = `${t.clientX}px`;
            joyEl.style.top = `${t.clientY}px`;
            joyEl.style.transform = 'translate(-50%, -50%)';
            joyEl.classList.add('joy-active');

            const rect = joyEl.getBoundingClientRect();
            this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            this.joyRadius = rect.width / 2;
            this.joyId = t.identifier;
            this.updateJoyPos(t.clientX, t.clientY);
          }
        } else {
          if (e.target === joyEl || joyEl.contains(e.target as Node)) {
            const rect = joyEl.getBoundingClientRect();
            this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            this.joyRadius = rect.width / 2;
            this.joyId = t.identifier;
            joyEl.classList.add('joy-active');
            this.updateJoyPos(t.clientX, t.clientY);
          }
        }
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (this.state.screen !== 'play') return;
        if (e.touches.length === 2 && this.pinchDist > 0) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          if (Math.abs(d - this.pinchDist) > 28) {
            this.ctx.cycleZoom();
            this.pinchDist = d;
          }
          return;
        }
        if (this.joyId !== null) {
          for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (t.identifier === this.joyId) {
              this.updateJoyPos(t.clientX, t.clientY);
              break;
            }
          }
        }
      }, { passive: true });

      window.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joyId) {
            this.joyId = null;
            this.joyBoost = false;
            const knob = document.getElementById('touch-knob');
            if (knob) knob.style.transform = 'translate(-50%,-50%)';
            const joyEl = document.getElementById('touch-joystick');
            if (joyEl) {
              joyEl.classList.remove('joy-active');
              if (this.state.settings.joyMode === 'floating') {
                joyEl.style.left = '';
                joyEl.style.top = '';
                joyEl.style.transform = '';
              }
            }
          }
        }
        if (e.touches.length < 2) this.pinchDist = 0;
      });
    }

    if (this.inputIntervalId) clearInterval(this.inputIntervalId);
    this.inputIntervalId = setInterval(() => {
      if (this.state.screen === 'play') {
        this.client.sendInput(this.angle, this.keyBoost || this.mouseBoost || this.joyBoost);
      }
    }, 50);
  }

  private updateKeyboardAngle() {
    let x = 0, y = 0;
    if (this.activeKeys.has('w') || this.activeKeys.has('arrowup')) y -= 1;
    if (this.activeKeys.has('s') || this.activeKeys.has('arrowdown')) y += 1;
    if (this.activeKeys.has('a') || this.activeKeys.has('arrowleft')) x -= 1;
    if (this.activeKeys.has('d') || this.activeKeys.has('arrowright')) x += 1;
    if (x !== 0 || y !== 0) this.angle = Math.atan2(y, x);
  }

  private updateJoyPos(x: number, y: number) {
    const dx = x - this.joyCenter.x;
    const dy = y - this.joyCenter.y;
    const dist = Math.hypot(dx, dy);
    const deadZone = this.state.settings.joyDeadZone || 6;
    const sens = Math.max(0.5, Math.min(2.0, this.state.settings.joySensitivity || 1.0));
    const maxR = Math.max(24, this.joyRadius * 0.78);
    const edgeBoostEnabled = this.state.settings.joyEdgeBoost !== false;
    let kx = 0;
    let ky = 0;
    if (dist > deadZone) {
      const ang = Math.atan2(dy, dx);
      this.angle = ang;
      const clamped = Math.min(dist * sens, maxR);
      kx = Math.cos(ang) * clamped;
      ky = Math.sin(ang) * clamped;
      this.joyBoost = edgeBoostEnabled ? clamped >= maxR * 0.86 : false;
    } else {
      this.joyBoost = false;
    }
    const knob = document.getElementById('touch-knob');
    if (knob) knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }

  private bindTouchHudButtons() {
    const triggerHaptics = (ms = 22) => {
      if (this.state.settings.haptics !== false) {
        audio.vibrate(ms);
      }
    };

    const boost = document.getElementById('touch-boost');
    if (boost) {
      const on = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.keyBoost = true;
        boost.classList.add('active');
        triggerHaptics(25);
      };
      const off = (e: Event) => {
        e.stopPropagation();
        this.keyBoost = false;
        boost.classList.remove('active');
      };
      boost.addEventListener('touchstart', on, { passive: false });
      boost.addEventListener('touchend', off);
      boost.addEventListener('touchcancel', off);
      boost.addEventListener('mousedown', on);
      boost.addEventListener('mouseup', off);
    }
    const ab = document.getElementById('touch-ability');
    if (ab) {
      const fire = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.ctx.activateAbility();
        triggerHaptics(35);
      };
      ab.addEventListener('touchstart', fire, { passive: false });
      ab.addEventListener('click', fire);
    }
    const zoom = document.getElementById('touch-zoom');
    if (zoom) {
      const fire = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.ctx.cycleZoom();
        triggerHaptics(15);
      };
      zoom.addEventListener('touchstart', fire, { passive: false });
      zoom.addEventListener('click', fire);
    }
    const mini = document.getElementById('touch-mini');
    if (mini) {
      mini.addEventListener('click', (e) => {
        e.stopPropagation();
        this.ctx.openTacticalMap();
        triggerHaptics(15);
      });
    }
  }

  public resumeMatch() {
    this.setScreen('play');
    this.startRenderLoop();
  }

  public toast(msg: string, durationMs = 2800) {
    document.getElementById('ap-toast')?.remove();
    const el = document.createElement('div');
    el.id = 'ap-toast';
    el.className = 'toast-pill';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), durationMs);
  }

  public render() {
    if (this.renderPending) return;
    this.renderPending = true;
    queueMicrotask(() => {
      this.renderPending = false;
      this.renderNow();
    });
  }

  private renderNow() {
    document.getElementById('mob-hub-drawer')?.remove();
    switch (this.state.screen) {
      case 'splash':
        renderSplashScreen(this.root);
        break;
      case 'admin':
        renderAdminScreen(this.root, this.ctx);
        break;
      case 'matchmaking':
        renderMatchmakingOverlay(this.root, this.ctx);
        break;
      case 'play':
        renderGameplayScreen(this.root, this.ctx, {
          leaderboardExpanded: this.leaderboardExpanded,
          onToggleLeaderboard: () => { this.leaderboardExpanded = !this.leaderboardExpanded; this.renderNow(); },
          onBindCanvas: (canvas) => {
            if (!this.renderer) this.renderer = new Renderer(canvas);
            else this.renderer.attach(canvas);
            this.renderer.setNpcQuotas(this.state.npcQuotas);
            this.applySettingsToDom();
            this.applyMatchTheme();

            canvas.addEventListener('click', (e) => {
              if (this.renderer?.isPointInMinimap(e.clientX, e.clientY)) {
                this.ctx.openTacticalMap();
                triggerHaptics(15);
              }
            });
          },
          onBindTouchHud: () => this.bindTouchHudButtons(),
        });
        break;
      case 'pause':
        renderPauseModal(this.root, this.ctx);
        break;
      case 'respawn':
        renderRespawnModal(this.root, this.ctx);
        break;
      case 'victory':
        renderResultScreen(this.root, this.ctx, true);
        break;
      case 'gameover':
        renderResultScreen(this.root, this.ctx, false);
        break;
      default:
        renderAppShell(this.root, this.ctx);
        break;
    }
  }
}

new AnacondaParkApp();
