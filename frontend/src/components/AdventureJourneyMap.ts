import { fmtNum } from '../api/ApiClient';
import { esc } from '../utils/escapeHtml';
import { AppContext } from '../screens/types';
import { svgBoooMascot, svgCloseX, svgStarCoin } from './CartoonUi';

interface StageDef {
  levelNumber: number;
  title?: string;
  levelType?: string;
  isBossCheckpoint?: boolean;
  isMajorMilestone?: boolean;
  unlocked?: boolean;
  completed?: boolean;
  targetScore?: number;
  rewardStars?: number;
  isCurrent?: boolean;
}

interface MapSlot {
  x: number; // in 0..400 viewBox
  y: number; // in 0..740 viewBox
  dots: Array<{ x: number; y: number }>;
}

const MAP_SLOTS: MapSlot[] = [
  { x: 165, y: 625, dots: [{ x: 215, y: 580 }, { x: 260, y: 535 }, { x: 285, y: 495 }] },
  { x: 290, y: 460, dots: [{ x: 235, y: 420 }, { x: 165, y: 395 }] },
  { x: 100, y: 365, dots: [{ x: 160, y: 320 }, { x: 235, y: 285 }] },
  { x: 290, y: 255, dots: [{ x: 250, y: 205 }] },
  { x: 195, y: 175, dots: [{ x: 135, y: 145 }] },
  { x: 85, y: 130, dots: [{ x: 65, y: 85 }] },
];

const BEZIER_PATH_FULL =
  'M 165 625 C 180 555, 280 535, 290 460 C 300 380, 135 410, 100 365 C 75 295, 265 315, 290 255 C 300 205, 240 195, 195 175 C 165 155, 115 150, 85 130 C 65 110, 50 60, 50 0';

// Segment subpaths for completed progression
const BEZIER_SEGMENTS: string[] = [
  'M 165 625 C 180 555, 280 535, 290 460',
  'M 290 460 C 300 380, 135 410, 100 365',
  'M 100 365 C 75 295, 265 315, 290 255',
  'M 290 255 C 300 205, 240 195, 195 175',
  'M 195 175 C 165 155, 115 150, 85 130',
  'M 85 130 C 65 110, 50 60, 50 0',
];

export function renderAdventureJourneyMap(ctx: AppContext): string {
  const { state } = ctx;
  const p = state.profile || {};
  const adv = state.adventure;
  const axes = adv?.axes || {
    adventureLevel: 1,
    highestUnlockedLevel: 1,
    currentWorld: 1,
  };
  const highestLvl = Number(axes.highestUnlockedLevel || 1);
  const worldNum = Math.max(1, Math.min(10, Number(adv?.world?.worldNumber || state.selectedKingdom || 1)));
  const worldName = adv?.world?.name || `World ${worldNum}`;

  const rawLevels: StageDef[] = adv?.levels || [];
  const levelsCount = Math.min(rawLevels.length, MAP_SLOTS.length);
  const levels: StageDef[] = Array.from({ length: MAP_SLOTS.length }, (_, i) => {
    const defaultNum = (worldNum - 1) * 100 + (i + 1);
    const existing = rawLevels[i];
    if (existing) return existing;
    return {
      levelNumber: defaultNum,
      title: `Stage ${defaultNum}`,
      isBossCheckpoint: (i + 1) % 10 === 0,
      unlocked: defaultNum <= highestLvl,
      completed: defaultNum < highestLvl,
      targetScore: 1000 + (i + 1) * 250,
      rewardStars: 50,
      isCurrent: defaultNum === highestLvl,
    };
  });

  // Calculate completed segments index
  const curSlotIndex = levels.findIndex(l => l.levelNumber === highestLvl);
  const activeSlotIdx = curSlotIndex >= 0 ? curSlotIndex : 0;
  const completedSegments = BEZIER_SEGMENTS.slice(0, activeSlotIdx);

  // Avatar position
  const activeSlot = MAP_SLOTS[activeSlotIdx] || MAP_SLOTS[0];
  const avatarX = (activeSlot.x / 400) * 100;
  const avatarY = activeSlot.y;

  return `
    <div class="journey-map-wrap">
      <!-- Floating Top HUD (Matching Reference Image) -->
      <div class="journey-map-topbar">
        <!-- 3D Chiseled Stone Back Button -->
        <button class="stone-back-btn" id="journey-back-btn" aria-label="Back to home">
          ‹
        </button>

        <!-- World Banner with Previous / Next Chapter Controls -->
        <div class="journey-world-pill">
          <button data-journey-world-step="-1" title="Previous World" ${worldNum <= 1 ? 'disabled' : ''}>◀</button>
          <span>W${worldNum} · ${esc(worldName)}</span>
          <button data-journey-world-step="1" title="Next World" ${worldNum >= 10 ? 'disabled' : ''}>▶</button>
        </div>

        <!-- Rich Carved Wood Coin Capsule -->
        <div class="journey-coin-badge" title="Star Coins">
          <span>${fmtNum(p.stars || 59927)}</span>
          <div class="journey-coin-medallion">
            ${svgStarCoin(22)}
          </div>
        </div>
      </div>

      <!-- Scrollable Continuous Trail Map Canvas -->
      <div class="journey-map-scroll" id="journey-map-scroll">
        <div class="journey-map-canvas">
          <!-- Alpine Mountain Valley & Turquoise Glacial Lake Landscape Artwork -->
          <svg class="journey-landscape-svg" viewBox="0 0 400 740" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="grassSlope" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#34d399"/>
                <stop offset="22%" stop-color="#10b981"/>
                <stop offset="55%" stop-color="#059669"/>
                <stop offset="85%" stop-color="#047857"/>
                <stop offset="100%" stop-color="#064e3b"/>
              </linearGradient>
              <linearGradient id="fjordWater" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#67e8f9"/>
                <stop offset="30%" stop-color="#06b6d4"/>
                <stop offset="70%" stop-color="#0284c7"/>
                <stop offset="100%" stop-color="#0369a1"/>
              </linearGradient>
              <radialGradient id="pineCluster" cx="40%" cy="30%" r="65%">
                <stop offset="0%" stop-color="#065f46"/>
                <stop offset="100%" stop-color="#022c22"/>
              </radialGradient>
            </defs>

            <!-- Rolling Alpine Slopes Base -->
            <rect width="400" height="740" fill="url(#grassSlope)"/>

            <!-- Lower Glacial Mountain Lake (Framing Node 1 & 2) -->
            <path d="M-15 480 C35 480, 85 520, 95 580 C105 640, 50 710, -15 730 Z" fill="url(#fjordWater)" opacity="0.92"/>
            <path d="M-15 480 C35 480, 85 520, 95 580 C105 640, 50 710, -15 730 Z" fill="none" stroke="#a5f3fc" stroke-width="3" opacity="0.6"/>
            <path d="M5 520 C35 540, 65 580, 75 640" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" opacity="0.45"/>

            <!-- Upper Glacial Fjord (Winding between Node 2, 3, and 4) -->
            <path d="M415 220 C320 230, 260 270, 215 310 C165 355, 110 365, -15 355 L-15 415 C60 430, 140 425, 200 385 C260 345, 330 325, 415 335 Z" fill="url(#fjordWater)" opacity="0.95"/>
            <path d="M415 220 C320 230, 260 270, 215 310 C165 355, 110 365, -15 355 L-15 415 C60 430, 140 425, 200 385 C260 345, 330 325, 415 335 Z" fill="none" stroke="#a5f3fc" stroke-width="3.5" opacity="0.65"/>
            <path d="M30 385 Q110 380 170 375" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            <path d="M240 335 Q295 310 375 295" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.4"/>

            <!-- Pine Foliage Clusters on Slopes -->
            <ellipse cx="60" cy="270" rx="42" ry="26" fill="url(#pineCluster)" opacity="0.45"/>
            <ellipse cx="340" cy="490" rx="55" ry="32" fill="url(#pineCluster)" opacity="0.5"/>
            <ellipse cx="320" cy="110" rx="48" ry="28" fill="url(#pineCluster)" opacity="0.42"/>
            <ellipse cx="40" cy="90" rx="36" ry="22" fill="url(#pineCluster)" opacity="0.4"/>
          </svg>

          <!-- Floating Clouds (Top-altitude Depth Atmosphere matching reference) -->
          <div class="journey-cloud c1"></div>
          <div class="journey-cloud c2"></div>
          <div class="journey-cloud c3"></div>
          <div class="journey-cloud c4"></div>

          <!-- SVG Ribbon Road Layer -->
          <svg class="journey-road-svg" viewBox="0 0 400 740" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="roadTerracotta" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f97316"/>
                <stop offset="50%" stop-color="#ea580c"/>
                <stop offset="100%" stop-color="#c2410c"/>
              </linearGradient>
              <linearGradient id="roadStone" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="45%" stop-color="#f8fafc"/>
                <stop offset="100%" stop-color="#cbd5e1"/>
              </linearGradient>
              <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-color="rgba(0,0,0,0.35)"/>
              </filter>
            </defs>

            <!-- Bottom Extrusion Shadow for full trail -->
            <path d="${BEZIER_PATH_FULL}" fill="none" stroke="rgba(0, 0, 0, 0.35)" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" transform="translate(0, 5)"/>

            <!-- White Paved Stone Road for upcoming / locked section -->
            <path d="${BEZIER_PATH_FULL}" fill="none" stroke="url(#roadStone)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="${BEZIER_PATH_FULL}" fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="${BEZIER_PATH_FULL}" fill="none" stroke="#94a3b8" stroke-width="3" stroke-dasharray="9 7" stroke-linecap="round"/>

            <!-- Completed Terracotta Dirt Road Section (from Level 1 up to current level) -->
            ${completedSegments.map(seg => `
              <path d="${seg}" fill="none" stroke="url(#roadTerracotta)" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="${seg}" fill="none" stroke="#fef08a" stroke-width="3" stroke-dasharray="9 7" stroke-linecap="round"/>
            `).join('')}
          </svg>

          <!-- Intermediate Stepping Dots / Stones -->
          ${MAP_SLOTS.map((slot, sIdx) => {
            const isCompletedSlot = sIdx < activeSlotIdx;
            return slot.dots.map(d => {
              const leftPct = (d.x / 400) * 100;
              const topPx = d.y;
              return `
                <div class="journey-step-dot ${isCompletedSlot ? 'done' : 'future'}"
                  style="left:${leftPct}%;top:${topPx}px"
                  aria-hidden="true">
                </div>
              `;
            }).join('');
          }).join('')}

          <!-- Milestone Level Nodes (Level 1 Gold, Level 2+ 3D Stone Slabs) -->
          ${levels.map((lvl, idx) => {
            const slot = MAP_SLOTS[idx];
            if (!slot) return '';
            const leftPct = (slot.x / 400) * 100;
            const topPx = slot.y;
            const isFirst = idx === 0;
            const isBoss = lvl.isBossCheckpoint || (lvl.levelNumber % 10 === 0);
            const isUnlocked = lvl.unlocked || lvl.levelNumber <= highestLvl;
            const isCompleted = lvl.completed || lvl.levelNumber < highestLvl;

            const nodeClass = [
              'journey-node',
              isFirst ? 'first-gold' : 'stone',
              isBoss ? 'boss' : '',
              isUnlocked ? 'open' : 'locked',
              isCompleted ? 'done' : '',
            ].filter(Boolean).join(' ');

            return `
              <button class="${nodeClass}"
                data-journey-node="${lvl.levelNumber}"
                style="left:${leftPct}%;top:${topPx}px"
                title="${esc(lvl.title || `Stage ${lvl.levelNumber}`)}">
                
                ${isFirst ? `
                  <div class="journey-node-gold">
                    <strong>${lvl.levelNumber}</strong>
                  </div>
                ` : `
                  <div class="journey-node-stone">
                    <strong>${lvl.levelNumber}</strong>
                  </div>
                `}

                ${isCompleted ? `
                  <div class="journey-node-stars">
                    <span>★</span><span>★</span><span>★</span>
                  </div>
                ` : ''}
              </button>
            `;
          }).join('')}

          <!-- Floating Player Avatar Token & Speech Bubble "Booo" -->
          <div class="journey-avatar-token"
            id="journey-avatar-token"
            style="left:${avatarX}%;top:${avatarY - 58}px">
            <div class="journey-bubble">Booo</div>
            <div class="journey-avatar-badge">
              ${svgBoooMascot(42)}
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Bottom Mode Switcher -->
      <div style="position:absolute;bottom:calc(12px + var(--safe-b));left:50%;transform:translateX(-50%);z-index:25;display:flex;gap:8px">
        <button class="btn btn-xs btn-gold" id="journey-toggle-quests" style="border-radius:999px;padding:6px 18px;box-shadow:0 3px 0 #78350f;font-size:12.5px">
          📜 View Quests &amp; Realms
        </button>
      </div>
    </div>
  `;
}

export function bindAdventureJourneyEvents(root: HTMLElement, ctx: AppContext) {
  // Back button -> returns to Home
  root.querySelector('#journey-back-btn')?.addEventListener('click', () => {
    ctx.go('home');
  });

  // World Step buttons
  root.querySelectorAll<HTMLElement>('[data-journey-world-step]').forEach(b => {
    b.addEventListener('click', async () => {
      const step = Number(b.dataset.journeyWorldStep) || 1;
      const adv = ctx.state.adventure;
      const curWorld = Number(adv?.world?.worldNumber || ctx.state.selectedKingdom || 1);
      const nextWorld = Math.max(1, Math.min(10, curWorld + step));
      ctx.state.selectedKingdom = nextWorld;
      await ctx.refreshAdventure({ world: nextWorld, page: 0 });
      ctx.render();
    });
  });

  // Stage modal inspection
  root.querySelectorAll<HTMLElement>('[data-journey-node]').forEach(btn => {
    btn.addEventListener('click', () => {
      const stageNum = Number(btn.dataset.journeyNode);
      if (!stageNum) return;
      showStageModal(ctx, stageNum);
    });
  });

  // Auto-scroll so current level is comfortably in view
  const scrollWrap = root.querySelector<HTMLElement>('#journey-map-scroll');
  const avatarToken = root.querySelector<HTMLElement>('#journey-avatar-token');
  if (scrollWrap && avatarToken) {
    setTimeout(() => {
      const tokenTop = avatarToken.offsetTop;
      const viewH = scrollWrap.clientHeight;
      scrollWrap.scrollTop = Math.max(0, tokenTop - viewH * 0.55);
    }, 60);
  }
}

function showStageModal(ctx: AppContext, levelNumber: number) {
  document.getElementById('stage-inspect-modal')?.remove();

  const adv = ctx.state.adventure;
  const rawLevels: any[] = adv?.levels || [];
  const lvl = rawLevels.find(l => l.levelNumber === levelNumber) || {
    levelNumber,
    title: `Stage ${levelNumber}`,
    targetScore: 1000 + (levelNumber % 10) * 300,
    rewardStars: 50,
    isBossCheckpoint: levelNumber % 5 === 0,
    completed: levelNumber < (adv?.axes?.highestUnlockedLevel || 1),
    unlocked: levelNumber <= (adv?.axes?.highestUnlockedLevel || 1),
  };

  const worldNum = Math.max(1, Math.min(10, Math.floor((levelNumber - 1) / 100) + 1));
  const worldName = adv?.world?.name || `World ${worldNum}`;
  const isBoss = lvl.isBossCheckpoint || levelNumber % 5 === 0;

  const overlay = document.createElement('div');
  overlay.id = 'stage-inspect-modal';
  overlay.className = 'journey-stage-modal-backdrop';

  overlay.innerHTML = `
    <div class="journey-stage-card">
      <button class="ref-lb-close" id="stage-close-btn" style="top:-12px;right:-12px;width:38px;height:38px" aria-label="Close">
        ${svgCloseX()}
      </button>

      <div class="ribbon-wrap" style="margin-top:-32px">
        <div class="ribbon-plaque ${isBoss ? 'red' : 'gold'}">
          ${isBoss ? 'BOSS CHECKPOINT' : `STAGE ${lvl.levelNumber}`}
        </div>
      </div>

      <h3 style="font-size:21px;color:#451a03;margin-top:6px;font-family:'Fredoka',sans-serif">
        ${esc(lvl.title || `Stage ${lvl.levelNumber}`)}
      </h3>
      <p class="subtitle" style="font-size:12px;color:#78350f;font-weight:700">
        World ${worldNum} · ${esc(worldName)}
      </p>

      <div style="background:#fff9e6;border:2px solid #fde68a;border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;margin:6px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <span style="color:#78350f;font-weight:700">Target Score</span>
          <b style="color:#451a03;font-size:15px;font-family:'Fredoka',sans-serif">${fmtNum(lvl.targetScore || 1500)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <span style="color:#78350f;font-weight:700">Clear Reward</span>
          <b style="color:#d97706;font-size:14px;font-family:'Fredoka',sans-serif">+${lvl.rewardStars || 50} ★ Star Coins</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
          <span style="color:#78350f;font-weight:700">Mastery</span>
          <span style="color:#f59e0b;font-size:17px">${lvl.completed ? '★★★' : '☆☆☆'}</span>
        </div>
      </div>

      <button class="btn btn-gold" id="stage-play-btn" style="font-size:16px;padding:11px 0;border-radius:999px;width:100%;margin-top:4px">
        ▶ PLAY STAGE
      </button>
    </div>
  `;

  overlay.querySelector('#stage-close-btn')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#stage-play-btn')?.addEventListener('click', () => {
    overlay.remove();
    void ctx.startAdventureLevel(levelNumber);
  });

  document.body.appendChild(overlay);
}

