import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import { Position } from '../components/Position.js';
import { Combat } from '../components/Combat.js';
import { Health } from '../components/Health.js';
import { Owner } from '../components/Owner.js';
import { Movement } from '../components/Movement.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { UnitType } from '../components/UnitType.js';
import { Building } from '../components/Building.js';
import { fpDistance } from '../math/FixedPoint.js';
import type { GameEventLog } from '../game/GameEventLog.js';

/**
 * Handles attack cooldowns, target acquisition, and damage application.
 *
 * Behavioral state rules:
 * - 'attacking': full combat (chase + attack). On target lost -> returnState or 'idle'.
 * - 'idle': auto-acquire in sight range -> 'attacking'.
 * - 'patrolling': auto-acquire in sight range -> 'attacking' with returnState='patrolling'.
 * - 'holding': auto-acquire in attack range only, attack in range, never chase, stay 'holding'.
 * - 'moving', 'gathering': ignored entirely.
 * - Does NOT call destroyEntity -- DeathCleanupSystem handles that exclusively.
 */
/** Throttle window for "under attack" events (ticks). At 10 tps = 5 seconds. */
const UNDER_ATTACK_COOLDOWN = 50;

export class CombatSystem extends System {
  readonly name = 'CombatSystem';
  readonly priority = 20;

  private eventLog: GameEventLog | null = null;

  setEventLog(log: GameEventLog): void {
    this.eventLog = log;
  }

  update(world: World, _deltaMs: number): void {
    const combatEntities = world.query(Position.type, Combat.type, Health.type, Owner.type);

    for (const entityId of combatEntities) {
      const combat = world.getComponent(entityId, Combat)!;
      const health = world.getComponent(entityId, Health)!;
      const behavior = world.getComponent(entityId, UnitBehavior);

      if (health.isDead) continue;

      // Tick cooldown regardless of state
      if (combat.cooldownRemaining > 0) {
        combat.cooldownRemaining--;
      }

      const state = behavior?.state;

      // Skip units in states we don't process
      if (state === 'moving' || state === 'gathering') continue;

      // --- Validate current target ---
      if (combat.targetEntity !== null) {
        const targetHealth = world.getComponent(combat.targetEntity, Health);
        if (!targetHealth || targetHealth.isDead || !world.hasEntity(combat.targetEntity)) {
          combat.targetEntity = null;
          this.onTargetLost(behavior);
        }
      }

      // --- Auto-acquire ---
      if (combat.targetEntity === null) {
        this.tryAutoAcquire(world, entityId, combat, behavior, combatEntities);
      }

      if (combat.targetEntity === null) continue;

      // --- Engage target ---
      const pos = world.getComponent(entityId, Position)!;
      const targetPos = world.getComponent(combat.targetEntity, Position);
      if (!targetPos) {
        combat.targetEntity = null;
        this.onTargetLost(behavior);
        continue;
      }

      const dist = fpDistance(pos.x, pos.y, targetPos.x, targetPos.y);

      if (dist <= combat.attackRange) {
        // In range: attack if cooldown ready
        if (combat.cooldownRemaining <= 0) {
          this.performAttack(world, combat);
        }
        // Stop moving while attacking
        const mov = world.getComponent(entityId, Movement);
        if (mov && mov.isMoving) {
          mov.clearPath();
        }
      } else if (state === 'holding') {
        // Holding: target moved out of range, drop it but stay holding
        combat.targetEntity = null;
      } else if (state === 'attacking') {
        // Attacking: chase the target
        const mov = world.getComponent(entityId, Movement);
        if (mov && !mov.isMoving) {
          mov.setPath([{ x: targetPos.x, y: targetPos.y }]);
        }
      }
      // 'patrolling' with a target: PatrolSystem pauses while we have a target.
      // If target is out of range, we chase (same as attacking).
      else if (state === 'patrolling') {
        const mov = world.getComponent(entityId, Movement);
        if (mov && !mov.isMoving) {
          mov.setPath([{ x: targetPos.x, y: targetPos.y }]);
        }
      }
    }
  }

  /**
   * Attempt auto-acquisition based on the unit's behavioral state.
   */
  private tryAutoAcquire(
    world: World,
    entityId: number,
    combat: Combat,
    behavior: UnitBehavior | undefined,
    candidates: number[],
  ): void {
    const state = behavior?.state;

    if (state === 'idle' || state === 'patrolling') {
      // Acquire within sight range
      const enemy = this.findNearestEnemy(world, entityId, candidates, combat.sightRange);
      if (enemy !== null) {
        combat.targetEntity = enemy;
        if (behavior) {
          if (state === 'patrolling') {
            // Remember to resume patrol after combat
            behavior.returnState = 'patrolling';
          }
          behavior.state = 'attacking';
        }
      }
    } else if (state === 'holding') {
      // Acquire within attack range only -- never chase
      const enemy = this.findNearestEnemy(world, entityId, candidates, combat.attackRange);
      if (enemy !== null) {
        combat.targetEntity = enemy;
        // Stay 'holding' -- don't transition to 'attacking'
      }
    }
  }

  /**
   * Called when the current combat target is lost or dies.
   * Transitions to returnState if set, otherwise idle (for attacking units).
   */
  private onTargetLost(behavior: UnitBehavior | undefined): void {
    if (!behavior) return;

    if (behavior.state === 'attacking') {
      if (behavior.returnState !== null) {
        behavior.state = behavior.returnState;
        behavior.returnState = null;
      } else {
        behavior.state = 'idle';
      }
    }
    // 'holding' units stay holding when target is lost (handled in engage section)
  }

  private findNearestEnemy(
    world: World,
    entityId: number,
    candidates: number[],
    maxRange: number,
  ): number | null {
    const pos = world.getComponent(entityId, Position)!;
    const owner = world.getComponent(entityId, Owner)!;

    let nearestId: number | null = null;
    let nearestDist = Infinity;

    for (const candidateId of candidates) {
      if (candidateId === entityId) continue;

      const candidateOwner = world.getComponent(candidateId, Owner);
      if (!candidateOwner || candidateOwner.playerId === owner.playerId) continue;
      if (candidateOwner.playerId === 0) continue;

      const candidateHealth = world.getComponent(candidateId, Health);
      if (!candidateHealth || candidateHealth.isDead) continue;

      const candidatePos = world.getComponent(candidateId, Position)!;
      const dist = fpDistance(pos.x, pos.y, candidatePos.x, candidatePos.y);

      if (dist <= maxRange && dist < nearestDist) {
        nearestDist = dist;
        nearestId = candidateId;
      }
    }

    return nearestId;
  }

  private performAttack(world: World, combat: Combat): void {
    if (combat.targetEntity === null) return;

    const targetHealth = world.getComponent(combat.targetEntity, Health);
    const targetCombat = world.getComponent(combat.targetEntity, Combat);
    if (!targetHealth) return;

    const armor = targetCombat ? targetCombat.totalArmor : 0;
    const damage = Math.max(1, combat.totalAttack - armor);

    targetHealth.takeDamage(damage);
    combat.cooldownRemaining = combat.attackCooldown;

    this.emitUnderAttack(world, combat.targetEntity);

    if (targetHealth.isDead) {
      combat.targetEntity = null;
    }
  }

  private emitUnderAttack(world: World, targetEntity: number): void {
    if (!this.eventLog) return;

    const ut = world.getComponent(targetEntity, UnitType);
    const bld = world.getComponent(targetEntity, Building);
    const label = bld?.name ?? ut?.name ?? 'Entity';

    this.eventLog.pushThrottled(
      'unit_under_attack',
      { key: `entity:${targetEntity}`, label },
      'Under attack!',
      world.tick,
      UNDER_ATTACK_COOLDOWN,
    );
  }
}
