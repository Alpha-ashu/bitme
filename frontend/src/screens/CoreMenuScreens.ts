import { api, fmtNum, fmtTime } from '../api/ApiClient';
import { adSlotPlaceholder, mountAdSlots } from '../components/AdBanner';
import {
  imgBundleSprite,
  svgAvatarBadge,
  svgCloseX,
  svgCrownIcon,
  svgKingdomBadge,
  svgModeBadge,
  svgNavIcon,
  svgNpcPortrait,
  svgSerpentCrest,
  svgSnakePreview,
  svgStarCoin,
  svgTicket,
} from '../components/CartoonUi';
import * as story from '../game/story';
import { esc } from '../utils/escapeHtml';
import {
  bindCollectionSocialEvents,
  renderEventsPage,
  renderInventoryPage,
  renderLeaderboardPage,
  renderMissionsPage,
  renderRewardsPage,
  renderSocialPage,
} from './CollectionSocialScreens';
import { bindAdventureJourneyEvents, renderAdventureJourneyMap } from '../components/AdventureJourneyMap';
import { AppContext, EVO_LADDER, getViewportTier, ONB_AVATARS, Page, REGIONS, UI_MODE_ORDER, UI_MODES, UIMode } from './types';

const menuUiState = {
  homeModePage: 0,
  storyTab: 'campaign' as 'campaign' | 'realms' | 'quests' | 'npcs',
  storyQuestPage: 0,
  campaignWorld: 1,
  campaignPage: 0,
  campaignHalf: 0,
  journeyView: 'map' as 'map' | 'quests',
  lobbyTab: 'rooms' as 'rooms' | 'create' | 'join',
  lobbyPage: 0,
  profileTab: 'identity' as 'identity' | 'stats' | 'history',
  profileHistPage: 0,
  settingsTab: 'controls' as 'controls' | 'audio',
};

const LEVEL_TYPE_ICON: Record<string, string> = {
  exploration: '🧭',
  collection: '🍎',
  word_puzzle: '🔤',
  math: '🧮',
  navigation: '🗺️',
  memory: '🧠',
  survival: '🛡️',
  logic: '🧩',
  rescue: '🛟',
  boss_checkpoint: '👑',
  major_milestone: '🏰',
  secret: '✨',
};

function renderHomePage(ctx: AppContext): string {
  const { state } = ctx;
  const p = state.profile || {};
  const level = p.level || 1;
  const rank = p.rank?.title ? p.rank : story.princeRank(level);
  const xpPct = Math.min(100, Math.round(((p.xp || 0) / Math.max(1, p.xpToNext || 100)) * 100));
  const castlePct = story.castleProgress(level);
  const curKingdom = state.explorer?.kingdom || story.KINGDOMS[0];
  const dailyDone = (state.missions || []).filter(m => m.category === 'daily' && m.isCompleted).length;
  const dailyTot = (state.missions || []).filter(m => m.category === 'daily').length;

  const tier = getViewportTier();
  const quickIds: UIMode[] = ['explorer', 'free_roam', 'battle_royale', 'team', 'boss', 'nokia'];
  const perPage = tier === 'tiny' ? 2 : tier === 'landscape' ? 3 : tier === 'mobile' ? 4 : 6;
  const totalPages = Math.max(1, Math.ceil(quickIds.length / perPage));
  menuUiState.homeModePage = Math.max(0, Math.min(menuUiState.homeModePage, totalPages - 1));
  const slice = quickIds.slice(menuUiState.homeModePage * perPage, menuUiState.homeModePage * perPage + perPage);

  const activeLevel = Number(state.adventure?.axes?.highestUnlockedLevel || 1);
  const storyChapter = curKingdom.n || 1;

  return `
    <div class="home-stage">
      <section class="hero-card">
        <div class="hero-main">
          <div class="hero-top-meta">
            <span class="hero-eyebrow">${esc(rank.title)} · Lv.${level}</span>
            <span class="hero-castle-tag">Castle ${castlePct}%</span>
          </div>
          <h2>${esc(curKingdom.name || 'Emerald Hollow')}</h2>
          <div class="xp-row">
            <div class="hud-bar gold"><div style="width:${xpPct}%"></div></div>
            <small>${fmtNum(p.xp)} / ${fmtNum(p.xpToNext || 100)} XP</small>
          </div>
          ${tier !== 'tiny' && tier !== 'landscape' ? `
            <button type="button" class="streak-checks-row" data-nav="missions" aria-label="Daily Tasks">
              ${Array.from({ length: Math.min(6, dailyTot || 6) }, (_, idx) => {
                const done = idx < dailyDone;
                const isNext = idx === dailyDone;
                return `<span class="streak-box ${done ? 'done' : isNext ? 'today' : ''}">${done ? '✓' : idx + 1}</span>`;
              }).join('')}
              <small class="streak-count">${dailyDone}/${dailyTot || 6} Tasks</small>
            </button>
          ` : ''}
          <div class="hero-ctas hero-ctas-single">
            <button class="btn btn-primary hero-play-btn" data-quick-start="${esc(state.selectedUIMode)}">▶ Play ${esc(UI_MODES[state.selectedUIMode].name)}</button>
          </div>
        </div>

        <div class="hero-right-col">
          <div class="hero-stats-mini three-col">
            <div class="mini-kpi"><span>Best</span><b>${fmtNum(p.stats?.highestScore)}</b></div>
            <div class="mini-kpi"><span>Wins</span><b>${fmtNum(p.stats?.matchesWon)}</b></div>
            <div class="mini-kpi"><span>Kills</span><b>${fmtNum(p.stats?.totalKills)}</b></div>
          </div>
        </div>
      </section>

      ${tier === 'tablet' || tier === 'desktop' ? adSlotPlaceholder('home_screen', 'home-ad-banner') : ''}

      <div class="page-hdr home-quick-hdr">
        <h3>Featured Game Modes</h3>
        ${totalPages > 1 ? `
          <div class="pill-group">
            <button class="btn btn-xs btn-soft" data-home-page="-1" ${menuUiState.homeModePage === 0 ? 'disabled' : ''}>◀</button>
            <span class="pager-dots">${menuUiState.homeModePage + 1}/${totalPages}</span>
            <button class="btn btn-xs btn-soft" data-home-page="1" ${menuUiState.homeModePage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
          </div>
        ` : ''}
      </div>

      <div class="quick-mode-grid" style="grid-template-columns:repeat(${Math.min(slice.length || 2, perPage === 6 ? 3 : 2)}, minmax(0,1fr))">
        ${slice.map(id => {
          const m = UI_MODES[id];
          return `
            <button type="button" class="quick-mode-pill ${ctx.state.selectedUIMode === id ? 'selected' : ''}" data-quick-start="${id}">
              ${svgModeBadge(id, tier === 'tiny' || tier === 'landscape' ? 30 : 34)}
              <span class="qm-info">
                <strong class="uname-ellipsis">${esc(m.name)}</strong>
                <small class="uname-ellipsis">${esc(m.tag)}</small>
              </span>
              <span class="qm-go">▶</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Active Realm Campaign Spotlight Banner (Fills Mobile Void & Drives Story Retention) -->
      <section class="home-quest-banner" data-nav="story" role="button" tabindex="0" aria-label="Continue Story Adventure">
        <div class="hqb-badge">
          ${svgCrownIcon(1, 30)}
        </div>
        <div class="hqb-info">
          <div class="hqb-header-row">
            <span class="hqb-tag">CAMPAIGN · CHAPTER ${storyChapter}</span>
            <span class="hqb-reward">+${storyChapter * 150} ★ Star Coins</span>
          </div>
          <strong class="hqb-title">${esc(curKingdom.name || 'Emerald Hollow')} · Stage ${activeLevel}</strong>
          <p class="hqb-sub">Winding alpine trail awaits — complete stages to unlock rewards</p>
          <div class="hqb-progress-wrap">
            <div class="hud-bar gold" style="height:6px"><div style="width:${Math.min(100, Math.max(10, ((activeLevel % 10) || 1) * 10))}%"></div></div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-gold hqb-cta" data-nav="story">
          Continue ▶
        </button>
      </section>
    </div>
  `;
}

function renderPlayModePage(ctx: AppContext): string {
  const tier = getViewportTier();
  const sel = ctx.state.selectedUIMode;
  const m = UI_MODES[sel];
  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Modes</h2>
        <span class="pill">7 Game Modes</span>
      </div>

      <section class="panel game-wood-rim mode-spotlight" style="margin-top:8px">
        <div class="ribbon-wrap" style="position:absolute;top:0;left:50%;transform:translateX(-50%);margin-top:-15px">
          <div class="ribbon-plaque">${esc(m.tag)}</div>
        </div>
        <div class="mode-spot-info" style="padding-top:6px">
          ${svgModeBadge(sel, tier === 'tiny' || tier === 'landscape' ? 52 : 64)}
          <div style="min-width:0">
            <h3>${esc(m.name)}</h3>
            <p class="subtitle" style="margin-top:3px">${esc(m.rules)}</p>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" data-quick-start="${sel}">▶ Play ${esc(m.name)}</button>
          ${m.multiplayer ? `<button class="btn btn-blue" data-open-lobby="${sel}">Lobby</button>` : ''}
        </div>
      </section>

      <div class="mode-tile-grid" style="margin-top:6px">
        ${UI_MODE_ORDER.map(id => {
          const item = UI_MODES[id];
          const active = sel === id;
          return `
            <button class="mode-pick-tile ${active ? 'active' : ''}" data-select-mode="${id}">
              ${svgModeBadge(id, tier === 'tiny' ? 32 : 38)}
              <strong>${esc(item.name)}</strong>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderLobbyPage(ctx: AppContext): string {
  const { state } = ctx;
  const tier = getViewportTier();
  const isCompact = tier === 'tiny' || tier === 'mobile' || tier === 'landscape';
  const rooms = state.lobbies || [];
  const perPage = tier === 'tiny' || tier === 'landscape' ? 2 : 3;
  const totalPages = Math.max(1, Math.ceil(rooms.length / perPage));
  menuUiState.lobbyPage = Math.max(0, Math.min(menuUiState.lobbyPage, totalPages - 1));
  const shownRooms = rooms.slice(menuUiState.lobbyPage * perPage, menuUiState.lobbyPage * perPage + perPage);

  const staged = state.stagedRoom;
  const friends: any[] = state.social?.friends || [];
  const myUserId = state.user?.id || state.profile?.userId || '';

  const stagedCard = staged ? (() => {
    const members: any[] = staged.members || [];
    const me = members.find((m: any) => m.userId === myUserId);
    const isHost = staged.hostUserId === myUserId;
    return `
      <section class="panel staged-room-card">
        <div class="staged-hdr">
          <div>
            <span class="pill pill-live">ROOM READY</span>
            <h3 style="margin-top:2px">${esc(staged.mode.replace('_', ' '))} · <code>${esc(staged.roomCode || staged.roomId)}</code></h3>
            <small class="muted">${esc(staged.mapTheme || 'forest')} · ${staged.durationSeconds || 180}s · ${staged.aiBackfill ? 'AI Backfill ON' : 'Humans Only'}</small>
          </div>
          <div class="pill-group">
            <button class="btn btn-xs btn-soft" id="staged-copy-code">📋 Copy</button>
            <button class="btn btn-xs btn-danger" id="staged-leave">Leave</button>
          </div>
        </div>
        <div class="staged-members">
          ${members.map((m: any) => `
            <div class="staged-member ${m.ready ? 'ready' : ''}">
              <span>${m.isHost ? '👑 ' : ''}${esc(m.displayName || m.username || 'Player')}</span>
              <span class="pill ${m.ready ? 'pill-live' : ''}">${m.ready ? 'Ready ✓' : 'Waiting'}</span>
            </div>
          `).join('') || `<small class="muted">Waiting for players…</small>`}
        </div>
        ${friends.length ? `
          <div class="inline-form" style="margin-top:4px">
            <select id="staged-invite-sel" class="select-sm">
              ${friends.map((f: any) => `<option value="${esc(f.userId || f.id)}">${esc(f.displayName || f.username)}</option>`).join('')}
            </select>
            <button class="btn btn-xs btn-blue" id="staged-invite-btn">Invite Friend</button>
          </div>
        ` : `<small class="muted">Share code <b>${esc(staged.roomCode || '')}</b> with friends to join.</small>`}
        <div class="form-actions" style="margin-top:6px">
          <button class="btn btn-sm ${me?.ready ? 'btn-soft' : 'btn-gold'}" id="staged-ready-btn" data-next-ready="${me?.ready ? '0' : '1'}">${me?.ready ? 'Unready' : '✓ Ready Up'}</button>
          ${isHost ? `<button class="btn btn-sm btn-primary" id="staged-start-btn">▶ Start Match</button>` : `<span class="pill">Waiting for Host</span>`}
        </div>
      </section>
    `;
  })() : '';

  const createCard = `
    <section class="panel">
      <h3>Create Room</h3>
      <form id="create-room-form" class="stack-form" style="margin-top:4px">
        <div class="form-row-2">
          <label>Mode
            <select id="cr-mode">
              <option value="battle_royale">Battle Royale</option>
              <option value="team">Team Battle</option>
              <option value="classic">Free World</option>
              <option value="event">Events</option>
            </select>
          </label>
          <label>Max Players
            <input id="cr-max" type="number" min="2" max="24" value="16" />
          </label>
        </div>
        <div class="form-row-2">
          <label>Arena Theme
            <select id="cr-theme">
              <option value="forest">Forest Park</option>
              <option value="volcano">Lava Volcano</option>
              <option value="riverlands">Riverlands</option>
              <option value="ice">Frozen Spire</option>
              <option value="royal_castle">Royal Castle</option>
            </select>
          </label>
          <label>Duration
            <select id="cr-dur">
              <option value="120">2 min</option>
              <option value="180" selected>3 min</option>
              <option value="300">5 min</option>
            </select>
          </label>
        </div>
        <div class="form-row-2" style="gap:6px">
          <label class="checkbox-inline"><input id="cr-bots" type="checkbox" checked /><span>AI Backfill</span></label>
          <label class="checkbox-inline"><input id="cr-priv" type="checkbox" /><span>Private</span></label>
        </div>
        <label class="checkbox-inline"><input id="cr-stage" type="checkbox" checked /><span>Stage in lobby (invite &amp; ready up first)</span></label>
        <button type="submit" class="btn btn-primary btn-sm">Create Room</button>
      </form>
    </section>
  `;

  const joinCard = `
    <section class="panel">
      <h3>Join by Code</h3>
      <form id="join-code-form" class="inline-form" style="margin-top:6px">
        <input id="join-code-inp" type="text" required maxlength="8" placeholder="K7M9P2" />
        <button type="submit" class="btn btn-gold btn-sm">Join</button>
      </form>
      <div class="form-actions" style="margin-top:10px">
        <button class="btn btn-primary btn-xs" data-quick-start="battle_royale">Auto Royale</button>
        <button class="btn btn-blue btn-xs" data-quick-start="team">Auto Team</button>
      </div>
    </section>
  `;

  const roomsCard = `
    <section class="panel" style="display:flex;flex-direction:column;gap:8px;flex:1;min-height:0">
      <div class="page-hdr" style="margin:0">
        <h3 style="font-size:15px">Open Rooms (${rooms.length})</h3>
        ${totalPages > 1 ? `
          <div class="pill-group">
            <button class="btn btn-xs btn-soft" data-lobby-page="-1" ${menuUiState.lobbyPage === 0 ? 'disabled' : ''}>◀</button>
            <span class="pager-dots">${menuUiState.lobbyPage + 1}/${totalPages}</span>
            <button class="btn btn-xs btn-soft" data-lobby-page="1" ${menuUiState.lobbyPage >= totalPages - 1 ? 'disabled' : ''}>▶</button>
          </div>
        ` : ''}
      </div>
      <div class="stack-list">
        ${shownRooms.map((r: any) => `
          <div class="mission-card" style="flex-direction:row;align-items:center;justify-content:space-between;padding:8px 10px">
            <div style="min-width:0">
              <strong class="uname-ellipsis" style="font-size:13px;display:block">${esc(r.hostName || r.roomId)}</strong>
              <small class="muted">${esc(r.mode)} · ${r.playerCount}/${r.maxPlayers}${r.stageStatus === 'lobby' ? ' · Staging' : ''}${r.roomCode ? ` · ${esc(r.roomCode)}` : ''}</small>
            </div>
            <button class="btn btn-xs btn-primary" data-join-room="${esc(r.roomId)}" data-room-mode="${esc(r.mode)}" data-room-stage="${esc(r.stageStatus || 'open')}">Join</button>
          </div>
        `).join('') || `<p class="empty-msg">No public rooms active.</p>`}
      </div>
    </section>
  `;

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Lobby</h2>
        <div class="pill-group">
          <select id="lobby-region" class="select-sm" style="width:auto">
            ${REGIONS.map(r => `<option value="${esc(r)}" ${state.selectedRegion === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}
          </select>
          <button id="lobby-refresh" class="btn btn-xs btn-gold" aria-label="Refresh">↻</button>
        </div>
      </div>

      ${stagedCard ? stagedCard : isCompact ? `
        <div class="seg-pill" style="align-self:flex-start">
          <button class="seg-btn ${menuUiState.lobbyTab === 'rooms' ? 'active' : ''}" data-lobby-tab="rooms">Rooms (${rooms.length})</button>
          <button class="seg-btn ${menuUiState.lobbyTab === 'create' ? 'active' : ''}" data-lobby-tab="create">Create</button>
          <button class="seg-btn ${menuUiState.lobbyTab === 'join' ? 'active' : ''}" data-lobby-tab="join">Join Code</button>
        </div>
        ${menuUiState.lobbyTab === 'rooms' ? roomsCard : menuUiState.lobbyTab === 'create' ? createCard : joinCard}
      ` : `
        <div class="admin-split">
          <div class="stack-list">${createCard}${joinCard}</div>
          ${roomsCard}
        </div>
      `}
    </div>
  `;
}

function renderStoryPage(ctx: AppContext): string {
  if (menuUiState.journeyView === 'map') {
    return renderAdventureJourneyMap(ctx);
  }

  const { state } = ctx;
  const tier = getViewportTier();
  const isCompact = tier === 'tiny' || tier === 'mobile' || tier === 'landscape';
  const ov = state.explorer;
  const adv = state.adventure;
  const level = state.profile?.level || 1;
  const axes = adv?.axes || {
    adventureLevel: 1,
    highestUnlockedLevel: 1,
    campaignCompletionPct: 0,
    accountLevel: level,
    evolutionTier: state.profile?.equippedEvolution || 'Baby',
    prestige: state.profile?.prestige || 0,
    currentWorld: 1,
    bossCheckpointsCleared: 0,
    bossCheckpointsTotal: 100,
    majorMilestonesCleared: 0,
    majorMilestonesTotal: 10,
  };
  const worlds: any[] = adv?.worlds || Array.from({ length: 10 }, (_, i) => ({
    worldNumber: i + 1,
    name: story.KINGDOMS[i]?.name || `World ${i + 1}`,
    levelStart: i * 100 + 1,
    levelEnd: (i + 1) * 100,
    unlocked: i === 0,
    levelsCleared: 0,
    bossesCleared: 0,
  }));
  const activeWorld = adv?.world || worlds[menuUiState.campaignWorld - 1] || worlds[0];
  const rawLevels: any[] = adv?.levels || Array.from({ length: 20 }, (_, i) => ({
    levelNumber: i + 1,
    title: `Stage ${i + 1}`,
    levelType: (i + 1) % 10 === 0 ? 'boss_checkpoint' : 'exploration',
    isBossCheckpoint: (i + 1) % 10 === 0,
    isMajorMilestone: (i + 1) % 100 === 0,
    unlocked: i === 0,
    completed: false,
    isCurrent: i === 0,
  }));
  const advPage = adv?.page ?? menuUiState.campaignPage;
  const advTotalPages = adv?.totalPages ?? 5;
  const tilesPerView = tier === 'tiny' || tier === 'landscape' ? 10 : isCompact ? 10 : 20;
  const halfOffset = tilesPerView === 10 ? (menuUiState.campaignHalf % 2) * 10 : 0;
  const visibleLevels = rawLevels.slice(halfOffset, halfOffset + tilesPerView);
  const viewRangeStart = visibleLevels[0]?.levelNumber ?? (advPage * 20 + 1);
  const viewRangeEnd = visibleLevels[visibleLevels.length - 1]?.levelNumber ?? (viewRangeStart + tilesPerView - 1);

  const kingdoms: any[] = ov?.kingdoms || story.KINGDOMS.map(k => ({
    ...k, unlocked: k.n === 1, completed: false, current: k.n === state.selectedKingdom, questsDone: 0, questsTotal: 3,
  }));
  const current = ov?.kingdom || kingdoms.find((k: any) => k.n === state.selectedKingdom) || kingdoms[0];
  const quests: any[] = ov?.quests || [];
  const npcs: any[] = ov?.npcs || [];

  const qPerPage = tier === 'tiny' || tier === 'landscape' ? 1 : 2;
  const qPages = Math.max(1, Math.ceil(quests.length / qPerPage));
  menuUiState.storyQuestPage = Math.max(0, Math.min(menuUiState.storyQuestPage, qPages - 1));
  const shownQuests = quests.slice(menuUiState.storyQuestPage * qPerPage, menuUiState.storyQuestPage * qPerPage + qPerPage);

  const campaignBlock = `
    <section class="panel campaign-panel">
      <div class="campaign-axes-bar">
        <span class="pill pill-live">Adv Lv.${axes.adventureLevel}/1000</span>
        <span class="pill">👑 ${axes.bossCheckpointsCleared}/${axes.bossCheckpointsTotal}</span>
        <span class="pill">🏰 ${axes.majorMilestonesCleared}/${axes.majorMilestonesTotal}</span>
        <span class="pill">Acct Lv.${axes.accountLevel}</span>
        <span class="pill">${esc(axes.evolutionTier)}</span>
        ${axes.prestige > 0 ? `<span class="pill">★P${axes.prestige}</span>` : ''}
      </div>

      <div class="campaign-world-strip" role="tablist" aria-label="10 Campaign Worlds">
        ${worlds.map((w: any) => `
          <button class="world-chip ${w.worldNumber === activeWorld.worldNumber ? 'active' : ''} ${w.unlocked ? '' : 'locked'}"
            data-adv-world="${w.worldNumber}" title="${esc(w.name)} (${w.levelStart}-${w.levelEnd})">
            <b>W${w.worldNumber}</b>
            <small>${w.unlocked ? `${w.levelsCleared || 0}/100` : '🔒'}</small>
          </button>
        `).join('')}
      </div>

      <div class="campaign-grid-hdr">
        <div style="min-width:0">
          <strong class="uname-ellipsis" style="display:block;font-size:13px">W${activeWorld.worldNumber} · ${esc(activeWorld.name)}</strong>
          <small class="muted">Lv.${viewRangeStart}–${viewRangeEnd} · Boss every 10 · Milestone Lv.${activeWorld.levelEnd}</small>
        </div>
        <div class="pill-group">
          <button class="btn btn-xs btn-soft" data-adv-step="-1" ${advPage === 0 && halfOffset === 0 ? 'disabled' : ''}>◀</button>
          <span class="pager-dots">${viewRangeStart}–${viewRangeEnd}</span>
          <button class="btn btn-xs btn-soft" data-adv-step="1" ${advPage >= advTotalPages - 1 && (tilesPerView === 20 || menuUiState.campaignHalf === 1) ? 'disabled' : ''}>▶</button>
        </div>
      </div>

      <div class="campaign-level-grid ${tilesPerView === 20 ? 'cols-5' : 'cols-5 compact'}">
        ${visibleLevels.map((lvl: any) => {
          const icon = LEVEL_TYPE_ICON[lvl.levelType] || '🧭';
          const cls = [
            'lvl-tile',
            lvl.isMajorMilestone ? 'milestone' : lvl.isBossCheckpoint ? 'boss' : '',
            lvl.completed ? 'done' : lvl.isCurrent ? 'current' : lvl.unlocked ? 'open' : 'locked',
          ].filter(Boolean).join(' ');
          return `
            <button class="${cls}" data-adv-play="${lvl.levelNumber}" ${lvl.unlocked ? '' : 'disabled'} title="${esc(lvl.title || `Level ${lvl.levelNumber}`)}">
              <span class="lvl-ico">${lvl.unlocked ? icon : '🔒'}</span>
              <strong class="lvl-num">${lvl.levelNumber}</strong>
              <small class="lvl-tag">${lvl.completed ? '✓' : lvl.isMajorMilestone ? 'BOSS' : lvl.isBossCheckpoint ? 'BOSS' : lvl.isCurrent ? 'NOW' : ''}</small>
            </button>
          `;
        }).join('')}
      </div>
    </section>
  `;

  const realmsBlock = `
    <div class="kingdom-strip">
      ${kingdoms.map((k: any) => {
        const starCnt = k.completed ? 3 : Math.min(3, k.questsDone || 0);
        return `
          <button class="kingdom-tile ${k.current ? 'current' : ''} ${k.unlocked ? '' : 'locked'}" data-sel-kingdom="${k.n}">
            ${svgKingdomBadge(k.n, tier === 'tiny' ? 28 : tier === 'mobile' ? 36 : 46)}
            <strong>${k.n}. ${esc(k.name)}</strong>
            <div class="stage-stars-mini" aria-label="${starCnt} stars">
              ${[1, 2, 3].map(s => `<img src="/assets/sprites/ui_star_wood.png" width="12" height="12" alt="" style="${s <= starCnt ? '' : 'filter:grayscale(1) opacity(0.35)'}" />`).join('')}
            </div>
            <small>${k.completed ? 'Done ✓' : k.unlocked ? `${k.questsDone}/${k.questsTotal}` : `Lv.${k.unlockLevel}`}</small>
          </button>
        `;
      }).join('')}
    </div>
  `;

  const questsBlock = `
    <section class="panel" style="display:flex;flex-direction:column;gap:8px">
      <div class="page-hdr" style="margin:0">
        <h3 style="font-size:15px">${esc(current.name)} Quests</h3>
        ${qPages > 1 ? `
          <div class="pill-group">
            <button class="btn btn-xs btn-soft" data-sq-page="-1" ${menuUiState.storyQuestPage === 0 ? 'disabled' : ''}>◀</button>
            <span class="pager-dots">${menuUiState.storyQuestPage + 1}/${qPages}</span>
            <button class="btn btn-xs btn-soft" data-sq-page="1" ${menuUiState.storyQuestPage >= qPages - 1 ? 'disabled' : ''}>▶</button>
          </div>
        ` : ''}
      </div>
      <div class="stack-list">
        ${shownQuests.map((q: any) => `
          <div class="mission-card ${q.claimed ? 'done' : ''}">
            <div class="m-top">
              <div><strong>${esc(q.title)}</strong><p>${esc(q.brief)}</p></div>
              <span class="pill">+${q.rewardStars}★</span>
            </div>
            <div class="hud-bar"><div style="width:${q.pct}%"></div></div>
            <div class="m-foot">
              <span>${q.progress}/${q.target}</span>
              ${q.claimed
                ? `<span class="pill pill-live">Done ✓</span>`
                : q.completed
                  ? `<button class="btn btn-xs btn-gold" data-q-claim="${esc(q.id)}">Claim</button>`
                  : q.accepted
                    ? `<small class="muted">Active</small>`
                    : `<button class="btn btn-xs btn-primary" data-q-accept="${esc(q.id)}">Accept</button>`}
            </div>
          </div>
        `).join('') || `<p class="empty-msg">Quests sync once connected.</p>`}
      </div>
    </section>
  `;

  const npcsBlock = `
    <section class="panel" style="display:flex;flex-direction:column;gap:8px">
      <h3 style="font-size:15px">Residents &amp; Guardian</h3>
      <div class="stack-list">
        ${npcs.slice(0, 2).map((n: any) => `
          <div class="npc-card-row">
            ${svgNpcPortrait(n.role, 36)}
            <div style="min-width:0;flex:1"><strong style="font-size:13px">${esc(n.name)} <small class="pill">${esc(n.role)}</small></strong><p class="subtitle uname-ellipsis" style="display:block">${esc(n.line)}</p></div>
          </div>
        `).join('')}
      </div>
      ${current.boss ? `
        <div class="boss-card-box">
          <div style="min-width:0">
            <span class="pill">BOSS</span>
            <h4>${esc(current.boss.name)}</h4>
            <small>HP ${current.boss.hp} · ${current.boss.defeated ? 'Defeated ✓' : `Lv.${current.boss.unlockLevel}+`}</small>
          </div>
          <button class="btn btn-sm btn-gold" id="story-boss-btn-2">Challenge</button>
        </div>
      ` : ''}
    </section>
  `;

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Adventure</h2>
        <div class="form-actions">
          <button class="btn btn-gold btn-xs" id="journey-open-map">🗺 Journey Map</button>
          <button class="btn btn-primary btn-xs" id="story-resume-adv" data-adv-play="${axes.highestUnlockedLevel}">▶ Lv.${axes.highestUnlockedLevel}</button>
          <button class="btn btn-gold btn-xs" id="story-enter-world">Explore</button>
          ${current.boss ? `<button class="btn btn-blue btn-xs" id="story-fight-boss">Boss</button>` : ''}
        </div>
      </div>

      <div class="seg-pill" style="align-self:flex-start">
        <button class="seg-btn ${menuUiState.storyTab === 'campaign' ? 'active' : ''}" data-story-tab="campaign">1,000 Levels</button>
        <button class="seg-btn ${menuUiState.storyTab === 'realms' ? 'active' : ''}" data-story-tab="realms">Realms</button>
        <button class="seg-btn ${menuUiState.storyTab === 'quests' ? 'active' : ''}" data-story-tab="quests">Quests</button>
        <button class="seg-btn ${menuUiState.storyTab === 'npcs' ? 'active' : ''}" data-story-tab="npcs">Guardian</button>
      </div>

      ${menuUiState.storyTab === 'campaign'
        ? campaignBlock
        : menuUiState.storyTab === 'realms'
          ? `${realmsBlock}${!isCompact ? `<div class="admin-split">${questsBlock}${npcsBlock}</div>` : ''}`
          : menuUiState.storyTab === 'quests'
            ? questsBlock
            : npcsBlock}
    </div>
  `;
}

function renderProfilePage(ctx: AppContext): string {
  const tier = getViewportTier();
  const isCompact = tier === 'tiny' || tier === 'mobile' || tier === 'landscape';
  const p = ctx.state.profile || {};
  const s = p.stats || {};
  const d = p.derivedStats || { winRate: 0, kd: 0 };
  const hist = ctx.state.history || [];
  const unlockedEvos = new Set<string>(p.unlockedEvolutions || ['Baby']);
  const curEvo = p.equippedEvolution || 'Baby';
  const prestige = p.prestige || 0;
  const canPrestige = (p.level || 1) >= 1000 && prestige < 2;

  const hPerPage = tier === 'tiny' || tier === 'landscape' ? 3 : 4;
  const hPages = Math.max(1, Math.ceil(hist.length / hPerPage));
  menuUiState.profileHistPage = Math.max(0, Math.min(menuUiState.profileHistPage, hPages - 1));
  const shownHist = hist.slice(menuUiState.profileHistPage * hPerPage, menuUiState.profileHistPage * hPerPage + hPerPage);

  const identityCard = `
    <section class="panel">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        ${svgSnakePreview(undefined, ctx.state.equippedAccessory, 56, curEvo)}
        <div style="min-width:0">
          <strong class="uname-ellipsis" style="font-size:17px;display:block">${esc(p.displayName || 'Explorer')}</strong>
          <small class="muted">${esc(curEvo)} · Lv.${p.level || 1} · Prestige ${prestige}</small>
        </div>
      </div>
      <div class="avatar-picker">
        ${ONB_AVATARS.map(av => `<button class="av-opt ${p.avatar === av ? 'active' : ''}" data-prof-av="${esc(av)}">${svgAvatarBadge(av, undefined, ctx.state.equippedAccessory, 36)}</button>`).join('')}
      </div>
      <form id="prof-name-form" class="inline-form">
        <input id="prof-name-inp" type="text" required minlength="3" maxlength="16" value="${esc(p.displayName || '')}" />
        <button type="submit" class="btn btn-xs btn-primary">Save</button>
      </form>
      <div class="stat-row-list" style="margin-top:6px">
        <div><span>Friend Code</span><code class="code-chip">${esc(p.friendCode || '—')}</code></div>
        <div><span>Evo XP · Region</span><b>${fmtNum(p.evolutionXp || 0)} · ${esc(p.preferredRegion || p.country || 'Global')}</b></div>
      </div>
    </section>
  `;

  const statsCard = `
    <section class="panel">
      <h3>Career &amp; Evolution</h3>
      <div class="kpi-grid" style="margin-top:6px">
        <div class="kpi-card"><span>Matches</span><strong>${fmtNum(s.matchesPlayed)}</strong><small>${d.winRate}% Win</small></div>
        <div class="kpi-card accent-green"><span>Kills</span><strong>${fmtNum(s.totalKills)}</strong><small>K:D ${d.kd}</small></div>
        <div class="kpi-card accent-gold"><span>High Score</span><strong>${fmtNum(s.highestScore)}</strong></div>
        <div class="kpi-card accent-blue"><span>Survival</span><strong>${fmtTime(s.longestSurvivalSeconds)}</strong></div>
      </div>
      <div class="evo-pill-row" style="margin-top:8px">
        ${EVO_LADDER.map(e => {
          const unlocked = unlockedEvos.has(e.name);
          const active = curEvo === e.name;
          return `<button class="btn btn-xs ${active ? 'btn-primary' : unlocked ? 'btn-soft' : 'btn-ghost'}" data-equip-evo="${esc(e.name)}" ${unlocked ? '' : 'disabled'}>${active ? '✓ ' : ''}${esc(e.name)}</button>`;
        }).join('')}
      </div>
      ${(p.level || 1) >= 1000 ? `
        <button id="prof-prestige-btn" class="btn btn-xs btn-gold btn-block" style="margin-top:8px" ${canPrestige ? '' : 'disabled'}>
          ${canPrestige ? `Prestige ${prestige + 1} (+5,000★)` : 'Max Prestige'}
        </button>
      ` : ''}
    </section>
  `;

  const historyCard = `
    <section class="panel">
      <div class="page-hdr" style="margin:0 0 6px">
        <h3 style="font-size:15px">Match History (${hist.length})</h3>
        ${hPages > 1 ? `
          <div class="pill-group">
            <button class="btn btn-xs btn-soft" data-ph-page="-1" ${menuUiState.profileHistPage === 0 ? 'disabled' : ''}>◀</button>
            <span class="pager-dots">${menuUiState.profileHistPage + 1}/${hPages}</span>
            <button class="btn btn-xs btn-soft" data-ph-page="1" ${menuUiState.profileHistPage >= hPages - 1 ? 'disabled' : ''}>▶</button>
          </div>
        ` : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>Mode</th><th>Result</th><th>Score</th><th>Kills</th></tr></thead>
        <tbody>
          ${shownHist.map((m: any) => `
            <tr>
              <td><b>${esc(m.mode)}</b></td>
              <td><span class="pill ${m.result === 'win' ? 'pill-live' : ''}">${m.result === 'win' ? 'WIN' : `#${m.rank || '—'}`}</span></td>
              <td>${fmtNum(m.score)}</td>
              <td>${m.kills}</td>
            </tr>
          `).join('') || `<tr><td colspan="4" class="empty-cell">No matches logged yet.</td></tr>`}
        </tbody>
      </table>
    </section>
  `;

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Profile</h2>
        <div class="form-actions">
          ${ctx.state.isGuest ? `<button id="prof-upgrade" class="btn btn-xs btn-gold">Save Account</button>` : ''}
          <button id="prof-logout" class="btn btn-xs btn-danger">Sign Out</button>
        </div>
      </div>

      ${isCompact ? `
        <div class="seg-pill" style="align-self:flex-start">
          <button class="seg-btn ${menuUiState.profileTab === 'identity' ? 'active' : ''}" data-prof-tab="identity">Identity</button>
          <button class="seg-btn ${menuUiState.profileTab === 'stats' ? 'active' : ''}" data-prof-tab="stats">Stats &amp; Evo</button>
          <button class="seg-btn ${menuUiState.profileTab === 'history' ? 'active' : ''}" data-prof-tab="history">History</button>
        </div>
        ${menuUiState.profileTab === 'identity' ? identityCard : menuUiState.profileTab === 'stats' ? statsCard : historyCard}
      ` : `
        <div class="admin-split">
          ${identityCard}
          <div class="stack-list">${statsCard}${historyCard}</div>
        </div>
      `}
    </div>
  `;
}

function renderSettingsPage(ctx: AppContext): string {
  const st = ctx.state.settings;
  const tier = getViewportTier();
  const isCompact = tier === 'tiny' || tier === 'mobile' || tier === 'landscape';

  const controlsPanel = `
    <section class="panel stack-form">
      <h3>Controls &amp; HUD</h3>
      <div class="form-row-2">
        <label>Control Side
          <select id="set-ctrl-pos">
            <option value="left" ${st.controlPos === 'left' ? 'selected' : ''}>Center Joy · Guard Left</option>
            <option value="right" ${st.controlPos === 'right' ? 'selected' : ''}>Center Joy · Guard Right</option>
          </select>
        </label>
        <label>Joystick Size
          <select id="set-joy-size">
            <option value="small" ${st.joySize === 'small' ? 'selected' : ''}>Small</option>
            <option value="medium" ${st.joySize === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="large" ${st.joySize === 'large' ? 'selected' : ''}>Large</option>
          </select>
        </label>
      </div>
      <div class="form-row-2">
        <label>Camera Preset
          <select id="set-cam">
            <option value="near" ${st.cameraPreset === 'near' ? 'selected' : ''}>Near</option>
            <option value="medium" ${st.cameraPreset === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="far" ${st.cameraPreset === 'far' ? 'selected' : ''}>Far</option>
            <option value="ultra_wide" ${st.cameraPreset === 'ultra_wide' ? 'selected' : ''}>Ultra Wide</option>
          </select>
        </label>
        <label>Quest Tracker
          <select id="set-trk-pos">
            <option value="left" ${st.trackerPos === 'left' ? 'selected' : ''}>Left</option>
            <option value="right" ${st.trackerPos === 'right' ? 'selected' : ''}>Right</option>
          </select>
        </label>
      </div>
      <label>Sensitivity (${(st.joySensitivity || 1.0).toFixed(1)}×)
        <input id="set-joy-sens" type="range" min="0.6" max="1.6" step="0.1" value="${st.joySensitivity || 1.0}" />
      </label>
      <label>Dead-Zone (${st.joyDeadZone}px)
        <input id="set-joy-dz" type="range" min="2" max="20" step="1" value="${st.joyDeadZone}" />
      </label>
      <div class="form-row-2">
        <label class="wood-switch"><span>Minimap</span><input id="set-minimap" type="checkbox" ${st.showMinimap ? 'checked' : ''} /></label>
        <label class="wood-switch"><span>Quests</span><input id="set-tracker" type="checkbox" ${st.missionTracker ? 'checked' : ''} /></label>
      </div>
    </section>
  `;

  const audioPanel = `
    <section class="panel stack-form">
      <h3>Audio &amp; Display</h3>
      <label class="wood-switch"><span>Sound Effects</span><input id="set-sfx" type="checkbox" ${st.sfx ? 'checked' : ''} /></label>
      <label class="wood-switch"><span>Synth Music</span><input id="set-music" type="checkbox" ${st.music ? 'checked' : ''} /></label>
      <label class="wood-switch"><span>Reduce Motion</span><input id="set-reduce-motion" type="checkbox" ${st.reduceMotion ? 'checked' : ''} /></label>
      <label class="wood-switch"><span>Large Text</span><input id="set-large-text" type="checkbox" ${st.largeText ? 'checked' : ''} /></label>
      <label class="wood-switch"><span>High Contrast</span><input id="set-contrast" type="checkbox" ${st.highContrast ? 'checked' : ''} /></label>
      <hr class="sep" />
      <button id="set-open-admin" class="btn btn-sm btn-soft">Admin Portal</button>
    </section>
  `;

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Settings</h2>
        <button id="set-tut" class="btn btn-xs btn-gold">How to Play</button>
      </div>
      ${isCompact ? `
        <div class="seg-pill" style="align-self:flex-start">
          <button class="seg-btn ${menuUiState.settingsTab === 'controls' ? 'active' : ''}" data-set-tab="controls">Controls</button>
          <button class="seg-btn ${menuUiState.settingsTab === 'audio' ? 'active' : ''}" data-set-tab="audio">Audio &amp; App</button>
        </div>
        ${menuUiState.settingsTab === 'controls' ? controlsPanel : audioPanel}
      ` : `
        <div class="admin-split">${controlsPanel}${audioPanel}</div>
      `}
    </div>
  `;
}

export function renderAppShell(root: HTMLElement, ctx: AppContext): void {
  const { state } = ctx;
  const p = state.profile || {};
  const navItems: Array<{ id: Page; icon: string; label: string }> = [
    { id: 'home', icon: svgNavIcon('home', 19), label: 'Home' },
    { id: 'play', icon: svgNavIcon('play', 19), label: 'Modes' },
    { id: 'lobby', icon: svgNavIcon('lobby', 19), label: 'Lobby' },
    { id: 'story', icon: svgNavIcon('story', 19), label: 'Story' },
    { id: 'inventory', icon: svgNavIcon('inventory', 19), label: 'Armory' },
    { id: 'missions', icon: svgNavIcon('missions', 19), label: 'Missions' },
    { id: 'leaderboard', icon: svgNavIcon('leaderboard', 19), label: 'Ranks' },
    { id: 'rewards', icon: svgNavIcon('rewards', 19), label: 'Rewards' },
    { id: 'social', icon: svgNavIcon('social', 19), label: 'Friends' },
    { id: 'events', icon: svgNavIcon('events', 19), label: 'Events' },
    { id: 'profile', icon: svgNavIcon('profile', 19), label: 'Profile' },
    { id: 'settings', icon: svgNavIcon('settings', 19), label: 'Settings' },
  ];
  const primaryMobileIds = new Set<Page>(['home', 'play', 'story', 'lobby']);
  const isHubActive = !primaryMobileIds.has(state.page);

  let pageHtml = '';
  switch (state.page) {
    case 'home': pageHtml = renderHomePage(ctx); break;
    case 'play': pageHtml = renderPlayModePage(ctx); break;
    case 'lobby': pageHtml = renderLobbyPage(ctx); break;
    case 'story': pageHtml = renderStoryPage(ctx); break;
    case 'inventory': pageHtml = renderInventoryPage(ctx); break;
    case 'missions': pageHtml = renderMissionsPage(ctx); break;
    case 'rewards': pageHtml = renderRewardsPage(ctx); break;
    case 'leaderboard': pageHtml = renderLeaderboardPage(ctx); break;
    case 'social': pageHtml = renderSocialPage(ctx); break;
    case 'events': pageHtml = renderEventsPage(ctx); break;
    case 'profile': pageHtml = renderProfilePage(ctx); break;
    case 'settings': pageHtml = renderSettingsPage(ctx); break;
  }

  root.innerHTML = `
    <div class="app-shell page-${state.page}">
      <header class="app-topbar">
        <div class="brand-lockup" data-nav="home">
          <span class="brand-glyph">${svgSerpentCrest(34)}</span>
          <div><strong>CoilQuest</strong><small>Explore. Evolve. Conquer.</small></div>
        </div>
        <div class="topbar-currencies">
          <div class="wallet-chip coins" title="Star Coins">${svgStarCoin(15)} <span>${fmtNum(p.stars || 0)}</span></div>
          <div class="wallet-chip tickets" title="Tickets">${svgTicket(15)} <span>${fmtNum(p.tickets || 0)}</span></div>
        </div>
        <div class="topbar-actions">
          <button class="topbar-icon-btn has-badge" data-nav="rewards" aria-label="Reward Box &amp; Boosts" title="Reward Box">
            ${imgBundleSprite('pirate_chest', 22)}
            ${(state.rewardBox?.unclaimedCount || 0) > 0 ? `<span class="topbar-badge">${state.rewardBox.unclaimedCount}</span>` : ''}
          </button>
          <button class="topbar-icon-btn" data-nav="settings" aria-label="Settings">${svgNavIcon('settings', 16)}</button>
          <button id="top-auth-btn" class="topbar-profile-pill">
            ${svgAvatarBadge(p.avatar, undefined, state.equippedAccessory, 26)}
            <span class="uname-ellipsis">${state.isGuest ? 'Sign In' : esc(p.displayName || 'Profile')}</span>
          </button>
        </div>
      </header>

      <div class="app-workspace">
        <aside class="app-sidebar" aria-label="Primary navigation">
          ${navItems.map(n => `
            <button class="nav-btn ${state.page === n.id ? 'active' : ''}" data-nav="${n.id}">
              <span>${n.icon}</span><em>${n.label}</em>
            </button>
          `).join('')}
        </aside>

        <main class="app-main">${pageHtml}</main>
      </div>

      <nav class="mobile-bottom-nav" aria-label="Primary navigation">
        ${([navItems[0], navItems[1], navItems[3], navItems[2]]).map(n => `
          <button class="mob-nav-btn ${state.page === n.id ? 'active' : ''}" data-nav="${n.id}">
            <span>${n.icon}</span><small>${n.label}</small>
          </button>
        `).join('')}
        <button class="mob-nav-btn ${isHubActive ? 'active' : ''}" id="mob-hub-btn">
          <span>${svgNavIcon('hub', 19)}</span><small>Hub</small>
        </button>
      </nav>
    </div>
  `;

  void mountAdSlots(root, state.page);
  bindMenuEvents(root, ctx, navItems.slice(4));
}

function showMobileHubDrawer(ctx: AppContext, items: Array<{ id: Page; icon: string; label: string }>) {
  document.getElementById('mob-hub-drawer')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'mob-hub-drawer';
  overlay.className = 'mob-hub-backdrop';
  overlay.innerHTML = `
    <div class="panel game-wood-rim modal-card">
      <button id="hub-close" class="close-badge crimson" aria-label="Close">${svgCloseX()}</button>
      <div class="ribbon-wrap"><div class="ribbon-plaque green">Adventure Hub</div></div>
      <div class="mob-hub-grid">
        ${items.map(it => `
          <button class="mob-hub-tile ${ctx.state.page === it.id ? 'active' : ''}" data-hub-nav="${it.id}">
            <span>${it.icon}</span>
            <small>${it.label}</small>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#hub-close')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll<HTMLElement>('[data-hub-nav]').forEach(b => {
    b.addEventListener('click', () => {
      overlay.remove();
      ctx.go(b.dataset.hubNav as Page);
    });
  });
}

function bindMenuEvents(root: HTMLElement, ctx: AppContext, hubItems: Array<{ id: Page; icon: string; label: string }> = []) {
  root.querySelector('#mob-hub-btn')?.addEventListener('click', () => showMobileHubDrawer(ctx, hubItems));
  root.querySelectorAll<HTMLElement>('[data-nav]').forEach(el => {
    el.addEventListener('click', () => ctx.go(el.dataset.nav as Page));
  });
  root.querySelector('#top-auth-btn')?.addEventListener('click', () => {
    if (ctx.state.isGuest) ctx.openAuthModal('login');
    else ctx.go('profile');
  });
  root.querySelector('#set-open-admin')?.addEventListener('click', () => {
    window.location.hash = '#/admin';
    ctx.setScreen('admin');
  });

  // Home & Modes Pagers/Selectors
  root.querySelectorAll<HTMLElement>('[data-home-page]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.homeModePage += Number(b.dataset.homePage); ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-select-mode]').forEach(b => {
    b.addEventListener('click', () => { ctx.state.selectedUIMode = b.dataset.selectMode as UIMode; ctx.render(); });
  });

  root.querySelectorAll<HTMLElement>('[data-quick-start]').forEach(b => {
    b.addEventListener('click', () => ctx.startMatch({ mode: b.dataset.quickStart as UIMode }));
  });
  root.querySelectorAll<HTMLElement>('[data-open-lobby]').forEach(b => {
    b.addEventListener('click', async () => {
      ctx.state.selectedUIMode = b.dataset.openLobby as UIMode;
      await ctx.refreshLobbies();
      ctx.go('lobby');
    });
  });

  // Lobby Tabs & Events
  root.querySelectorAll<HTMLElement>('[data-lobby-tab]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.lobbyTab = b.dataset.lobbyTab as any; ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-lobby-page]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.lobbyPage += Number(b.dataset.lobbyPage); ctx.render(); });
  });
  root.querySelector('#lobby-region')?.addEventListener('change', (e) => {
    ctx.state.selectedRegion = (e.target as HTMLSelectElement).value;
  });
  root.querySelector('#lobby-refresh')?.addEventListener('click', async () => {
    await ctx.refreshLobbies();
    ctx.render();
  });
  root.querySelector('#create-room-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mode = (root.querySelector('#cr-mode') as HTMLSelectElement).value;
    const maxPlayers = Number((root.querySelector('#cr-max') as HTMLInputElement).value) || 16;
    const mapTheme = (root.querySelector('#cr-theme') as HTMLSelectElement)?.value || 'forest';
    const durationSeconds = Number((root.querySelector('#cr-dur') as HTMLSelectElement)?.value) || 180;
    const withBots = (root.querySelector('#cr-bots') as HTMLInputElement).checked;
    const isPrivate = (root.querySelector('#cr-priv') as HTMLInputElement).checked;
    const stageInLobby = !!(root.querySelector('#cr-stage') as HTMLInputElement)?.checked;
    const r = await api('/api/lobbies/create', {
      method: 'POST',
      body: JSON.stringify({ mode, maxPlayers, isPrivate, withBots, mapTheme, durationSeconds, stageInLobby, region: ctx.state.selectedRegion }),
    });
    if (!r.ok) { ctx.toast(r.data?.error || 'Could not create room'); return; }
    const room = r.data.room;
    if (stageInLobby && room.stageStatus === 'lobby') {
      ctx.state.stagedRoom = room;
      ctx.toast(`Room staged! Share code ${room.roomCode}`);
      ctx.render();
      return;
    }
    const uiMode: UIMode = mode === 'team' ? 'team' : mode === 'battle_royale' ? 'battle_royale' : mode === 'event' ? 'event' : 'free_roam';
    ctx.toast(`Room created! Code: ${room.roomCode}`);
    ctx.startMatch({ mode: uiMode, roomId: room.roomId, roomCode: room.roomCode });
  });
  root.querySelector('#join-code-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = (root.querySelector('#join-code-inp') as HTMLInputElement).value.trim().toUpperCase();
    const r = await api('/api/lobbies/join-code', { method: 'POST', body: JSON.stringify({ code }) });
    if (!r.ok) { ctx.toast(r.data?.error || 'Room code not found'); return; }
    const room = r.data.room;
    if (room.stageStatus === 'lobby') {
      ctx.state.stagedRoom = room;
      ctx.toast(`Joined lobby ${room.roomCode}`);
      ctx.render();
      return;
    }
    const uiMode: UIMode = room.mode === 'team' ? 'team' : room.mode === 'battle_royale' ? 'battle_royale' : room.mode === 'event' ? 'event' : 'free_roam';
    ctx.startMatch({ mode: uiMode, roomId: room.roomId, roomCode: room.roomCode });
  });
  root.querySelectorAll<HTMLElement>('[data-join-room]').forEach(b => {
    b.addEventListener('click', async () => {
      const m = b.dataset.roomMode!;
      const roomId = b.dataset.joinRoom!;
      if (b.dataset.roomStage === 'lobby') {
        const r = await api(`/api/lobbies/${encodeURIComponent(roomId)}/join`, { method: 'POST', body: JSON.stringify({}) });
        if (r.ok && r.data?.room) {
          ctx.state.stagedRoom = r.data.room;
          ctx.render();
          return;
        }
      }
      const uiMode: UIMode = m === 'team' ? 'team' : m === 'battle_royale' ? 'battle_royale' : m === 'event' ? 'event' : 'free_roam';
      ctx.startMatch({ mode: uiMode, roomId });
    });
  });

  // Staged Room Controls
  root.querySelector('#staged-copy-code')?.addEventListener('click', () => {
    const code = ctx.state.stagedRoom?.roomCode || '';
    if (code && navigator.clipboard) void navigator.clipboard.writeText(code).catch(() => {});
    ctx.toast(`Room code copied: ${code}`);
  });
  root.querySelector('#staged-leave')?.addEventListener('click', () => {
    ctx.state.stagedRoom = null;
    ctx.render();
  });
  root.querySelector('#staged-ready-btn')?.addEventListener('click', async (e) => {
    const room = ctx.state.stagedRoom;
    if (!room) return;
    const ready = (e.currentTarget as HTMLElement).dataset.nextReady === '1';
    const r = await api(`/api/lobbies/${encodeURIComponent(room.roomId)}/ready`, { method: 'POST', body: JSON.stringify({ ready }) });
    if (r.ok && r.data?.room) {
      ctx.state.stagedRoom = r.data.room;
      ctx.render();
    } else {
      ctx.toast(r.data?.error || 'Could not update ready state');
    }
  });
  root.querySelector('#staged-invite-btn')?.addEventListener('click', async () => {
    const room = ctx.state.stagedRoom;
    const sel = root.querySelector('#staged-invite-sel') as HTMLSelectElement | null;
    if (!room || !sel?.value) return;
    const r = await api(`/api/lobbies/${encodeURIComponent(room.roomId)}/invite`, { method: 'POST', body: JSON.stringify({ targetUserId: sel.value }) });
    ctx.toast(r.ok ? 'Friend invite sent!' : (r.data?.error || 'Invite failed'));
  });
  root.querySelector('#staged-start-btn')?.addEventListener('click', async () => {
    const room = ctx.state.stagedRoom;
    if (!room) return;
    const r = await api(`/api/lobbies/${encodeURIComponent(room.roomId)}/start`, { method: 'POST', body: JSON.stringify({}) });
    if (!r.ok) { ctx.toast(r.data?.error || 'Could not start match'); return; }
    const started = r.data.room || room;
    ctx.state.stagedRoom = null;
    const uiMode: UIMode = started.mode === 'team' ? 'team' : started.mode === 'battle_royale' ? 'battle_royale' : started.mode === 'event' ? 'event' : 'free_roam';
    ctx.startMatch({ mode: uiMode, roomId: started.roomId, roomCode: started.roomCode });
  });

  // Story & 1,000-Level Campaign Tabs & Events
  bindAdventureJourneyEvents(root, ctx);
  root.querySelector('#journey-toggle-quests')?.addEventListener('click', () => {
    menuUiState.journeyView = 'quests';
    ctx.render();
  });
  root.querySelector('#journey-world-label')?.addEventListener('click', () => {
    menuUiState.journeyView = 'quests';
    ctx.render();
  });
  root.querySelector('#journey-open-map')?.addEventListener('click', () => {
    menuUiState.journeyView = 'map';
    ctx.render();
  });

  root.querySelectorAll<HTMLElement>('[data-story-tab]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.storyTab = b.dataset.storyTab as any; ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-adv-world]').forEach(b => {
    b.addEventListener('click', async () => {
      menuUiState.campaignWorld = Number(b.dataset.advWorld) || 1;
      menuUiState.campaignPage = 0;
      menuUiState.campaignHalf = 0;
      await ctx.refreshAdventure({ world: menuUiState.campaignWorld, page: 0 });
      ctx.render();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-adv-step]').forEach(b => {
    b.addEventListener('click', async () => {
      const dir = Number(b.dataset.advStep) || 1;
      const tier = getViewportTier();
      const isCompactView = tier === 'tiny' || tier === 'mobile' || tier === 'landscape';
      const curPage = ctx.state.adventure?.page ?? menuUiState.campaignPage;
      const totalPages = ctx.state.adventure?.totalPages ?? 5;
      if (isCompactView) {
        const nextHalf = menuUiState.campaignHalf + dir;
        if (nextHalf < 0 && curPage > 0) {
          menuUiState.campaignPage = curPage - 1;
          menuUiState.campaignHalf = 1;
          await ctx.refreshAdventure({ world: menuUiState.campaignWorld, page: menuUiState.campaignPage });
        } else if (nextHalf > 1 && curPage < totalPages - 1) {
          menuUiState.campaignPage = curPage + 1;
          menuUiState.campaignHalf = 0;
          await ctx.refreshAdventure({ world: menuUiState.campaignWorld, page: menuUiState.campaignPage });
        } else if (nextHalf === 0 || nextHalf === 1) {
          menuUiState.campaignHalf = nextHalf;
        }
        ctx.render();
      } else {
        menuUiState.campaignPage = Math.max(0, Math.min(totalPages - 1, curPage + dir));
        await ctx.refreshAdventure({ world: menuUiState.campaignWorld, page: menuUiState.campaignPage });
        ctx.render();
      }
    });
  });
  root.querySelectorAll<HTMLElement>('[data-adv-play]').forEach(b => {
    b.addEventListener('click', () => {
      const lvl = Number(b.dataset.advPlay) || 1;
      void ctx.startAdventureLevel(lvl);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-sq-page]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.storyQuestPage += Number(b.dataset.sqPage); ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-sel-kingdom]').forEach(b => {
    b.addEventListener('click', async () => {
      const kn = Number(b.dataset.selKingdom);
      const r = await api('/api/explorer/kingdom/select', { method: 'POST', body: JSON.stringify({ kingdom: kn }) });
      if (!r.ok) { ctx.toast(r.data?.message || 'Kingdom locked'); return; }
      ctx.state.selectedKingdom = kn;
      menuUiState.storyTab = 'quests';
      await ctx.refreshExplorer();
      ctx.render();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-q-accept]').forEach(b => {
    b.addEventListener('click', async () => {
      const r = await api('/api/explorer/quest/accept', { method: 'POST', body: JSON.stringify({ questId: b.dataset.qAccept }) });
      ctx.toast(r.data?.message || 'Quest accepted');
      await ctx.refreshExplorer();
      ctx.render();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-q-claim]').forEach(b => {
    b.addEventListener('click', async () => {
      const r = await api('/api/explorer/quest/claim', { method: 'POST', body: JSON.stringify({ questId: b.dataset.qClaim }) });
      ctx.toast(r.data?.message || 'Quest reward claimed!');
      await Promise.all([ctx.refreshExplorer(), ctx.refreshProfile()]);
      ctx.render();
    });
  });
  root.querySelector('#story-enter-world')?.addEventListener('click', () => {
    ctx.startMatch({ mode: 'explorer', kingdom: ctx.state.explorer?.kingdom?.n || ctx.state.selectedKingdom });
  });
  const launchBoss = () => ctx.startMatch({ mode: 'boss', kingdom: ctx.state.explorer?.kingdom?.n || ctx.state.selectedKingdom });
  root.querySelector('#story-fight-boss')?.addEventListener('click', launchBoss);
  root.querySelector('#story-boss-btn-2')?.addEventListener('click', launchBoss);

  // Profile Tabs & Events
  root.querySelectorAll<HTMLElement>('[data-prof-tab]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.profileTab = b.dataset.profTab as any; ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-ph-page]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.profileHistPage += Number(b.dataset.phPage); ctx.render(); });
  });
  root.querySelector('#prof-upgrade')?.addEventListener('click', () => ctx.openAuthModal('upgrade'));
  root.querySelector('#prof-logout')?.addEventListener('click', () => void ctx.logoutPlayer());
  root.querySelectorAll<HTMLElement>('[data-prof-av]').forEach(b => {
    b.addEventListener('click', async () => {
      await api('/api/player/edit-profile', { method: 'POST', body: JSON.stringify({ avatar: b.dataset.profAv }) });
      await ctx.refreshProfile();
      ctx.toast('Avatar updated!');
    });
  });
  root.querySelector('#prof-name-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = (root.querySelector('#prof-name-inp') as HTMLInputElement).value.trim();
    const r = await api('/api/player/edit-profile', { method: 'POST', body: JSON.stringify({ displayName }) });
    ctx.toast(r.ok ? 'Name updated!' : (r.data?.error || 'Could not update name'));
    await ctx.refreshProfile();
  });
  root.querySelectorAll<HTMLElement>('[data-equip-evo]').forEach(b => {
    b.addEventListener('click', async () => {
      const evolution = b.dataset.equipEvo!;
      const r = await api('/api/player/evolution', { method: 'POST', body: JSON.stringify({ evolution }) });
      ctx.toast(r.data?.message || `Equipped ${evolution} form!`);
      await ctx.refreshProfile();
    });
  });
  root.querySelector('#prof-prestige-btn')?.addEventListener('click', async () => {
    const r = await api('/api/player/prestige', { method: 'POST' });
    ctx.toast(r.data?.message || (r.ok ? 'Prestiged!' : 'Level 1000 required'));
    await ctx.refreshProfile();
  });

  // Settings Tabs & Events
  root.querySelectorAll<HTMLElement>('[data-set-tab]').forEach(b => {
    b.addEventListener('click', () => { menuUiState.settingsTab = b.dataset.setTab as any; ctx.render(); });
  });
  root.querySelector('#set-tut')?.addEventListener('click', () => ctx.openTutorialModal());
  root.querySelector('#set-ctrl-pos')?.addEventListener('change', (e) => ctx.updateSettings({ controlPos: (e.target as HTMLSelectElement).value as any }));
  root.querySelector('#set-joy-size')?.addEventListener('change', (e) => ctx.updateSettings({ joySize: (e.target as HTMLSelectElement).value as any }));
  root.querySelector('#set-joy-sens')?.addEventListener('change', (e) => ctx.updateSettings({ joySensitivity: Number((e.target as HTMLInputElement).value) }));
  root.querySelector('#set-joy-dz')?.addEventListener('change', (e) => ctx.updateSettings({ joyDeadZone: Number((e.target as HTMLInputElement).value) }));
  root.querySelector('#set-cam')?.addEventListener('change', (e) => ctx.updateSettings({ cameraPreset: (e.target as HTMLSelectElement).value as any }));
  root.querySelector('#set-trk-pos')?.addEventListener('change', (e) => ctx.updateSettings({ trackerPos: (e.target as HTMLSelectElement).value as any }));
  root.querySelector('#set-minimap')?.addEventListener('change', (e) => ctx.updateSettings({ showMinimap: (e.target as HTMLInputElement).checked }));
  root.querySelector('#set-tracker')?.addEventListener('change', (e) => ctx.updateSettings({ missionTracker: (e.target as HTMLInputElement).checked }));
  root.querySelector('#set-sfx')?.addEventListener('change', (e) => ctx.updateSettings({ sfx: (e.target as HTMLInputElement).checked }));
  root.querySelector('#set-music')?.addEventListener('change', (e) => ctx.updateSettings({ music: (e.target as HTMLInputElement).checked }));
  root.querySelector('#set-reduce-motion')?.addEventListener('change', (e) => ctx.updateSettings({ reduceMotion: (e.target as HTMLInputElement).checked }));
  root.querySelector('#set-large-text')?.addEventListener('change', (e) => ctx.updateSettings({ largeText: (e.target as HTMLInputElement).checked }));
  root.querySelector('#set-contrast')?.addEventListener('change', (e) => ctx.updateSettings({ highContrast: (e.target as HTMLInputElement).checked }));

  bindCollectionSocialEvents(root, ctx);
}
