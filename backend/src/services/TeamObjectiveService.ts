import { GameWorldState, SnakeState, TeamControlZone, TeamRelic, Vector2D } from '../types';
import { AnalyticsService } from './AnalyticsService';

export class TeamObjectiveService {
  private static wrapDelta(d: number, world: number): number {
    let r = ((d % world) + world) % world;
    if (r > world / 2) r -= world;
    return r;
  }

  public static initialize(state: GameWorldState, worldSize: number): void {
    const half = worldSize / 2;
    state.teamBases = {
      blue: { x: half - 950, y: half },
      red: { x: half + 950, y: half },
    };
    state.teamZones = [
      { id: 'zone_north', label: 'North Spire', x: half, y: half - 620, radius: 170, owner: 'neutral', capturePct: 0 },
      { id: 'zone_center', label: 'Crown Plaza', x: half, y: half, radius: 190, owner: 'neutral', capturePct: 0 },
      { id: 'zone_south', label: 'South Grove', x: half, y: half + 620, radius: 170, owner: 'neutral', capturePct: 0 },
    ];
    state.teamRelics = [
      { id: 'relic_1', x: half, y: half - 320, points: 15 },
      { id: 'relic_2', x: half, y: half + 320, points: 15 },
    ];
    state.teamObjectiveBreakdown = {
      red: { kills: 0, zones: 0, relics: 0, resources: 0 },
      blue: { kills: 0, zones: 0, relics: 0, resources: 0 },
    };
  }

  /**
   * Tick objective-based Red vs Blue Team Battle Royale:
   * 1. Control Zones capture smoothly based on uncontested team presence, awarding team points + player contribution.
   * 2. Relics can be carried by any snake (even small non-aggressive snakes!) and delivered to their team base for +15 pts.
   * 3. Dropped relics respawn if a carrier is eliminated.
   */
  public static tick(
    state: GameWorldState,
    dt: number,
    worldSize: number,
    onFeedback?: (userId: string, x: number, y: number, text: string, color: string) => void
  ): void {
    if (!state.teamScores || !state.teamZones || !state.teamRelics || !state.teamBases) return;
    if (!state.teamObjectiveBreakdown) {
      state.teamObjectiveBreakdown = {
        red: { kills: 0, zones: 0, relics: 0, resources: 0 },
        blue: { kills: 0, zones: 0, relics: 0, resources: 0 },
      };
    }

    const snakes = Object.values(state.snakes).filter(s => s.isAlive && !s.isPaused);
    const half = worldSize / 2;

    // 1. Control Zones
    for (const z of state.teamZones) {
      const reds: SnakeState[] = [];
      const blues: SnakeState[] = [];
      const rSq = z.radius * z.radius;
      for (const s of snakes) {
        const dx = this.wrapDelta(s.head.x - z.x, worldSize);
        const dy = this.wrapDelta(s.head.y - z.y, worldSize);
        if (dx * dx + dy * dy <= rSq) {
          if (s.team === 'red') reds.push(s);
          else if (s.team === 'blue') blues.push(s);
        }
      }

      const prevOwner = z.owner;
      if (blues.length > reds.length) {
        z.capturePct = Math.min(100, z.capturePct + (blues.length - reds.length) * 28 * dt);
        if (z.capturePct >= 100) z.owner = 'blue';
      } else if (reds.length > blues.length) {
        z.capturePct = Math.max(-100, z.capturePct - (reds.length - blues.length) * 28 * dt);
        if (z.capturePct <= -100) z.owner = 'red';
      }

      if (z.owner !== prevOwner && z.owner !== 'neutral') {
        const captors = z.owner === 'blue' ? blues : reds;
        for (const c of captors) {
          c.teamContribution = (c.teamContribution || 0) + 10;
          if (!c.isBot) {
            onFeedback?.(c.userId, z.x, z.y, `${z.label.toUpperCase()} CAPTURED! +10`, z.owner === 'blue' ? '#2563EB' : '#DC2626');
            AnalyticsService.track({
              eventType: 'team_zone_capture',
              userId: c.userId,
              mode: 'team',
              roomId: state.matchId,
              metadata: { zoneId: z.id, team: z.owner },
            });
          }
        }
      }

      // Holding a zone grants +2 team points every 1 second (on tick % 30 === 0)
      if (z.owner !== 'neutral' && state.tick % 30 === 0) {
        state.teamScores[z.owner] += 2;
        state.teamObjectiveBreakdown[z.owner].zones += 2;
        const defenders = z.owner === 'blue' ? blues : reds;
        for (const d of defenders) {
          d.teamContribution = (d.teamContribution || 0) + 2;
        }
      }
    }

    // 2. Relics (Pickup + Carry + Base Delivery)
    for (const relic of state.teamRelics) {
      if (relic.carrierId) {
        const carrier = state.snakes[relic.carrierId];
        if (!carrier || !carrier.isAlive || carrier.isPaused) {
          // Drop relic cleanly where carrier fell
          relic.carrierId = undefined;
          relic.carrierTeam = undefined;
          continue;
        }
        relic.x = carrier.head.x;
        relic.y = carrier.head.y;

        // Check delivery to carrier's team base
        const base: Vector2D = carrier.team === 'red' ? state.teamBases.red : state.teamBases.blue;
        const dx = this.wrapDelta(carrier.head.x - base.x, worldSize);
        const dy = this.wrapDelta(carrier.head.y - base.y, worldSize);
        if (dx * dx + dy * dy <= 155 * 155) {
          const team = carrier.team || 'blue';
          state.teamScores[team] += relic.points;
          state.teamObjectiveBreakdown[team].relics += relic.points;
          carrier.teamContribution = (carrier.teamContribution || 0) + relic.points;
          carrier.score += 120;
          carrier.carryingRelicId = undefined;

          if (!carrier.isBot) {
            onFeedback?.(carrier.userId, base.x, base.y, `RELIC DELIVERED! +${relic.points} TEAM`, team === 'blue' ? '#2563EB' : '#DC2626');
            AnalyticsService.track({
              eventType: 'team_relic_deliver',
              userId: carrier.userId,
              mode: 'team',
              roomId: state.matchId,
              score: relic.points,
              metadata: { relicId: relic.id, team },
            });
          }

          // Respawn relic near neutral center lanes
          relic.carrierId = undefined;
          relic.carrierTeam = undefined;
          const ang = Math.random() * Math.PI * 2;
          const d = 220 + Math.random() * 340;
          relic.x = ((half + Math.cos(ang) * d) % worldSize + worldSize) % worldSize;
          relic.y = ((half + Math.sin(ang) * d) % worldSize + worldSize) % worldSize;
        }
      } else {
        // Check pickup by any snake not already carrying a relic
        for (const s of snakes) {
          if (s.carryingRelicId || !s.team) continue;
          const dx = this.wrapDelta(s.head.x - relic.x, worldSize);
          const dy = this.wrapDelta(s.head.y - relic.y, worldSize);
          const pickR = s.radius + 36;
          if (dx * dx + dy * dy <= pickR * pickR) {
            relic.carrierId = s.id;
            relic.carrierTeam = s.team;
            s.carryingRelicId = relic.id;
            if (!s.isBot) {
              onFeedback?.(s.userId, s.head.x, s.head.y, 'RELIC PICKED UP! RETURN TO BASE!', '#F59E0B');
            }
            break;
          }
        }
      }
    }
  }

  public static recordKillScore(state: GameWorldState, team: 'red' | 'blue', winner: SnakeState) {
    if (!state.teamScores) return;
    state.teamScores[team] += 5;
    if (state.teamObjectiveBreakdown) state.teamObjectiveBreakdown[team].kills += 5;
    winner.teamContribution = (winner.teamContribution || 0) + 5;
  }

  public static recordResourceScore(state: GameWorldState, snake: SnakeState, foodValue: number) {
    if (!state.teamScores || !snake.team || foodValue < 20) return;
    const pts = foodValue >= 40 ? 2 : 1;
    state.teamScores[snake.team] += pts;
    if (state.teamObjectiveBreakdown) state.teamObjectiveBreakdown[snake.team].resources += pts;
    snake.teamContribution = (snake.teamContribution || 0) + pts;
  }
}

