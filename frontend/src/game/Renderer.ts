import { GameStateTick, SnakeData, FoodData, ObstacleData, WORLD } from './GameClient.js';
import {
  renderTreeAsset,
  renderBushAsset,
  renderFlowerbedAsset,
  renderSignpostAsset,
  renderPondAsset,
  renderCaveAsset,
  renderRockAsset,
  renderHillAsset,
  renderFrogAsset,
  renderWormholeAsset,
  renderCherryVector,
  renderAppleVector,
  renderMushroomVector,
  renderStarCoinVector,
  renderEggVector,
  renderTreasureChestVector,
  renderPotionVector,
  renderCrystalVector,
  renderGlowOrbVector,
  renderCritterVector,
  renderShieldPowerAsset,
  renderSpeedPowerAsset,
  renderLogAsset,
  renderCactusHazardAsset,
  renderLavaHazardAsset,
  renderPoisonHazardAsset,
  renderBombHazardAsset,
  renderVectorAccessory,
} from './assets/index.js';
import { preloadCoreBundleSprites } from './assets/spriteCache.js';

interface SkinPalette {
  primary: string;
  secondary: string;
  belly: string;
  glow: string;
  eye: string;
  blush: string;
  outline: string;
  scaleColor: string;
  accentColor: string;
}

const SKINS: Record<string, SkinPalette> = {
  Forest:   { primary: '#F2F9F6', secondary: '#B5EAD7', belly: '#C7E9DE', glow: '#D8F3DC', eye: '#1B243B', blush: '#FFB7B2', outline: '#233240', scaleColor: 'rgba(112, 193, 179, 0.4)', accentColor: '#F472B6' },
  Ocean:    { primary: '#F0F8FF', secondary: '#BEE3F8', belly: '#D0E4F2', glow: '#E0F2FE', eye: '#1B243B', blush: '#FFB7CE', outline: '#1F2D42', scaleColor: 'rgba(144, 205, 244, 0.45)', accentColor: '#38BDF8' },
  Fire:     { primary: '#FFF8F5', secondary: '#FFDAC1', belly: '#FCE1D4', glow: '#FFE5D9', eye: '#2D1B24', blush: '#FF9AA2', outline: '#3D1E28', scaleColor: 'rgba(255, 183, 178, 0.45)', accentColor: '#F97316' },
  Ice:      { primary: '#F5FCFF', secondary: '#E2F1FF', belly: '#D4EBFC', glow: '#EDF2F7', eye: '#162235', blush: '#FEB2B2', outline: '#1C2C42', scaleColor: 'rgba(190, 227, 248, 0.45)', accentColor: '#BAE6FD' },
  Sakura:   { primary: '#FFF5F8', secondary: '#FFC6FF', belly: '#FCDDEC', glow: '#FFE5EC', eye: '#331B28', blush: '#FF70A6', outline: '#421E32', scaleColor: 'rgba(255, 173, 173, 0.45)', accentColor: '#EC4899' },
  Shadow:   { primary: '#F9F5FF', secondary: '#D8B4FE', belly: '#E9D5FF', glow: '#F5D0FE', eye: '#1E1035', blush: '#F472B6', outline: '#2D184C', scaleColor: 'rgba(192, 132, 252, 0.4)', accentColor: '#A855F7' },
  Galaxy:   { primary: '#F4F5FB', secondary: '#C7CEEA', belly: '#D8DCF2', glow: '#E8DFF5', eye: '#161936', blush: '#FFC6FF', outline: '#22274C', scaleColor: 'rgba(181, 234, 215, 0.4)', accentColor: '#818CF8' },
  Golden:   { primary: '#FFFFF5', secondary: '#FFFFD1', belly: '#FAF3C0', glow: '#FFF9C4', eye: '#35280F', blush: '#FFB7B2', outline: '#4A3918', scaleColor: 'rgba(255, 229, 153, 0.45)', accentColor: '#FACC15' },
  Royal:    { primary: '#F8F6FF', secondary: '#DDD6FE', belly: '#E5DEF9', glow: '#EDE9FE', eye: '#201642', blush: '#F472B6', outline: '#312361', scaleColor: 'rgba(167, 139, 250, 0.4)', accentColor: '#C084FC' },
  Desert:   { primary: '#FFFDF5', secondary: '#FDE68A', belly: '#F7E7A9', glow: '#FEF08A', eye: '#38230B', blush: '#FCA5A5', outline: '#4A3113', scaleColor: 'rgba(252, 211, 77, 0.45)', accentColor: '#F59E0B' },
  Jungle:   { primary: '#F3FBF7', secondary: '#A7F3D0', belly: '#C6F6D5', glow: '#D1FAE5', eye: '#103022', blush: '#FCA5A5', outline: '#194532', scaleColor: 'rgba(110, 231, 183, 0.45)', accentColor: '#10B981' },
  Electric: { primary: '#FFFFF2', secondary: '#FEF08A', belly: '#FAF0A3', glow: '#FEF08A', eye: '#382B08', blush: '#FCA5A5', outline: '#4D3B0E', scaleColor: 'rgba(253, 224, 71, 0.45)', accentColor: '#EAB308' },
  Christmas:{ primary: '#FFF5F5', secondary: '#FCA5A5', belly: '#FAD1D1', glow: '#FEE2E2', eye: '#281717', blush: '#EF4444', outline: '#421E1E', scaleColor: 'rgba(110, 231, 183, 0.45)', accentColor: '#EF4444' },
  Halloween:{ primary: '#FFF8F2', secondary: '#FDBA74', belly: '#FCD7B0', glow: '#FED7AA', eye: '#261810', blush: '#F43F5E', outline: '#40261A', scaleColor: 'rgba(251, 146, 60, 0.45)', accentColor: '#F97316' },
  Mythical: { primary: '#FFF2FA', secondary: '#F472B6', belly: '#F9CEE7', glow: '#FCE7F3', eye: '#380E24', blush: '#FB7185', outline: '#4F1836', scaleColor: 'rgba(232, 121, 249, 0.45)', accentColor: '#EC4899' },
};

const SKIN_ALIASES: Record<string, string> = {
  'Emerald Anaconda': 'Forest', 'Standard Forest Snake': 'Forest', 'Golden Serpent': 'Golden',
  'Crimson Viper': 'Fire', 'Shadow Cobra': 'Shadow', 'Ice': 'Ice', 'Galaxy': 'Galaxy',
};

interface InterpolatedSnake {
  x: number;
  y: number;
  angle: number;
  body: Array<{ x: number; y: number }>;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cameraPos = { x: WORLD / 2, y: WORLD / 2 };
  private zoom = 0.45;
  private userZoom = 0.45;            // §5 player-controlled zoom (default: Far view 0.45 = 2.2x wider map FOV)
  private readonly ZOOM_MIN = 0.30;  // most zoomed OUT (Ultra Wide)
  private readonly ZOOM_MAX = 1.0;   // most zoomed IN (Near)
  private animFrame = 0;

  // §6 Toroidal wrap helpers — draw entities at the copy nearest the camera (§8 world = WORLD).
  private wrapRaw(v: number): number { const w = WORLD; return ((v % w) + w) % w; }
  private wrapDeltaRaw(d: number): number { const w = WORLD; let r = ((d % w) + w) % w; if (r > w / 2) r -= w; return r; }
  private wrapNear(coord: number, ref: number): number { return ref + this.wrapDeltaRaw(coord - ref); }

  // LERP Position Cache
  private lerpSnakes: Map<string, InterpolatedSnake> = new Map();

  // Animation State per snake
  private snakeAnimState: Map<string, {
    blinkTimer: number;
    isBlinking: boolean;
    happyTimer: number;
    tongueOut: boolean;
    tongueTimer: number;
  }> = new Map();

  private shakeTimer = 0;
  private shakeIntensity = 0;
  private lastRenderTs = 0;
  private frameDt = 1 / 60;
  private reduceMotion = false;
  private showMinimap = true;
  private controlPos: 'left' | 'right' = 'left';
  private classicBounded = false;
  private activeQuest: any = null;
  private npcQuotas: Record<string, any> = {};
  private damageTexts: Array<{ x: number; y: number; text: string; color: string; life: number; maxLife: number }> = [];
  private shockwaves: Array<{ x: number; y: number; maxR: number; life: number; maxLife: number }> = [];

  public setActiveQuest(quest: any | null) {
    this.activeQuest = quest;
  }

  public setNpcQuotas(quotas: Record<string, any> | null | undefined) {
    this.npcQuotas = quotas || {};
  }

  public setOptions(opts: {
    reduceMotion?: boolean;
    showMinimap?: boolean;
    controlPos?: 'left' | 'right';
    classicBounded?: boolean;
  }) {
    if (opts.reduceMotion !== undefined) this.reduceMotion = opts.reduceMotion;
    if (opts.showMinimap !== undefined) this.showMinimap = opts.showMinimap;
    if (opts.controlPos !== undefined) this.controlPos = opts.controlPos;
    if (opts.classicBounded !== undefined) this.classicBounded = opts.classicBounded;
  }

  public triggerCameraShake(intensity = 6, duration = 0.25) {
    if (this.reduceMotion) return;
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  public spawnDamageText(x: number, y: number, text: string | number, isCritical = false) {
    const txt = typeof text === 'number' ? `-${text}` : text;
    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y - 20,
      text: String(txt),
      color: isCritical ? '#EF4444' : '#F59E0B',
      life: 0.9,
      maxLife: 0.9,
    });
  }

  public spawnFeedback(x: number, y: number, text: string, color: string) {
    this.damageTexts.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y - 24,
      text,
      color,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  public spawnShockwave(x: number, y: number, maxR = 110) {
    this.shockwaves.push({ x, y, maxR, life: 0.42, maxLife: 0.42 });
  }

  // §net How much world this device can actually see right now (half the viewport diagonal,
  // in world units). The client reports this so the server culls the broadcast to what is
  // genuinely visible — a phone needs a fraction of what a 4K desktop does.
  private viewportSize(): { vw: number; vh: number } {
    const vp = window.visualViewport;
    return {
      vw: vp ? Math.round(vp.width) : window.innerWidth,
      vh: vp ? Math.round(vp.height) : window.innerHeight,
    };
  }

  public getViewRadius(): number {
    const { vw, vh } = this.viewportSize();
    return Math.hypot(vw, vh) / 2 / Math.max(0.2, this.zoom);
  }

  public setCameraPreset(preset: 'near' | 'medium' | 'far' | 'ultra_wide') {
    const scale = preset === 'near' ? 1.15 : preset === 'medium' ? 0.85 : preset === 'ultra_wide' ? 0.38 : 0.60;
    this.userZoom = scale;
  }

  public getZoomLabel(): string {
    if (this.userZoom >= 1.0) return '1.3×';
    if (this.userZoom >= 0.72) return '1.0×';
    if (this.userZoom >= 0.48) return '0.7×';
    return '0.5×';
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    preloadCoreBundleSprites();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
    // visualViewport fires when the on-screen keyboard or URL bar resizes the visible area
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.resize());
    }
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.resize());
      ro.observe(document.documentElement);
    }
  }

  // Re-bind to the current canvas element. The app rebuilds root.innerHTML on every
  // render(), which replaces the <canvas>, so we must re-point at the live element or
  // we'd keep drawing to a detached one (→ blank screen after pause/resume).
  public attach(canvas: HTMLCanvasElement) {
    if (this.canvas === canvas) return;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  public resize() {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    // Use visualViewport when available — on mobile this reflects the actual visible
    // area after the URL bar / virtual keyboard shrinks it. innerWidth/innerHeight
    // can return the full layout viewport (larger than what's actually visible).
    const vp = window.visualViewport;
    const w = vp ? Math.round(vp.width) : window.innerWidth;
    const h = vp ? Math.round(vp.height) : window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private palette(skin: string): SkinPalette {
    return SKINS[skin] || SKINS[SKIN_ALIASES[skin]] || SKINS.Forest;
  }

  private getAnimState(id: string) {
    if (!this.snakeAnimState.has(id)) {
      this.snakeAnimState.set(id, {
        blinkTimer: Math.random() * 3,
        isBlinking: false,
        happyTimer: 0,
        tongueOut: false,
        tongueTimer: 0,
      });
    }
    return this.snakeAnimState.get(id)!;
  }

  // §Team the local player's team this frame (undefined outside Team Battle)
  private selfTeam?: 'red' | 'blue';

  // §8 Data-driven map theme + seasonal tint (applied from the server maps config).
  private theme = { sky: '#D4EEF9', ground: '#EBF5FB', grid: 'rgba(120,180,150,0.18)', accent: '#2E7D32', tint: '' };
  public applyTheme(t: { sky?: string; ground?: string; grid?: string; accent?: string; tint?: string }) {
    this.theme = { ...this.theme, ...t, ground: t.ground || t.sky || this.theme.ground };
  }
  private teamColor(team?: 'red' | 'blue'): string {
    return team === 'red' ? '#EF4444' : team === 'blue' ? '#3B82F6' : '#70C1B3';
  }

  public render(state: GameStateTick, targetUserId: string) {
    const nowTs = performance.now();
    this.frameDt = this.lastRenderTs ? Math.min(0.05, Math.max(0.004, (nowTs - this.lastRenderTs) / 1000)) : 1 / 60;
    this.lastRenderTs = nowTs;
    this.animFrame++;
    const { vw, vh } = this.viewportSize();
    // Team Battle: remember our team so allies/enemies can be color-coded consistently.
    this.selfTeam = state.snakes.find(s => s.id === targetUserId)?.team;

    // §8 Theme-driven sky/background (data-driven per map theme).
    this.ctx.fillStyle = this.theme.sky;
    this.ctx.fillRect(0, 0, vw, vh);

    let target = state.snakes.find(s => s.id === targetUserId);
    if (!target || !target.isAlive) target = state.snakes.find(s => s.isAlive);

    const camFactor = 1 - Math.pow(0.0015, this.frameDt);
    // LERP Smooth Camera
    if (target) {
      const targetLerp = this.lerpSnakes.get(target.id);
      const camX = targetLerp ? targetLerp.x : target.head.x;
      const camY = targetLerp ? targetLerp.y : target.head.y;
      // §6 Ease toroidally so crossing the seam never slides the camera across the map.
      this.cameraPos.x = this.wrapRaw(this.cameraPos.x + this.wrapDeltaRaw(camX - this.cameraPos.x) * camFactor);
      this.cameraPos.y = this.wrapRaw(this.cameraPos.y + this.wrapDeltaRaw(camY - this.cameraPos.y) * camFactor);

      // Responsive camera zoom — continuous scaling curve for all device sizes.
      const size = ((target as any).radius ?? 13) + ((target as any).length ?? 12) * 0.12;
      const minDim = Math.min(vw, vh);
      const maxDim = Math.max(vw, vh);
      const baseZoom = 18 / Math.max(12, size);

      // Screen-adaptive scale: ref 360px → 1.0 (so mobile phones are baseline, clear and prominent)
      const screenScale = Math.max(0.85, Math.min(1.4, minDim / 360));

      // Landscape compensation — wider aspect ratios zoom out slightly
      const aspectRatio = maxDim / Math.max(1, minDim);
      const landscapeBoost = aspectRatio > 1.6 ? 0.92 : 1.0;

      // Wide unclamped responsive zoom so Ultra / Far / Medium / Near presets are unmistakably distinct on every screen!
      const targetZoom = Math.max(0.28, Math.min(1.85,
        baseZoom * screenScale * landscapeBoost * this.userZoom
      ));
      this.zoom += (targetZoom - this.zoom) * Math.min(1, this.frameDt * 8);
    }

    let shakeX = 0, shakeY = 0;
    if (!this.reduceMotion && this.shakeTimer > 0) {
      this.shakeTimer -= this.frameDt;
      shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      shakeY = (Math.random() - 0.5) * this.shakeIntensity;
    }

    this.ctx.save();
    this.ctx.translate(vw / 2 + shakeX, vh / 2 + shakeY);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(-this.cameraPos.x, -this.cameraPos.y);

    this.renderTerrain(WORLD);
    if (this.classicBounded) {
      const bMin = WORLD / 2 - 1100;
      const bSize = 2200;
      this.ctx.save();
      this.ctx.strokeStyle = '#EF4444';
      this.ctx.lineWidth = 10;
      this.ctx.setLineDash([18, 10]);
      this.ctx.strokeRect(bMin, bMin, bSize, bSize);
      this.ctx.restore();
    }
    const isCompetitive = state.mode === 'battle_royale' || state.mode === 'team' || state.mode === 'boss';
    if (isCompetitive && state.safeZone) this.renderSafeZone(state.safeZone);
    if (state.sanctuaryZone) this.renderSanctuaryZone(state.sanctuaryZone);
    if (state.teamZones?.length || state.teamBases) this.renderTeamObjectives(state);
    if (state.obstacles) this.renderObstacles(state.obstacles);
    if (state.portals) this.renderPortals(state.portals);
    if (this.activeQuest) this.renderQuestObjectives(target);
    if (state.npcs?.length) this.renderNpcs(state.npcs, target);

    // Render Food (Crystal Clear Discs)
    for (let i = 0; i < state.food.length; i++) {
      this.renderCollectible(state.food[i]);
    }

    // Render Snakes
    for (let i = 0; i < state.snakes.length; i++) {
      const snake = state.snakes[i];
      if (snake.isAlive) {
        this.updateSnakeLerp(snake);
        this.renderKawaiiVectorSnake(snake, snake.id === targetUserId);
      }
    }

    // Bomb / blast shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= this.frameDt;
      if (sw.life <= 0) { this.shockwaves.splice(i, 1); continue; }
      const p = 1 - sw.life / sw.maxLife;
      const sx = this.wrapNear(sw.x, this.cameraPos.x);
      const sy = this.wrapNear(sw.y, this.cameraPos.y);
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, 1 - p);
      this.ctx.strokeStyle = '#EF4444';
      this.ctx.lineWidth = 6 * (1 - p * 0.7);
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, Math.max(10, sw.maxR * p), 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Floating combat / damage / heal / power text
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const d = this.damageTexts[i];
      d.life -= this.frameDt;
      d.y -= 1.25;
      if (d.life <= 0) {
        this.damageTexts.splice(i, 1);
        continue;
      }
      const alpha = Math.max(0, d.life / d.maxLife);
      const fx = this.wrapNear(d.x, this.cameraPos.x);
      const fy = this.wrapNear(d.y, this.cameraPos.y);
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.font = '900 18px Outfit, sans-serif';
      this.ctx.fillStyle = d.color;
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 4;
      this.ctx.textAlign = 'center';
      this.ctx.strokeText(d.text, fx, fy);
      this.ctx.fillText(d.text, fx, fy);
      this.ctx.restore();
    }

    if (!this.reduceMotion && state.currentEvent?.type === 'rain_storm') this.renderRain(WORLD);

    this.ctx.restore();

    // §8 Seasonal tint overlay (thin, non-intrusive) — auto-selected by month or festival.
    if (this.theme.tint) {
      this.ctx.fillStyle = this.theme.tint;
      this.ctx.fillRect(0, 0, vw, vh);
    }

    if (this.showMinimap) this.renderMinimap(state, targetUserId);
  }

  private updateSnakeLerp(snake: SnakeData) {
    let lerp = this.lerpSnakes.get(snake.id);
    if (!lerp) {
      lerp = {
        x: snake.head.x,
        y: snake.head.y,
        angle: snake.angle,
        body: snake.body.map(b => ({ x: b.x, y: b.y })),
      };
      this.lerpSnakes.set(snake.id, lerp);
      return;
    }

    const factor = 1 - Math.pow(0.0005, this.frameDt);
    // §6 Interpolate toroidally and keep cached coords wrapped — no cross-map slides.
    lerp.x = this.wrapRaw(lerp.x + this.wrapDeltaRaw(snake.head.x - lerp.x) * factor);
    lerp.y = this.wrapRaw(lerp.y + this.wrapDeltaRaw(snake.head.y - lerp.y) * factor);

    let da = (snake.angle - lerp.angle) % (Math.PI * 2);
    if (da < -Math.PI) da += Math.PI * 2;
    if (da > Math.PI) da -= Math.PI * 2;
    lerp.angle += da * factor;

    for (let i = 0; i < snake.body.length; i++) {
      const targetSeg = snake.body[i];
      if (!lerp.body[i]) {
        lerp.body[i] = { x: targetSeg.x, y: targetSeg.y };
      } else {
        lerp.body[i].x = this.wrapRaw(lerp.body[i].x + this.wrapDeltaRaw(targetSeg.x - lerp.body[i].x) * factor);
        lerp.body[i].y = this.wrapRaw(lerp.body[i].y + this.wrapDeltaRaw(targetSeg.y - lerp.body[i].y) * factor);
      }
    }
    if (lerp.body.length > snake.body.length) {
      lerp.body.length = snake.body.length;
    }
  }

  private renderTerrain(_world: number) {
    const ctx = this.ctx;
    const cam = this.cameraPos;
    const R = 5000; // covers the viewport at any zoom — §6 seamless, borderless ground

    // 1. Breezy Pastel Mint Park Base matching our Mint-White-Emerald theme
    const isDefaultGround = !this.theme.ground || this.theme.ground === '#EBF5FB' || this.theme.ground === '#D4EEF9';
    ctx.fillStyle = isDefaultGround ? '#DCF5E7' : this.theme.ground;
    ctx.fillRect(cam.x - R, cam.y - R, R * 2, R * 2);

    // 2. Soft Organic Sunlight Clearings
    ctx.fillStyle = isDefaultGround ? 'rgba(255, 255, 255, 0.34)' : 'rgba(255, 255, 255, 0.16)';
    for (const [px, py, pr] of [[350, 500, 380], [2500, 700, 420], [700, 2400, 440], [2400, 2300, 390], [1500, 1500, 480]]) {
      ctx.beginPath(); ctx.arc(this.wrapNear(px, cam.x), this.wrapNear(py, cam.y), pr, 0, Math.PI * 2); ctx.fill();
    }

    // Winding sandy adventure dirt trail between Story Plazas
    const landmarks: Array<[number, number]> = [[665, 1445], [1465, 645], [2265, 1445], [1565, 2445]];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(217, 179, 130, 0.36)';
    ctx.lineWidth = 54;
    ctx.beginPath();
    landmarks.forEach(([lx, ly], idx) => {
      const wx = this.wrapNear(lx, cam.x);
      const wy = this.wrapNear(ly, cam.y);
      if (idx === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Subtle meadow grid & grass tufts + wildflowers & pebbles around camera
    ctx.save();
    const step = 300;
    const gx0 = Math.floor((cam.x - 1650) / step) * step;
    const gx1 = cam.x + 1650;
    const gy0 = Math.floor((cam.y - 1250) / step) * step;
    const gy1 = cam.y + 1250;
    for (let gx = gx0; gx <= gx1; gx += step) {
      for (let gy = gy0; gy <= gy1; gy += step) {
        const hash = Math.abs((gx * 73 + gy * 19) ^ (gx * 13));
        const jx = gx + (((gx * 73 + gy * 19) & 127) - 64);
        const jy = gy + (((gx * 37 + gy * 97) & 127) - 64);

        // Soft clover tuft
        ctx.strokeStyle = isDefaultGround ? 'rgba(21, 128, 61, 0.24)' : (this.theme.grid || 'rgba(22, 163, 74, 0.2)');
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(jx - 7, jy); ctx.lineTo(jx - 13, jy - 11);
        ctx.moveTo(jx, jy); ctx.lineTo(jx, jy - 14);
        ctx.moveTo(jx + 7, jy); ctx.lineTo(jx + 13, jy - 10);
        ctx.stroke();

        // Tiny cartoon meadow daisies or stepping pebbles
        if (hash % 3 === 0) {
          const fx = jx + 68;
          const fy = jy + 52;
          ctx.fillStyle = hash % 2 === 0 ? '#FFFFFF' : '#FDE047';
          for (let p = 0; p < 5; p++) {
            const a = (p * Math.PI * 2) / 5;
            ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 4.5, fy + Math.sin(a) * 4.5, 2.8, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (hash % 3 === 1) {
          ctx.fillStyle = 'rgba(120, 113, 108, 0.16)';
          ctx.beginPath(); ctx.ellipse(jx - 75, jy + 62, 10, 6, 0.3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(jx - 58, jy + 70, 6, 4, -0.2, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();

    // 3. Carved Stone & Wood Story Landmark Plazas (Explorer Discovery Anchors)
    for (const [lx, ly] of landmarks) {
      const wx = this.wrapNear(lx, cam.x);
      const wy = this.wrapNear(ly, cam.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(wx, wy, 134, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(235, 219, 185, 0.68)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(139, 90, 43, 0.45)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wx, wy, 104, 0, Math.PI * 2);
      ctx.setLineDash([14, 10]);
      ctx.strokeStyle = 'rgba(120, 82, 40, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
      // Inner golden compass medallion
      ctx.beginPath();
      ctx.arc(wx, wy, 56, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(217, 165, 91, 0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderSafeZone(zone: { centerX: number; centerY: number; radius: number }) {
    const ctx = this.ctx;
    const cx = this.wrapNear(zone.centerX, this.cameraPos.x); // §6
    const cy = this.wrapNear(zone.centerY, this.cameraPos.y);
    const R = 6000;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.cameraPos.x - R, this.cameraPos.y - R, R * 2, R * 2);
    ctx.arc(cx, cy, zone.radius, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
    ctx.fill('evenodd');

    ctx.beginPath();
    ctx.arc(cx, cy, zone.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  /** Render Peaceful Safe Sanctuary Zone (No PvP / Hide Safely Inside) — Clean & Unobstructed */
  private renderSanctuaryZone(s: { centerX: number; centerY: number; radius: number; label: string; icon: string }) {
    const ctx = this.ctx;
    const cx = this.wrapNear(s.centerX, this.cameraPos.x); // §6 nearest wrapped copy
    const cy = this.wrapNear(s.centerY, this.cameraPos.y);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(167, 243, 208, 0.25)';
    ctx.fill();
    ctx.restore();
  }

  /** Render Wormhole Portals — Delegated to ./assets/powers.ts asset registry */
  private renderPortals(portals: Array<{ id: string; targetId: string; x: number; y: number; label: string; color: string }>) {
    for (const p of portals) {
      const px = this.wrapNear(p.x, this.cameraPos.x);
      const py = this.wrapNear(p.y, this.cameraPos.y);
      renderWormholeAsset(this.ctx, px, py, this.animFrame, p.label, p.color);
    }
  }

  /** Dynamic obstacles — Rendered stably using immutable obstacle ID seed so sprites never flip across world seams */
  private renderObstacles(obstacles: ObstacleData[]) {
    const ctx = this.ctx;
    for (const ob of obstacles) {
      const ox = this.wrapNear(ob.x, this.cameraPos.x);
      const oy = this.wrapNear(ob.y, this.cameraPos.y);
      const seed = ob.id || `${Math.round(ob.x)}_${Math.round(ob.y)}`;
      ctx.save();
      if (ob.type === 'pond') {
        renderPondAsset(ctx, ox, oy, ob.radius || 54, this.animFrame, seed);
      } else if (ob.type === 'tree') {
        renderTreeAsset(ctx, ox, oy, ob.radius || 46, seed);
      } else if (ob.type === 'bush') {
        renderBushAsset(ctx, ox, oy, ob.radius || 34, seed);
      } else if (ob.type === 'flowerbed') {
        renderFlowerbedAsset(ctx, ox, oy, ob.radius || 32, this.animFrame, seed);
      } else if (ob.type === 'signpost') {
        renderSignpostAsset(ctx, ox, oy, ob.radius || 28, seed);
      } else if (ob.type === 'cave') {
        renderCaveAsset(ctx, ox, oy, ob.radius || 56, seed);
      } else if (ob.type === 'rock') {
        renderRockAsset(ctx, ox, oy, ob.radius || 34, seed);
      } else if (ob.type === 'hill') {
        renderHillAsset(ctx, ox, oy, ob.radius || 48, seed);
      } else if (ob.type === 'log') {
        renderLogAsset(ctx, ox, oy, ob.radius || 30, seed);
      } else if (ob.type === 'cactus') {
        renderCactusHazardAsset(ctx, ox, oy, ob.radius || 38, seed);
      } else if (ob.type === 'lava') {
        renderLavaHazardAsset(ctx, ox, oy, ob.radius || 44, this.animFrame, seed);
      } else if (ob.type === 'poison') {
        renderPoisonHazardAsset(ctx, ox, oy, ob.radius || 38, this.animFrame, seed);
      } else {
        renderBombHazardAsset(ctx, ox, oy, ob.radius || 32, this.animFrame, seed);
      }
      ctx.restore();
    }
  }

  /**
   * Pure Cartoon Vector Collectibles (World-unit scale keeps 1:1 visual parity with snake radius)
   */
  private renderCollectible(food: FoodData) {
    const ctx = this.ctx;
    const fx = this.wrapNear(food.x, this.cameraPos.x);
    const fy0 = this.wrapNear(food.y, this.cameraPos.y);

    if (food.type === 'frog') {
      renderFrogAsset(ctx, fx, fy0, this.animFrame);
      return;
    }

    const bounce = food.type === 'star' ? 0 : Math.sin(this.animFrame * 0.08 + food.x) * 3;
    const py = fy0 - bounce;

    switch (food.type) {
      case 'cherry':
        renderCherryVector(ctx, fx, py, 14);
        break;
      case 'apple':
        renderAppleVector(ctx, fx, py, 15);
        break;
      case 'mushroom':
        renderMushroomVector(ctx, fx, py, this.animFrame, 17);
        break;
      case 'star':
      case 'super_star':
        renderStarCoinVector(ctx, fx, py, this.animFrame, food.type === 'super_star' ? 19 : 16);
        break;
      case 'egg':
        renderEggVector(ctx, fx, py, this.animFrame, 16);
        break;
      case 'shield':
        renderShieldPowerAsset(ctx, fx, py, this.animFrame, 17);
        break;
      case 'speed':
        renderSpeedPowerAsset(ctx, fx, py, this.animFrame, 17);
        break;
      case 'coupon_box':
      case 'boss_drop':
        renderTreasureChestVector(ctx, fx, py, this.animFrame, 19);
        break;
      case 'crystal':
        renderCrystalVector(ctx, fx, py, this.animFrame, 16);
        break;
      case 'mouse':
      case 'lizard':
        renderCritterVector(ctx, fx, py, food.type, this.animFrame, 15);
        break;
      case 'snake_remains':
        renderGlowOrbVector(ctx, fx, py, food.color || '#FDE047', this.animFrame, 11);
        break;
      default:
        renderPotionVector(ctx, fx, py, 14);
        break;
    }
  }

  /**
   * High-Performance 60+ FPS Kawaii Vector Snake Illustration Renderer
   */
  private renderKawaiiVectorSnake(snake: SnakeData, isTarget: boolean) {
    const ctx = this.ctx;
    const pal = this.palette(snake.skin);
    const lerp = this.lerpSnakes.get(snake.id);
    const rawHeadX = lerp ? lerp.x : snake.head.x;
    const rawHeadY = lerp ? lerp.y : snake.head.y;
    const angle = lerp ? lerp.angle : snake.angle;
    const rawBody = lerp ? lerp.body : snake.body;

    // §6 Reconstruct a camera-continuous chain: head at the copy nearest the camera, then
    // each segment placed by the short toroidal delta from the previous one (wraps seamlessly).
    const headX = this.wrapNear(rawHeadX, this.cameraPos.x);
    const headY = this.wrapNear(rawHeadY, this.cameraPos.y);
    const body: Array<{ x: number; y: number }> = [];
    let prevAbs = { x: rawHeadX, y: rawHeadY };
    let prevDrawn = { x: headX, y: headY };
    for (let i = 0; i < rawBody.length; i++) {
      const seg = rawBody[i];
      const d = { x: prevDrawn.x + this.wrapDeltaRaw(seg.x - prevAbs.x), y: prevDrawn.y + this.wrapDeltaRaw(seg.y - prevAbs.y) };
      body.push(d);
      prevAbs = seg; prevDrawn = d;
    }
    const anim = this.getAnimState(snake.id);

    // Timers
    anim.blinkTimer += 0.02;
    if (anim.blinkTimer > 3.8) anim.blinkTimer = 0;
    anim.isBlinking = anim.blinkTimer < 0.14;

    anim.tongueTimer += 0.02;
    if (anim.tongueTimer > 2.8) anim.tongueTimer = 0;
    anim.tongueOut = anim.tongueTimer < 0.42;

    const baseRadius = Math.max(12, snake.radius);

    // §Team Battle — a team-colored ground ring makes allies/enemies instantly readable.
    if (snake.team) {
      const ally = snake.team === this.selfTeam;
      ctx.save();
      ctx.beginPath();
      ctx.arc(headX, headY, baseRadius * 1.9, 0, Math.PI * 2);
      ctx.strokeStyle = this.teamColor(snake.team);
      ctx.globalAlpha = ally ? 0.9 : 0.7;
      ctx.setLineDash(ally ? [] : [6, 5]); // solid ring = ally, dashed = enemy
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Power aura around the head — 🍄 super (pink) / 🛡️ shield (blue)
    const superOn = ((snake as any).superTimer ?? 0) > 0;
    const shieldOn = snake.shieldTimer > 0;
    if (superOn || shieldOn) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(headX, headY, baseRadius * 1.7 + Math.sin(this.animFrame * 0.2) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = superOn ? 'rgba(232,93,117,0.85)' : 'rgba(62,146,204,0.85)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // --- 1. CONTINUOUS SMOOTH KAWAII BODY TUBE (Batch-rendered for 60+ FPS lock) ---

    // Pass A: Dark Indigo Outer Line (Contour)
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.outline;
    ctx.lineWidth = baseRadius * 2.15;
    ctx.stroke();

    // Pass B: Main Soft Pastel Cream Body Fill
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = baseRadius * 1.82;
    ctx.stroke();

    // Pass C: Soft Powder Blue Underbelly Shade
    ctx.beginPath();
    ctx.moveTo(headX, headY);
    for (let i = 0; i < body.length; i++) {
      ctx.lineTo(body[i].x, body[i].y);
    }
    ctx.strokeStyle = pal.belly;
    ctx.lineWidth = baseRadius * 0.72;
    ctx.stroke();

    // Pass D: Vector 4-Petal Blossom / Crest (Max 2 along spine for 60fps)
    if (body.length > 5) {
      const drawCrest = (cx: number, cy: number) => {
        const cr = baseRadius * 0.34;
        ctx.save();
        ctx.translate(cx, cy - baseRadius * 0.35);
        ctx.fillStyle = pal.accentColor || '#F472B6';
        for (let p = 0; p < 4; p++) {
          const a = (p * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * cr * 0.72, Math.sin(a) * cr * 0.72, cr * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, 0, cr * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      const seg1 = body[Math.floor(body.length * 0.3)];
      if (seg1) drawCrest(seg1.x, seg1.y);

      if (body.length > 12) {
        const seg2 = body[Math.floor(body.length * 0.7)];
        if (seg2) drawCrest(seg2.x, seg2.y);
      }
    }

    // Trailing 4-point cartoon sparkles when boosting
    if (snake.boosting) {
      const tailSeg = body[body.length - 1] || { x: headX, y: headY };
      const sr = baseRadius * 0.55;
      ctx.save();
      ctx.translate(tailSeg.x, tailSeg.y);
      ctx.fillStyle = '#FDE047';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * sr * 0.3, Math.sin(a + Math.PI / 4) * sr * 0.3);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // --- 2. CHUBBY KAWAII HEAD & FACE ---
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(angle);

    const headW = baseRadius * 1.15;
    const headH = baseRadius * 1.05;

    // Head Dark Contour Outline
    ctx.beginPath();
    ctx.ellipse(0, 0, headW + 2.2, headH + 2.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.outline;
    ctx.fill();

    // Head Primary Soft Pastel Fill
    ctx.beginPath();
    ctx.ellipse(0, 0, headW, headH, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.primary;
    ctx.fill();

    // Soft Pink Blush Cheeks
    ctx.beginPath();
    ctx.ellipse(headW * 0.28, -headH * 0.46, baseRadius * 0.32, baseRadius * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(headW * 0.28, headH * 0.46, baseRadius * 0.32, baseRadius * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.blush;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // --- 3. KAWAII BUTTON EYES ---
    const eyeOffsetX = headW * 0.36;
    const eyeOffsetY = headH * 0.32;
    const eyeRadiusX = Math.max(3.5, baseRadius * 0.24);
    const eyeRadiusY = Math.max(2.8, baseRadius * 0.18);

    for (const side of [-1, 1]) {
      const ey = side * eyeOffsetY;

      if (anim.isBlinking) {
        ctx.beginPath();
        ctx.arc(eyeOffsetX, ey, eyeRadiusX, 0.15 * Math.PI, 0.85 * Math.PI, false);
        ctx.strokeStyle = pal.outline;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(eyeOffsetX, ey, eyeRadiusX, eyeRadiusY, side * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = pal.eye;
        ctx.fill();
      }
    }

    // Equipped Vector Accessory (Pure Canvas 2D)
    const equippedAcc = (snake as any).equippedAccessory;
    if (equippedAcc && equippedAcc !== 'none') {
      renderVectorAccessory(ctx, equippedAcc, headW, headH);
    }

    ctx.restore();

    // --- 5. CLEAN NAME TAG & HP BAR ---
    this.renderNameHp(snake, isTarget, anim, headX, headY, baseRadius);
  }

  private renderNameHp(
    snake: SnakeData,
    isTarget: boolean,
    _anim: any,
    headX: number,
    headY: number,
    r: number
  ) {
    const ctx = this.ctx;
    const hp = snake.hp ?? 100;
    const maxHp = snake.maxHp ?? 100;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    // World-unit name font size (cam zoom already handles device viewport adaptation cleanly)
    const nameFontSize = Math.max(12, Math.min(18, Math.round(r * 0.88)));
    const y = headY - r - (nameFontSize + 10);
    ctx.save();
    ctx.font = `bold ${nameFontSize}px Outfit, sans-serif`;
    ctx.textAlign = 'center';

    const label = snake.displayName || 'Serpent';
    const textW = ctx.measureText(label).width;
    if (snake.team) {
      const pipS = nameFontSize * 0.65;
      const pipX = headX - textW / 2 - pipS - 6;
      const pipY = y - 4 - pipS * 0.82;
      ctx.fillStyle = this.teamColor(snake.team);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pipX, pipY, pipS, pipS, 2);
      ctx.fill();
      ctx.stroke();
    } else if (isTarget) {
      const cw = nameFontSize * 0.9;
      const cx = headX - textW / 2 - cw * 0.72 - 5;
      const cy = y - 5 - nameFontSize * 0.36;
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.45, cy + cw * 0.28);
      ctx.lineTo(cx - cw * 0.48, cy - cw * 0.22);
      ctx.lineTo(cx - cw * 0.16, cy);
      ctx.lineTo(cx, cy - cw * 0.34);
      ctx.lineTo(cx + cw * 0.16, cy);
      ctx.lineTo(cx + cw * 0.48, cy - cw * 0.22);
      ctx.lineTo(cx + cw * 0.45, cy + cw * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = snake.team ? this.teamColor(snake.team) : (isTarget ? '#1E3A8A' : '#475569');
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, headX, y - 4);

    if (ratio < 0.99) {
      const w = Math.max(30, r * 2.5);
      const hpH = Math.max(3, Math.min(6, nameFontSize * 0.4));
      const x = headX - w / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x - 1, y - 1, w + 2, hpH + 2);
      ctx.fillStyle = ratio < 0.3 ? '#FC8181' : '#F6AD55';
      ctx.fillRect(x, y, w * ratio, hpH);
    }
    ctx.restore();
  }

  private renderRain(world: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 227, 248, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 50; i++) {
      const rx = (i * 65 + this.animFrame * 10) % world;
      const ry = (i * 55 + this.animFrame * 18) % world;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke();
    }
    ctx.restore();
  }

  private renderMinimap(state: GameStateTick, targetUserId: string) {
    const ctx = this.ctx;
    const { vw, vh } = this.viewportSize();
    const minDim = Math.min(vw, vh);
    const hasTouchHud = vw <= 900 || ('ontouchstart' in window) || !!window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches;
    const isShortLandscape = hasTouchHud && vw > vh && vh < 520;

    // Proportional minimap: avoids overlapping touch joystick & action buttons in both portrait & landscape
    const size = isShortLandscape
      ? Math.max(60, Math.min(74, Math.floor(vh * 0.185)))
      : Math.max(70, Math.min(130, Math.floor(minDim * (minDim <= 640 ? 0.18 : 0.13))));
    const margin = Math.max(10, Math.floor(minDim * 0.025));

    const onLeft = this.controlPos === 'right';
    let x = onLeft ? margin : vw - size - margin;
    let y = vh - size - margin;
    if (isShortLandscape) {
      x = onLeft ? margin : vw - size - margin;
      y = vh - size - 88;
    } else if (hasTouchHud) {
      x = onLeft ? margin : vw - size - margin;
      y = vh - size - 112;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(11, 61, 40, 0.16)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = this.classicBounded ? '#EF4444' : '#5FC38E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, Math.max(8, size * 0.14));
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    ctx.clip();

    // Classic Arcade bounds: frame 2200×2200 center arena cleanly instead of 6000×6000 world
    const span = this.classicBounded ? 2200 : WORLD;
    const originX = this.classicBounded ? WORLD / 2 - 1100 : 0;
    const originY = this.classicBounded ? WORLD / 2 - 1100 : 0;
    const scale = size / span;

    if (this.classicBounded) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
      ctx.restore();
    }

    // Sanctuary (always visible) — green ring on the minimap
    if (state.sanctuaryZone) {
      ctx.beginPath();
      ctx.arc(x + (state.sanctuaryZone.centerX - originX) * scale, y + (state.sanctuaryZone.centerY - originY) * scale, Math.max(4, state.sanctuaryZone.radius * scale), 0, Math.PI * 2);
      ctx.strokeStyle = '#10B981'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Active wormhole — pulsing purple marker
    if (state.portals) {
      for (const p of state.portals) {
        ctx.beginPath();
        ctx.arc(x + (p.x - originX) * scale, y + (p.y - originY) * scale, 3 + Math.sin(this.animFrame * 0.15) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = p.color || '#8B5CF6'; ctx.fill();
      }
    }

    // Snake dots — proportional to minimap size
    const dotR = Math.max(1.5, size * 0.025);
    const myDotR = Math.max(2.5, size * 0.035);
    for (let i = 0; i < state.snakes.length; i++) {
      const s = state.snakes[i];
      if (!s.isAlive) continue;
      const isT = s.id === targetUserId;
      ctx.beginPath();
      ctx.arc(x + (s.head.x - originX) * scale, y + (s.head.y - originY) * scale, isT ? myDotR : dotR, 0, Math.PI * 2);
      // Team Battle: dots colored by team so you can read the battlefield at a glance.
      ctx.fillStyle = isT ? '#111827' : (s.team ? this.teamColor(s.team) : '#70C1B3'); ctx.fill();
      if (isT) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    }
    ctx.restore();
  }

  // §explorer Villagers. Each is a small coiled snake with a pure Canvas vector role crest
  // so an elder reads differently from a guard at a glance, standing on trodden ground.
  private renderNpcs(npcs: NonNullable<GameStateTick['npcs']>, target?: SnakeData) {
    const ctx = this.ctx;
    for (const n of npcs) {
      const x = this.wrapNear(n.x, this.cameraPos.x);
      const y = this.wrapNear(n.y, this.cameraPos.y);
      // Skip anything comfortably off-screen — a village is a lot of draw calls otherwise.
      if (Math.abs(x - this.cameraPos.x) > 2600 || Math.abs(y - this.cameraPos.y) > 2600) continue;

      ctx.save();
      const r = Math.max(18, n.radius * 0.56);
      const bob = Math.sin(this.animFrame * 0.05 + n.x * 0.01) * 2.2;
      const ny = y + bob;

      // Grounded stone/soil contact disc
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.82, r * 1.08, r * 0.42, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20, 83, 45, 0.24)';
      ctx.fill();

      // Coiled serpentine robe/base beneath villager torso
      const tailCol = n.role === 'elder' ? '#6D28D9' : n.role === 'guard' ? '#1D4ED8' : n.role === 'trainer' ? '#DC2626' : n.role === 'merchant' ? '#D97706' : '#16A34A';
      ctx.fillStyle = tailCol;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(x, ny + r * 0.34, r * 0.96, r * 0.52, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Expressive Emerald Creature Head
      const headG = ctx.createRadialGradient(x - r * 0.25, ny - r * 0.35, r * 0.1, x, ny - r * 0.06, r * 0.86);
      headG.addColorStop(0, '#86EFAC');
      headG.addColorStop(0.55, '#22C55E');
      headG.addColorStop(1, '#15803D');
      ctx.fillStyle = headG;
      ctx.beginPath();
      ctx.arc(x, ny - r * 0.06, r * 0.72, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Cream belly / vest collar
      ctx.fillStyle = '#FEF3C7';
      ctx.beginPath();
      ctx.ellipse(x, ny + r * 0.32, r * 0.46, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Big Glossy Cartoon Eyes
      for (const s of [-1, 1]) {
        const ex = x + s * r * 0.28;
        const ey = ny - r * 0.1;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(ex, ey, r * 0.21, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#052E16'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.beginPath(); ctx.arc(ex, ey, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(ex - 1.4, ey - 1.4, r * 0.055, 0, Math.PI * 2); ctx.fill();
      }

      // Friendly smile & role-specific iconic prop/hat
      if (n.role === 'elder') {
        // Fluffy white wizard beard + Wizard Hat + Oak Staff
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(x - r * 0.35, ny + r * 0.05);
        ctx.quadraticCurveTo(x, ny + r * 0.65, x + r * 0.35, ny + r * 0.05);
        ctx.closePath();
        ctx.fill();

        // Pointy Indigo Wizard Hat with gold buckle
        ctx.fillStyle = '#4F46E5';
        ctx.strokeStyle = '#1E1B4B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.85, ny - r * 0.54);
        ctx.lineTo(x + r * 0.05, ny - r * 1.48);
        ctx.lineTo(x + r * 0.85, ny - r * 0.54);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath(); ctx.ellipse(x, ny - r * 0.54, r * 0.92, r * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Crystal staff beside Elder
        ctx.strokeStyle = '#78350F'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x + r * 0.92, ny + r * 0.72); ctx.lineTo(x + r * 0.96, ny - r * 0.6); ctx.stroke();
        ctx.fillStyle = '#38BDF8'; ctx.strokeStyle = '#0369A1'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x + r * 0.96, ny - r * 0.72, r * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (n.role === 'guard' || n.role === 'trainer') {
        // Gleaming Knight Helm + Crest + Shield
        ctx.fillStyle = n.role === 'guard' ? '#94A3B8' : '#EA580C';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, ny - r * 0.36, r * 0.76, Math.PI, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = n.role === 'guard' ? '#3B82F6' : '#EF4444';
        ctx.beginPath();
        ctx.ellipse(x, ny - r * 1.12, r * 0.2, r * 0.38, -0.15, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Side heraldic buckler shield
        ctx.fillStyle = '#FBBF24'; ctx.strokeStyle = '#78350F';
        ctx.beginPath(); ctx.arc(x - r * 0.86, ny + r * 0.16, r * 0.34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (n.role === 'merchant') {
        // Golden Merchant Cap & Star Coin Pouch
        ctx.fillStyle = '#F59E0B'; ctx.strokeStyle = '#78350F'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, ny - r * 0.62, r * 0.72, r * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath(); ctx.arc(x, ny - r * 0.68, r * 0.16, 0, Math.PI * 2); ctx.fill();
      } else {
        // Cute Explorer Straw Hat
        ctx.fillStyle = '#FDE68A'; ctx.strokeStyle = '#92400E'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(x, ny - r * 0.56, r * 0.9, r * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, ny - r * 0.58, r * 0.5, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(x - r * 0.5, ny - r * 0.64, r * 1.0, r * 0.12);
      }

      // Crisp pill Name Plate + Quest Master 5-task quota status
      ctx.font = '800 12px Outfit, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5; ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(n.name, x, y + r * 1.25);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(n.name, x, y + r * 1.25);

      const qInfo = this.npcQuotas[n.id];
      const doneInCycle = qInfo ? qInfo.completedInCycle : 0;
      const maxInCycle = qInfo ? qInfo.maxPerCycle : 5;
      let statusTxt = `Tasks ${doneInCycle}/${maxInCycle}`;
      let statusCol = '#047857';
      if (qInfo?.onCooldown && qInfo.cooldownUntil) {
        const leftSec = Math.max(0, Math.ceil((Date.parse(qInfo.cooldownUntil) - Date.now()) / 1000));
        if (leftSec > 0) {
          const m = Math.floor(leftSec / 60);
          const s = leftSec % 60;
          statusTxt = `Rest ${m}:${String(s).padStart(2, '0')}`;
          statusCol = '#B45309';
        }
      }
      ctx.font = '800 10.5px Outfit, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF';
      ctx.strokeText(statusTxt, x, y + r * 1.62);
      ctx.fillStyle = statusCol;
      ctx.fillText(statusTxt, x, y + r * 1.62);

      // Interactive NPC Ground Halo + Floating Animated Quest Indicator
      if (target) {
        const dx = this.wrapDeltaRaw(target.head.x - n.x);
        const dy = this.wrapDeltaRaw(target.head.y - n.y);
        const distSq = dx * dx + dy * dy;
        const enterR = (n.radius || 46) + target.radius + 82;
        if (distSq < (enterR + 180) ** 2) {
          const pulse = 0.5 + 0.5 * Math.sin(this.animFrame * 0.1);
          const inRange = distSq <= enterR * enterR;
          ctx.save();
          ctx.strokeStyle = inRange ? 'rgba(245, 158, 11, 0.85)' : 'rgba(16, 185, 129, 0.45)';
          ctx.lineWidth = inRange ? 3.5 : 2;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.arc(x, y, enterR * (0.96 + pulse * 0.04), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();

          const bounce = Math.sin(this.animFrame * 0.16) * 4;
          const bx = x;
          const by = ny - r * 1.85 + bounce;
          ctx.fillStyle = inRange ? '#FACC15' : '#FEF08A';
          ctx.strokeStyle = '#78350F';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(bx, by, inRange ? 14 : 11, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#78350F';
          ctx.font = '900 15px Outfit, sans-serif';
          ctx.fillText(this.activeQuest?.state === 'CLAIMABLE' ? '★' : '!', bx, by + 1);
        }
      }
      ctx.restore();
    }
  }

  /** Render live world Quest Objectives (Waypoints, Rescue Beacons, Boss Switches + Compass Arrow). */
  private renderQuestObjectives(target?: SnakeData) {
    const q = this.activeQuest;
    if (!q || !q.currentStage || q.state !== 'ACTIVE') return;
    const ctx = this.ctx;
    const st = q.currentStage;
    const pulse = 0.5 + 0.5 * Math.sin(this.animFrame * 0.12);

    let compassTarget: { x: number; y: number; color: string } | null = null;

    if ((st.kind === 'navigate' || st.kind === 'rescue') && Array.isArray(st.waypoints)) {
      const done = new Set<string>(q.completedWaypoints || []);
      st.waypoints.forEach((wp: any, idx: number) => {
        const isDone = done.has(wp.id);
        const isNext = !isDone && idx === done.size;
        const wx = this.wrapNear(wp.x, this.cameraPos.x);
        const wy = this.wrapNear(wp.y, this.cameraPos.y);
        if (isNext && !compassTarget) compassTarget = { x: wp.x, y: wp.y, color: '#F59E0B' };
        ctx.save();
        ctx.beginPath();
        ctx.arc(wx, wy, (wp.radius || 75) * (isNext ? 0.94 + pulse * 0.1 : 0.85), 0, Math.PI * 2);
        ctx.fillStyle = isDone ? 'rgba(16, 185, 129, 0.22)' : isNext ? 'rgba(250, 204, 21, 0.28)' : 'rgba(148, 163, 184, 0.16)';
        ctx.fill();
        ctx.lineWidth = isNext ? 4 : 2.5;
        ctx.strokeStyle = isDone ? '#059669' : isNext ? '#F59E0B' : '#94A3B8';
        ctx.setLineDash(isNext ? [10, 6] : []);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '900 14px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        const lbl = isDone ? '✓' : (st.kind === 'rescue' ? '🆘 RESCUE' : `${idx + 1}. ${wp.label || 'Beacon'}`);
        ctx.strokeText(lbl, wx, wy);
        ctx.fillStyle = isDone ? '#065F46' : '#92400E';
        ctx.fillText(lbl, wx, wy);
        ctx.restore();
      });
    }

    if (st.kind === 'switches' && Array.isArray(st.switches)) {
      const lit = new Set<string>(q.activatedSwitches || []);
      for (const sw of st.switches) {
        const isLit = lit.has(sw.id);
        const sx = this.wrapNear(sw.x, this.cameraPos.x);
        const sy = this.wrapNear(sw.y, this.cameraPos.y);
        if (!isLit && !compassTarget) compassTarget = { x: sw.x, y: sw.y, color: '#0EA5E9' };
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, (sw.radius || 68) * (isLit ? 0.9 : 0.95 + pulse * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = isLit ? 'rgba(16, 185, 129, 0.34)' : 'rgba(56, 189, 248, 0.28)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = isLit ? '#059669' : '#0284C7';
        ctx.stroke();
        ctx.font = '900 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.5;
        const lbl = isLit ? '✓ SEAL LIT' : `⚡ ${sw.label || 'SWITCH'}`;
        ctx.strokeText(lbl, sx, sy);
        ctx.fillStyle = isLit ? '#065F46' : '#075985';
        ctx.fillText(lbl, sx, sy);
        ctx.restore();
      }
    }

    // Directional compass arrow hovering cleanly near snake pointing toward the next spatial objective
    if (compassTarget && target && target.isAlive) {
      const dx = this.wrapDeltaRaw(compassTarget.x - target.head.x);
      const dy = this.wrapDeltaRaw(compassTarget.y - target.head.y);
      if (dx * dx + dy * dy > 160 * 160) {
        const ang = Math.atan2(dy, dx);
        const tx = this.wrapNear(target.head.x, this.cameraPos.x);
        const ty = this.wrapNear(target.head.y, this.cameraPos.y);
        const ax = tx + Math.cos(ang) * 74;
        const ay = ty + Math.sin(ang) * 74;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = compassTarget.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-9, -9);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-9, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** Render Red vs Blue Team Battle Royale Control Zones, Team Relics, and Home Delivery Bases. */
  private renderTeamObjectives(state: GameStateTick) {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(this.animFrame * 0.1);

    // Home Delivery Bases
    if (state.teamBases) {
      for (const [team, pos] of [['blue', state.teamBases.blue], ['red', state.teamBases.red]] as const) {
        const bx = this.wrapNear(pos.x, this.cameraPos.x);
        const by = this.wrapNear(pos.y, this.cameraPos.y);
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, 150, 0, Math.PI * 2);
        ctx.fillStyle = team === 'blue' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(239, 68, 68, 0.18)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = team === 'blue' ? '#2563EB' : '#DC2626';
        ctx.stroke();
        ctx.font = '900 15px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        const lbl = team === 'blue' ? '🔵 BLUE BASE (DROP RELIC)' : '🔴 RED BASE (DROP RELIC)';
        ctx.strokeText(lbl, bx, by);
        ctx.fillStyle = team === 'blue' ? '#1D4ED8' : '#B91C1C';
        ctx.fillText(lbl, bx, by);
        ctx.restore();
      }
    }

    // Control Zones
    if (state.teamZones) {
      for (const z of state.teamZones) {
        const zx = this.wrapNear(z.x, this.cameraPos.x);
        const zy = this.wrapNear(z.y, this.cameraPos.y);
        const col = z.owner === 'blue' ? '#2563EB' : z.owner === 'red' ? '#DC2626' : '#D97706';
        ctx.save();
        ctx.beginPath();
        ctx.arc(zx, zy, z.radius, 0, Math.PI * 2);
        ctx.fillStyle = z.owner === 'blue' ? 'rgba(59, 130, 246, 0.16)' : z.owner === 'red' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(245, 158, 11, 0.14)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = col;
        ctx.setLineDash([12, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Capture progress arc
        const pct = Math.min(1, Math.abs(z.capturePct || 0) / 100);
        if (pct > 0.02) {
          ctx.beginPath();
          ctx.arc(zx, zy, z.radius - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
          ctx.lineWidth = 6;
          ctx.strokeStyle = z.capturePct >= 0 ? '#2563EB' : '#DC2626';
          ctx.stroke();
        }
        ctx.font = '900 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.strokeText(`🏁 ${z.label}`, zx, zy);
        ctx.fillStyle = col;
        ctx.fillText(`🏁 ${z.label}`, zx, zy);
        ctx.restore();
      }
    }

    // Team Relics
    if (state.teamRelics) {
      for (const r of state.teamRelics) {
        const rx = this.wrapNear(r.x, this.cameraPos.x);
        const ry = this.wrapNear(r.y, this.cameraPos.y) - (r.carrierId ? 28 : 0);
        ctx.save();
        ctx.beginPath();
        ctx.arc(rx, ry, 20 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 14);
        ctx.lineTo(rx + 12, ry);
        ctx.lineTo(rx, ry + 14);
        ctx.lineTo(rx - 12, ry);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  public triggerHappyAnim(snakeId: string) {
    const anim = this.getAnimState(snakeId);
    anim.happyTimer = 1.0;
  }

  // §5 Camera zoom controls -------------------------------------------------
  /** Multiply zoom by a factor (mouse wheel / pinch). Clamped to focus↔reveal range. */
  public adjustZoom(factor: number) {
    this.userZoom = Math.max(this.ZOOM_MIN / 1.15, Math.min(this.ZOOM_MAX / 0.9, this.userZoom * factor));
  }

  /** Zoom button — cycles cleanly through 4 unmistakably distinct FOV scales (0.7× → 1.0× → 1.3× → 0.5×). */
  public cycleZoom(): string {
    const steps: Array<[number, string]> = [[0.60, '0.7×'], [0.85, '1.0×'], [1.15, '1.3×'], [0.38, '0.5×']];
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < steps.length; i++) {
      const d = Math.abs(this.userZoom - steps[i][0]);
      if (d < best) { best = d; idx = i; }
    }
    const next = (idx + 1) % steps.length;
    this.userZoom = steps[next][0];
    return steps[next][1];
  }
}
