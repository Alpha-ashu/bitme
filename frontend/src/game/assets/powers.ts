// Uploaded Bundle Power-Up & Portal Sprite Renderer

import { drawSpriteCentered } from './spriteCache.js';

export function renderShieldPowerAsset(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 17) {
  const pulse = 1 + Math.sin(animFrame * 0.12 + x) * 0.07;
  drawSpriteCentered(ctx, 'ui_heart_wood', x, y, r * 2.4 * pulse, {
    shadow: true,
    auraColor: 'rgba(34, 197, 94, 0.28)',
  });
}

export function renderSpeedPowerAsset(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 17) {
  const pulse = 1 + Math.sin(animFrame * 0.14 + y) * 0.08;
  drawSpriteCentered(ctx, 'ui_bolt_wood', x, y, r * 2.5 * pulse, {
    shadow: true,
    auraColor: 'rgba(250, 204, 21, 0.3)',
  });
}

export function renderWormholeAsset(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  animFrame: number,
  label = 'Portal',
  color = '#8B5CF6',
  radius = 48
) {
  ctx.save();
  ctx.translate(x, y);
  const pulse = 1 + Math.sin(animFrame * 0.08 + x) * 0.06;
  const col = color || '#8B5CF6';

  // Spinning outer rune aura
  const og = ctx.createRadialGradient(0, 0, radius * 0.18, 0, 0, radius * 1.15 * pulse);
  og.addColorStop(0, '#FFFFFF');
  og.addColorStop(0.45, `${col}88`);
  og.addColorStop(1, `${col}00`);
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.15 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(animFrame * 0.03);
  ctx.strokeStyle = col;
  ctx.lineWidth = 3.2;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawSpriteCentered(ctx, 'crystal_rainbow', x, y, radius * 1.25 * pulse, {
    shadow: false,
  });

  if (label) {
    ctx.save();
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0b3d28';
    ctx.fillText(label.replace(/🌀/g, '').trim() || 'Wormhole', x, y + radius * 1.1);
    ctx.restore();
  }
}
