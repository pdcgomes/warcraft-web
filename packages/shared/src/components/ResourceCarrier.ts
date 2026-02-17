import type { Component } from '../ecs/Component.js';
import type { EntityId } from '../ecs/Entity.js';

export type ResourceType = 'gold' | 'lumber';

/**
 * Component for worker units that can gather and carry resources.
 */
export class ResourceCarrier implements Component {
  static readonly type = 'ResourceCarrier' as const;
  readonly type = ResourceCarrier.type;

  /** Amount of resource currently carried */
  carrying: number = 0;

  /** Max amount that can be carried per trip */
  carryCapacity: number;

  /** Type of resource being carried (null if empty) */
  carryingType: ResourceType | null = null;

  /** Gathering rate: amount per tick */
  gatherRate: number;

  /** Entity being gathered from */
  gatherTarget: EntityId | null = null;

  /** Entity to return resources to */
  returnTarget: EntityId | null = null;

  /** Current state in the gather cycle */
  state: 'idle' | 'moving_to_resource' | 'gathering' | 'returning' = 'idle';

  constructor(carryCapacity: number, gatherRate: number) {
    this.carryCapacity = carryCapacity;
    this.gatherRate = gatherRate;
  }
}
