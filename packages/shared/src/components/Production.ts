import type { Component } from '../ecs/Component.js';
import type { UnitKind } from './UnitType.js';

export interface ProductionQueueItem {
  unitKind: UnitKind;
  /** Ticks remaining to produce */
  ticksRemaining: number;
  /** Total ticks to produce */
  totalTicks: number;
}

/**
 * Allows a building to produce units.
 */
export class Production implements Component {
  static readonly type = 'Production' as const;
  readonly type = Production.type;

  /** Units this building can produce */
  canProduce: UnitKind[];

  /** Current production queue */
  queue: ProductionQueueItem[] = [];

  /** Max queue size */
  maxQueueSize: number;

  /** Rally point for produced units (fixed-point) */
  rallyX: number = 0;
  rallyY: number = 0;

  constructor(canProduce: UnitKind[], maxQueueSize: number = 5) {
    this.canProduce = canProduce;
    this.maxQueueSize = maxQueueSize;
  }
}
