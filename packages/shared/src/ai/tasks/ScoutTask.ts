import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { Point } from '../../math/Point.js';
import { UnitBehavior } from '../../components/UnitBehavior.js';

export class ScoutTask implements Task {
  readonly id: string;
  readonly domain = 'scout';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private dispatched = false;

  constructor(
    private unitId: EntityId,
    private targetRegion: Point,
  ) {
    this.id = nextTaskId('scout');
    this.label = `Scout (${targetRegion.x},${targetRegion.y})`;
  }

  execute(ctx: TaskContext): void {
    if (!ctx.world.hasEntity(this.unitId)) {
      this.status = 'failed';
      return;
    }

    if (!this.dispatched) {
      ctx.dispatch.commandMove(this.unitId, this.targetRegion);
      this.dispatched = true;
      return;
    }

    const behavior = ctx.world.getComponent(this.unitId, UnitBehavior);
    if (behavior && behavior.state === 'idle') {
      this.status = 'completed';
    }
  }

  isValid(ctx: TaskContext): boolean {
    return ctx.world.hasEntity(this.unitId);
  }
}
