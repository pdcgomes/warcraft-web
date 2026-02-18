import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Building } from '../components/Building.js';
import { Health } from '../components/Health.js';
import { Position } from '../components/Position.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { distanceSquared } from '../math/FixedPoint.js';

const CONSTRUCTION_RANGE_SQ = 3000 * 3000;

/**
 * Progresses building construction each tick, but only when a worker
 * in 'constructing' state is close enough to the building.
 * When construction completes, sets isComplete = true, fills health,
 * and transitions the constructing worker(s) to idle.
 */
export class BuildingConstructionSystem extends System {
  readonly name = 'BuildingConstructionSystem';
  readonly priority = 50;

  update(world: World, _deltaMs: number): void {
    const buildings = world.query(Building.type);
    const workers = world.query(UnitBehavior.type, Position.type);

    for (const buildingId of buildings) {
      const building = world.getComponent(buildingId, Building)!;
      if (building.isComplete) continue;

      const buildingPos = world.getComponent(buildingId, Position);
      if (!buildingPos) continue;

      let hasWorker = false;

      for (const workerId of workers) {
        const behavior = world.getComponent(workerId, UnitBehavior)!;
        if (behavior.state !== 'constructing') continue;
        if (behavior.constructingTarget !== buildingId) continue;

        const workerPos = world.getComponent(workerId, Position)!;
        if (distanceSquared(workerPos, buildingPos) <= CONSTRUCTION_RANGE_SQ) {
          hasWorker = true;
          break;
        }
      }

      if (!hasWorker) continue;

      building.constructionProgress++;

      const health = world.getComponent(buildingId, Health);
      if (health) {
        health.current = Math.round(health.max * building.constructionRatio);
      }

      if (building.constructionProgress >= building.buildTime) {
        building.isComplete = true;
        if (health) {
          health.current = health.max;
        }

        for (const workerId of workers) {
          const behavior = world.getComponent(workerId, UnitBehavior)!;
          if (behavior.state === 'constructing' && behavior.constructingTarget === buildingId) {
            behavior.state = 'idle';
            behavior.constructingTarget = null;
          }
        }
      }
    }
  }
}
