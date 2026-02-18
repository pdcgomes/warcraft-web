import type { UnitKind } from '../components/UnitType.js';
import type { FactionId } from '../components/Owner.js';
import type { BuildingKind } from '../components/Building.js';
import type { DamageType } from '../components/Combat.js';
import type { OrderId } from '../game/Orders.js';

export interface ResourceCost {
  readonly gold: number;
  readonly lumber: number;
}

export interface UnitDataEntry {
  readonly name: string;
  /** Override display name when the owner belongs to the other faction. */
  readonly factionNames?: Partial<Record<FactionId, string>>;
  readonly faction: FactionId | 'any';
  readonly hp: number;
  readonly speed: number;
  readonly attack: number;
  readonly armor: number;
  /** Attack range in fixed-point units. */
  readonly range: number;
  /** Ticks between attacks. */
  readonly cooldown: number;
  readonly damageType: DamageType;
  /** Sight range in fixed-point units. */
  readonly sightRange: number;
  /** Collision radius in fixed-point units. */
  readonly collisionRadius: number;
  readonly cost: ResourceCost;
  /** Population slots consumed. */
  readonly supply: number;
  /** Ticks to train. */
  readonly trainTime: number;
  /** Building kinds that can train this unit. */
  readonly trainedAt: readonly BuildingKind[];
  /**
   * Building prerequisites: outer = AND, inner = OR.
   * E.g. `[['lumber_mill', 'war_mill']]` means the player needs at least
   * one lumber_mill OR war_mill.
   */
  readonly requires: readonly (readonly BuildingKind[])[];
  readonly orders: readonly OrderId[];
  readonly isWorker: boolean;
}

export const UNIT_DATA: Record<UnitKind, UnitDataEntry> = {
  worker: {
    name: 'Peasant',
    factionNames: { orcs: 'Peon' },
    faction: 'any',
    hp: 30, speed: 200, attack: 3, armor: 0,
    range: 1500, cooldown: 15, damageType: 'melee',
    sightRange: 5000, collisionRadius: 350,
    cost: { gold: 400, lumber: 0 }, supply: 1, trainTime: 50,
    trainedAt: ['town_hall', 'great_hall'],
    requires: [],
    orders: ['move', 'stop', 'attack', 'gather', 'repair', 'build', 'build_advanced'],
    isWorker: true,
  },
  footman: {
    name: 'Footman', faction: 'humans',
    hp: 60, speed: 180, attack: 6, armor: 2,
    range: 1500, cooldown: 12, damageType: 'melee',
    sightRange: 5000, collisionRadius: 400,
    cost: { gold: 600, lumber: 0 }, supply: 1, trainTime: 60,
    trainedAt: ['barracks'],
    requires: [],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  grunt: {
    name: 'Grunt', faction: 'orcs',
    hp: 60, speed: 180, attack: 6, armor: 2,
    range: 1500, cooldown: 12, damageType: 'melee',
    sightRange: 5000, collisionRadius: 400,
    cost: { gold: 600, lumber: 0 }, supply: 1, trainTime: 60,
    trainedAt: ['barracks'],
    requires: [],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  archer: {
    name: 'Archer', faction: 'humans',
    hp: 40, speed: 200, attack: 4, armor: 0,
    range: 5000, cooldown: 10, damageType: 'ranged',
    sightRange: 6000, collisionRadius: 350,
    cost: { gold: 500, lumber: 50 }, supply: 1, trainTime: 70,
    trainedAt: ['barracks'],
    requires: [['lumber_mill']],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  troll_axethrower: {
    name: 'Troll Axethrower', faction: 'orcs',
    hp: 40, speed: 200, attack: 4, armor: 0,
    range: 5000, cooldown: 10, damageType: 'ranged',
    sightRange: 6000, collisionRadius: 350,
    cost: { gold: 500, lumber: 50 }, supply: 1, trainTime: 70,
    trainedAt: ['barracks'],
    requires: [['war_mill']],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  knight: {
    name: 'Knight', faction: 'humans',
    hp: 90, speed: 250, attack: 8, armor: 4,
    range: 1500, cooldown: 14, damageType: 'melee',
    sightRange: 5000, collisionRadius: 450,
    cost: { gold: 800, lumber: 100 }, supply: 1, trainTime: 90,
    trainedAt: ['stable'],
    requires: [],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  raider: {
    name: 'Raider', faction: 'orcs',
    hp: 90, speed: 250, attack: 8, armor: 4,
    range: 1500, cooldown: 14, damageType: 'melee',
    sightRange: 5000, collisionRadius: 450,
    cost: { gold: 800, lumber: 100 }, supply: 1, trainTime: 90,
    trainedAt: ['beastiary'],
    requires: [],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  ballista: {
    name: 'Ballista', faction: 'humans',
    hp: 110, speed: 100, attack: 25, armor: 0,
    range: 8000, cooldown: 30, damageType: 'siege',
    sightRange: 9000, collisionRadius: 550,
    cost: { gold: 900, lumber: 300 }, supply: 1, trainTime: 120,
    trainedAt: ['barracks'],
    requires: [['blacksmith']],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  catapult: {
    name: 'Catapult', faction: 'orcs',
    hp: 110, speed: 100, attack: 25, armor: 0,
    range: 8000, cooldown: 30, damageType: 'siege',
    sightRange: 9000, collisionRadius: 550,
    cost: { gold: 900, lumber: 300 }, supply: 1, trainTime: 120,
    trainedAt: ['barracks'],
    requires: [['blacksmith']],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  cleric: {
    name: 'Cleric', faction: 'humans',
    hp: 25, speed: 180, attack: 2, armor: 0,
    range: 1500, cooldown: 15, damageType: 'magic',
    sightRange: 6000, collisionRadius: 350,
    cost: { gold: 700, lumber: 100 }, supply: 1, trainTime: 80,
    trainedAt: ['barracks'],
    requires: [['lumber_mill']],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
  shaman: {
    name: 'Shaman', faction: 'orcs',
    hp: 25, speed: 180, attack: 2, armor: 0,
    range: 1500, cooldown: 15, damageType: 'magic',
    sightRange: 6000, collisionRadius: 350,
    cost: { gold: 700, lumber: 100 }, supply: 1, trainTime: 80,
    trainedAt: ['barracks'],
    requires: [['war_mill']],
    orders: ['move', 'stop', 'attack', 'patrol', 'hold_position'],
    isWorker: false,
  },
};

/** Get the faction-appropriate display name for a unit kind. */
export function getUnitDisplayName(kind: UnitKind, faction: FactionId): string {
  const data = UNIT_DATA[kind];
  return data.factionNames?.[faction] ?? data.name;
}

/**
 * Check whether a player satisfies all prerequisite building requirements.
 * Each inner array is an OR group; all outer groups must be satisfied.
 */
export function meetsPrerequisites(
  requires: readonly (readonly BuildingKind[])[],
  ownedKinds: ReadonlySet<BuildingKind>,
): boolean {
  for (const group of requires) {
    if (!group.some(kind => ownedKinds.has(kind))) return false;
  }
  return true;
}

/**
 * Return the unit kinds a building can currently produce,
 * filtered by the owner's faction and prerequisite buildings.
 */
export function getTrainableUnits(
  canProduce: readonly UnitKind[],
  ownerFaction: FactionId,
  ownedBuildingKinds: ReadonlySet<BuildingKind>,
): UnitKind[] {
  return canProduce.filter(kind => {
    const data = UNIT_DATA[kind];
    if (data.faction !== 'any' && data.faction !== ownerFaction) return false;
    return meetsPrerequisites(data.requires, ownedBuildingKinds);
  });
}
