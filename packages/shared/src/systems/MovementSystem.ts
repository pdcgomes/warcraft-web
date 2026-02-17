import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { UnitType } from '../components/UnitType.js';
import { fpDistance } from '../math/FixedPoint.js';
import type { GameEventLog } from '../game/GameEventLog.js';

/**
 * Moves entities along their path each tick.
 * Consumes path nodes as they are reached.
 *
 * When a unit in 'moving' behavior state exhausts its path,
 * transitions it to 'idle'. Other states (attacking, gathering)
 * own their own movement and are left alone.
 */
export class MovementSystem extends System {
  readonly name = 'MovementSystem';
  readonly priority = 10;

  private eventLog: GameEventLog | null = null;

  setEventLog(log: GameEventLog): void {
    this.eventLog = log;
  }

  update(world: World, _deltaMs: number): void {
    const entities = world.query(Position.type, Movement.type);

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      const mov = world.getComponent(entityId, Movement)!;

      if (!mov.isMoving || mov.path.length === 0) continue;

      const target = mov.path[mov.pathIndex];
      if (!target) {
        mov.clearPath();
        this.onPathExhausted(world, entityId);
        continue;
      }

      const dist = fpDistance(pos.x, pos.y, target.x, target.y);

      if (dist <= mov.speed) {
        // Reached current waypoint
        pos.x = target.x;
        pos.y = target.y;
        mov.pathIndex++;

        if (mov.pathIndex >= mov.path.length) {
          // Reached final destination
          mov.clearPath();
          this.onPathExhausted(world, entityId);
        }
      } else {
        // Move toward current waypoint
        const dx = target.x - pos.x;
        const dy = target.y - pos.y;

        // Normalize direction and multiply by speed (integer math)
        pos.x += Math.round((dx * mov.speed) / dist);
        pos.y += Math.round((dy * mov.speed) / dist);
      }
    }
  }

  /**
   * When the path runs out, transition units in 'moving' state to 'idle'.
   * Units in 'attacking' or 'gathering' are driven by their own systems
   * and should not be transitioned here.
   */
  private onPathExhausted(world: World, entityId: number): void {
    const behavior = world.getComponent(entityId, UnitBehavior);
    if (behavior && behavior.state === 'moving') {
      behavior.state = 'idle';
      if (this.eventLog) {
        const ut = world.getComponent(entityId, UnitType);
        const label = ut?.name ?? 'Unit';
        this.eventLog.push(
          'order_completed',
          { key: `entity:${entityId}`, label },
          'Arrived at destination',
          world.tick,
        );
      }
    }
  }
}
