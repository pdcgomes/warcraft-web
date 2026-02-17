import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Production } from '../components/Production.js';
import { Building } from '../components/Building.js';
import { Owner } from '../components/Owner.js';
import type { UnitKind } from '../components/UnitType.js';
import type { EntityId } from '../ecs/Entity.js';
import type { GameEventLog } from '../game/GameEventLog.js';

/**
 * Callback for creating units when production completes.
 * The system calls this so the game layer can use EntityFactory.
 */
export type UnitSpawnCallback = (
  world: World,
  unitKind: UnitKind,
  spawnX: number,
  spawnY: number,
  playerId: number,
  faction: 'humans' | 'orcs',
) => EntityId | null;

/** Human-readable labels for unit kinds. */
const UNIT_LABELS: Record<UnitKind, string> = {
  worker: 'Worker',
  footman: 'Footman',
  archer: 'Archer',
  knight: 'Knight',
  catapult: 'Catapult',
  ballista: 'Ballista',
  cleric: 'Cleric',
  shaman: 'Shaman',
  grunt: 'Grunt',
  troll_axethrower: 'Troll Axethrower',
  raider: 'Raider',
};

/**
 * Ticks building production queues and spawns completed units.
 */
export class ProductionSystem extends System {
  readonly name = 'ProductionSystem';
  readonly priority = 40;

  private spawnCallback: UnitSpawnCallback | null = null;
  private eventLog: GameEventLog | null = null;

  setSpawnCallback(cb: UnitSpawnCallback): void {
    this.spawnCallback = cb;
  }

  setEventLog(log: GameEventLog): void {
    this.eventLog = log;
  }

  update(world: World, _deltaMs: number): void {
    const producers = world.query(Production.type, Building.type, Owner.type, Position.type);

    for (const entityId of producers) {
      const production = world.getComponent(entityId, Production)!;
      const building = world.getComponent(entityId, Building)!;
      const owner = world.getComponent(entityId, Owner)!;
      const pos = world.getComponent(entityId, Position)!;

      // Only complete buildings can produce
      if (!building.isComplete) continue;
      if (production.queue.length === 0) continue;

      // Tick the first item in the queue
      const item = production.queue[0];
      item.ticksRemaining--;

      if (item.ticksRemaining <= 0) {
        // Production complete: spawn unit
        production.queue.shift();

        // Use rally point if set, otherwise spawn near building
        const spawnX = production.rallyX !== 0 ? production.rallyX : pos.x + building.tileWidth * 1000;
        const spawnY = production.rallyY !== 0 ? production.rallyY : pos.y + building.tileHeight * 1000;

        if (this.spawnCallback) {
          const newEntity = this.spawnCallback(world, item.unitKind, spawnX, spawnY, owner.playerId, owner.faction);
          this.emitSpawnEvent(world, entityId, building, item.unitKind, newEntity);
        }
      }
    }
  }

  private emitSpawnEvent(
    world: World,
    buildingEntity: number,
    building: Building,
    unitKind: UnitKind,
    newEntity: EntityId | null,
  ): void {
    if (!this.eventLog) return;

    const unitLabel = UNIT_LABELS[unitKind] ?? unitKind.replace(/_/g, ' ');
    this.eventLog.push(
      'training_complete',
      { key: `entity:${buildingEntity}`, label: building.name },
      `${unitLabel} ready`,
      world.tick,
    );
  }
}
