import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { Point } from '../../math/Point.js';
import { Position } from '../../components/Position.js';
import { Owner } from '../../components/Owner.js';
import { Combat } from '../../components/Combat.js';
import { UnitBehavior } from '../../components/UnitBehavior.js';
import { Health } from '../../components/Health.js';

export class AttackTask implements Task {
  readonly id: string;
  readonly domain = 'military';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

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

    if (this.targetEntity !== null && !ctx.world.hasEntity(this.targetEntity)) {
      this.targetEntity = null;
    }

    const idleUnits = alive.filter(u => {
      const b = ctx.world.getComponent(u, UnitBehavior);
      return b && b.state === 'idle';
    });

    if (idleUnits.length === alive.length) {
      const nearbyEnemy = this.findNearbyEnemy(ctx);
      if (nearbyEnemy === null) {
        this.status = 'completed';
        return;
      }
      this.targetEntity = nearbyEnemy;
    }

    for (const uid of idleUnits) {
      if (this.targetEntity !== null) {
        ctx.dispatch.commandAttack(uid, this.targetEntity);
      } else {
        const goalTile = {
          x: Math.round(this.targetPosition.x / 1000),
          y: Math.round(this.targetPosition.y / 1000),
        };
        ctx.dispatch.commandMove(uid, goalTile);
      }
    }
  }

  private findNearbyEnemy(ctx: TaskContext): EntityId | null {
    const cx = this.targetPosition.x;
    const cy = this.targetPosition.y;
    const searchRadius = 15000;
    const r2 = searchRadius * searchRadius;

    let closest: EntityId | null = null;
    let closestDist = r2;

    const candidates = ctx.world.query(Position.type, Owner.type, Health.type);
    for (const eid of candidates) {
      const owner = ctx.world.getComponent(eid, Owner)!;
      if (owner.playerId === ctx.playerId || owner.playerId === 0) continue;

      const health = ctx.world.getComponent(eid, Health)!;
      if (health.isDead) continue;

      const pos = ctx.world.getComponent(eid, Position)!;
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < closestDist) {
        closestDist = dist2;
        closest = eid;
      }
    }
    return closest;
  }

  isValid(ctx: TaskContext): boolean {
    return this.units.some(u => ctx.world.hasEntity(u));
  }
}
