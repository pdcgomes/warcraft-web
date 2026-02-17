import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { Combat } from '../components/Combat.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { fpDistance } from '../math/FixedPoint.js';

/** Distance at which a patrol waypoint is considered reached. */
const PATROL_ARRIVE_DIST = 300;

/**
 * Drives units in 'patrolling' state back and forth between their
 * patrol origin and patrol target.
 *
 * Pauses movement when the unit has an active combat target
 * (CombatSystem handles the fight). Resumes patrol movement when
 * the combat target is cleared.
 *
 * Priority 12: after MovementSystem (10) path consumption, before
 * CollisionSystem (15) and CombatSystem (20).
 */
export class PatrolSystem extends System {
  readonly name = 'PatrolSystem';
  readonly priority = 12;

  update(world: World, _deltaMs: number): void {
    const entities = world.query(
      Position.type,
      Movement.type,
      UnitBehavior.type,
    );

    for (const entityId of entities) {
      const behavior = world.getComponent(entityId, UnitBehavior)!;
      if (behavior.state !== 'patrolling') continue;

      // If currently fighting, let CombatSystem drive movement
      const combat = world.getComponent(entityId, Combat);
      if (combat && combat.targetEntity !== null) continue;

      const pos = world.getComponent(entityId, Position)!;
      const mov = world.getComponent(entityId, Movement)!;

      // If already moving, let MovementSystem consume the path
      if (mov.isMoving) continue;

      // Determine current waypoint
      let waypointX: number;
      let waypointY: number;

      if (behavior.patrolForward) {
        waypointX = behavior.patrolTargetX;
        waypointY = behavior.patrolTargetY;
      } else {
        waypointX = behavior.patrolOriginX;
        waypointY = behavior.patrolOriginY;
      }

      const dist = fpDistance(pos.x, pos.y, waypointX, waypointY);

      if (dist <= PATROL_ARRIVE_DIST) {
        // Reached waypoint: flip direction
        behavior.patrolForward = !behavior.patrolForward;
        waypointX = behavior.patrolForward ? behavior.patrolTargetX : behavior.patrolOriginX;
        waypointY = behavior.patrolForward ? behavior.patrolTargetY : behavior.patrolOriginY;
      }

      // Set path toward the current waypoint
      mov.setPath([{ x: waypointX, y: waypointY }]);
    }
  }
}
