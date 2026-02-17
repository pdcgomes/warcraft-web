import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Building } from '../components/Building.js';
import { Health } from '../components/Health.js';

/**
 * Progresses building construction each tick.
 * When construction completes, sets isComplete = true and fills health.
 */
export class BuildingConstructionSystem extends System {
  readonly name = 'BuildingConstructionSystem';
  readonly priority = 50;

  update(world: World, _deltaMs: number): void {
    const buildings = world.query(Building.type);

    for (const entityId of buildings) {
      const building = world.getComponent(entityId, Building)!;

      if (building.isComplete) continue;

      building.constructionProgress++;

      // Update health proportional to construction progress
      const health = world.getComponent(entityId, Health);
      if (health) {
        const ratio = building.constructionRatio;
        health.current = Math.round(health.max * ratio);
      }

      if (building.constructionProgress >= building.buildTime) {
        building.isComplete = true;
        if (health) {
          health.current = health.max;
        }
      }
    }
  }
}
