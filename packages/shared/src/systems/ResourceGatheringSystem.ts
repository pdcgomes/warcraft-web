import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Movement } from '../components/Movement.js';
import { ResourceCarrier } from '../components/ResourceCarrier.js';
import { ResourceSource } from '../components/ResourceSource.js';
import { Owner } from '../components/Owner.js';
import { Building } from '../components/Building.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { fpDistance } from '../math/FixedPoint.js';
import type { Point } from '../math/Point.js';
import type { PlayerResources } from '../game/PlayerResources.js';

/** Distance threshold to consider a worker "at" a target (fixed-point). */
const ARRIVE_DISTANCE = 1500; // 1.5 tiles

/**
 * Drives the worker resource-gathering state machine:
 * idle -> moving_to_resource -> gathering -> returning -> (deposit) -> moving_to_resource ...
 *
 * Only processes workers whose UnitBehavior.state === 'gathering'.
 * On resource depleted / no return building: sets behavior.state to 'idle'.
 * Uses the shared PlayerResources instance for depositing resources.
 */
export class ResourceGatheringSystem extends System {
  readonly name = 'ResourceGatheringSystem';
  readonly priority = 30;

  /** Shared player resources (injected from outside). */
  playerResources!: PlayerResources;

  constructor(playerResources?: PlayerResources) {
    super();
    if (playerResources) {
      this.playerResources = playerResources;
    }
  }

  update(world: World, _deltaMs: number): void {
    const workers = world.query(
      Position.type,
      Movement.type,
      ResourceCarrier.type,
      Owner.type,
    );

    for (const entityId of workers) {
      const behavior = world.getComponent(entityId, UnitBehavior);

      if (behavior && behavior.state !== 'gathering') continue;

      const carrier = world.getComponent(entityId, ResourceCarrier)!;
      const pos = world.getComponent(entityId, Position)!;
      const mov = world.getComponent(entityId, Movement)!;
      const owner = world.getComponent(entityId, Owner)!;

      switch (carrier.state) {
        case 'idle':
          break;

        case 'moving_to_resource': {
          if (carrier.gatherTarget === null) {
            this.goIdle(carrier, behavior);
            break;
          }

          if (!world.hasEntity(carrier.gatherTarget)) {
            carrier.gatherTarget = null;
            mov.clearPath();
            this.goIdle(carrier, behavior);
            break;
          }

          const sourcePos = world.getComponent(carrier.gatherTarget, Position);
          if (!sourcePos) {
            this.goIdle(carrier, behavior);
            break;
          }

          const distToSource = fpDistance(pos, sourcePos);
          if (distToSource <= ARRIVE_DISTANCE) {
            mov.clearPath();
            carrier.state = 'gathering';

            const source = world.getComponent(carrier.gatherTarget, ResourceSource);
            if (source) {
              carrier.carryingType = source.resourceType;
              source.currentGatherers++;
            }
          }
          break;
        }

        case 'gathering': {
          if (carrier.gatherTarget === null) {
            this.goIdle(carrier, behavior);
            break;
          }

          const source = world.getComponent(carrier.gatherTarget, ResourceSource);
          if (!source || source.isDepleted) {
            this.goIdle(carrier, behavior);
            carrier.gatherTarget = null;
            break;
          }

          const gatherAmount = Math.min(
            carrier.gatherRate,
            carrier.carryCapacity - carrier.carrying,
            source.amount,
          );
          carrier.carrying += gatherAmount;
          source.amount -= gatherAmount;

          if (carrier.carrying >= carrier.carryCapacity) {
            source.currentGatherers = Math.max(0, source.currentGatherers - 1);
            carrier.state = 'returning';

            const returnTarget = this.findReturnBuilding(world, owner.playerId, pos.toPoint());
            if (returnTarget !== null) {
              carrier.returnTarget = returnTarget;
              const returnPos = world.getComponent(returnTarget, Position);
              if (returnPos) {
                mov.setPath([returnPos.toPoint()]);
              }
            } else {
              this.goIdle(carrier, behavior);
            }
          }
          break;
        }

        case 'returning': {
          if (carrier.returnTarget === null) {
            this.goIdle(carrier, behavior);
            break;
          }

          const returnPos = world.getComponent(carrier.returnTarget, Position);
          if (!returnPos || !world.hasEntity(carrier.returnTarget)) {
            carrier.returnTarget = null;
            this.goIdle(carrier, behavior);
            break;
          }

          const distToReturn = fpDistance(pos, returnPos);
          if (distToReturn <= ARRIVE_DISTANCE) {
            mov.clearPath();
            const res = this.playerResources.get(owner.playerId);
            if (carrier.carryingType === 'gold') {
              res.gold += carrier.carrying;
            } else if (carrier.carryingType === 'lumber') {
              res.lumber += carrier.carrying;
            }
            carrier.carrying = 0;
            carrier.carryingType = null;

            if (carrier.gatherTarget !== null && world.hasEntity(carrier.gatherTarget)) {
              carrier.state = 'moving_to_resource';
              const sourcePos = world.getComponent(carrier.gatherTarget, Position);
              if (sourcePos) {
                mov.setPath([sourcePos.toPoint()]);
              }
            } else {
              this.goIdle(carrier, behavior);
              carrier.gatherTarget = null;
            }
          }
          break;
        }
      }
    }
  }

  private goIdle(
    carrier: ResourceCarrier,
    behavior: UnitBehavior | undefined,
  ): void {
    carrier.state = 'idle';
    if (behavior) {
      behavior.state = 'idle';
    }
  }

  private findReturnBuilding(world: World, playerId: number, from: Point): number | null {
    const buildings = world.query(Position.type, Building.type, Owner.type);
    let nearest: number | null = null;
    let nearestDist = Infinity;

    for (const bid of buildings) {
      const bOwner = world.getComponent(bid, Owner)!;
      if (bOwner.playerId !== playerId) continue;

      const building = world.getComponent(bid, Building)!;
      if (!building.isComplete) continue;
      if (building.kind !== 'town_hall' && building.kind !== 'great_hall') continue;

      const bPos = world.getComponent(bid, Position)!;
      const dist = fpDistance(from, bPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = bid;
      }
    }

    return nearest;
  }
}
