import { NpcEncounterPayload, WorldNpc } from '../types';
import { QuestEngineService } from './QuestEngineService';

export interface ProximityConfig {
  /** Extra margin beyond npc.radius + snake.radius to trigger NPC encounter. */
  enterMargin: number;
  /** Extra exit hysteresis margin beyond enter radius before encounter can trigger again. */
  exitHysteresis: number;
  /** Minimum cooldown (ms) between duplicate trigger emissions for the same NPC. */
  retriggerCooldownMs: number;
}

const DEFAULT_PROXIMITY: ProximityConfig = {
  enterMargin: 82,
  exitHysteresis: 64,
  retriggerCooldownMs: 1200,
};

interface PlayerNpcTracking {
  insideNpcs: Set<string>;
  lastTriggerAt: Map<string, number>;
  lastHead?: { x: number; y: number };
}

/**
 * Server-authoritative NPC proximity & encounter validation engine:
 * - Swept segment vs circle test (prevHead -> head) catches high-speed / boosted movement.
 * - Toroidal wrap-around math handles NPCs & snakes on opposite map edges.
 * - Hysteresis enter/exit prevents repeated firing while stationary inside the circle.
 */
export class NPCInteractionService {
  private tracking: Map<string, PlayerNpcTracking> = new Map();
  private config: ProximityConfig;

  constructor(config?: Partial<ProximityConfig>) {
    this.config = { ...DEFAULT_PROXIMITY, ...(config || {}) };
  }

  public static wrapDelta(d: number, worldSize: number): number {
    let r = ((d % worldSize) + worldSize) % worldSize;
    if (r > worldSize / 2) r -= worldSize;
    return r;
  }

  /**
   * Shortest squared distance from point (px, py) to swept movement segment (x1, y1) -> (x2, y2)
   * on a toroidal world of size `worldSize`.
   */
  public static sweptToroidalDistSq(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    worldSize: number
  ): number {
    const segDx = this.wrapDelta(x2 - x1, worldSize);
    const segDy = this.wrapDelta(y2 - y1, worldSize);
    const ptDx = this.wrapDelta(px - x1, worldSize);
    const ptDy = this.wrapDelta(py - y1, worldSize);

    const segLenSq = segDx * segDx + segDy * segDy;
    if (segLenSq < 1e-6) {
      return ptDx * ptDx + ptDy * ptDy;
    }
    const t = Math.max(0, Math.min(1, (ptDx * segDx + ptDy * segDy) / segLenSq));
    const nearDx = ptDx - segDx * t;
    const nearDy = ptDy - segDy * t;
    return nearDx * nearDx + nearDy * nearDy;
  }

  /**
   * Evaluate proximity for a moving snake on every server tick.
   * Returns an encounter payload ONLY on the exact edge transition from outside -> inside
   * for an eligible NPC (and never repeats until the snake exits past exitRadius).
   */
  public evaluateStep(
    userId: string,
    headX: number,
    headY: number,
    snakeRadius: number,
    npcs: WorldNpc[],
    worldSize: number,
    nowMs = Date.now()
  ): { entered?: NpcEncounterPayload; exitedNpcIds: string[]; nearbyNpcId: string | null } {
    let st = this.tracking.get(userId);
    if (!st) {
      st = { insideNpcs: new Set(), lastTriggerAt: new Map() };
      this.tracking.set(userId, st);
    }

    const prevX = st.lastHead ? st.lastHead.x : headX;
    const prevY = st.lastHead ? st.lastHead.y : headY;
    st.lastHead = { x: headX, y: headY };

    const exitedNpcIds: string[] = [];
    let entered: NpcEncounterPayload | undefined;
    let closestNpcId: string | null = null;
    let closestDistSq = Infinity;

    for (const npc of npcs) {
      const enterR = (npc.radius || 46) + snakeRadius + this.config.enterMargin;
      const exitR = enterR + this.config.exitHysteresis;

      const sweptDistSq = NPCInteractionService.sweptToroidalDistSq(
        npc.x, npc.y, prevX, prevY, headX, headY, worldSize
      );
      const curDx = NPCInteractionService.wrapDelta(npc.x - headX, worldSize);
      const curDy = NPCInteractionService.wrapDelta(npc.y - headY, worldSize);
      const curDistSq = curDx * curDx + curDy * curDy;

      const wasInside = st.insideNpcs.has(npc.id);

      if (curDistSq <= enterR * enterR && curDistSq < closestDistSq) {
        closestDistSq = curDistSq;
        closestNpcId = npc.id;
      }

      if (!wasInside && sweptDistSq <= enterR * enterR) {
        st.insideNpcs.add(npc.id);
        const lastAt = st.lastTriggerAt.get(npc.id) || 0;
        if (!entered && nowMs - lastAt >= this.config.retriggerCooldownMs) {
          const offer = QuestEngineService.recordOffer(userId, npc.id);
          if (offer) {
            st.lastTriggerAt.set(npc.id, nowMs);
            entered = offer;
          }
        }
      } else if (wasInside && curDistSq > exitR * exitR) {
        st.insideNpcs.delete(npc.id);
        exitedNpcIds.push(npc.id);
      }
    }

    return { entered, exitedNpcIds, nearbyNpcId: closestNpcId };
  }

  /** Validate whether a player is currently eligible/within range to manually open an NPC popup. */
  public validateManualInteract(
    userId: string,
    npcId: string,
    headX: number,
    headY: number,
    snakeRadius: number,
    npcs: WorldNpc[],
    worldSize: number
  ): { ok: boolean; error?: string; encounter?: NpcEncounterPayload } {
    const npc = npcs.find(n => n.id === npcId);
    if (!npc) return { ok: false, error: 'NPC not present in this realm' };
    const maxR = (npc.radius || 46) + snakeRadius + this.config.enterMargin + this.config.exitHysteresis;
    const dx = NPCInteractionService.wrapDelta(npc.x - headX, worldSize);
    const dy = NPCInteractionService.wrapDelta(npc.y - headY, worldSize);
    if (dx * dx + dy * dy > maxR * maxR) {
      return { ok: false, error: 'Move closer to the NPC to interact' };
    }
    const encounter = QuestEngineService.buildNpcEncounter(userId, npcId);
    if (!encounter) return { ok: false, error: 'No available quest from this NPC' };
    return { ok: true, encounter };
  }

  public forget(userId: string): void {
    this.tracking.delete(userId);
  }
}

