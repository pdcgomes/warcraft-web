import type { Component } from '../ecs/Component.js';
import type { EntityId } from '../ecs/Entity.js';

export type DamageType = 'melee' | 'ranged' | 'siege' | 'magic';

export class Combat implements Component {
  static readonly type = 'Combat' as const;
  readonly type = Combat.type;

  /** Base attack damage */
  attackDamage: number;

  /** Bonus from upgrades */
  attackBonus: number = 0;

  /** Base armor (damage reduction) */
  armor: number;

  /** Bonus armor from upgrades */
  armorBonus: number = 0;

  /** Attack range in fixed-point units */
  attackRange: number;

  /** Ticks between attacks */
  attackCooldown: number;

  /** Ticks remaining until next attack */
  cooldownRemaining: number = 0;

  /** Current attack target entity */
  targetEntity: EntityId | null = null;

  damageType: DamageType;

  /** Sight range in fixed-point units (for fog of war) */
  sightRange: number;

  constructor(params: {
    attackDamage: number;
    armor: number;
    attackRange: number;
    attackCooldown: number;
    damageType: DamageType;
    sightRange: number;
  }) {
    this.attackDamage = params.attackDamage;
    this.armor = params.armor;
    this.attackRange = params.attackRange;
    this.attackCooldown = params.attackCooldown;
    this.damageType = params.damageType;
    this.sightRange = params.sightRange;
  }

  get totalAttack(): number {
    return this.attackDamage + this.attackBonus;
  }

  get totalArmor(): number {
    return this.armor + this.armorBonus;
  }
}
