import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Collider } from '../components/Collider.js';
import { fpDistance } from '../math/FixedPoint.js';

/**
 * Maximum correction per tick per pair, in fixed-point units.
 * Keeps dynamic-vs-dynamic resolution gentle so it doesn't fight pathfinding.
 */
const MAX_DYNAMIC_PUSH = 40;

/**
 * Static obstacles push harder so units don't clip through buildings.
 */
const MAX_STATIC_PUSH = 120;

/**
 * Resolves overlapping colliders each tick.
 *
 * Resolution rules:
 * - dynamic vs dynamic: both pushed equally (half the overlap each)
 * - dynamic vs static: only the dynamic entity is pushed (full overlap)
 * - static vs static: ignored
 *
 * Runs after MovementSystem (priority 15) so positions reflect this tick's
 * movement, but before CombatSystem (priority 20) so range checks see
 * corrected positions.
 */
export class CollisionSystem extends System {
  readonly name = 'CollisionSystem';
  readonly priority = 15;

  update(world: World, _deltaMs: number): void {
    const entities = world.query(Position.type, Collider.type);
    const len = entities.length;
    if (len < 2) return;

    // Accumulate corrections so iteration order doesn't bias results
    const pushX = new Float64Array(len);
    const pushY = new Float64Array(len);

    for (let i = 0; i < len; i++) {
      const colA = world.getComponent(entities[i], Collider)!;
      const posA = world.getComponent(entities[i], Position)!;

      for (let j = i + 1; j < len; j++) {
        const colB = world.getComponent(entities[j], Collider)!;

        // Skip static-vs-static pairs
        if (colA.isStatic && colB.isStatic) continue;

        const posB = world.getComponent(entities[j], Position)!;

        const minDist = colA.radius + colB.radius;
        const dist = fpDistance(posA.x, posA.y, posB.x, posB.y);

        if (dist >= minDist) continue;

        const overlap = minDist - dist;

        let dx: number;
        let dy: number;

        if (dist === 0) {
          // Exactly overlapping: use deterministic fallback direction
          const angle = ((entities[i] * 7 + entities[j] * 13) % 628) / 100;
          dx = Math.round(Math.cos(angle) * 1000);
          dy = Math.round(Math.sin(angle) * 1000);
        } else {
          // Direction from B toward A
          dx = posA.x - posB.x;
          dy = posA.y - posB.y;
        }

        // Normalize direction to unit length (scaled by 1000 for fp precision)
        const dirLen = fpDistance(0, 0, dx, dy) || 1;

        if (colA.isStatic) {
          // Only push B (dynamic) away from A (static)
          const push = Math.min(MAX_STATIC_PUSH, overlap);
          pushX[j] -= Math.round((dx * push) / dirLen);
          pushY[j] -= Math.round((dy * push) / dirLen);
        } else if (colB.isStatic) {
          // Only push A (dynamic) away from B (static)
          const push = Math.min(MAX_STATIC_PUSH, overlap);
          pushX[i] += Math.round((dx * push) / dirLen);
          pushY[i] += Math.round((dy * push) / dirLen);
        } else {
          // Both dynamic: share the correction equally
          const push = Math.min(MAX_DYNAMIC_PUSH, Math.round(overlap / 2));
          const cx = Math.round((dx * push) / dirLen);
          const cy = Math.round((dy * push) / dirLen);
          pushX[i] += cx;
          pushY[i] += cy;
          pushX[j] -= cx;
          pushY[j] -= cy;
        }
      }
    }

    // Apply accumulated corrections (only to dynamic entities)
    for (let k = 0; k < len; k++) {
      if (pushX[k] === 0 && pushY[k] === 0) continue;
      const col = world.getComponent(entities[k], Collider)!;
      if (col.isStatic) continue;
      const pos = world.getComponent(entities[k], Position)!;
      pos.x += Math.round(pushX[k]);
      pos.y += Math.round(pushY[k]);
    }
  }
}
