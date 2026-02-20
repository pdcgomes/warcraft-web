import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Building } from '../components/Building.js';
import { Health } from '../components/Health.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { Collider } from '../components/Collider.js';
import { distanceSquared } from '../math/FixedPoint.js';

const CONSTRUCTION_RANGE_SQ = 3000 * 3000;

/**
 * Progresses building construction using a Warcraft II-style builder
 * binding model: a worker walks to the building, gets absorbed into it,
 * and construction auto-progresses each tick without proximity checks.
 * When done the worker is released adjacent to the building.
 *
 * The absorbed worker is made collision-static so the building's own
 * static collider doesn't push them out each tick.
 *
 * If the player issues a new command to the absorbed worker, clearUnit
 * resets the absorbed flag and restores the collider. This system
 * detects the mismatch on the next tick and unbinds the builder.
 */
export class BuildingConstructionSystem extends System {
  readonly name = 'BuildingConstructionSystem';
  readonly priority = 50;

  update(world: World, _deltaMs: number): void {
    const buildings = world.query(Building.type);

    for (const buildingId of buildings) {
      const building = world.getComponent(buildingId, Building)!;
      if (building.isComplete) continue;

      const buildingPos = world.getComponent(buildingId, Position);
      if (!buildingPos) continue;

      // Validate the current builder is still assigned to this building
      if (building.builderId !== null) {
        const behavior = world.getComponent(building.builderId, UnitBehavior);
        if (!behavior || behavior.state !== 'constructing' || behavior.constructingTarget !== buildingId) {
          this.releaseBuilder(world, building.builderId);
          building.builderId = null;
        }
      }

      // Try to absorb a nearby constructing worker that has finished walking
      if (building.builderId === null) {
        const workers = world.query(UnitBehavior.type, Position.type);
        for (const workerId of workers) {
          const behavior = world.getComponent(workerId, UnitBehavior)!;
          if (behavior.state !== 'constructing' || behavior.constructingTarget !== buildingId) continue;

          const mov = world.getComponent(workerId, Movement);
          if (mov?.isMoving) continue;

          const workerPos = world.getComponent(workerId, Position)!;
          if (distanceSquared(workerPos, buildingPos) > CONSTRUCTION_RANGE_SQ) continue;

          building.builderId = workerId;
          behavior.absorbed = true;

          if (mov) mov.clearPath();
          workerPos.x = buildingPos.x;
          workerPos.y = buildingPos.y;

          const collider = world.getComponent(workerId, Collider);
          if (collider) collider.isStatic = true;

          break;
        }
      }

      if (building.builderId === null) continue;

      // Auto-progress construction
      building.constructionProgress++;

      const health = world.getComponent(buildingId, Health);
      if (health) {
        health.current = Math.round(health.max * building.constructionRatio);
      }

      if (building.constructionProgress >= building.buildTime) {
        building.isComplete = true;
        if (health) health.current = health.max;

        const builderId = building.builderId;
        building.builderId = null;

        this.releaseBuilder(world, builderId);

        // Place the worker adjacent to the completed building
        const workerPos = world.getComponent(builderId, Position);
        if (workerPos) {
          workerPos.x = buildingPos.x + building.tileWidth * 1000;
          workerPos.y = buildingPos.y;
        }
      }
    }
  }

  private releaseBuilder(world: World, builderId: number): void {
    const behavior = world.getComponent(builderId, UnitBehavior);
    if (behavior) {
      behavior.state = 'idle';
      behavior.constructingTarget = null;
      behavior.absorbed = false;
    }

    const collider = world.getComponent(builderId, Collider);
    if (collider) collider.isStatic = false;
  }
}
