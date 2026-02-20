import type { EntityId } from '../ecs/Entity.js';
import type { World } from '../ecs/World.js';
import type { GameMap } from '../map/GameMap.js';
import type { Point } from '../math/Point.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { Combat } from '../components/Combat.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { ResourceCarrier } from '../components/ResourceCarrier.js';
import { findPath } from '../map/Pathfinding.js';

export class CommandDispatcher {
  constructor(
    private world: World,
    private gameMap: GameMap,
  ) {}

  private clearUnit(entityId: EntityId): void {
    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) {
      behavior.state = 'idle';
      behavior.returnState = null;
      behavior.constructingTarget = null;
      behavior.repairTarget = null;
    }

    const mov = this.world.getComponent(entityId, Movement);
    if (mov) mov.clearPath();

    const combat = this.world.getComponent(entityId, Combat);
    if (combat) combat.targetEntity = null;

    const carrier = this.world.getComponent(entityId, ResourceCarrier);
    if (carrier) {
      carrier.state = 'idle';
      carrier.gatherTarget = null;
    }
  }

  commandMove(entityId: EntityId, goalTile: Point): void {
    const pos = this.world.getComponent(entityId, Position);
    const mov = this.world.getComponent(entityId, Movement);
    if (!pos || !mov) return;

    this.clearUnit(entityId);

    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) behavior.state = 'moving';

    const startTileX = Math.round(pos.x / 1000);
    const startTileY = Math.round(pos.y / 1000);
    const path = findPath(this.gameMap, { x: startTileX, y: startTileY }, goalTile);

    if (path.length > 0) {
      mov.setPath(path);
    } else {
      mov.setPath([{ x: goalTile.x * 1000, y: goalTile.y * 1000 }]);
    }
  }

  commandAttack(entityId: EntityId, targetEntity: EntityId): void {
    const targetPos = this.world.getComponent(targetEntity, Position);

    this.clearUnit(entityId);

    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) behavior.state = 'attacking';

    const combat = this.world.getComponent(entityId, Combat);
    if (combat) combat.targetEntity = targetEntity;

    const mov = this.world.getComponent(entityId, Movement);
    if (mov && targetPos) {
      mov.setPath([targetPos.toPoint()]);
    }
  }

  commandGather(entityId: EntityId, resourceEntity: EntityId): void {
    const targetPos = this.world.getComponent(resourceEntity, Position);
    if (!targetPos) return;

    const carrier = this.world.getComponent(entityId, ResourceCarrier);
    const mov = this.world.getComponent(entityId, Movement);
    if (!carrier || !mov) return;

    this.clearUnit(entityId);

    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) behavior.state = 'gathering';

    carrier.gatherTarget = resourceEntity;
    carrier.state = 'moving_to_resource';
    mov.setPath([targetPos.toPoint()]);
  }

  commandConstruct(entityId: EntityId, buildingEntity: EntityId): void {
    const targetPos = this.world.getComponent(buildingEntity, Position);
    if (!targetPos) return;

    this.clearUnit(entityId);

    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) {
      behavior.state = 'constructing';
      behavior.constructingTarget = buildingEntity;
    }

    const mov = this.world.getComponent(entityId, Movement);
    if (mov) {
      mov.setPath([targetPos.toPoint()]);
    }
  }

  commandRepair(entityId: EntityId, buildingEntity: EntityId): void {
    const targetPos = this.world.getComponent(buildingEntity, Position);
    if (!targetPos) return;

    this.clearUnit(entityId);

    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) {
      behavior.state = 'repairing';
      behavior.repairTarget = buildingEntity;
    }

    const mov = this.world.getComponent(entityId, Movement);
    if (mov) {
      mov.setPath([targetPos.toPoint()]);
    }
  }

  commandPatrol(entityId: EntityId, origin: Point, target: Point): void {
    const mov = this.world.getComponent(entityId, Movement);
    if (!mov) return;

    this.clearUnit(entityId);

    const behavior = this.world.getComponent(entityId, UnitBehavior);
    if (behavior) {
      behavior.state = 'patrolling';
      behavior.patrolOrigin = origin;
      behavior.patrolTarget = target;
      behavior.patrolForward = true;
    }

    mov.setPath([target]);
  }

  commandStop(entityId: EntityId): void {
    this.clearUnit(entityId);
  }
}
