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

      // Only process workers in 'gathering' behavior state
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

          const distToSource = fpDistance(pos.x, pos.y, sourcePos.x, sourcePos.y);
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

          // Gather resources
          const gatherAmount = Math.min(
            carrier.gatherRate,
            carrier.carryCapacity - carrier.carrying,
            source.amount,
          );
          carrier.carrying += gatherAmount;
          source.amount -= gatherAmount;

          // If full, go return resources
          if (carrier.carrying >= carrier.carryCapacity) {
            source.currentGatherers = Math.max(0, source.currentGatherers - 1);
            carrier.state = 'returning';

            const returnTarget = this.findReturnBuilding(world, owner.playerId, pos.x, pos.y);
            if (returnTarget !== null) {
              carrier.returnTarget = returnTarget;
              const returnPos = world.getComponent(returnTarget, Position);
              if (returnPos) {
                mov.setPath([{ x: returnPos.x, y: returnPos.y }]);
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

          const distToReturn = fpDistance(pos.x, pos.y, returnPos.x, returnPos.y);
          if (distToReturn <= ARRIVE_DISTANCE) {
            // Deposit resources
            mov.clearPath();
            const res = this.playerResources.get(owner.playerId);
            if (carrier.carryingType === 'gold') {
              res.gold += carrier.carrying;
            } else if (carrier.carryingType === 'lumber') {
              res.lumber += carrier.carrying;
            }
            carrier.carrying = 0;
            carrier.carryingType = null;

            // Go back to gathering if we still have a target
            if (carrier.gatherTarget !== null && world.hasEntity(carrier.gatherTarget)) {
              carrier.state = 'moving_to_resource';
              const sourcePos = world.getComponent(carrier.gatherTarget, Position);
              if (sourcePos) {
                mov.setPath([{ x: sourcePos.x, y: sourcePos.y }]);
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

  /**
   * Transition a worker to idle: reset carrier state and behavior state.
   */
  private goIdle(
    carrier: ResourceCarrier,
    behavior: UnitBehavior | undefined,
  ): void {
    carrier.state = 'idle';
    if (behavior) {
      behavior.state = 'idle';
    }
  }

  private findReturnBuilding(world: World, playerId: number, fromX: number, fromY: number): number | null {
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
      const dist = fpDistance(fromX, fromY, bPos.x, bPos.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = bid;
      }
    }

    return nearest;
  }
}
