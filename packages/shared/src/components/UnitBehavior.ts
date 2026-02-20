import type { Component } from '../ecs/Component.js';
import type { Point } from '../math/Point.js';
import { ZERO } from '../math/Point.js';

/**
 * The authoritative behavioral state for a unit.
 * Only ONE system should drive Movement for a given state.
 */
export type BehaviorState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'gathering'
  | 'patrolling'
  | 'holding'
  | 'constructing'
  | 'repairing';

export class UnitBehavior implements Component {
  static readonly type = 'UnitBehavior' as const;
  readonly type = UnitBehavior.type;

  state: BehaviorState = 'idle';

  /**
   * State to restore after an 'attacking' sequence completes.
   * For example, a patrolling unit that auto-engages an enemy gets
   * returnState = 'patrolling'. When the target dies, CombatSystem
   * transitions back to 'patrolling' instead of 'idle'.
   */
  returnState: BehaviorState | null = null;

  /** Patrol origin point (fixed-point). */
  patrolOrigin: Point = ZERO;

  /** Patrol destination point (fixed-point). */
  patrolTarget: Point = ZERO;

  /** Whether currently heading toward the target (true) or back to origin (false). */
  patrolForward: boolean = true;

  /** Entity ID of the building this worker is constructing, or null. */
  constructingTarget: number | null = null;

  /** Entity ID of the building this worker is repairing, or null. */
  repairTarget: number | null = null;

  /** True while the worker is inside a building under construction. */
  absorbed: boolean = false;

  constructor(state: BehaviorState = 'idle') {
    this.state = state;
  }
}
