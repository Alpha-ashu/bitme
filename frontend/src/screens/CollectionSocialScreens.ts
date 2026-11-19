import { api, fmtNum } from '../api/ApiClient';
import {
  svgAccessoryPreview,
  svgAvatarBadge,
  svgCloseX,
  svgFoodPreview,
  svgNavIcon,
  svgSnakePreview,
  svgTrophyMedallion,
} from '../components/CartoonUi';
import { esc } from '../utils/escapeHtml';
import { AppContext, DEFAULT_ACCESSORIES, getViewportTier, SKIN_FAMILIES } from './types';

const colUi = {
  invPage: 0,
  missionPage: 0,
  rewardPage: 0,
  lbPage: 0,
  friendTab: 'friends' as 'friends' | 'requests',
  eventPage: 0,
};

function showShopInspectModal(
  ctx: AppContext,
  cards: HTMLElement[],
  startIndex: number
) {
  let idx = Math.max(0, Math.min(cards.length - 1, startIndex));
  document.getElementById('shop-inspect-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'shop-inspect-modal';
  overlay.className = 'modal-backdrop';

  const draw = () => {
    const card = cards[idx];
    const kind = card.dataset.inspectKind as 'skin' | 'acc' | 'egg';
    const id = card.dataset.inspectId!;
    const title = card.dataset.inspectTitle || 'Item';
    const subtitle = card.dataset.inspectSub || '';
    const visualHtml = kind === 'skin'
      ? svgSnakePreview(id, ctx.state.equippedAccessory, 108)
      : kind === 'acc'
        ? svgAccessoryPreview(id, 92)
        : svgFoodPreview(id, 88);
    const act = card.querySelector('button, .pill-live')?.outerHTML || '';

    overlay.innerHTML = `
      <div class="panel game-wood-rim modal-card" style="text-align:center">
        <button id="ins-close" class="close-badge crimson" aria-label="Close">${svgCloseX()}</button>
        <div class="ribbon-wrap"><div class="ribbon-plaque">Item Showcase</div></div>
        <div class="shop-carousel-stage" style="display:flex;align-items:center;gap:10px;margin:8px 0">
          <button id="ins-prev" class="btn btn-xs btn-soft" ${cards.length < 2 ? 'disabled' : ''} aria-label="Previous item">◀</button>
          <div style="flex:1;padding:10px;border-radius:16px;background:radial-gradient(circle,#fff,#dcfce7);border:2px solid #15803d;display:grid;place-items:center">${visualHtml}</div>
          <button id="ins-next" class="btn btn-xs btn-soft" ${cards.length < 2 ? 'disabled' : ''} aria-label="Next item">▶</button>
        </div>
        <h3>${esc(title)}</h3>
        <p class="subtitle" style="margin:6px 0 14px">${esc(subtitle)}</p>
        <div id="ins-actions">${act}</div>
      </div>
    `;
    overlay.querySelector('#ins-close')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ins-prev')?.addEventListener('click', () => {
      idx = (idx - 1 + cards.length) % cards.length;
      draw();
    });
    overlay.querySelector('#ins-next')?.addEventListener('click', () => {
      idx = (idx + 1) % cards.length;
      draw();
    });
    bindShopActionButtons(overlay, ctx, () => overlay.remove());
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  draw();
  document.body.appendChild(overlay);
}

function bindShopActionButtons(scope: HTMLElement, ctx: AppContext, afterAction?: () => void) {
  scope.querySelectorAll<HTMLElement>('[data-equip-skin]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const skin = b.dataset.equipSkin!;
      const r = await api('/api/player/equip', { method: 'POST', body: JSON.stringify({ skin }) });
      if (!r.ok) { ctx.toast(r.data?.message || 'Cannot equip'); return; }
      ctx.state.selectedSkin = skin;
      afterAction?.();
      await ctx.refreshCollectionData();
      ctx.toast(`Equipped ${skin} skin!`);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-buy-skin]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await api('/api/shop/purchase', { method: 'POST', body: JSON.stringify({ skinId: b.dataset.buySkin }) });
      ctx.toast(r.data?.message || (r.ok ? 'Unlocked!' : 'Cannot unlock'));
      afterAction?.();
      await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-equip-acc]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const acc = b.dataset.equipAcc || '';
      const r = await api('/api/player/equip-accessory', { method: 'POST', body: JSON.stringify({ accessoryId: acc }) });
      if (!r.ok) { ctx.toast(r.data?.message || 'Cannot equip accessory'); return; }
      ctx.state.equippedAccessory = acc;
      afterAction?.();
      await ctx.refreshCollectionData();
      ctx.toast(acc ? 'Accessory equipped!' : 'Accessory removed');
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-buy-acc]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await api('/api/shop/purchase-accessory', { method: 'POST', body: JSON.stringify({ accessoryId: b.dataset.buyAcc }) });
      ctx.toast(r.data?.message || 'Purchase complete');
      afterAction?.();
      await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
    });
  });
  scope.querySelectorAll<HTMLElement>('[data-open-item]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = await api('/api/inventory/open', { method: 'POST', body: JSON.stringify({ itemId: b.dataset.openItem }) });
      ctx.toast(r.data?.message || 'Opened!');
      afterAction?.();
      await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
    });
  });
}

function pagerHtml(key: string, page: number, total: number): string {
  if (total <= 1) return '';
  return `
    <div class="pager-bar">
      <button class="btn btn-xs btn-soft" data-pager="${key}" data-dir="-1" ${page <= 0 ? 'disabled' : ''}>◀ Prev</button>
      <span class="pager-dots">${page + 1} / ${total}</span>
      <button class="btn btn-xs btn-soft" data-pager="${key}" data-dir="1" ${page >= total - 1 ? 'disabled' : ''}>Next ▶</button>
    </div>
  `;
}

export function renderInventoryPage(ctx: AppContext): string {
  const { state } = ctx;
  const tier = getViewportTier();
  const p = state.profile || {};
  const ownedSkins = new Set<string>(p.unlockedSkins || ['Forest', 'Jungle']);
  const ownedAcc = new Set<string>(p.unlockedAccessories || ['flower_crown']);
  const inv = p.inventory || {};
  const catalogSkins: any[] = state.shopCatalog?.skins || [];
  const catalogAcc: any[] = state.shopCatalog?.accessories?.length ? state.shopCatalog.accessories : DEFAULT_ACCESSORIES;

  const tabs = [
    { id: 'skins', label: 'Skins' },
    { id: 'accessories', label: 'Wearables' },
    { id: 'eggs', label: 'Eggs' },
    { id: 'coupons', label: 'Coupons' },
  ];

  const perPage = tier === 'tiny' ? 2 : tier === 'mobile' ? 4 : tier === 'landscape' ? 3 : tier === 'tablet' ? 6 : 6;
  let itemsHtml = '';
  let pager = '';

  if (state.invTab === 'skins') {
    const flatSkins = SKIN_FAMILIES.flatMap(fam => fam.skins.map(s => ({ ...s, family: fam.family })));
    const pages = Math.max(1, Math.ceil(flatSkins.length / perPage));
    colUi.invPage = Math.max(0, Math.min(colUi.invPage, pages - 1));
    const slice = flatSkins.slice(colUi.invPage * perPage, colUi.invPage * perPage + perPage);
    const cols = tier === 'tiny' || tier === 'mobile' ? 2 : 3;
    itemsHtml = `
      <div class="card-grid-3" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
        ${slice.map(s => {
          const cat = catalogSkins.find((x: any) => x.id === s.id);
          const isOwned = cat ? !!cat.owned : ownedSkins.has(s.id);
          const isEquipped = (p.equippedSkin || state.selectedSkin) === s.id;
          const costStars = cat?.costStars ?? 0;
          const costTickets = cat?.costTickets ?? 0;
          const minLv = cat?.minLevel ?? 1;
          const actionBtn = isEquipped
            ? `<span class="pill pill-live">Equipped ✓</span>`
            : isOwned
              ? `<button class="btn btn-xs btn-primary" data-equip-skin="${esc(s.id)}">Equip</button>`
              : `<button class="btn btn-xs btn-gold" data-buy-skin="${esc(s.id)}">Buy ${costStars}★</button>`;
          return `
            <div class="cosmetic-card ${isEquipped ? 'equipped' : ''}" style="cursor:pointer"
              data-inspect-kind="skin" data-inspect-id="${esc(s.id)}"
              data-inspect-title="${esc(s.name)}" data-inspect-sub="${esc(s.family)} · Lv.${minLv}+ · ${costStars ? `${fmtNum(costStars)}★` : 'Starter Gift'}${costTickets ? ` + ${costTickets} Tickets` : ''}">
              <div class="acc-icon">${svgSnakePreview(s.id, undefined, tier === 'tiny' || tier === 'landscape' ? 54 : 68)}</div>
              <strong class="uname-ellipsis">${esc(s.name)}</strong>
              <small>Lv.${minLv}+ · ${costStars ? `${fmtNum(costStars)}★` : 'Free'}</small>
              ${actionBtn}
            </div>
          `;
        }).join('')}
      </div>
    `;
    pager = pagerHtml('inv', colUi.invPage, pages);
  } else if (state.invTab === 'accessories') {
    const pages = Math.max(1, Math.ceil(catalogAcc.length / perPage));
    colUi.invPage = Math.max(0, Math.min(colUi.invPage, pages - 1));
    const slice = catalogAcc.slice(colUi.invPage * perPage, colUi.invPage * perPage + perPage);
    const cols = tier === 'tiny' || tier === 'mobile' ? 2 : 3;
    itemsHtml = `
      <div class="card-grid-3" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">
        ${slice.map((a: any) => {
          const isOwned = a.owned ?? ownedAcc.has(a.id);
          const isEq = (p.equippedAccessory || state.equippedAccessory) === a.id;
          const actionBtn = isEq
            ? `<button class="btn btn-xs btn-soft" data-equip-acc="">Unequip</button>`
            : isOwned
              ? `<button class="btn btn-xs btn-primary" data-equip-acc="${esc(a.id)}">Equip</button>`
              : `<button class="btn btn-xs btn-gold" data-buy-acc="${esc(a.id)}">Buy ${a.costStars || 0}★</button>`;
          return `
            <div class="cosmetic-card ${isEq ? 'equipped' : ''}" style="cursor:pointer"
              data-inspect-kind="acc" data-inspect-id="${esc(a.id)}"
              data-inspect-title="${esc(a.name)}" data-inspect-sub="${esc(a.rarity.toUpperCase())} ${esc(a.slot)} · Lv.${a.minLevel ?? 1}+">
              <div class="acc-icon">${svgAccessoryPreview(a.id, tier === 'tiny' || tier === 'landscape' ? 48 : 58)}</div>
              <strong class="uname-ellipsis">${esc(a.name)}</strong>
              <small>Lv.${a.minLevel ?? 1}+${a.costStars ? ` · ${fmtNum(a.costStars)}★` : ''}</small>
              ${actionBtn}
            </div>
          `;
        }).join('')}
      </div>
    `;
    pager = pagerHtml('inv', colUi.invPage, pages);
  } else if (state.invTab === 'eggs') {
    const items = [
      { id: 'rare_egg', name: 'Rare Egg', desc: '250-500★ + Tickets & accessory roll' },
      { id: 'mystery_egg', name: 'Mystery Egg', desc: '500-900★ + Guaranteed wearable' },
      { id: 'golden_chest', name: 'Golden Chest', desc: '750-1250★ + Tickets & skin roll' },
    ];
    const per = tier === 'tiny' || tier === 'mobile' ? 2 : 3;
    const pages = Math.max(1, Math.ceil(items.length / per));
    colUi.invPage = Math.max(0, Math.min(colUi.invPage, pages - 1));
    const slice = items.slice(colUi.invPage * per, colUi.invPage * per + per);
    itemsHtml = `
      <div class="card-grid-3" style="grid-template-columns:repeat(${Math.min(per, slice.length)},minmax(0,1fr))">
        ${slice.map(it => {
          const qty = inv[it.id] || 0;
          return `
            <div class="cosmetic-card" style="cursor:pointer"
              data-inspect-kind="egg" data-inspect-id="${it.id}"
              data-inspect-title="${esc(it.name)} (×${qty})" data-inspect-sub="${esc(it.desc)}">
              <div class="acc-icon">${svgFoodPreview(it.id, 52)}</div>
              <strong>${esc(it.name)} (×${qty})</strong>
              <small>${esc(it.desc)}</small>
              <button class="btn btn-xs ${qty > 0 ? 'btn-gold' : 'btn-soft'}" data-open-item="${it.id}" ${qty < 1 ? 'disabled' : ''}>
                ${qty > 0 ? 'Open Now' : 'Daily Bonus'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    pager = pagerHtml('inv', colUi.invPage, pages);
  } else {
    const coupons = p.coupons || [];
    itemsHtml = coupons.length
      ? `<div class="card-grid-2">${coupons.slice(0, 4).map((c: any) => `
          <div class="panel" style="display:flex;align-items:center;gap:10px">
            ${svgFoodPreview('golden_chest', 40)}
            <div style="min-width:0">
              <strong>${esc(c.storeName)}</strong>
              <p class="subtitle">${esc(c.discountText)}</p>
              <code class="code-chip">${esc(c.promoCode)}</code>
            </div>
          </div>
        `).join('')}</div>`
      : `<div class="panel empty-msg">Complete missions or redeem Stars in Rewards to collect Coupons.</div>`;
  }

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Armory</h2>
        <div class="pill-group">
          ${tabs.map(t => `<button class="btn btn-xs ${state.invTab === t.id ? 'btn-gold' : 'btn-soft'}" data-inv-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
      </div>

      <div class="armory-live-bar">
        ${svgSnakePreview(state.selectedSkin || 'Forest', state.equippedAccessory, tier === 'tiny' || tier === 'landscape' ? 46 : 58, p.equippedEvolution)}
        <div style="min-width:0;flex:1">
          <strong style="display:block;font-size:14px">${esc(state.selectedSkin || 'Forest')} · ${esc(p.equippedEvolution || 'Baby')}</strong>
          <small class="muted">${esc(state.equippedAccessory ? `Wearing ${state.equippedAccessory}` : 'Tap any item to inspect & try on')}</small>
        </div>
        <span class="pill">${fmtNum(p.stars || 0)}★</span>
      </div>

      ${itemsHtml}
      ${pager}
    </div>
  `;
}

export function renderMissionsPage(ctx: AppContext): string {
  const { state } = ctx;
  const tier = getViewportTier();
  const cat = state.missionCat;
  const cats = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'event', label: 'Event' },
    { id: 'achievements', label: 'Badges' },
  ];
  const daily = (state.missions || []).filter(m => m.category === 'daily');
  const allDailyDone = daily.length > 0 && daily.every(m => m.isCompleted);
  const todayKey = new Date().toISOString().slice(0, 10);
  const bonusClaimedToday = state.profile?.lastDailyBonus === todayKey;

  const perPage = tier === 'tiny' || tier === 'landscape' ? 2 : tier === 'mobile' ? 3 : 4;
  let bodyHtml = '';
  let pager = '';

  if (cat === 'achievements') {
    const achs = state.achievements || [];
    const pages = Math.max(1, Math.ceil(achs.length / perPage));
    colUi.missionPage = Math.max(0, Math.min(colUi.missionPage, pages - 1));
    const slice = achs.slice(colUi.missionPage * perPage, colUi.missionPage * perPage + perPage);
    bodyHtml = `
      <div class="card-grid-2">
        ${slice.map((a: any) => {
          const pct = Math.min(100, Math.round(((a.progress || 0) / Math.max(1, a.target)) * 100));
          return `
            <div class="panel mission-card ${a.isUnlocked ? 'done' : ''}">
              <div class="m-top">
                <span class="m-icon">${svgTrophyMedallion(1, 30)}</span>
                <div><strong>${esc(a.title)}</strong><p>${esc(a.description)}</p></div>
                <span class="pill">${esc(a.tier)}</span>
              </div>
              <div class="hud-bar"><div style="width:${pct}%"></div></div>
              <div class="m-foot"><span>${a.progress}/${a.target}</span><b>${a.isUnlocked ? `Unlocked ✓ (+${a.rewardStars}★)` : `+${a.rewardStars}★`}</b></div>
            </div>
          `;
        }).join('') || `<div class="panel empty-msg">No badges unlocked yet.</div>`}
      </div>
    `;
    pager = pagerHtml('ms', colUi.missionPage, pages);
  } else {
    const items = (state.missions || []).filter(m => m.category === cat);
    const hasClaimable = items.some(m => m.isCompleted && !m.isClaimed);
    const pages = Math.max(1, Math.ceil(items.length / perPage));
    colUi.missionPage = Math.max(0, Math.min(colUi.missionPage, pages - 1));
    const slice = items.slice(colUi.missionPage * perPage, colUi.missionPage * perPage + perPage);
    bodyHtml = `
      ${hasClaimable ? `<div><button id="btn-claim-all-ms" class="btn btn-gold btn-xs">Claim All Ready Rewards</button></div>` : ''}
      <div class="card-grid-2">
        ${slice.map(m => {
          const pct = Math.min(100, Math.round(((m.currentCount || 0) / Math.max(1, m.targetCount)) * 100));
          const rawTitle = String(m.title || '');
          const cleanTitle = (m.icon && rawTitle.startsWith(m.icon))
            ? rawTitle.slice(m.icon.length).trim()
            : rawTitle.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, '').trim() || rawTitle;
          return `
            <div class="panel mission-card ${m.isClaimed ? 'done' : ''}">
              <div class="m-top">
                <span class="m-icon">${svgFoodPreview('star', 26)}</span>
                <div><strong>${esc(cleanTitle)}</strong><p>${esc(m.description)}</p></div>
                <span class="pill">+${m.rewardStars}★ · +${m.rewardXP}XP</span>
              </div>
              <div class="hud-bar"><div style="width:${pct}%"></div></div>
              <div class="m-foot">
                <span>${m.currentCount}/${m.targetCount}</span>
                ${m.isClaimed
                  ? `<span class="pill pill-live">Claimed ✓</span>`
                  : m.isCompleted
                    ? `<button class="btn btn-xs btn-gold" data-claim-ms="${esc(m.id)}">Claim</button>`
                    : `<small class="muted">${pct}%</small>`}
              </div>
            </div>
          `;
        }).join('') || `<div class="panel empty-msg">No missions right now.</div>`}
      </div>
    `;
    pager = pagerHtml('ms', colUi.missionPage, pages);
  }

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Missions</h2>
        <div class="pill-group">
          ${cats.map(c => `<button class="btn btn-xs ${cat === c.id ? 'btn-gold' : 'btn-soft'}" data-ms-cat="${c.id}">${c.label}</button>`).join('')}
        </div>
      </div>

      <div class="panel bonus-strip">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          ${svgFoodPreview('rare_egg', 36)}
          <div style="min-width:0">
            <strong style="font-size:13.5px;display:block">Daily Completion Chest</strong>
            <p class="subtitle">${daily.filter(d => d.isCompleted).length}/${daily.length} done · +1,000★ · Rare Egg</p>
          </div>
        </div>
        <button id="btn-daily-bonus" class="btn btn-xs ${allDailyDone && !bonusClaimedToday ? 'btn-gold' : 'btn-soft'}" ${!allDailyDone || bonusClaimedToday ? 'disabled' : ''}>
          ${bonusClaimedToday ? 'Claimed ✓' : allDailyDone ? 'Open!' : 'Incomplete'}
        </button>
      </div>

      ${bodyHtml}
      ${pager}
    </div>
  `;
}

export function renderRewardsPage(ctx: AppContext): string {
  const { state } = ctx;
  const tier = getViewportTier();
  const stars = state.profile?.stars ?? 0;
  const rewards = state.rewards || [];
  const perPage = tier === 'tiny' || tier === 'landscape' ? 2 : tier === 'mobile' ? 2 : 3;
  const pages = Math.max(1, Math.ceil(rewards.length / perPage));
  colUi.rewardPage = Math.max(0, Math.min(colUi.rewardPage, pages - 1));
  const slice = rewards.slice(colUi.rewardPage * perPage, colUi.rewardPage * perPage + perPage);

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Rewards</h2>
        <span class="pill">${fmtNum(stars)}★</span>
      </div>
      <div class="card-grid-3" style="grid-template-columns:repeat(${tier === 'tiny' || tier === 'mobile' ? 1 : tier === 'landscape' ? 2 : 3},minmax(0,1fr))">
        ${slice.map(r => `
          <div class="panel" style="display:flex;flex-direction:column;gap:7px;justify-content:space-between">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              ${svgFoodPreview('golden_chest', 36)}
              <span class="pill">${esc(r.category)}</span>
            </div>
            <strong>${esc(r.title)}</strong>
            <p class="subtitle">${esc(r.description)}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:800">
              <span>Lv.${r.minLevel}+ · ${r.stock < 0 ? '∞' : r.stock} left</span>
              <b>${fmtNum(r.starCost)} ★</b>
            </div>
            <button class="btn btn-xs btn-gold btn-block" data-redeem-rw="${esc(r.id)}" ${!r.available || stars < r.starCost ? 'disabled' : ''}>
              ${r.soldOut ? 'Sold Out' : !r.available ? 'Unavailable' : stars < r.starCost ? `Need ${fmtNum(r.starCost)}★` : `Redeem`}
            </button>
          </div>
        `).join('') || `<div class="panel empty-msg">Loading rewards…</div>`}
      </div>
      ${pagerHtml('rw', colUi.rewardPage, pages)}
    </div>
  `;
}

export function renderLeaderboardPage(ctx: AppContext): string {
  const { leaderboard } = ctx.state;
  const tier = getViewportTier();
  const cats = [
    { id: 'score', label: 'Score' },
    { id: 'level', label: 'Level' },
    { id: 'kills', label: 'Kills' },
    { id: 'wins', label: 'Wins' },
    { id: 'survival', label: 'Time' },
    { id: 'stars', label: 'Stars' },
    { id: 'explorer', label: 'Story' },
  ];
  const scopes = ['global', 'local', 'friends'];
  const entries = leaderboard.entries || [];
  const top3Order = [entries[1], entries[0], entries[2]].filter(Boolean);

  const perPage = tier === 'tiny' || tier === 'landscape' ? 3 : 4;
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  colUi.lbPage = Math.max(0, Math.min(colUi.lbPage, pages - 1));
  const slice = entries.slice(colUi.lbPage * perPage, colUi.lbPage * perPage + perPage);

  const pool = ['🐲', '🦎', '🐢', '🦊', '🦉', '🐸', '🐝', '🐍'];
  const avatarFor = (e: any) => {
    if (e?.isYou) return ctx.state.profile?.avatar || e.avatar || '🐍';
    if (e?.avatar && e.avatar !== '🐍') return e.avatar;
    const s = String(e?.displayName || e?.userId || 'Explorer');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return pool[Math.abs(h) % pool.length];
  };

  const podiumHtml = top3Order.length && tier !== 'landscape' ? `
    <div class="podium-grid podium-sunny">
      ${top3Order.map((e: any) => `
        <div class="podium-slot rank-${e.rank}">
          <div class="podium-frame">
            ${svgAvatarBadge(avatarFor(e), 'Forest', undefined, e.rank === 1 ? 48 : 38)}
            <span class="podium-medal-pin rank-${e.rank}">${e.rank}</span>
          </div>
          <strong class="uname-ellipsis">${esc(e.displayName)}</strong>
          <div class="podium-val">${fmtNum(e.value)}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Leaderboard</h2>
        <div class="pill-group">
          ${scopes.map(s => `<button class="btn btn-xs ${leaderboard.scope === s ? 'btn-gold' : 'btn-soft'}" data-lb-scope="${s}">${s.toUpperCase()}</button>`).join('')}
        </div>
      </div>

      <div class="pill-group">
        ${cats.map(c => `<button class="btn btn-xs ${leaderboard.category === c.id ? 'btn-primary' : 'btn-soft'}" data-lb-cat="${c.id}">${c.label}</button>`).join('')}
      </div>

      ${podiumHtml}

      <div class="panel" style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:space-between;gap:6px">
        <table class="data-table">
          <thead><tr><th>#</th><th>Player</th><th>Lv</th><th>Value</th></tr></thead>
          <tbody>
            ${slice.map((e: any) => `
              <tr class="${e.isYou ? 'row-me' : ''}">
                <td><b>#${e.rank}</b></td>
                <td><div style="display:flex;align-items:center;gap:6px;min-width:0">${svgAvatarBadge(avatarFor(e), 'Forest', undefined, 22)}<b class="uname-ellipsis" style="max-width:110px">${esc(e.displayName)}</b>${e.isYou ? '<span class="pill pill-live">YOU</span>' : ''}</div></td>
                <td>${e.level}</td>
                <td><b>${fmtNum(e.value)}</b></td>
              </tr>
            `).join('') || `<tr><td colspan="4" class="empty-cell">No entries yet.</td></tr>`}
          </tbody>
        </table>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          ${pages > 1 ? `
            <div class="pill-group">
              <button class="btn btn-xs btn-soft" data-pager="lb" data-dir="-1" ${colUi.lbPage <= 0 ? 'disabled' : ''}>◀</button>
              <span class="pager-dots">${colUi.lbPage + 1}/${pages}</span>
              <button class="btn btn-xs btn-soft" data-pager="lb" data-dir="1" ${colUi.lbPage >= pages - 1 ? 'disabled' : ''}>▶</button>
            </div>
          ` : '<span></span>'}
          <button class="btn btn-xs btn-gold" data-lb-play>▶ Play</button>
        </div>
      </div>
    </div>
  `;
}

export function renderSocialPage(ctx: AppContext): string {
  const tier = getViewportTier();
  const isCompact = tier === 'tiny' || tier === 'mobile' || tier === 'landscape';
  const soc = ctx.state.social || { friends: [], incoming: [], outgoing: [] };
  const invs = ctx.state.invites || [];

  const friendsPanel = `
    <section class="panel" style="flex:1;min-height:0">
      <h3 style="font-size:15px">Friends (${(soc.friends || []).length})</h3>
      ${(soc.friends || []).slice(0, 4).map((f: any) => `
        <div class="stat-row-list"><div>
          <span style="display:flex;align-items:center;gap:6px;min-width:0">${svgAvatarBadge(f.avatar, 'Forest', undefined, 26)} <b class="uname-ellipsis" style="max-width:105px">${esc(f.displayName)}</b> · Lv.${f.level} ${f.online ? '<span class="pill pill-live">Online</span>' : ''}</span>
          <div class="btn-cell">
            <button class="btn btn-xs btn-primary" data-inv-friend="${esc(f.userId)}">Invite</button>
            <button class="btn btn-xs btn-danger" data-unfriend="${esc(f.userId)}">Remove</button>
          </div>
        </div></div>
      `).join('') || `<p class="empty-msg">No friends yet. Share your code above!</p>`}
    </section>
  `;

  const reqPanel = `
    <section class="panel" style="flex:1;min-height:0">
      <h3 style="font-size:15px">Requests &amp; Invites (${(soc.incoming || []).length + invs.length})</h3>
      ${invs.slice(0, 2).map((i: any) => `
        <div class="stat-row-list"><div>
          <span style="display:flex;align-items:center;gap:6px;min-width:0">${svgAvatarBadge(i.fromAvatar, 'Forest', undefined, 24)} <b class="uname-ellipsis">${esc(i.fromName)}</b> · ${esc(i.mode)}</span>
          <div class="btn-cell">
            <button class="btn btn-xs btn-primary" data-inv-resp="${esc(i.id)}" data-act="accept">Join</button>
            <button class="btn btn-xs btn-soft" data-inv-resp="${esc(i.id)}" data-act="decline">Skip</button>
          </div>
        </div></div>
      `).join('')}
      ${(soc.incoming || []).slice(0, 3).map((req: any) => `
        <div class="stat-row-list"><div>
          <span class="uname-ellipsis">${esc(req.displayName)} (Lv.${req.level})</span>
          <div class="btn-cell">
            <button class="btn btn-xs btn-primary" data-fr-resp="${esc(req.userId)}" data-act="accept">Accept</button>
            <button class="btn btn-xs btn-soft" data-fr-resp="${esc(req.userId)}" data-act="reject">Ignore</button>
          </div>
        </div></div>
      `).join('') || (invs.length ? '' : `<p class="empty-msg">No requests right now.</p>`)}
    </section>
  `;

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <h2>Friends</h2>
        <code class="code-chip">${esc(ctx.state.profile?.friendCode || '—')}</code>
      </div>

      <div class="panel">
        <form id="friend-add-form" class="inline-form">
          <input id="friend-query" type="text" required placeholder="Username or AP-XXXX-XXXX code" />
          <button type="submit" class="btn btn-primary btn-xs">Add</button>
        </form>
      </div>

      ${isCompact ? `
        <div class="seg-pill" style="align-self:flex-start">
          <button class="seg-btn ${colUi.friendTab === 'friends' ? 'active' : ''}" data-fr-tab="friends">Friends (${(soc.friends || []).length})</button>
          <button class="seg-btn ${colUi.friendTab === 'requests' ? 'active' : ''}" data-fr-tab="requests">Requests (${(soc.incoming || []).length + invs.length})</button>
        </div>
        ${colUi.friendTab === 'friends' ? friendsPanel : reqPanel}
      ` : `
        <div class="admin-split">${friendsPanel}${reqPanel}</div>
      `}
    </div>
  `;
}

export function renderEventsPage(ctx: AppContext): string {
  const tier = getViewportTier();
  const { live, scheduled, season } = ctx.state.events;
  const perPage = tier === 'tiny' || tier === 'landscape' ? 1 : tier === 'mobile' ? 2 : 3;
  const pages = Math.max(1, Math.ceil(scheduled.length / perPage));
  colUi.eventPage = Math.max(0, Math.min(colUi.eventPage, pages - 1));
  const slice = scheduled.slice(colUi.eventPage * perPage, colUi.eventPage * perPage + perPage);

  return `
    <div class="screen-fill">
      <div class="page-hdr">
        <div style="display:flex;align-items:center;gap:8px"><h2>Events</h2><span class="pill">${esc(season || 'Season 1')}</span></div>
        <button class="btn btn-xs btn-gold" data-quick-mode="event">▶ Play Events</button>
      </div>

      <section class="panel game-wood-rim">
        <h3 style="font-size:14px;margin-bottom:6px">Live In-Match World Events</h3>
        ${live.slice(0, 1).map((e: any) => `
          <div class="mission-card">
            <div style="display:flex;align-items:center;gap:8px">
              ${svgNavIcon('events', 22)}
              <strong>${esc(String(e.name || '').replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+/u, ''))}</strong>
            </div>
            <p class="subtitle">${esc(e.description)}</p>
            <small class="muted">Mode: ${esc(e.mode)} · Rotates in ${e.timerSeconds}s</small>
          </div>
        `).join('') || `<p class="empty-msg">Enter Event Mode or Battle Royale to join Live World Events!</p>`}
      </section>

      <section class="panel" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:8px">
        <h3 style="font-size:14px">Seasonal Calendar</h3>
        <div class="card-grid-2">
          ${slice.map((e: any) => `
            <div class="mission-card">
              <div class="m-top">
                <span class="m-icon">${svgFoodPreview('crystal', 24)}</span>
                <div><strong>${esc(e.name)}</strong><p>${esc(e.description)}</p></div>
                <span class="pill ${e.live ? 'pill-live' : ''}">${e.live ? 'LIVE' : 'Soon'}</span>
              </div>
              <small>${esc(e.rewardHint || '')}</small>
            </div>
          `).join('') || `<p class="empty-msg">Calendar syncs when connected.</p>`}
        </div>
        ${pagerHtml('ev', colUi.eventPage, pages)}
      </section>
    </div>
  `;
}

export function bindCollectionSocialEvents(root: HTMLElement, ctx: AppContext) {
  root.querySelectorAll<HTMLElement>('[data-inv-tab]').forEach(b => {
    b.addEventListener('click', () => { ctx.state.invTab = b.dataset.invTab as any; colUi.invPage = 0; ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-pager]').forEach(b => {
    b.addEventListener('click', () => {
      const k = b.dataset.pager;
      const d = Number(b.dataset.dir);
      if (k === 'inv') colUi.invPage += d;
      if (k === 'ms') colUi.missionPage += d;
      if (k === 'rw') colUi.rewardPage += d;
      if (k === 'lb') colUi.lbPage += d;
      if (k === 'ev') colUi.eventPage += d;
      ctx.render();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-fr-tab]').forEach(b => {
    b.addEventListener('click', () => { colUi.friendTab = b.dataset.frTab as any; ctx.render(); });
  });

  bindShopActionButtons(root, ctx);
  const inspectCards = Array.from(root.querySelectorAll<HTMLElement>('[data-inspect-kind]'));
  inspectCards.forEach((card, i) => {
    card.addEventListener('click', () => showShopInspectModal(ctx, inspectCards, i));
  });
  root.querySelector('[data-lb-play]')?.addEventListener('click', () => {
    ctx.startMatch({ mode: ctx.state.selectedUIMode });
  });

  root.querySelectorAll<HTMLElement>('[data-ms-cat]').forEach(b => {
    b.addEventListener('click', () => { ctx.state.missionCat = b.dataset.msCat as any; colUi.missionPage = 0; ctx.render(); });
  });
  root.querySelectorAll<HTMLElement>('[data-claim-ms]').forEach(b => {
    b.addEventListener('click', async () => {
      const r = await api('/api/missions/claim', { method: 'POST', body: JSON.stringify({ missionId: b.dataset.claimMs }) });
      ctx.toast(r.data?.message || 'Mission claimed!');
      await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
    });
  });
  root.querySelector('#btn-claim-all-ms')?.addEventListener('click', async () => {
    const r = await api('/api/missions/claim-all', { method: 'POST' });
    ctx.toast(`Claimed ${r.data?.claimed?.length || 0} missions (+${r.data?.stars || 0}★)!`);
    await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
  });
  root.querySelector('#btn-daily-bonus')?.addEventListener('click', async () => {
    const r = await api('/api/missions/daily-bonus', { method: 'POST' });
    ctx.toast(r.data?.message || 'Claimed Daily Bonus Egg!');
    await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
  });

  root.querySelectorAll<HTMLElement>('[data-redeem-rw]').forEach(b => {
    b.addEventListener('click', async () => {
      const r = await api('/api/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify({ itemId: b.dataset.redeemRw, region: ctx.state.profile?.country || 'Global' }),
      });
      ctx.toast(r.data?.message || 'Redeemed!');
      await Promise.all([ctx.refreshProfile(), ctx.refreshCollectionData()]);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-lb-scope]').forEach(b => {
    b.addEventListener('click', async () => {
      ctx.state.leaderboard.scope = b.dataset.lbScope!;
      colUi.lbPage = 0;
      await ctx.refreshLeaderboard();
      ctx.render();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-lb-cat]').forEach(b => {
    b.addEventListener('click', async () => {
      ctx.state.leaderboard.category = b.dataset.lbCat!;
      colUi.lbPage = 0;
      await ctx.refreshLeaderboard();
      ctx.render();
    });
  });

  root.querySelector('#friend-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = (root.querySelector('#friend-query') as HTMLInputElement).value.trim();
    const r = await api('/api/social/request', { method: 'POST', body: JSON.stringify({ query }) });
    ctx.toast(r.data?.message || (r.ok ? 'Request sent' : 'User not found'));
    await ctx.refreshCollectionData();
  });
  root.querySelectorAll<HTMLElement>('[data-fr-resp]').forEach(b => {
    b.addEventListener('click', async () => {
      await api('/api/social/respond', { method: 'POST', body: JSON.stringify({ userId: b.dataset.frResp, action: b.dataset.act }) });
      await ctx.refreshCollectionData();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-unfriend]').forEach(b => {
    b.addEventListener('click', async () => {
      await api('/api/social/unfriend', { method: 'POST', body: JSON.stringify({ userId: b.dataset.unfriend }) });
      await ctx.refreshCollectionData();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-inv-friend]').forEach(b => {
    b.addEventListener('click', async () => {
      const r = await api('/api/social/invite', { method: 'POST', body: JSON.stringify({ userId: b.dataset.invFriend, mode: ctx.state.selectedUIMode }) });
      ctx.toast(r.data?.message || 'Invite sent!');
    });
  });
  root.querySelectorAll<HTMLElement>('[data-inv-resp]').forEach(b => {
    b.addEventListener('click', async () => {
      const r = await api('/api/social/invites/respond', { method: 'POST', body: JSON.stringify({ inviteId: b.dataset.invResp, action: b.dataset.act }) });
      await ctx.refreshCollectionData();
      if (b.dataset.act === 'accept' && r.ok) {
        ctx.startMatch({ mode: r.data?.mode === 'team' ? 'team' : r.data?.mode === 'battle_royale' ? 'battle_royale' : 'free_roam' });
      }
    });
  });
  root.querySelectorAll<HTMLElement>('[data-quick-mode]').forEach(b => {
    b.addEventListener('click', () => ctx.startMatch({ mode: b.dataset.quickMode as any }));
  });
}
