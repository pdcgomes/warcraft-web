import type { Component } from '../ecs/Component.js';

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
  | 'holding';

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
  patrolOriginX: number = 0;
  patrolOriginY: number = 0;

  /** Patrol destination point (fixed-point). */
  patrolTargetX: number = 0;
  patrolTargetY: number = 0;

  /** Whether currently heading toward the target (true) or back to origin (false). */
  patrolForward: boolean = true;

  constructor(state: BehaviorState = 'idle') {
    this.state = state;
  }
}
