// Shared Bitmap Sprite Cache backed exclusively by extracted PNGs from the uploaded asset bundles

export type BundleSpriteKey =
  | 'obj_bush_round' | 'obj_bush_tall' | 'obj_tree_oak' | 'obj_tree_acacia'
  | 'obj_sign_arrow' | 'obj_sign_post' | 'obj_rock_stone' | 'obj_stump_roots'
  | 'gem_cyan_rect' | 'gem_pink_hex' | 'gem_gold_sun' | 'gem_blue_heart'
  | 'gem_green_oval' | 'gem_violet_star' | 'gem_ice_hex' | 'gem_ruby_square'
  | 'gem_amber_square' | 'gem_emerald_diamond' | 'gem_brown_oval' | 'gem_emerald_drop'
  | 'isl_desert' | 'isl_forest_pond' | 'isl_wasteland' | 'isl_waterfall'
  | 'isl_ice' | 'isl_volcano' | 'isl_river' | 'isl_tropical' | 'isl_glacier'
  | 'crystal_green' | 'crystal_gold' | 'crystal_pink' | 'crystal_blue' | 'crystal_purple' | 'crystal_rainbow'
  | 'ruins_arch' | 'ruins_pillars'
  | 'cave_mine' | 'cave_crystals' | 'cave_skull' | 'cave_dynamite' | 'cave_gems' | 'cave_goldcart'
  | 'farm_shovel' | 'farm_rake' | 'farm_bucket' | 'farm_sunflower'
  | 'farm_cherry_twin' | 'farm_sprout_pot' | 'farm_golden_pepper'
  | 'pirate_potion' | 'pirate_bomb' | 'pirate_coin_sack' | 'pirate_barrel'
  | 'pirate_skull' | 'pirate_chest' | 'pirate_map' | 'pirate_gold_coins' | 'pirate_sword'
  | 'ui_wood_banner' | 'ui_star_wood' | 'ui_play_wood' | 'ui_heart_wood' | 'ui_bolt_wood'
  | 'ui_scroll_win' | 'ui_scroll_lose';

const CACHE = new Map<string, HTMLImageElement>();
let preloaded = false;

export function spriteUrl(key: BundleSpriteKey): string {
  return `/assets/sprites/${key}.png`;
}

export function getBundleImage(key: BundleSpriteKey): HTMLImageElement | null {
  let img = CACHE.get(key);
  if (!img && typeof Image !== 'undefined') {
    img = new Image();
    img.decoding = 'async';
    img.src = spriteUrl(key);
    CACHE.set(key, img);
  }
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function preloadCoreBundleSprites(): void {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  const keys: BundleSpriteKey[] = [
    'obj_tree_oak', 'obj_tree_acacia', 'obj_bush_round', 'obj_bush_tall',
    'obj_rock_stone', 'obj_stump_roots', 'obj_sign_arrow', 'obj_sign_post',
    'isl_waterfall', 'isl_forest_pond', 'isl_volcano', 'isl_desert', 'isl_ice', 'isl_river', 'isl_tropical',
    'cave_mine', 'cave_crystals', 'cave_skull', 'cave_goldcart',
    'ruins_arch', 'ruins_pillars', 'crystal_rainbow', 'crystal_green', 'crystal_gold', 'crystal_blue', 'crystal_purple',
    'farm_cherry_twin', 'farm_golden_pepper', 'farm_sunflower', 'farm_sprout_pot', 'farm_bucket',
    'pirate_bomb', 'pirate_chest', 'pirate_potion', 'pirate_gold_coins', 'pirate_coin_sack',
    'pirate_barrel', 'pirate_skull', 'pirate_map',
    'ui_star_wood', 'ui_heart_wood', 'ui_bolt_wood',
    'gem_violet_star', 'gem_gold_sun', 'gem_emerald_diamond', 'gem_cyan_rect', 'gem_pink_hex', 'gem_ruby_square', 'gem_blue_heart', 'gem_amber_square',
  ];
  for (const k of keys) getBundleImage(k);
}

/**
 * Draw an extracted bundle sprite centered on (x, y) inside a target bounding diameter,
 * maintaining original aspect ratio with an optional soft ground contact shadow.
 */
export function drawSpriteCentered(
  ctx: CanvasRenderingContext2D,
  key: BundleSpriteKey,
  x: number,
  y: number,
  targetSize: number,
  opts?: { shadow?: boolean; alpha?: number; rotate?: number; auraColor?: string }
): boolean {
  const img = getBundleImage(key);
  ctx.save();
  if (opts?.shadow) {
    ctx.fillStyle = 'rgba(11, 61, 40, 0.16)';
    ctx.beginPath();
    ctx.ellipse(x, y + targetSize * 0.36, targetSize * 0.42, targetSize * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts?.auraColor) {
    ctx.fillStyle = opts.auraColor;
    ctx.beginPath();
    ctx.arc(x, y, targetSize * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!img) {
    ctx.restore();
    return false;
  }
  const sc = targetSize / Math.max(img.naturalWidth, img.naturalHeight);
  const dw = img.naturalWidth * sc;
  const dh = img.naturalHeight * sc;
  ctx.translate(x, y);
  if (opts?.rotate) ctx.rotate(opts.rotate);
  if (opts?.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return true;
}

