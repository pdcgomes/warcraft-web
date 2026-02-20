import type { Task, TaskContext } from './Task.js';
import { nextTaskId } from './Task.js';
import type { EntityId } from '../../ecs/Entity.js';
import type { Point } from '../../math/Point.js';
import { Position } from '../../components/Position.js';
import { Owner } from '../../components/Owner.js';
import { UnitBehavior } from '../../components/UnitBehavior.js';
import { UnitType } from '../../components/UnitType.js';
import { Health } from '../../components/Health.js';
import { Combat } from '../../components/Combat.js';
import { UNIT_DATA } from '../../data/UnitData.js';

export class DefendTask implements Task {
  readonly id: string;
  readonly domain = 'defense';
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled' = 'active';

  private dispatched = false;
  private idleTicks = 0;

  constructor(
    private units: EntityId[],
    private baseCenter: Point,
  ) {
    this.id = nextTaskId('defend');
    this.label = 'Defend base';
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

    const nearbyEnemies = findNearbyEnemies(ctx, this.baseCenter, ctx.playerId, 12000);

    if (nearbyEnemies.length === 0) {
      this.idleTicks++;
      if (this.idleTicks > 10) {
        this.status = 'completed';
      }
      return;
    }

    this.idleTicks = 0;

    if (!this.dispatched) {
      const closestEnemy = nearbyEnemies[0];
      for (const uid of alive) {
        ctx.dispatch.commandAttack(uid, closestEnemy);
      }
      this.dispatched = true;
    }
  }

  isValid(ctx: TaskContext): boolean {
    return this.units.some(u => ctx.world.hasEntity(u));
  }
}

function findNearbyEnemies(ctx: TaskContext, center: Point, playerId: number, radius: number): EntityId[] {
  const r2 = radius * radius;
  const enemies: EntityId[] = [];
  const entities = ctx.world.query(Position.type, Owner.type, Combat.type);

  for (const eid of entities) {
    const owner = ctx.world.getComponent(eid, Owner)!;
    if (owner.playerId === playerId || owner.playerId === 0) continue;

    const health = ctx.world.getComponent(eid, Health);
    if (health && health.isDead) continue;

    const pos = ctx.world.getComponent(eid, Position)!;
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    if (dx * dx + dy * dy <= r2) {
      enemies.push(eid);
    }
  }
  return enemies;
}
