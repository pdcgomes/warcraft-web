import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import { Position } from '../../components/Position.js';
import { ResourceSource } from '../../components/ResourceSource.js';
import { UnitBehavior } from '../../components/UnitBehavior.js';

export class GatherTask implements Task {
  readonly id: string;
  readonly domain = 'economy';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private assigned = false;

  constructor(
    private workerId: EntityId,
    private resourceId: EntityId,
  ) {
    this.id = nextTaskId('gather');
    this.label = `Gather resource ${resourceId}`;
  }

  execute(ctx: TaskContext): void {
    if (this.assigned) {
      const behavior = ctx.world.getComponent(this.workerId, UnitBehavior);
      if (behavior && behavior.state === 'idle') {
        this.status = 'completed';
      }
      return;
    }

    ctx.dispatch.commandGather(this.workerId, this.resourceId);
    this.assigned = true;
  }

  isValid(ctx: TaskContext): boolean {
    if (!ctx.world.hasEntity(this.workerId)) return false;
    if (!ctx.world.hasEntity(this.resourceId)) return false;
    const rs = ctx.world.getComponent(this.resourceId, ResourceSource);
    if (!rs || rs.isDepleted) return false;
    return true;
  }
}
