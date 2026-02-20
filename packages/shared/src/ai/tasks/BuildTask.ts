import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { BuildingKind } from '../../components/Building.js';
import type { FactionId } from '../../components/Owner.js';
import type { Point } from '../../math/Point.js';
import { Building } from '../../components/Building.js';
import { Owner } from '../../components/Owner.js';
import { UnitBehavior } from '../../components/UnitBehavior.js';
import { BUILDING_DATA } from '../../data/BuildingData.js';

export class BuildTask implements Task {
  readonly id: string;
  readonly domain = 'expansion';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private placedBuildingId: EntityId | null = null;
  private workerId: EntityId | null = null;

  constructor(
    private buildingKind: BuildingKind,
    private location: Point,
    private assignedWorkers: EntityId[],
    private faction: FactionId,
  ) {
    this.id = nextTaskId('build');
    this.label = `Build ${buildingKind}`;
  }

  execute(ctx: TaskContext): void {
    if (this.placedBuildingId !== null) {
      if (!ctx.world.hasEntity(this.placedBuildingId)) {
        this.status = 'failed';
        return;
      }
      const building = ctx.world.getComponent(this.placedBuildingId, Building);
      if (building && building.isComplete) {
        this.status = 'completed';
        ctx.gameInterface.recalculateSupply();
        return;
      }
      if (this.workerId !== null) {
        const behavior = ctx.world.getComponent(this.workerId, UnitBehavior);
        if (behavior && behavior.state === 'idle' && !building?.isComplete) {
          ctx.dispatch.commandConstruct(this.workerId, this.placedBuildingId);
        }
      }
      return;
    }

    const data = BUILDING_DATA[this.buildingKind];
    if (!ctx.playerResources.canAfford(ctx.playerId, data.cost)) {
      return;
    }
    if (!ctx.gameMap.isAreaBuildable(this.location, data.tileWidth, data.tileHeight)) {
      this.status = 'failed';
      return;
    }

    ctx.playerResources.deduct(ctx.playerId, data.cost);
    this.placedBuildingId = ctx.gameInterface.placeBuilding(
      this.buildingKind, this.location.x, this.location.y,
      ctx.playerId, this.faction,
    );

    const worker = this.assignedWorkers[0];
    if (worker && ctx.world.hasEntity(worker)) {
      this.workerId = worker;
      ctx.dispatch.commandConstruct(worker, this.placedBuildingId);
    }
  }

  isValid(ctx: TaskContext): boolean {
    if (this.placedBuildingId !== null) {
      return ctx.world.hasEntity(this.placedBuildingId);
    }
    return this.assignedWorkers.some(w => ctx.world.hasEntity(w));
  }
}
