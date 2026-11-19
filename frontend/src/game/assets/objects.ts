// Uploaded Bundle World Objects & Hazards Sprite Renderer

import { BundleSpriteKey, drawSpriteCentered } from './spriteCache.js';

function pickVariant<T>(seed: string | number, items: T[]): T {
  const s = String(seed);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash * 31) + s.charCodeAt(i)) | 0;
  }
  return items[Math.abs(hash) % items.length];
}

export function renderTreeAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['obj_tree_oak', 'obj_tree_acacia']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.55, { shadow: true });
}

export function renderBushAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['obj_bush_round', 'obj_bush_tall']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.15, { shadow: true, auraColor: 'rgba(74, 222, 128, 0.14)' });
}

export function renderFlowerbedAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, _animFrame: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['farm_sunflower', 'farm_sprout_pot']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.0, { shadow: true, auraColor: 'rgba(250, 204, 21, 0.16)' });
}

export function renderSignpostAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['obj_sign_arrow', 'obj_sign_post']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.1, { shadow: true });
}

export function renderPondAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, animFrame: number, seed: string | number = 0) {
  // Steady pond sprite with subtle surface ripple ring (no sprite wobbling)
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(ox, oy, radius * (0.94 + Math.sin(animFrame * 0.05) * 0.03), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const key = pickVariant<BundleSpriteKey>(seed, ['isl_waterfall', 'isl_forest_pond', 'isl_river', 'isl_tropical']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.25, { shadow: true });
}

export function renderCaveAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['cave_mine', 'cave_crystals', 'cave_gems', 'cave_goldcart']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.25, { shadow: true });
}

export function renderRockAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['obj_rock_stone', 'ruins_pillars', 'ruins_arch', 'crystal_blue']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.15, { shadow: true });
}

export function renderHillAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['isl_ice', 'isl_glacier', 'ruins_pillars']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.2, { shadow: true });
}

export function renderLogAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['obj_stump_roots', 'pirate_barrel']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.05, { shadow: true });
}

export function renderCactusHazardAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, seed: string | number = 0) {
  const key = pickVariant<BundleSpriteKey>(seed, ['isl_desert', 'isl_wasteland']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.2, { shadow: true, auraColor: 'rgba(245, 158, 11, 0.16)' });
}

export function renderLavaHazardAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, animFrame: number, _seed: string | number = 0) {
  // Stable volcano sprite with subtle danger ring
  ctx.save();
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.42 + 0.18 * Math.sin(animFrame * 0.08)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ox, oy, radius * 0.96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawSpriteCentered(ctx, 'isl_volcano', ox, oy, radius * 2.25, { shadow: true, auraColor: 'rgba(239, 68, 68, 0.18)' });
}

export function renderPoisonHazardAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, animFrame: number, seed: string | number = 0) {
  ctx.save();
  ctx.strokeStyle = `rgba(132, 204, 22, ${0.40 + 0.16 * Math.sin(animFrame * 0.08)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(ox, oy, radius * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const key = pickVariant<BundleSpriteKey>(seed, ['cave_skull', 'pirate_skull']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.1, { shadow: true, auraColor: 'rgba(132, 204, 22, 0.2)' });
}

export function renderBombHazardAsset(ctx: CanvasRenderingContext2D, ox: number, oy: number, radius: number, animFrame: number, seed: string | number = 0) {
  ctx.save();
  ctx.strokeStyle = `rgba(244, 63, 94, ${0.45 + 0.2 * Math.sin(animFrame * 0.1)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(ox, oy, radius * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const key = pickVariant<BundleSpriteKey>(seed, ['pirate_bomb', 'cave_dynamite']);
  drawSpriteCentered(ctx, key, ox, oy, radius * 2.0, { shadow: true, auraColor: 'rgba(244, 63, 94, 0.2)' });
}

/** Custom Distinct Vector Head/Neck/Back Accessories for ALL 11 Items (Zero OS Emojis). */
export function renderVectorAccessory(ctx: CanvasRenderingContext2D, accId: string, headW: number, headH: number) {
  ctx.save();
  if (accId === 'diwali_crown' || accId === 'crown') {
    ctx.translate(0, -headH * 0.88);
    const cg = ctx.createLinearGradient(0, -headH * 0.65, 0, headH * 0.2);
    cg.addColorStop(0, '#FEF08A');
    cg.addColorStop(1, '#D97706');
    ctx.fillStyle = cg;
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-headW * 0.56, headH * 0.2);
    ctx.lineTo(-headW * 0.62, -headH * 0.45);
    ctx.lineTo(-headW * 0.2, -headH * 0.12);
    ctx.lineTo(0, -headH * 0.68);
    ctx.lineTo(headW * 0.2, -headH * 0.12);
    ctx.lineTo(headW * 0.62, -headH * 0.45);
    ctx.lineTo(headW * 0.56, headH * 0.2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EC4899';
    ctx.beginPath(); ctx.arc(0, -headH * 0.1, headW * 0.15, 0, Math.PI * 2); ctx.fill();
  } else if (accId === 'flower_crown') {
    for (const [fx, fy, col] of [
      [-headW * 0.46, -headH * 0.84, '#F472B6'],
      [0, -headH * 0.96, '#FACC15'],
      [headW * 0.46, -headH * 0.84, '#FB7185'],
    ] as Array<[number, number, string]>) {
      ctx.fillStyle = col;
      ctx.strokeStyle = '#831843';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(fx, fy, headW * 0.23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFBEB';
      ctx.beginPath(); ctx.arc(fx, fy, headW * 0.08, 0, Math.PI * 2); ctx.fill();
    }
  } else if (accId === 'wizard_hat' || accId === 'christmas_hat') {
    const isXmas = accId === 'christmas_hat';
    ctx.fillStyle = isXmas ? '#EF4444' : '#4338CA';
    ctx.strokeStyle = '#1E1B4B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-headW * 0.74, -headH * 0.55);
    ctx.lineTo(0, -headH * 1.78);
    ctx.lineTo(headW * 0.74, -headH * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = isXmas ? '#FFFFFF' : '#FBBF24';
    ctx.beginPath(); ctx.ellipse(0, -headH * 0.55, headW * 0.84, headH * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    if (isXmas) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(0, -headH * 1.78, headW * 0.18, 0, Math.PI * 2); ctx.fill();
    }
  } else if (accId === 'golden_wings') {
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#FEF08A';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(-headW * 0.32, s * headH * 1.18, headW * 0.78, headH * 0.3, s * 0.45, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(-headW * 0.4, s * headH * 1.05, headW * 0.46, headH * 0.16, s * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (accId === 'headphones') {
    ctx.strokeStyle = '#1E293B'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(0, 0, headW * 1.1, -Math.PI * 0.75, Math.PI * 0.75, true); ctx.stroke();
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = '#0369A1';
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(0, s * headH * 1.04, headW * 0.27, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  } else if (accId === 'scarf') {
    ctx.fillStyle = '#E11D48';
    ctx.strokeStyle = '#881337';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(-headW * 0.35, 0, headW * 0.32, headH * 0.92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-headW * 0.95, headH * 0.22, headW * 0.72, headH * 0.3, 4); ctx.fill(); ctx.stroke();
  } else if (accId === 'backpack') {
    ctx.fillStyle = '#B45309';
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(-headW * 1.18, -headH * 0.56, headW * 0.62, headH * 1.12, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-headW * 1.06, -headH * 0.28, headW * 0.14, headH * 0.56);
  } else if (accId === 'ramadan_lantern') {
    ctx.translate(0, -headH * 0.92);
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(-headW * 0.36, -headH * 0.52, headW * 0.72, headH * 0.68, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath(); ctx.arc(0, -headH * 0.18, headW * 0.2, 0, Math.PI * 2); ctx.fill();
  } else if (accId === 'pirate_hat') {
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -headH * 0.74, headW * 0.92, headH * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-headW * 0.62, -headH * 0.78); ctx.quadraticCurveTo(0, -headH * 1.48, headW * 0.62, -headH * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath(); ctx.arc(0, -headH * 0.98, headW * 0.16, 0, Math.PI * 2); ctx.fill();
  } else {
    // Explorer hat wide brim + leather strap
    ctx.fillStyle = '#D97706';
    ctx.strokeStyle = '#451A03'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -headH * 0.72, headW * 0.92, headH * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-headW * 0.48, -headH * 1.28, headW * 0.96, headH * 0.56, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-headW * 0.48, -headH * 0.88, headW * 0.96, headH * 0.15);
  }
  ctx.restore();
}
