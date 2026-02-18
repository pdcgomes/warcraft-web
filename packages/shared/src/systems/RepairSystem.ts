import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Health } from '../components/Health.js';
import { Owner } from '../components/Owner.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { Building } from '../components/Building.js';
import { distanceSquared } from '../math/FixedPoint.js';
import type { PlayerResources } from '../game/PlayerResources.js';

const REPAIR_RANGE_SQ = 3000 * 3000;
const REPAIR_HP_PER_TICK = 2;
const REPAIR_GOLD_PER_HP = 1;
const REPAIR_LUMBER_PER_HP = 0.5;

/**
 * Workers in the 'repairing' state heal a target building each tick
 * while consuming resources proportional to HP restored.
 * Stops when the building is full HP or the player runs out of resources.
 */
export class RepairSystem extends System {
  readonly name = 'RepairSystem';
  readonly priority = 45;

  private readonly playerResources: PlayerResources;

  constructor(resources: PlayerResources) {
    super();
    this.playerResources = resources;
  }

  update(world: World, _deltaMs: number): void {
    const workers = world.query(UnitBehavior.type, Position.type, Owner.type);

    for (const workerId of workers) {
      const behavior = world.getComponent(workerId, UnitBehavior)!;
      if (behavior.state !== 'repairing' || behavior.repairTarget === null) continue;

      const targetId = behavior.repairTarget;
      if (!world.hasEntity(targetId)) {
        behavior.state = 'idle';
        behavior.repairTarget = null;
        continue;
      }

      const health = world.getComponent(targetId, Health);
      const building = world.getComponent(targetId, Building);
      if (!health || !building || !building.isComplete || health.current >= health.max) {
        behavior.state = 'idle';
        behavior.repairTarget = null;
        continue;
      }

      const workerPos = world.getComponent(workerId, Position)!;
      const targetPos = world.getComponent(targetId, Position);
      if (!targetPos || distanceSquared(workerPos, targetPos) > REPAIR_RANGE_SQ) continue;

      const owner = world.getComponent(workerId, Owner)!;
      const hpToRepair = Math.min(REPAIR_HP_PER_TICK, health.max - health.current);
      const goldCost = Math.ceil(hpToRepair * REPAIR_GOLD_PER_HP);
      const lumberCost = Math.ceil(hpToRepair * REPAIR_LUMBER_PER_HP);

      const res = this.playerResources.get(owner.playerId);
      if (res.gold < goldCost || res.lumber < lumberCost) {
        behavior.state = 'idle';
        behavior.repairTarget = null;
        continue;
      }

      res.gold -= goldCost;
      res.lumber -= lumberCost;
      health.heal(hpToRepair);

      if (health.current >= health.max) {
        behavior.state = 'idle';
        behavior.repairTarget = null;
      }
    }
  }
}
