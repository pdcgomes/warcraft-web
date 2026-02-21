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
import type { GameMap } from '../map/GameMap.js';
import { findPath } from '../map/Pathfinding.js';
import type { GameEventLog } from '../game/GameEventLog.js';
import { factionSender } from '../game/GameEventLog.js';

import type { DamageType } from '../components/Combat.js';

/**
 * Handles attack cooldowns, target acquisition, and damage application.
 *
 * Behavioral state rules (for units with UnitBehavior):
 * - 'attacking': full combat (chase + attack). On target lost -> returnState or 'idle'.
 * - 'idle': auto-acquire in sight range -> 'attacking'.
 * - 'patrolling': auto-acquire in sight range -> 'attacking' with returnState='patrolling'.
 * - 'holding': auto-acquire in attack range only, attack in range, never chase.
 * - 'moving', 'gathering', 'constructing': ignored entirely.
 *
 * Buildings with Combat (towers) have no UnitBehavior. They behave like permanent
 * 'holding' units: auto-acquire in attack range, never chase.
 *
 * Does NOT call destroyEntity -- DeathCleanupSystem handles that exclusively.
 */
const UNDER_ATTACK_COOLDOWN = 50;

/**
 * Damage multiplier matrix: DAMAGE_MATRIX[attackerType][targetType].
 * 1.0 is the default. Siege does extra damage to buildings.
 */
const DAMAGE_MATRIX: Partial<Record<DamageType, Partial<Record<string, number>>>> = {
  siege: { building: 2.0, unit: 0.5 },
  melee: { building: 0.5 },
};

export class CombatSystem extends System {
  readonly name = 'CombatSystem';
  readonly priority = 20;

  private eventLog: GameEventLog | null = null;
  private gameMap: GameMap | null = null;

  constructor(gameMap?: GameMap) {
    super();
    if (gameMap) this.gameMap = gameMap;
  }

  setEventLog(log: GameEventLog): void {
    this.eventLog = log;
  }

  setGameMap(map: GameMap): void {
    this.gameMap = map;
  }

  update(world: World, _deltaMs: number): void {
    const combatEntities = world.query(Position.type, Combat.type, Health.type, Owner.type);

    for (const entityId of combatEntities) {
      const combat = world.getComponent(entityId, Combat)!;
      const health = world.getComponent(entityId, Health)!;
      const behavior = world.getComponent(entityId, UnitBehavior);

      if (health.isDead) continue;

      if (combat.cooldownRemaining > 0) {
        combat.cooldownRemaining--;
      }

      const state = behavior?.state;

      if (state === 'moving' || state === 'gathering' || state === 'constructing' || state === 'repairing') continue;

      if (combat.targetEntity !== null) {
        const targetHealth = world.getComponent(combat.targetEntity, Health);
        if (!targetHealth || targetHealth.isDead || !world.hasEntity(combat.targetEntity)) {
          combat.targetEntity = null;
          this.onTargetLost(behavior);
        }
      }

      if (combat.targetEntity === null) {
        this.tryAutoAcquire(world, entityId, combat, behavior, combatEntities);
      }

      if (combat.targetEntity === null) continue;

      const pos = world.getComponent(entityId, Position)!;
      const targetPos = world.getComponent(combat.targetEntity, Position);
      if (!targetPos) {
        combat.targetEntity = null;
        this.onTargetLost(behavior);
        continue;
      }

      const dist = fpDistance(pos, targetPos);

      if (dist <= combat.attackRange) {
        if (combat.cooldownRemaining <= 0) {
          this.performAttack(world, combat);
        }
        const mov = world.getComponent(entityId, Movement);
        if (mov && mov.isMoving) {
          mov.clearPath();
        }
      } else if (state === 'holding') {
        combat.targetEntity = null;
      } else if (state === 'attacking' || state === 'patrolling') {
        const mov = world.getComponent(entityId, Movement);
        if (mov && !mov.isMoving) {
          this.pathTo(pos, mov, { x: targetPos.x, y: targetPos.y });
        }
      }
    }
  }

  private pathTo(pos: Position, mov: Movement, target: { x: number; y: number }): void {
    if (this.gameMap) {
      const startTile = { x: Math.round(pos.x / 1000), y: Math.round(pos.y / 1000) };
      const goalTile = { x: Math.round(target.x / 1000), y: Math.round(target.y / 1000) };
      const path = findPath(this.gameMap, startTile, goalTile);
      if (path.length > 0) mov.setPath(path);
    } else {
      mov.setPath([target]);
    }
  }

  private tryAutoAcquire(
    world: World,
    entityId: number,
    combat: Combat,
    behavior: UnitBehavior | undefined,
    candidates: number[],
  ): void {
    const state = behavior?.state;

    if (state === 'idle' || state === 'patrolling') {
      const enemy = this.findNearestEnemy(world, entityId, candidates, combat.sightRange);
      if (enemy !== null) {
        combat.targetEntity = enemy;
        if (behavior) {
          if (state === 'patrolling') {
            behavior.returnState = 'patrolling';
          }
          behavior.state = 'attacking';
        }
      }
    } else if (state === 'holding') {
      const enemy = this.findNearestEnemy(world, entityId, candidates, combat.attackRange);
      if (enemy !== null) {
        combat.targetEntity = enemy;
      }
    } else if (behavior === undefined) {
      // Building with Combat (e.g. tower): range-only auto-acquire, no behavior change
      const enemy = this.findNearestEnemy(world, entityId, candidates, combat.attackRange);
      if (enemy !== null) {
        combat.targetEntity = enemy;
      }
    }
  }

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
      const dist = fpDistance(pos, candidatePos);

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
    let baseDamage = Math.max(1, combat.totalAttack - armor);

    // Apply damage type multiplier
    const targetCategory = world.hasComponent(combat.targetEntity, Building.type) ? 'building' : 'unit';
    const multiplier = DAMAGE_MATRIX[combat.damageType]?.[targetCategory] ?? 1.0;
    const damage = Math.max(1, Math.round(baseDamage * multiplier));

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
    const owner = world.getComponent(targetEntity, Owner);
    const label = bld?.name ?? ut?.name ?? 'Entity';
    const sender = owner
      ? factionSender(`entity:${targetEntity}`, label, owner.faction)
      : { key: `entity:${targetEntity}`, label };

    this.eventLog.pushThrottled(
      'unit_under_attack',
      sender,
      'Under attack!',
      world.tick,
      UNDER_ATTACK_COOLDOWN,
    );
  }
}
