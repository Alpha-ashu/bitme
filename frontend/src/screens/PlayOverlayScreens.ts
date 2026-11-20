import { api, fmtNum, fmtTime } from '../api/ApiClient';
import { adSlotPlaceholder, mountAdSlots } from '../components/AdBanner';
import { imgBundleSprite, svgCloseX, svgFoodPreview, svgModeBadge, svgNavIcon, svgStarCoin, svgStarsRating } from '../components/CartoonUi';
import { renderNpcEncounterPopup, renderQuizModal } from '../components/QuizModal';
import { ads } from '../game/AdService';
import { GameStateTick, WORLD } from '../game/GameClient';
import { audio } from '../game/AudioSystem';
import { esc, safeUrl } from '../utils/escapeHtml';
import { AppContext, EVO_LADDER, UI_MODES } from './types';

function computeRunStars(score: number, kills: number, items: number, isVictory = false): number {
  if (isVictory) return 3;
  if (score >= 1500 || kills >= 3 || items >= 25) return 3;
  if (score >= 450 || kills >= 1 || items >= 10) return 2;
  if (score >= 80 || items >= 2) return 1;
  return 0;
}

function renderLootAndTasksSummary(ctx: AppContext, opts?: { compact?: boolean }): string {
  const ms = ctx.state.matchStats || {};
  const me = ctx.state.lastSnake;
  const score = Math.round(me?.score || 0);
  const kills = me?.kills || 0;
  const walletStars = ctx.state.profile?.stars ?? 0;
  const totalItems = ms.totalItems || 0;
  const missions = Array.isArray(ctx.state.missions) ? ctx.state.missions : [];
  const activeDaily = missions.filter((m: any) => !m.claimed).slice(0, opts?.compact ? 2 : 4);
  const doneCount = missions.filter((m: any) => m.isCompleted).length;
  const quest = ctx.state.activeQuest || ctx.state.explorer?.activeQuest || null;

  const chips: Array<[string, number, string]> = [
    ['farm_cherry_twin', (ms.cherry || 0) + (ms.apple || 0), 'Fruit'],
    ['ui_star_wood', (ms.star || 0) + (ms.super_star || 0), 'Stars'],
    ['gem_cyan_rect', (ms.crystal || 0) + (ms.frog || 0), 'Gems'],
    ['ui_bolt_wood', (ms.speed || 0) + (ms.shield || 0) + (ms.mushroom || 0), 'Boosts'],
  ];

  const questIsQuiz = quest?.state === 'ACTIVE' && (quest.currentStage?.kind === 'quiz' || !!quest.quizSessionId);
  const questIsClaimable = quest?.state === 'CLAIMABLE';

  return `
    <div class="loot-tasks-box">
      <!-- Live Match Stats in Pause Screen -->
      <div class="pause-stats-banner">
        <div class="ps-stat"><small>SCORE</small><b>${fmtNum(score)}</b></div>
        <div class="ps-stat"><small>STARS</small><b>${fmtNum(walletStars)}</b></div>
        <div class="ps-stat"><small>ITEMS</small><b>${totalItems}</b></div>
        <div class="ps-stat"><small>KILLS</small><b>${kills}</b></div>
      </div>

      <!-- Active Adventure Quest (Detailed) -->
      ${quest ? `
        <div class="pause-quest-card ${questIsClaimable ? 'claimable' : ''}">
          <div class="pqc-header">
            <span class="pqc-tag">${quest.levelNumber ? `Level ${quest.levelNumber}` : 'Active Quest'}</span>
            <span class="pqc-status">${questIsClaimable ? 'DONE ✓' : `${quest.progress}/${quest.target}`}</span>
          </div>
          <strong class="pqc-title">${esc(quest.title)}</strong>
          <p class="pqc-desc">${esc(quest.currentStage?.label || quest.description || 'Complete the park objective')}</p>
          <div class="task-mini-bar" style="height:8px"><div style="width:${Math.min(100, quest.pct || 0)}%"></div></div>
          <div class="pqc-actions">
            ${questIsQuiz ? `
              <button type="button" id="pause-open-quiz" class="btn btn-sm btn-blue btn-block" style="margin-top:6px">
                🧠 Open Quiz Challenge
              </button>
            ` : ''}
            ${questIsClaimable ? `
              <button type="button" id="pause-claim-quest" class="btn btn-sm btn-gold btn-block" style="margin-top:6px">
                🏆 Claim Quest Reward
              </button>
            ` : ''}
          </div>
        </div>
      ` : `
        <div class="pause-quest-card empty">
          <span class="pqc-desc">No active quest right now. Explore the park or visit an Elder NPC to accept quests!</span>
        </div>
      `}

      <!-- Daily Tasks / Missions Status -->
      <div class="task-status-card">
        <div class="task-status-hdr">
          <span>Daily Tasks & Missions</span>
          <b>${doneCount}/${missions.length || 0} Done</b>
        </div>
        ${activeDaily.length ? activeDaily.map((m: any) => {
          const cur = Math.min(m.targetCount || 1, m.currentCount || 0);
          const tgt = Math.max(1, m.targetCount || 1);
          const pct = Math.round((cur / tgt) * 100);
          const rawTitle = String(m.title || '');
          const cleanTitle = (m.icon && rawTitle.startsWith(m.icon))
            ? rawTitle.slice(m.icon.length).trim()
            : rawTitle.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim() || rawTitle;
          const mSprite = m.metric === 'cherry' ? 'farm_cherry_twin'
            : m.metric === 'frog' ? 'gem_emerald_diamond'
            : m.metric === 'kills' ? 'pirate_sword'
            : m.metric === 'powerup' ? 'ui_bolt_wood'
            : m.isCompleted ? 'ui_heart_wood' : 'ui_star_wood';
          return `
            <div class="task-row ${m.isCompleted ? 'done' : ''}">
              <div class="task-row-top">
                <span style="display:flex;align-items:center;gap:5px">${imgBundleSprite(mSprite, 14)} <span>${esc(cleanTitle)}</span></span>
                <b>${m.isCompleted ? 'DONE ✓' : `${cur}/${tgt}`}</b>
              </div>
              <div class="task-mini-bar"><div style="width:${pct}%"></div></div>
            </div>
          `;
        }).join('') : `<div class="muted" style="font-size:11.5px;text-align:center;padding:4px">All daily tasks completed! Great work!</div>`}
      </div>

      <!-- Loot Collected This Run -->
      <div class="loot-items-row">
        ${chips.map(([sprite, qty, label]) => `
          <div class="loot-chip ${qty > 0 ? 'has' : ''}">
            ${imgBundleSprite(sprite, 20)}
            <span><b>${qty}</b><small>${label}</small></span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function svgHeartIcon(state: 'full' | 'half' | 'empty'): string {
  const fill = state === 'full' ? '#EF4444' : state === 'half' ? '#FB7185' : 'rgba(239, 68, 68, 0.16)';
  const stroke = state === 'empty' ? '#DC2626' : '#991B1B';
  return `<svg class="heart-svg ${state}" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><path d="M7.5 6.4c-.9 0-1.7.7-1.7 1.7" stroke="rgba(255,255,255,0.75)" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`;
}

function fmtHeartMMSS(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function buildFiveHeartsBarContent(hs: { hearts: number; maxHearts: number; nextRestoreInSec: number }): { key: string; html: string; low: boolean } {
  const maxH = hs.maxHearts || 5;
  const curH = Math.max(0, Math.min(maxH, hs.hearts ?? maxH));
  let html = '';
  for (let i = 0; i < maxH; i++) {
    html += svgHeartIcon(i < curH ? 'full' : 'empty');
  }
  const timerTxt = curH < maxH && hs.nextRestoreInSec > 0 ? fmtHeartMMSS(hs.nextRestoreInSec) : '';
  if (timerTxt) {
    html += `<span class="heart-restore-timer" id="hud-heart-restore">${timerTxt}</span>`;
  }
  return {
    key: `${curH}_${maxH}_${timerTxt}`,
    html,
    low: curH <= 1,
  };
}

export function patchHeartHudBar(root: HTMLElement, ctx: AppContext): void {
  const hs = ctx.getLiveHeartState();
  const heartsEl = root.querySelector('#hud-hearts-bar') as HTMLElement | null;
  if (heartsEl) {
    const h = buildFiveHeartsBarContent(hs);
    if (heartsEl.dataset.hearts !== h.key) {
      heartsEl.dataset.hearts = h.key;
      heartsEl.innerHTML = h.html;
      heartsEl.classList.toggle('low', h.low);
      heartsEl.setAttribute('aria-label', `Hearts ${hs.hearts} of ${hs.maxHearts}`);
    }
  }
  const shardEl = root.querySelector('#hud-heart-shards') as HTMLElement | null;
  if (shardEl) {
    const showShard = hs.hearts < hs.maxHearts || hs.heartShards > 0;
    shardEl.style.display = showShard ? 'inline-flex' : 'none';
    const label = `${hs.heartShards}/${hs.shardsRequired}`;
    const txtEl = shardEl.querySelector('strong');
    if (txtEl && txtEl.textContent !== label) txtEl.textContent = label;
  }
}

function svgMiniMapBtnIcon(): string {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>`;
}

function svgMiniZoomBtnIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`;
}

function stagePct(score: number): { name: string; pct: number } {
  let idx = 0;
  for (let i = 0; i < EVO_LADDER.length; i++) {
    if (score >= EVO_LADDER[i].scoreReq) idx = i;
  }
  const cur = EVO_LADDER[idx];
  const next = EVO_LADDER[idx + 1];
  if (!next) return { name: cur.name, pct: 100 };
  const pct = Math.min(100, Math.max(0, Math.round(((score - cur.scoreReq) / Math.max(1, next.scoreReq - cur.scoreReq)) * 100)));
  return { name: cur.name, pct };
}

export function renderGameplayScreen(
  root: HTMLElement,
  ctx: AppContext,
  opts: {
    onBindCanvas: (canvas: HTMLCanvasElement) => void;
    onBindTouchHud: () => void;
    onToggleLeaderboard: () => void;
    leaderboardExpanded: boolean;
  }
): void {
  const { state } = ctx;
  const st = state.lastState;
  const mode = state.selectedUIMode;
  const me = st?.snakes?.find(s => s.id === state.user?.id || s.userId === state.user?.id) || state.lastSnake;
  const score = Math.round(me?.score || 0);
  const kills = me?.kills || 0;
  const hp = Math.max(0, Math.round(me?.hp ?? 100));
  const maxHp = Math.max(1, Math.round(me?.maxHp ?? 100));
  const stage = stagePct(score);
  const rankIdx = st?.leaderboard ? (st.leaderboard.findIndex((e: any) => e.id === me?.id) + 1) : 0;
  const aliveCount = st?.snakes ? st.snakes.filter(s => s.isAlive).length : 0;
  const boss = mode === 'boss' ? st?.snakes?.find(s => s.isBoss && s.isAlive) : undefined;
  const rightSide = state.settings.controlPos === 'right';
  const trackerRight = state.settings.trackerPos === 'right';
  const joyPx = state.settings.joySize === 'small' ? 92 : state.settings.joySize === 'large' ? 132 : 112;

  const isTimed = mode === 'team' || mode === 'boss' || mode === 'battle_royale' || mode === 'event';
  const defaultSec = mode === 'boss' ? 150 : 180;
  const initTimerSec = st?.matchTimer !== undefined ? st.matchTimer : defaultSec;
  const timerPrefix = mode === 'boss' ? 'BOSS' : mode === 'team' ? 'TEAM' : mode === 'battle_royale' ? 'STORM' : 'TIME';
  const hs = ctx.getLiveHeartState();
  const hearts = buildFiveHeartsBarContent(hs);
  const showShards = hs.hearts < hs.maxHearts || hs.heartShards > 0;

  let hudTopHtml = '';
  if (mode === 'team') {
    const blue = st?.teamScores?.blue || 0;
    const red = st?.teamScores?.red || 0;
    const tot = Math.max(1, blue + red);
    const bluePct = Math.round((blue / tot) * 100);
    hudTopHtml = `
      <header class="hud-top-bar hud-team">
        <div class="hud-pill-team team-blue"><span>BLUE</span><strong id="tb-blue">${blue}</strong></div>
        <div class="hud-center-wrap">
          <div class="tb-bar"><div id="tb-fill" class="tb-bar-blue" style="width:${bluePct}%"></div></div>
          <div class="hud-team-meta">
            <span id="tb-myteam">${me?.team === 'red' ? 'RED TEAM' : 'BLUE TEAM'}</span>
            <span id="tb-timer" class="hud-timer">${fmtTime(initTimerSec)}</span>
          </div>
        </div>
        <div class="hud-pill-team team-red"><strong id="tb-red">${red}</strong><span>RED</span></div>
        <button id="btn-pause" class="hud-pause-btn" aria-label="Pause">⏸</button>
      </header>
      <div class="hud-sub-stats">
        <span><b id="tb-player-name">${esc(state.profile?.displayName || 'Player')}</b></span>
        <span>Score <b id="tb-player-score">${fmtNum(score)}</b></span>
        <span>Kills <b id="tb-player-kills">${kills}</b></span>
        <span>Rank <b id="tb-player-rank">${rankIdx > 0 ? `#${rankIdx}` : '#—'}</b></span>
      </div>
    `;
  } else {
    const extraChip = mode === 'battle_royale'
      ? `<div class="hud-stat"><small>ALIVE</small><strong id="hv-alive">${aliveCount}</strong></div>`
      : `<div class="hud-stat"><small>RANK</small><strong id="hv-rank">${rankIdx > 0 ? `#${rankIdx}` : '#—'}</strong></div>`;

    const walletStars = state.profile?.stars ?? 0;
    const collectedCnt = state.matchStats?.totalItems ?? 0;
    hudTopHtml = `
      <header class="hud-top-bar">
        <div class="hud-stats-row">
          <div class="hud-stat primary"><small style="display:flex;align-items:center;gap:4px">${svgStarCoin(13)} SCORE</small><strong id="hv-score">${fmtNum(score)}</strong></div>
          <div class="hud-stat"><small>STARS</small><strong id="hv-stars">${fmtNum(walletStars)}</strong></div>
          <div class="hud-stat"><small>ITEMS</small><strong id="hv-items">${collectedCnt}</strong></div>
          <div class="hud-stat"><small>KILLS</small><strong id="hv-kills">${kills}</strong></div>
          ${extraChip}
        </div>
        <div class="hud-stage-wrap">
          <div class="hud-hp-row">
            <span>HP ${hp}/${maxHp}</span>
            <span id="hud-stage">${esc(stage.name)}</span>
          </div>
          <div class="hud-bar"><div id="hud-hp-fill" style="width:${Math.round((hp / maxHp) * 100)}%"></div></div>
        </div>
        <button id="btn-pause" class="hud-pause-btn" aria-label="Pause">⏸</button>
      </header>
    `;
  }

  const vitalsRowHtml = `
    <div class="hud-vitals-row ${mode === 'team' ? 'is-team' : ''} ${mode === 'boss' ? 'is-boss' : ''}">
      <div class="hud-hearts-bar ${hearts.low ? 'low' : ''}" id="hud-hearts-bar" data-hearts="${hearts.key}" aria-label="Hearts ${hs.hearts} of ${hs.maxHearts}">
        ${hearts.html}
      </div>
      <div class="heart-shard-chip" id="hud-heart-shards" style="display:${showShards ? 'inline-flex' : 'none'}" title="Collect 30 in-game hearts to recharge +1 Heart">
        ${svgHeartIcon('full')}
        <strong>${hs.heartShards}/${hs.shardsRequired}</strong>
      </div>
      ${isTimed ? `
        <div class="hud-mode-timer ${initTimerSec <= 30 ? 'urgent' : ''}" id="hv-timer-pill">
          <small>${timerPrefix}</small>
          <strong id="hv-time">${fmtTime(initTimerSec)}</strong>
        </div>
      ` : ''}
    </div>
  `;

  const eventBanner = st?.currentEvent
    ? `<div class="hud-event-pill">${esc(String(st.currentEvent.title || '').replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, ''))}</div>`
    : '';

  const bossBanner = mode === 'boss'
    ? `<div class="hud-boss-bar" id="hv-boss">
         <span><strong id="hv-boss-name">${esc(boss?.displayName || 'Kingdom Boss')}</strong> · <span id="hv-boss-power">Power ${fmtNum(boss?.score || 0)}</span> · <b id="hv-boss-time">${fmtTime(initTimerSec)}</b></span>
         <div class="hud-bar boss"><div id="hv-boss-fill" style="width:${boss ? Math.max(5, Math.min(100, Math.round(((boss.hp || 0) / (boss.maxHp || 1)) * 100))) : 100}%"></div></div>
       </div>`
    : '';

  const boardList = (st?.leaderboard || []).slice(0, 6);
  const leaderboardHtml = boardList.length ? `
    <aside class="hud-board ${opts.leaderboardExpanded ? 'open' : 'collapsed'}" id="hud-board">
      <button class="hud-board-toggle" id="btn-board-toggle">${rankIdx > 0 ? `#${rankIdx}` : 'Top'} ▾</button>
      <div class="hud-board-rows">
        ${boardList.map((e: any, i: number) => `
          <div class="hb-row ${e.id === me?.id ? 'me' : ''}">
            <span>${i + 1}. ${esc(e.name)}</span>
            <b>${fmtNum(e.score)}</b>
          </div>
        `).join('')}
      </div>
    </aside>
  ` : '';

  const abCd = Math.ceil(me?.abilityCooldown || 0);
  const shieldSec = Math.ceil(me?.shieldTimer || 0);
  const speedSec = Math.ceil(me?.speedBoostTimer || 0);
  const superSec = Math.ceil(me?.superTimer || 0);
  const poisonSec = Math.ceil((me as any)?.poisonTimer || 0);
  const powerPills = buildPowerTimerHtml(shieldSec, speedSec, superSec, poisonSec);
  const zoomLbl = ctx.getZoomLabel();
  const inv = state.profile?.inventory || {};
  const ownedBoost = Number(inv.pw_boost || 0);
  const ownedShield = Number(inv.pw_shield || 0);
  const ownedSuper = Number(inv.pw_super || 0);
  const hasOwnedCharges = ownedBoost > 0 || ownedShield > 0 || ownedSuper > 0;
  const chargeBarHtml = hasOwnedCharges ? `
    <div class="hud-charge-bar" id="hud-charge-bar">
      ${ownedBoost > 0 ? `<button type="button" class="pw-charge-btn" data-use-pw="pw_boost" title="Use Speed Boost (+10s)">${imgBundleSprite('ui_bolt_wood', 16)} <span>×${ownedBoost}</span></button>` : ''}
      ${ownedShield > 0 ? `<button type="button" class="pw-charge-btn" data-use-pw="pw_shield" title="Use Guard Shield (+10s)">${imgBundleSprite('ui_heart_wood', 16)} <span>×${ownedShield}</span></button>` : ''}
      ${ownedSuper > 0 ? `<button type="button" class="pw-charge-btn" data-use-pw="pw_super" title="Use Super Surge (+8s)">${imgBundleSprite('farm_sunflower', 16)} <span>×${ownedSuper}</span></button>` : ''}
    </div>
  ` : '';

  const hudCenterVitals = `
    <div class="hud-center-vitals">
      ${bossBanner}
      ${eventBanner}
      ${vitalsRowHtml}
      <div class="hud-power-timers" id="hud-power-timers" data-key="${shieldSec}_${speedSec}_${superSec}_${poisonSec}">${powerPills}</div>
    </div>
  `;

  const hudTopRight = `
    <div class="hud-top-right-bar">
      <button id="btn-pause" class="hud-pause-btn" aria-label="Pause Game">⏸</button>
    </div>
  `;

  root.innerHTML = `
    <div class="play-viewport">
      <canvas id="game-canvas"></canvas>
      <div class="hud-overlay">
        ${hudCenterVitals}
        ${hudTopRight}
        <div id="active-quest-hud-slot"></div>
        ${chargeBarHtml}
        <div id="npc-approach-chip-slot"></div>
        <div id="npc-modal-slot"></div>
        <div id="quiz-modal-slot"></div>

        <!-- Desktop quick action bar (50% translucent at rest, rises on hover/tap) -->
        <div class="desk-actions" id="desk-actions">
          <button id="desk-ability" class="btn btn-sm btn-soft">${imgBundleSprite('ui_heart_wood', 16)} <span id="desk-ability-txt">Guard ${shieldSec > 0 ? `${shieldSec}s` : abCd > 0 ? `(${abCd}s)` : '[Q]'}</span></button>
          <button id="desk-zoom" class="btn btn-sm btn-soft">Zoom <span id="desk-zoom-lbl">${zoomLbl}</span> [Z]</button>
          <button id="desk-mini" class="btn btn-sm btn-soft">Map [M]</button>
        </div>

        <!-- Mobile / Tablet Touch Controls: Divided Left & Right Powers + Centered Precision Joystick (50% opacity) -->
        <div class="touch-hud touch-divided ${rightSide ? 'swap-sides' : ''}">
          <div class="touch-side-left">
            <div class="touch-util-row">
              <button id="touch-mini" class="touch-btn sm" aria-label="Arena Map (Safe Pause)">
                ${svgMiniMapBtnIcon()}
                <span class="tbtn-micro">MAP</span>
              </button>
              <button id="touch-zoom" class="touch-btn sm" aria-label="Camera Zoom">
                ${svgMiniZoomBtnIcon()}
                <span id="touch-zoom-label" class="tbtn-micro" style="font-size:7px;line-height:1;opacity:0.8">${zoomLbl}</span>
              </button>
            </div>
            <button id="touch-ability" class="touch-btn ${abCd > 0 ? 'cd' : ''} ${shieldSec > 0 ? 'buff-active' : ''}" aria-label="Guard Shield Power">
              ${svgFoodPreview('shield', 28)}
              <small id="ability-cd">${shieldSec > 0 ? `${shieldSec}s` : abCd > 0 ? `${abCd}s` : 'GUARD'}</small>
            </button>
          </div>

          <div id="touch-joystick" class="touch-joystick" style="--joy-size:${joyPx}px" aria-label="Movement Joystick">
            <div class="joy-ring-inner"></div>
            <div id="touch-knob" class="touch-knob"></div>
          </div>

          <div class="touch-side-right">
            <button id="touch-boost" class="touch-btn boost ${speedSec > 0 || superSec > 0 ? 'buff-active' : ''}" aria-label="Boost Speed Power">
              ${svgFoodPreview('speed', 30)}
              <small id="boost-cd">${superSec > 0 ? `${superSec}s` : speedSec > 0 ? `${speedSec}s` : 'BOOST'}</small>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const canvas = root.querySelector('#game-canvas') as HTMLCanvasElement;
  if (canvas) opts.onBindCanvas(canvas);
  opts.onBindTouchHud();

  root.querySelector('#btn-pause')?.addEventListener('click', () => {
    audio.playClick();
    ctx.setScreen('pause');
  });
  root.querySelector('#btn-board-toggle')?.addEventListener('click', () => {
    opts.onToggleLeaderboard();
  });
  root.querySelector('#desk-ability')?.addEventListener('click', () => ctx.activateAbility());
  root.querySelector('#desk-zoom')?.addEventListener('click', () => { ctx.cycleZoom(); });
  root.querySelector('#desk-mini')?.addEventListener('click', () => ctx.openTacticalMap());
  root.querySelectorAll<HTMLElement>('[data-use-pw]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.dataset.usePw as 'pw_boost' | 'pw_shield' | 'pw_super';
      if (pid) void ctx.usePowerup(pid);
    });
  });

  // Mount live non-destructive adventure overlays right after initial screen build
  patchActiveQuestHud(root, ctx);
  patchNpcApproachChip(root, ctx);
  patchNpcEncounterOverlay(root, ctx);
  patchQuizOverlay(root, ctx);
}

/** Non-destructive live Active Quest HUD (Clean minimal play field: quest details visible in Pause screen!). */
export function patchActiveQuestHud(root: HTMLElement, _ctx: AppContext) {
  const slot = root.querySelector('#active-quest-hud-slot') as HTMLElement | null;
  if (!slot) return;
  // Per user instruction: Keep screen 100% open and uncluttered during gameplay.
  // Full task details, progress & quiz buttons are accessed safely in the Pause menu!
  slot.innerHTML = '';
}

/** Non-destructive NPC Talk Chip when near an NPC (allows reopening after selecting 'Later'). */
export function patchNpcApproachChip(root: HTMLElement, ctx: AppContext) {
  const slot = root.querySelector('#npc-approach-chip-slot') as HTMLElement | null;
  if (!slot) return;
  const npcId = ctx.state.nearbyNpcId;
  if (!npcId || ctx.state.activeNpcEncounter || ctx.state.activeQuizQuestion || ctx.state.selectedUIMode === 'nokia') {
    slot.innerHTML = '';
    return;
  }
  const npc = ctx.state.lastState?.npcs?.find((n: any) => n.id === npcId);
  if (!npc) { slot.innerHTML = ''; return; }
  const qInfo = ctx.state.npcQuotas?.[npc.id];
  const badge = qInfo?.onCooldown ? ' · Resting' : ` · ${qInfo?.completedInCycle || 0}/5`;
  slot.innerHTML = `
    <div class="npc-approach-pill">
      <button type="button" id="npc-talk-now" class="btn btn-sm btn-gold">Talk to ${esc(npc.name)}${badge} [E]</button>
    </div>
  `;
  slot.querySelector('#npc-talk-now')?.addEventListener('click', () => void ctx.openNpcInteraction(npc.id));
}

export function patchNpcEncounterOverlay(root: HTMLElement, ctx: AppContext) {
  const slot = root.querySelector('#npc-modal-slot') as HTMLElement | null;
  if (!slot) return;
  renderNpcEncounterPopup(slot, ctx.state.activeNpcEncounter, {
    onAccept: () => ctx.respondNpcEncounter('accept'),
    onLater: () => ctx.respondNpcEncounter('later'),
    onSkip: () => ctx.respondNpcEncounter('skip'),
    onClaim: () => ctx.respondNpcEncounter('claim'),
  });
}

export function patchQuizOverlay(root: HTMLElement, ctx: AppContext) {
  const slot = root.querySelector('#quiz-modal-slot') as HTMLElement | null;
  if (!slot) return;
  renderQuizModal(slot, ctx.state.activeQuizQuestion, {
    onSubmitAnswer: (qsid, qid, ans, ms) => ctx.submitQuizAnswer(qsid, qid, ans, ms),
    onClose: () => ctx.closeQuizModal(),
    onClaimReady: () => ctx.claimActiveQuest(),
    getHeartState: () => ctx.getLiveHeartState(),
    onRetryLevel: async () => {
      const lvl = ctx.state.activeQuest?.levelNumber || 1;
      ctx.closeQuizModal();
      await ctx.startAdventureLevel(lvl);
    },
  });
}

function buildPowerTimerHtml(shieldSec: number, speedSec: number, superSec: number, poisonSec: number): string {
  const pills: string[] = [];
  if (shieldSec > 0) pills.push(`<span class="pw-timer-pill shield">${imgBundleSprite('ui_heart_wood', 16)} Shield <b>${shieldSec}s</b></span>`);
  if (speedSec > 0) pills.push(`<span class="pw-timer-pill speed">${imgBundleSprite('ui_bolt_wood', 16)} Speed <b>${speedSec}s</b></span>`);
  if (superSec > 0) pills.push(`<span class="pw-timer-pill super">${imgBundleSprite('farm_sunflower', 16)} Super <b>${superSec}s</b></span>`);
  if (poisonSec > 0) pills.push(`<span class="pw-timer-pill poison">${imgBundleSprite('pirate_skull', 16)} Poison <b>${poisonSec}s</b></span>`);
  return pills.join('');
}

/** Lightweight incremental DOM patch @ 15-30Hz without rebuilding `<canvas>` or touch listeners. */
export function patchGameplayHudValues(root: HTMLElement, st: GameStateTick, ctx: AppContext) {
  const targetId = ctx.state.lastSnake?.id || ctx.state.user?.id;
  const me = st.snakes.find(s => s.id === targetId || s.userId === targetId) || st.snakes[0];
  const score = Math.round(me?.score || 0);
  const kills = me?.kills || 0;
  const hp = Math.max(0, Math.round(me?.hp ?? 100));
  const maxHp = Math.max(1, Math.round(me?.maxHp ?? 100));
  const stage = stagePct(score);
  const rankIdx = st.leaderboard ? st.leaderboard.findIndex(e => e.id === me?.id) + 1 : 0;

  const set = (id: string, txt: string) => { const el = root.querySelector(`#${id}`); if (el && el.textContent !== txt) el.textContent = txt; };
  set('hv-score', fmtNum(score));
  set('hv-stars', fmtNum(ctx.state.profile?.stars ?? 0));
  set('hv-items', String(ctx.state.matchStats?.totalItems ?? 0));
  set('hv-kills', String(kills));
  set('hv-rank', rankIdx > 0 ? `#${rankIdx}` : '#—');
  set('hud-stage', stage.name);
  set('hv-alive', String(st.snakes.filter(s => s.isAlive).length));
  if (st.matchTimer !== undefined) {
    const tStr = fmtTime(st.matchTimer);
    set('hv-time', tStr);
    set('tb-timer', tStr);
    set('hv-boss-time', tStr);
    const tp = root.querySelector('#hv-timer-pill');
    if (tp) tp.classList.toggle('urgent', st.matchTimer <= 30);
  }

  const hpFill = root.querySelector('#hud-hp-fill') as HTMLElement | null;
  if (hpFill) hpFill.style.width = `${Math.round((hp / maxHp) * 100)}%`;

  // Live 5-Hearts + 15-min restore countdown + X/30 heart-shard recharge chip
  patchHeartHudBar(root, ctx);

  // Live Boss HP fill bar & name update in Boss Arena
  const boss = ctx.state.selectedUIMode === 'boss' ? st.snakes.find(s => s.isBoss && s.isAlive) : undefined;
  if (boss) {
    set('hv-boss-name', boss.displayName || 'Kingdom Boss');
    set('hv-boss-power', `Power ${fmtNum(boss.score || 0)}`);
    const bossFill = root.querySelector('#hv-boss-fill') as HTMLElement | null;
    if (bossFill) {
      bossFill.style.width = `${Math.max(5, Math.min(100, Math.round(((boss.hp || 0) / (boss.maxHp || 1)) * 100)))}%`;
    }
  }

  if (ctx.state.selectedUIMode === 'team' && st.teamScores) {
    const b = st.teamScores.blue || 0;
    const r = st.teamScores.red || 0;
    set('tb-blue', String(b));
    set('tb-red', String(r));
    set('tb-player-score', fmtNum(score));
    set('tb-player-kills', String(kills));
    set('tb-player-rank', rankIdx > 0 ? `#${rankIdx}` : '#—');
    const fill = root.querySelector('#tb-fill') as HTMLElement | null;
    if (fill) fill.style.width = `${Math.round((b / Math.max(1, b + r)) * 100)}%`;
  }

  const abCd = Math.ceil(me?.abilityCooldown || 0);
  const shieldSec = Math.ceil(me?.shieldTimer || 0);
  const speedSec = Math.ceil(me?.speedBoostTimer || 0);
  const superSec = Math.ceil(me?.superTimer || 0);
  const poisonSec = Math.ceil((me as any)?.poisonTimer || 0);

  set('ability-cd', shieldSec > 0 ? `${shieldSec}s` : abCd > 0 ? `${abCd}s` : 'GUARD');
  const abBtn = root.querySelector('#touch-ability');
  abBtn?.classList.toggle('cd', abCd > 0 && shieldSec <= 0);
  abBtn?.classList.toggle('buff-active', shieldSec > 0);

  set('boost-cd', superSec > 0 ? `${superSec}s` : speedSec > 0 ? `${speedSec}s` : 'BOOST');
  root.querySelector('#touch-boost')?.classList.toggle('buff-active', speedSec > 0 || superSec > 0);

  const deskAb = root.querySelector('#desk-ability-txt');
  if (deskAb) deskAb.textContent = `Guard ${shieldSec > 0 ? `${shieldSec}s` : abCd > 0 ? `(${abCd}s)` : '[Q]'}`;

  const timerWrap = root.querySelector('#hud-power-timers') as HTMLElement | null;
  if (timerWrap) {
    const key = `${shieldSec}_${speedSec}_${superSec}_${poisonSec}`;
    if (timerWrap.dataset.key !== key) {
      timerWrap.dataset.key = key;
      timerWrap.innerHTML = buildPowerTimerHtml(shieldSec, speedSec, superSec, poisonSec);
    }
  }

  const boardRows = root.querySelector('.hud-board-rows');
  if (boardRows && st.leaderboard?.length) {
    boardRows.innerHTML = st.leaderboard.slice(0, 6).map((e, i) => `
      <div class="hb-row ${e.id === me?.id ? 'me' : ''}">
        <span>${i + 1}. ${esc(e.name)}</span>
        <b>${fmtNum(e.score)}</b>
      </div>
    `).join('');
  }
}

export function renderMatchmakingOverlay(root: HTMLElement, ctx: AppContext) {
  const modeDef = UI_MODES[ctx.state.selectedUIMode];
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="panel game-wood-rim modal-card" style="text-align:center">
        <div class="ribbon-wrap"><div class="ribbon-plaque blue">Matchmaking</div></div>
        <div style="margin:6px 0;display:grid;place-items:center">${svgModeBadge(ctx.state.selectedUIMode, 64)}</div>
        <h2>Entering ${esc(modeDef.name)}</h2>
        <p class="subtitle" style="margin:6px 0 14px">
          ${ctx.state.selectedRoomCode ? `Room Code: <code class="code-chip">${esc(ctx.state.selectedRoomCode)}</code>` : `${esc(ctx.state.selectedRegion)} Servers · ${esc(modeDef.tag)}`}
        </p>
        <div class="hud-bar gold" style="margin:12px 0"><div style="width:72%"></div></div>
        <small class="muted" style="display:block;margin-bottom:14px">Synchronising arena entities and player positions…</small>
        <button id="mm-cancel" class="btn btn-danger btn-block">Cancel Matchmaking</button>
      </div>
    </div>
  `;
  root.querySelector('#mm-cancel')?.addEventListener('click', () => void ctx.abandonMatch());
}

export function renderPauseModal(root: HTMLElement, ctx: AppContext) {
  const me = ctx.state.lastSnake;
  const runStars = computeRunStars(Math.round(me?.score || 0), me?.kills || 0, ctx.state.matchStats?.totalItems || 0, false);
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="panel game-wood-rim modal-card modal-creative">
        <button id="pause-x" class="close-badge" aria-label="Resume">${svgCloseX()}</button>
        <div class="ribbon-wrap"><div class="ribbon-plaque wood-ribbon">Paused</div></div>
        ${svgStarsRating(runStars, 40)}
        ${renderLootAndTasksSummary(ctx, { compact: true })}
        <div class="modal-stack">
          <button id="pause-resume" class="btn btn-primary btn-block">▶ Resume</button>
          <div class="pause-toggle-row">
            <button id="pause-sfx" class="btn btn-soft btn-sm">${ctx.state.settings.sfx ? 'SFX: ON' : 'SFX: OFF'}</button>
            <button id="pause-side" class="btn btn-soft btn-sm">${ctx.state.settings.controlPos === 'right' ? 'Powers: R/L' : 'Powers: L/R'}</button>
            <button id="pause-mini" class="btn btn-soft btn-sm">${ctx.state.settings.showMinimap ? 'Map: ON' : 'Map: OFF'}</button>
          </div>
          <button id="pause-quit" class="btn btn-danger btn-block">Leave Match</button>
        </div>
      </div>
    </div>
  `;
  root.querySelector('#pause-x')?.addEventListener('click', () => ctx.resumeMatch());
  root.querySelector('#pause-resume')?.addEventListener('click', () => ctx.resumeMatch());
  root.querySelector('#pause-open-quiz')?.addEventListener('click', async () => {
    const q = ctx.state.activeQuest;
    if (!q) return;
    ctx.resumeMatch(); // switch back to game view to show quiz
    if (ctx.state.activeQuizQuestion) {
      ctx.setQuizActive(true);
      patchQuizOverlay(root, ctx);
    } else if (q.quizSessionId) {
      const r = await api(`/api/adventure/quiz/${encodeURIComponent(q.quizSessionId)}`);
      if (r.ok && r.data?.currentQuestion) {
        ctx.state.activeQuizQuestion = r.data.currentQuestion;
        ctx.setQuizActive(true);
        patchQuizOverlay(root, ctx);
      }
    }
  });
  root.querySelector('#pause-claim-quest')?.addEventListener('click', async () => {
    await ctx.claimActiveQuest();
    renderPauseModal(root, ctx);
  });
  root.querySelector('#pause-sfx')?.addEventListener('click', () => {
    ctx.updateSettings({ sfx: !ctx.state.settings.sfx });
    audio.setSfxEnabled(ctx.state.settings.sfx);
    renderPauseModal(root, ctx);
  });
  root.querySelector('#pause-side')?.addEventListener('click', () => {
    ctx.updateSettings({ controlPos: ctx.state.settings.controlPos === 'right' ? 'left' : 'right' });
    renderPauseModal(root, ctx);
  });
  root.querySelector('#pause-mini')?.addEventListener('click', () => {
    ctx.toggleMinimap();
    renderPauseModal(root, ctx);
  });
  root.querySelector('#pause-quit')?.addEventListener('click', () => void ctx.abandonMatch());
}

export function renderRespawnModal(root: HTMLElement, ctx: AppContext) {
  const stars = ctx.state.profile?.stars ?? 0;
  const tickets = ctx.state.profile?.tickets ?? 0;
  const starCost = ctx.state.respawnCostStars ?? 20;
  const me = ctx.state.lastSnake;
  const runScore = Math.round(me?.score || 0);
  const runKills = me?.kills || 0;
  const totalItems = ctx.state.matchStats?.totalItems || 0;
  const earnedRunStars = computeRunStars(runScore, runKills, totalItems, false);

  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="panel game-wood-rim modal-card modal-creative">
        <div class="ribbon-wrap"><div class="ribbon-plaque red">Knocked Out</div></div>
        <div class="modal-hero-art">
          ${imgBundleSprite('ui_scroll_lose', 74, 'scroll-hero')}
          <div class="modal-hero-meta">
            ${svgStarsRating(earnedRunStars, 40)}
            <div class="run-score-pill">Score <b>${fmtNum(runScore)}</b> · Kills <b>${runKills}</b></div>
          </div>
        </div>
        ${renderLootAndTasksSummary(ctx, { compact: true })}
        <div class="modal-stack">
          <button id="rsp-free" class="btn btn-primary btn-block">${imgBundleSprite('ui_play_wood', 18)} Free Respawn</button>
          <div class="rsp-split-row">
            <button id="rsp-stars" class="btn btn-gold" ${stars < starCost ? 'disabled' : ''}>${imgBundleSprite('ui_star_wood', 16)} Instant (${starCost}★)</button>
            <button id="rsp-ticket" class="btn btn-soft" ${tickets < 1 ? 'disabled' : ''}>${imgBundleSprite('pirate_map', 16)} Ticket (${tickets})</button>
          </div>
          <div class="rsp-split-row">
            <button id="rsp-ad" class="btn btn-blue">Watch Ad · Revive</button>
            <button id="rsp-finish" class="btn btn-danger">Finish Run</button>
          </div>
        </div>
      </div>
    </div>
  `;
  root.querySelector('#rsp-free')?.addEventListener('click', () => ctx.requestRespawn('wait'));
  root.querySelector('#rsp-stars')?.addEventListener('click', () => ctx.requestRespawn('stars'));
  root.querySelector('#rsp-ticket')?.addEventListener('click', () => ctx.requestRespawn('ticket'));
  root.querySelector('#rsp-ad')?.addEventListener('click', async () => {
    const start = await ads.startRewardedWatch();
    if (!start.ok || !start.tokenId) {
      ctx.toast(start.error || 'Could not start rewarded ad');
      return;
    }
    showRewardedWatchDialog(root, ctx, start.tokenId, start.minWatchMs, start.ad, (tok) => {
      ctx.requestRespawn('ad', tok);
    });
  });
  root.querySelector('#rsp-finish')?.addEventListener('click', () => {
    ctx.setScreen('gameover');
  });
}

export function renderResultScreen(root: HTMLElement, ctx: AppContext, isVictory: boolean) {
  const sum = ctx.state.summary || {};
  const score = Math.round(sum.score ?? ctx.state.lastSnake?.score ?? 0);
  const kills = sum.kills ?? ctx.state.lastSnake?.kills ?? 0;
  const rank = sum.placement ?? 1;
  const bossWin = ctx.state.lastBossWin;
  const totalItems = ctx.state.matchStats?.totalItems || 0;
  const starsRated = computeRunStars(score, kills, totalItems, isVictory);
  const fallbackStars = Math.max(50, Math.floor(score / 10) + kills * 50 + (isVictory ? 500 : 0));
  const fallbackXp = Math.max(25, Math.floor(score / 5) + kills * 100 + (isVictory ? 300 : 0));
  const baseStars = (sum.earnedStars || bossWin?.rewards?.stars || 0) + (ctx.state.matchStats?.starsEarned || 0) || fallbackStars;
  const baseXp = sum.earnedXP || bossWin?.rewards?.xp || fallbackXp;
  const doubled = !!ctx.state.adRewardClaimedThisMatch;
  const addedBonusStars = sum.doubledBonusStars || baseStars;
  const addedBonusXp = sum.doubledBonusXp || baseXp;
  const starsEarned = doubled ? (baseStars + addedBonusStars) : baseStars;
  const xpEarned = doubled ? (baseXp + addedBonusXp) : baseXp;
  const previewAddStars = baseStars;
  const currentTotalStars = ctx.state.profile?.stars || 0;

  root.innerHTML = `
    <div class="result-shell ${isVictory ? 'is-victory' : 'is-gameover'}">
      <div class="panel game-wood-rim result-card modal-creative">
        <button id="res-x-close" class="close-badge" aria-label="Home">${svgCloseX()}</button>
        <div class="ribbon-wrap">
          <div class="ribbon-plaque ${isVictory ? 'green' : 'red'}">${isVictory ? 'Completed!' : 'Game Over'}</div>
        </div>
        <div class="modal-hero-art compact">
          ${imgBundleSprite(isVictory ? 'ui_scroll_win' : 'ui_scroll_lose', 62, 'scroll-hero')}
          <div class="modal-hero-meta">
            ${svgStarsRating(starsRated, 38)}
            <h1 style="font-size:18px;margin:1px 0">${isVictory ? (bossWin ? `Defeated ${esc(bossWin.boss?.name || 'Kingdom Boss')}!` : 'Apex Champion!') : 'Nice Run, Explorer!'}</h1>
            <p class="subtitle">Mode: <b>${esc(ctx.state.selectedUIMode.replace('_', ' ').toUpperCase())}</b> · Rank <b>#${rank}</b></p>
            <div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,200,0,0.18);border:1px solid rgba(255,180,0,0.4);border-radius:12px;padding:2px 10px;font-size:12px;font-weight:700;color:#8f5200;margin-top:3px">
              ⭐ Total Balance: ${fmtNum(currentTotalStars)}
            </div>
          </div>
        </div>

        <div class="kpi-grid result-kpis">
          <div class="kpi-card accent-gold"><span>Final Score</span><strong>${fmtNum(score)}</strong></div>
          <div class="kpi-card accent-blue"><span>Kills</span><strong>${kills}</strong></div>
          <div class="kpi-card accent-green"><span>Run Stars${doubled ? ' (2×)' : ''}</span><strong>+${fmtNum(starsEarned)}</strong></div>
          <div class="kpi-card"><span>XP Earned${doubled ? ' (2×)' : ''}</span><strong>+${fmtNum(xpEarned)} XP</strong></div>
        </div>

        ${renderLootAndTasksSummary(ctx, { compact: true })}

        ${sum.grantedCoupons?.length ? `
          <div class="reward-unlock-banner" style="display:flex;align-items:center;justify-content:center;gap:8px">
            ${svgFoodPreview('golden_chest', 28)}
            <span>Coupon: <b>${esc(sum.grantedCoupons[0].storeName)}</b> (${esc(sum.grantedCoupons[0].promoCode)})</span>
          </div>
        ` : ''}

        <div class="ad-double-banner">
          <small class="ad-double-hint">${doubled ? `🎉 2× Reward Doubled! +${fmtNum(addedBonusStars)} Stars & +${fmtNum(addedBonusXp)} XP credited to your balance.` : `Watch a short ad to DOUBLE (2×) your run points & stars (+${fmtNum(previewAddStars)} Stars${baseXp > 0 ? ` & +${fmtNum(baseXp)} XP` : ''})!`}</small>
          <button id="res-ad-bonus" class="btn btn-gold btn-block" ${doubled ? 'disabled' : ''}>
            ${doubled ? `✓ 2× Reward Doubled (+${fmtNum(addedBonusStars)} ★ Added)` : `Watch Ad · 2× Double Reward (+${fmtNum(previewAddStars)} Stars)`}
          </button>
        </div>

        <div class="result-circle-row">
          <button id="res-home" class="btn btn-wood-circle" title="Home">${svgNavIcon('home', 20)}</button>
          <button id="res-again" class="btn btn-primary" style="min-width:148px;font-size:15px">▶ Play Again</button>
          <button id="res-modes" class="btn btn-wood-circle" title="Modes">${svgNavIcon('play', 20)}</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#res-again')?.addEventListener('click', () => ctx.startMatch({ mode: ctx.state.selectedUIMode }));
  root.querySelector('#res-modes')?.addEventListener('click', () => { ctx.go('play'); ctx.setScreen('app'); });
  root.querySelector('#res-home')?.addEventListener('click', () => { ctx.go('home'); ctx.setScreen('app'); });
  root.querySelector('#res-x-close')?.addEventListener('click', () => { ctx.go('home'); ctx.setScreen('app'); });

  root.querySelector('#res-ad-bonus')?.addEventListener('click', async () => {
    if (ctx.state.adRewardClaimedThisMatch) return;
    const start = await ads.startRewardedWatch();
    if (!start.ok || !start.tokenId) {
      ctx.toast(start.error || 'Could not start rewarded ad');
      return;
    }
    showRewardedWatchDialog(root, ctx, start.tokenId, start.minWatchMs, start.ad, undefined, {
      doubleMatch: true,
      matchId: sum.matchId || `match_${ctx.state.matchStartTs || Date.now()}`,
      matchStars: previewAddStars,
      matchXp: Math.max(25, baseXp),
      score,
    });
  });
}

function showRewardedWatchDialog(
  root: HTMLElement,
  ctx: AppContext,
  tokenId: string,
  minWatchMs: number,
  ad: any,
  onClaim?: (tokenId: string) => void,
  extra?: { doubleMatch?: boolean; matchId?: string; matchStars?: number; matchXp?: number; score?: number }
) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  const totalSec = Math.max(4, Math.ceil(minWatchMs / 1000));
  let left = totalSec;

  const mediaUrl = ad?.mediaUrl ? safeUrl(ad.mediaUrl) : '';
  const creative = mediaUrl
    ? (ad.mediaType === 'video'
        ? `<video class="ad-modal-media" src="${esc(mediaUrl)}" autoplay muted playsinline></video>`
        : `<img class="ad-modal-media" src="${esc(mediaUrl)}" alt="${esc(ad.title)}" />`)
    : `<div class="ad-modal-placeholder"><b>2× Double Reward Bonus</b><br/><small>Watch to double your match points &amp; stars!</small></div>`;

  modal.innerHTML = `
    <div class="panel game-wood-rim modal-card">
      <div class="ribbon-wrap"><div class="ribbon-plaque blue">${extra?.doubleMatch ? '2× Double Reward' : 'Sponsored Bonus'}</div></div>
      <h3 style="text-align:center">${esc(ad?.title || (extra?.doubleMatch ? `Watch Ad to Double (2×) +${fmtNum(extra.matchStars || 50)} Stars!` : 'Watch to Earn Bonus'))}</h3>
      ${ad?.description ? `<p class="subtitle" style="text-align:center">${esc(ad.description)}</p>` : ''}
      ${creative}
      <div class="hud-bar gold" style="margin:10px 0"><div id="rew-ad-bar" style="width:0%"></div></div>
      <div class="modal-stack">
        <button id="rew-ad-claim" class="btn btn-gold btn-block" disabled>Reward unlocks in ${left}s…</button>
        <button id="rew-ad-cancel" class="btn btn-soft btn-sm">Cancel (No Reward)</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const btn = modal.querySelector('#rew-ad-claim') as HTMLButtonElement;
  const bar = modal.querySelector('#rew-ad-bar') as HTMLElement;
  const timer = setInterval(() => {
    left--;
    const pct = Math.min(100, Math.round(((totalSec - Math.max(0, left)) / totalSec) * 100));
    if (bar) bar.style.width = `${pct}%`;
    if (left <= 0) {
      clearInterval(timer);
      if (bar) bar.style.width = '100%';
      btn.disabled = false;
      btn.textContent = onClaim ? 'Claim Free Instant Respawn!' : `Claim 2× Double Reward (+${fmtNum(extra?.matchStars || 50)} ★)!`;
    } else {
      btn.textContent = `Reward unlocks in ${left}s…`;
    }
  }, 1000);

  modal.querySelector('#rew-ad-cancel')?.addEventListener('click', () => {
    clearInterval(timer);
    modal.remove();
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (onClaim) {
      modal.remove();
      onClaim(tokenId);
      return;
    }

    const fallbackBonusStars = extra?.matchStars || 50;
    const fallbackBonusXp = extra?.matchXp || 25;

    let res: any = { ok: false };
    if (!tokenId.startsWith('local_rew_') && (getPlayerToken() || hasConfiguredServer())) {
      try {
        res = await api('/api/ads/claim', {
          method: 'POST',
          body: JSON.stringify({
            adToken: tokenId,
            doubleMatch: !!extra?.doubleMatch,
            matchId: extra?.matchId,
            matchStars: extra?.matchStars || 0,
            matchXp: extra?.matchXp || 0,
            score: extra?.score || 0,
          }),
        });
      } catch (e) {
        res = { ok: false };
      }
    }

    modal.remove();

    const addedStars = (res.ok && res.data?.bonusStars) ? res.data.bonusStars : fallbackBonusStars;
    const addedXp = (res.ok && res.data?.bonusXp) ? res.data.bonusXp : fallbackBonusXp;

    ctx.state.adRewardClaimedThisMatch = true;
    if (!ctx.state.summary) ctx.state.summary = {};
    ctx.state.summary.doubledBonusStars = addedStars;
    ctx.state.summary.doubledBonusXp = addedXp;

    if (res.ok && res.data?.profile) {
      ctx.state.profile = res.data.profile;
    } else if (ctx.state.profile) {
      ctx.state.profile.stars = (ctx.state.profile.stars || 0) + addedStars;
      ctx.state.profile.xp = (ctx.state.profile.xp || 0) + addedXp;
      ctx.state.profile.tickets = (ctx.state.profile.tickets || 0) + 2;
    }

    if (getPlayerToken()) {
      void ctx.refreshProfile();
    }

    ctx.toast(res.data?.message || `🎉 2× Reward Doubled! +${fmtNum(addedStars)} Stars & +${fmtNum(addedXp)} XP added to balance!`);
    renderResultScreen(root, ctx, ctx.state.screen === 'victory');
  });
}

export function toggleTacticalMapOverlay(
  state: GameStateTick | null,
  myUserId: string,
  opts?: { onTogglePause?: (paused: boolean) => void; npcQuotas?: Record<string, any>; activeQuest?: any }
) {
  const existing = document.getElementById('tactical-overlay');
  if (existing) {
    existing.remove();
    opts?.onTogglePause?.(false);
    return;
  }

  // Safely pause & shield the player while planning on the Arena Map so no enemy can attack!
  opts?.onTogglePause?.(true);

  const q = opts?.activeQuest && opts.activeQuest.state === 'ACTIVE' ? opts.activeQuest : null;
  const taskLine = q
    ? `<div class="map-task-pill"><b>Task:</b> ${esc(q.currentStage?.label || q.title)} <span>(${q.progress}/${q.target})</span></div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'tactical-overlay';
  overlay.className = 'modal-backdrop';
  overlay.innerHTML = `
    <div class="panel game-wood-rim modal-card tactical-card compact-map" style="text-align:center">
      <button id="tact-close" class="close-badge crimson" aria-label="Resume Play">${svgCloseX()}</button>
      <div class="ribbon-wrap"><div class="ribbon-plaque blue">Arena Map</div></div>
      <div class="map-pause-badge">PAUSED · SAFE PLANNING</div>
      ${taskLine}
      <canvas id="tactical-canvas" width="260" height="260" class="tactical-canvas"></canvas>
      <div class="map-legend-row">
        <span><i class="ml-dot you"></i>You</span>
        <span><i class="ml-dot task"></i>Task/Guide</span>
        <span><i class="ml-dot worm"></i>Wormhole</span>
        <span><i class="ml-dot safe"></i>Sanctuary</span>
      </div>
      <button id="tact-resume-btn" class="btn btn-primary btn-sm btn-block">Resume Arena</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const closeOverlay = () => {
    overlay.remove();
    opts?.onTogglePause?.(false);
  };
  overlay.querySelector('#tact-close')?.addEventListener('click', closeOverlay);
  overlay.querySelector('#tact-resume-btn')?.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });

  const c = overlay.querySelector('#tactical-canvas') as HTMLCanvasElement;
  const c2 = c.getContext('2d');
  if (!c2) return;
  const s = 260;
  const scale = s / WORLD;
  c2.fillStyle = '#ECFDF5';
  c2.fillRect(0, 0, s, s);

  // Subtle coordinate grid for orientation
  c2.strokeStyle = 'rgba(16, 185, 129, 0.14)';
  c2.lineWidth = 1;
  for (let g = 1; g < 4; g++) {
    const p = (s / 4) * g;
    c2.beginPath(); c2.moveTo(p, 0); c2.lineTo(p, s); c2.stroke();
    c2.beginPath(); c2.moveTo(0, p); c2.lineTo(s, p); c2.stroke();
  }

  // Storm ring (competitive modes only)
  if (state?.safeZone && (state.mode === 'battle_royale' || state.mode === 'team' || state.mode === 'boss')) {
    c2.beginPath();
    c2.arc(state.safeZone.centerX * scale, state.safeZone.centerY * scale, state.safeZone.radius * scale, 0, Math.PI * 2);
    c2.strokeStyle = 'rgba(239, 68, 68, 0.7)';
    c2.lineWidth = 2;
    c2.stroke();
  }

  // Safe Sanctuary
  if (state?.sanctuaryZone) {
    c2.beginPath();
    c2.arc(state.sanctuaryZone.centerX * scale, state.sanctuaryZone.centerY * scale, state.sanctuaryZone.radius * scale, 0, Math.PI * 2);
    c2.fillStyle = 'rgba(16, 185, 129, 0.28)';
    c2.fill();
    c2.strokeStyle = '#059669';
    c2.lineWidth = 1.5;
    c2.stroke();
  }

  // Team Battle Control Zones & Bases (important mode objectives)
  if (state?.teamZones?.length) {
    for (const z of state.teamZones) {
      c2.beginPath();
      c2.arc(z.x * scale, z.y * scale, Math.max(7, z.radius * scale), 0, Math.PI * 2);
      c2.fillStyle = z.owner === 'blue' ? 'rgba(37, 99, 235, 0.35)' : z.owner === 'red' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(245, 158, 11, 0.28)';
      c2.fill();
      c2.strokeStyle = z.owner === 'blue' ? '#2563EB' : z.owner === 'red' ? '#DC2626' : '#D97706';
      c2.lineWidth = 1.5;
      c2.stroke();
    }
  }

  // Wormholes (important fast-travel landmarks)
  for (const p of state?.portals || []) {
    const px = p.x * scale;
    const py = p.y * scale;
    c2.beginPath();
    c2.arc(px, py, 6.5, 0, Math.PI * 2);
    c2.fillStyle = 'rgba(139, 92, 246, 0.28)';
    c2.fill();
    c2.strokeStyle = '#7C3AED';
    c2.lineWidth = 2;
    c2.stroke();
    c2.fillStyle = '#5B21B6';
    c2.font = '900 8px Outfit, sans-serif';
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillText('W', px, py + 0.5);
  }

  // Quest Masters (important guides)
  for (const npc of state?.npcs || []) {
    const qInfo = opts?.npcQuotas?.[npc.id];
    const nx = npc.x * scale;
    const ny = npc.y * scale;
    c2.beginPath();
    c2.arc(nx, ny, 5, 0, Math.PI * 2);
    c2.fillStyle = qInfo?.onCooldown ? '#94A3B8' : '#F59E0B';
    c2.fill();
    c2.strokeStyle = '#FFFFFF';
    c2.lineWidth = 1.5;
    c2.stroke();
  }

  // Player position + Boss marker ONLY (zero random bot dot clutter!)
  const me = state?.snakes?.find(sn => sn.isAlive && (sn.id === myUserId || sn.userId === myUserId));
  const boss = state?.snakes?.find(sn => sn.isAlive && sn.isBoss);

  // Active Quest Waypoints / Rescue Beacons / Boss Switches (highlighted diamond markers + dashed guide line!)
  if (q?.currentStage) {
    const targets = [
      ...(q.currentStage.waypoints || []).filter((w: any) => !(q.completedWaypoints || []).includes(w.id)),
      ...(q.currentStage.switches || []).filter((sw: any) => !(q.activatedSwitches || []).includes(sw.id)),
    ];
    targets.forEach((pt: any, idx: number) => {
      const tx = pt.x * scale;
      const ty = pt.y * scale;
      if (idx === 0 && me) {
        c2.save();
        c2.beginPath();
        c2.setLineDash([4, 4]);
        c2.moveTo(me.head.x * scale, me.head.y * scale);
        c2.lineTo(tx, ty);
        c2.strokeStyle = '#D97706';
        c2.lineWidth = 1.8;
        c2.stroke();
        c2.restore();
      }
      c2.save();
      c2.translate(tx, ty);
      c2.rotate(Math.PI / 4);
      c2.fillStyle = idx === 0 ? '#FACC15' : '#FDE68A';
      c2.strokeStyle = '#92400E';
      c2.lineWidth = 1.8;
      c2.fillRect(-5, -5, 10, 10);
      c2.strokeRect(-5, -5, 10, 10);
      c2.restore();
    });
  }

  if (boss) {
    c2.beginPath();
    c2.arc(boss.head.x * scale, boss.head.y * scale, 6.5, 0, Math.PI * 2);
    c2.fillStyle = '#DC2626';
    c2.fill();
    c2.strokeStyle = '#FFFFFF';
    c2.lineWidth = 2;
    c2.stroke();
  }

  if (me) {
    const mx = me.head.x * scale;
    const my = me.head.y * scale;
    c2.beginPath();
    c2.arc(mx, my, 8.5, 0, Math.PI * 2);
    c2.fillStyle = 'rgba(15, 23, 42, 0.22)';
    c2.fill();
    c2.beginPath();
    c2.arc(mx, my, 5.2, 0, Math.PI * 2);
    c2.fillStyle = '#0F172A';
    c2.fill();
    c2.strokeStyle = '#FFFFFF';
    c2.lineWidth = 2;
    c2.stroke();
  }
}
