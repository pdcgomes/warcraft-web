import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Health } from '../components/Health.js';
import { UnitType } from '../components/UnitType.js';
import { Building } from '../components/Building.js';
import type { GameEventLog } from '../game/GameEventLog.js';

/**
 * Cleans up dead entities that weren't already destroyed by the combat system.
 * Runs at low priority to ensure all other systems have processed deaths first.
 */
export class DeathCleanupSystem extends System {
  readonly name = 'DeathCleanupSystem';
  readonly priority = 100;

  private eventLog: GameEventLog | null = null;

  setEventLog(log: GameEventLog): void {
    this.eventLog = log;
  }

  update(world: World, _deltaMs: number): void {
    const entities = world.query(Health.type);

    for (const entityId of entities) {
      const health = world.getComponent(entityId, Health)!;
      if (health.isDead) {
        this.emitDeathEvent(world, entityId);
        world.destroyEntity(entityId);
      }
    }
  }

  private emitDeathEvent(world: World, entityId: number): void {
    if (!this.eventLog) return;

    const ut = world.getComponent(entityId, UnitType);
    const bld = world.getComponent(entityId, Building);
    const label = bld?.name ?? ut?.name ?? 'Entity';

    this.eventLog.push(
      'unit_killed',
      { key: `entity:${entityId}`, label },
      'Destroyed',
      world.tick,
    );
  }
}
