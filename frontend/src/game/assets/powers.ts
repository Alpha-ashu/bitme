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

/** Glossy cartoon ruby-red Heart Collectible (collect 30 in-game to recharge +1 full heart). */
export function renderHeartPickupAsset(ctx: CanvasRenderingContext2D, x: number, y: number, animFrame: number, r = 15) {
  const beat = 1 + Math.sin(animFrame * 0.14 + x * 0.03) * 0.09;
  const s = r * beat;
  ctx.save();
  ctx.translate(x, y);

  // Soft ground shadow
  ctx.fillStyle = 'rgba(153, 27, 27, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.92, s * 0.65, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Warm ruby halo
  const halo = ctx.createRadialGradient(0, 0, s * 0.15, 0, 0, s * 1.45);
  halo.addColorStop(0, 'rgba(251, 113, 133, 0.55)');
  halo.addColorStop(0.6, 'rgba(239, 68, 68, 0.22)');
  halo.addColorStop(1, 'rgba(239, 68, 68, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, s * 1.45, 0, Math.PI * 2);
  ctx.fill();

  // Plump glossy cartoon heart silhouette
  const drawHeartPath = (scale: number) => {
    ctx.beginPath();
    ctx.moveTo(0, scale * 0.78);
    ctx.bezierCurveTo(-scale * 1.15, scale * 0.15, -scale * 1.05, -scale * 0.85, -scale * 0.42, -scale * 0.85);
    ctx.bezierCurveTo(-scale * 0.12, -scale * 0.85, 0, -scale * 0.56, 0, -scale * 0.42);
    ctx.bezierCurveTo(0, -scale * 0.56, scale * 0.12, -scale * 0.85, scale * 0.42, -scale * 0.85);
    ctx.bezierCurveTo(scale * 1.05, -scale * 0.85, scale * 1.15, scale * 0.15, 0, scale * 0.78);
    ctx.closePath();
  };

  const grad = ctx.createLinearGradient(0, -s * 0.9, 0, s * 0.85);
  grad.addColorStop(0, '#FF6B81');
  grad.addColorStop(0.45, '#EF4444');
  grad.addColorStop(1, '#B91C1C');

  drawHeartPath(s);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#7F1D1D';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Glossy cartoon specular shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.38, -s * 0.36, s * 0.22, s * 0.12, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-s * 0.18, -s * 0.14, s * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
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
