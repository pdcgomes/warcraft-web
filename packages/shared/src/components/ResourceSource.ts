import type { Component } from '../ecs/Component.js';
import type { ResourceType } from './ResourceCarrier.js';

/**
 * A resource node that can be gathered from (gold mine, tree).
 */
export class ResourceSource implements Component {
  static readonly type = 'ResourceSource' as const;
  readonly type = ResourceSource.type;

  resourceType: ResourceType;

  /** Amount remaining */
  amount: number;

  /** Max workers that can gather simultaneously */
  maxGatherers: number;

  /** Current number of gatherers */
  currentGatherers: number = 0;

  constructor(resourceType: ResourceType, amount: number, maxGatherers: number = 1) {
    this.resourceType = resourceType;
    this.amount = amount;
    this.maxGatherers = maxGatherers;
  }

  get isDepleted(): boolean {
    return this.amount <= 0;
  }
}
