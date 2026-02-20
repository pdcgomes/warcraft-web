import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { UnitKind } from '../../components/UnitType.js';
import { Production } from '../../components/Production.js';

export class TrainTask implements Task {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private queued = false;

  constructor(
    private buildingId: EntityId,
    private unitKind: UnitKind,
    domain: string = 'economy',
  ) {
    this.id = nextTaskId('train');
    this.domain = domain;
    this.label = `Train ${unitKind}`;
  }

  execute(ctx: TaskContext): void {
    if (this.queued) {
      const prod = ctx.world.getComponent(this.buildingId, Production);
      if (!prod || prod.queue.length === 0) {
        this.status = 'completed';
      }
      return;
    }

    const result = ctx.gameInterface.queueProduction(this.buildingId, this.unitKind);
    if (result !== null) {
      this.status = 'failed';
      return;
    }
    this.queued = true;
  }

  isValid(ctx: TaskContext): boolean {
    if (!ctx.world.hasEntity(this.buildingId)) return false;
    const prod = ctx.world.getComponent(this.buildingId, Production);
    return prod !== undefined;
  }
}
