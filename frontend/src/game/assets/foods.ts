// Uploaded Bundle Collectibles & Rewards Sprite Renderer (no drawn non-bundle props)

import { BundleSpriteKey, drawSpriteCentered } from './spriteCache.js';

export function renderFrogAsset(ctx: CanvasRenderingContext2D, fx: number, fy0: number, animFrame: number) {
  const pulse = 1 + Math.sin(animFrame * 0.1 + fx) * 0.07;
  drawSpriteCentered(ctx, 'gem_emerald_diamond', fx, fy0, 34 * pulse, {
    shadow: true,
    auraColor: 'rgba(16, 185, 129, 0.2)',
  });
}

export function renderCherryVector(ctx: CanvasRenderingContext2D, x: number, y: number, r = 14) {
  drawSpriteCentered(ctx, 'farm_cherry_twin', x, y, r * 2.25, { shadow: true });
}

export function renderAppleVector(ctx: CanvasRenderingContext2D, x: number, y: number, r = 15) {
  drawSpriteCentered(ctx, 'farm_golden_pepper', x, y, r * 2.25, { shadow: true });
}

export function renderMushroomVector(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 17) {
  const pulse = 1 + Math.sin(animFrame * 0.12 + x) * 0.08;
  drawSpriteCentered(ctx, 'farm_sunflower', x, y, r * 2.35 * pulse, {
    shadow: true,
    auraColor: 'rgba(250, 204, 21, 0.25)',
  });
}

export function renderStarCoinVector(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 16) {
  const pulse = 1 + Math.sin(animFrame * 0.12 + x) * 0.08;
  const key: BundleSpriteKey = r >= 18 ? 'gem_violet_star' : 'ui_star_wood';
  drawSpriteCentered(ctx, key, x, y, r * 2.4 * pulse, {
    shadow: true,
    auraColor: r >= 18 ? 'rgba(168, 85, 247, 0.28)' : 'rgba(250, 204, 21, 0.28)',
  });
}

export function renderEggVector(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 16) {
  const pulse = 1 + Math.sin(animFrame * 0.1) * 0.06;
  drawSpriteCentered(ctx, 'crystal_rainbow', x, y, r * 2.6 * pulse, {
    shadow: true,
    auraColor: 'rgba(56, 189, 248, 0.24)',
  });
}

export function renderTreasureChestVector(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 19) {
  const pulse = 1 + Math.sin(animFrame * 0.1) * 0.05;
  drawSpriteCentered(ctx, 'pirate_chest', x, y, r * 2.45 * pulse, {
    shadow: true,
    auraColor: 'rgba(245, 158, 11, 0.24)',
  });
}

export function renderPotionVector(ctx: CanvasRenderingContext2D, x: number, y: number, r = 14) {
  drawSpriteCentered(ctx, 'pirate_potion', x, y, r * 2.35, { shadow: true });
}

export function renderCrystalVector(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 16) {
  const keys: BundleSpriteKey[] = ['gem_cyan_rect', 'gem_pink_hex', 'gem_ruby_square', 'crystal_green', 'gem_ice_hex'];
  const key = keys[Math.abs(Math.round(x + y)) % keys.length];
  const pulse = 1 + Math.sin(animFrame * 0.11 + y) * 0.06;
  drawSpriteCentered(ctx, key, x, y, r * 2.3 * pulse, {
    shadow: true,
    auraColor: 'rgba(56, 189, 248, 0.22)',
  });
}

export function renderGlowOrbVector(ctx: CanvasRenderingContext2D, x: number, y: number, _color: string, animFrame: number, r = 11) {
  const keys: BundleSpriteKey[] = ['gem_gold_sun', 'gem_blue_heart', 'gem_amber_square', 'gem_green_oval'];
  const key = keys[Math.abs(Math.round(x * 3 + y)) % keys.length];
  const pulse = 1 + Math.sin(animFrame * 0.14 + x) * 0.08;
  drawSpriteCentered(ctx, key, x, y, r * 2.2 * pulse, {
    auraColor: 'rgba(250, 204, 21, 0.22)',
  });
}

export function renderCritterVector(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'mouse' | 'lizard', animFrame: number, r = 15) {
  const key: BundleSpriteKey = kind === 'mouse' ? 'pirate_gold_coins' : 'gem_amber_square';
  const bob = Math.sin(animFrame * 0.15 + x) * 2;
  drawSpriteCentered(ctx, key, x, y + bob, r * 2.3, { shadow: true });
}
