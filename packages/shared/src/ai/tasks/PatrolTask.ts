import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { Point } from '../../math/Point.js';
import { Position } from '../../components/Position.js';

export class PatrolTask implements Task {
  readonly id: string;
  readonly domain = 'defense';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private dispatched = false;

  constructor(
    private units: EntityId[],
    private pointA: Point,
    private pointB: Point,
  ) {
    this.id = nextTaskId('patrol');
    this.label = 'Patrol route';
  }

  execute(ctx: TaskContext): void {
    const alive = this.units.filter(u => ctx.world.hasEntity(u));
    if (alive.length === 0) {
      this.status = 'failed';
      return;
    }
    this.units = alive;

    if (!this.dispatched) {
      for (const uid of alive) {
        const pos = ctx.world.getComponent(uid, Position);
        const origin = pos ? pos.toPoint() : this.pointA;
        ctx.dispatch.commandPatrol(uid, origin, this.pointB);
      }
      this.dispatched = true;
    }
  }

  isValid(ctx: TaskContext): boolean {
    return this.units.some(u => ctx.world.hasEntity(u));
  }
}
