import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { Point } from '../../math/Point.js';
import { UnitBehavior } from '../../components/UnitBehavior.js';
import { Health } from '../../components/Health.js';

export class AttackTask implements Task {
  readonly id: string;
  readonly domain = 'military';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private dispatched = false;

  constructor(
    private units: EntityId[],
    private targetPosition: Point,
    private targetEntity: EntityId | null = null,
  ) {
    this.id = nextTaskId('attack');
    this.label = targetEntity !== null
      ? `Attack entity ${targetEntity}`
      : `Attack-move to (${Math.round(targetPosition.x / 1000)},${Math.round(targetPosition.y / 1000)})`;
  }

  execute(ctx: TaskContext): void {
    const alive = this.units.filter(u => {
      if (!ctx.world.hasEntity(u)) return false;
      const h = ctx.world.getComponent(u, Health);
      return h && !h.isDead;
    });

    if (alive.length === 0) {
      this.status = 'failed';
      return;
    }
    this.units = alive;

    if (!this.dispatched) {
      for (const uid of alive) {
        if (this.targetEntity !== null && ctx.world.hasEntity(this.targetEntity)) {
          ctx.dispatch.commandAttack(uid, this.targetEntity);
        } else {
          const goalTile = {
            x: Math.round(this.targetPosition.x / 1000),
            y: Math.round(this.targetPosition.y / 1000),
          };
          ctx.dispatch.commandMove(uid, goalTile);
        }
      }
      this.dispatched = true;
      return;
    }

    const allIdle = alive.every(u => {
      const b = ctx.world.getComponent(u, UnitBehavior);
      return b && b.state === 'idle';
    });

    if (allIdle) {
      this.status = 'completed';
    }
  }

  isValid(ctx: TaskContext): boolean {
    return this.units.some(u => ctx.world.hasEntity(u));
  }
}
