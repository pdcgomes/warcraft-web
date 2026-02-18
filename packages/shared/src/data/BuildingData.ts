import type { BuildingKind } from '../components/Building.js';
import type { FactionId } from '../components/Owner.js';
import type { UnitKind } from '../components/UnitType.js';
import type { ResourceCost } from './UnitData.js';
import { meetsPrerequisites } from './UnitData.js';

export interface BuildingDataEntry {
  readonly name: string;
  readonly faction: FactionId | 'any';
  readonly hp: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Ticks to construct. */
  readonly buildTime: number;
  readonly cost: ResourceCost;
  /** Population capacity provided when complete. */
  readonly supplyProvided: number;
  /** All units this building kind can ever produce (across factions). */
  readonly canProduce: readonly UnitKind[];
  /**
   * Building prerequisites: outer = AND, inner = OR.
   * E.g. `[['lumber_mill', 'war_mill']]` means at least one must exist.
   */
  readonly requires: readonly (readonly BuildingKind[])[];
  /** Which build submenu this building appears in for workers. */
  readonly buildCategory: 'basic' | 'advanced';
}

export const BUILDING_DATA: Record<BuildingKind, BuildingDataEntry> = {
  town_hall: {
    name: 'Town Hall', faction: 'humans',
    hp: 1200, tileWidth: 3, tileHeight: 3, buildTime: 200,
    cost: { gold: 1200, lumber: 800 }, supplyProvided: 1,
    canProduce: ['worker'],
    requires: [],
    buildCategory: 'advanced',
  },
  great_hall: {
    name: 'Great Hall', faction: 'orcs',
    hp: 1200, tileWidth: 3, tileHeight: 3, buildTime: 200,
    cost: { gold: 1200, lumber: 800 }, supplyProvided: 1,
    canProduce: ['worker'],
    requires: [],
    buildCategory: 'advanced',
  },
  barracks: {
    name: 'Barracks', faction: 'any',
    hp: 800, tileWidth: 3, tileHeight: 3, buildTime: 150,
    cost: { gold: 700, lumber: 450 }, supplyProvided: 0,
    canProduce: ['footman', 'grunt', 'archer', 'troll_axethrower', 'ballista', 'catapult', 'cleric', 'shaman'],
    requires: [],
    buildCategory: 'basic',
  },
  lumber_mill: {
    name: 'Lumber Mill', faction: 'humans',
    hp: 600, tileWidth: 2, tileHeight: 2, buildTime: 100,
    cost: { gold: 600, lumber: 450 }, supplyProvided: 0,
    canProduce: [],
    requires: [],
    buildCategory: 'basic',
  },
  war_mill: {
    name: 'War Mill', faction: 'orcs',
    hp: 600, tileWidth: 2, tileHeight: 2, buildTime: 100,
    cost: { gold: 600, lumber: 450 }, supplyProvided: 0,
    canProduce: [],
    requires: [],
    buildCategory: 'basic',
  },
  blacksmith: {
    name: 'Blacksmith', faction: 'any',
    hp: 600, tileWidth: 2, tileHeight: 2, buildTime: 120,
    cost: { gold: 800, lumber: 450 }, supplyProvided: 0,
    canProduce: [],
    requires: [['lumber_mill', 'war_mill']],
    buildCategory: 'advanced',
  },
  stable: {
    name: 'Stable', faction: 'humans',
    hp: 500, tileWidth: 3, tileHeight: 3, buildTime: 150,
    cost: { gold: 1000, lumber: 300 }, supplyProvided: 0,
    canProduce: ['knight'],
    requires: [['barracks']],
    buildCategory: 'advanced',
  },
  beastiary: {
    name: 'Beastiary', faction: 'orcs',
    hp: 500, tileWidth: 3, tileHeight: 3, buildTime: 150,
    cost: { gold: 1000, lumber: 300 }, supplyProvided: 0,
    canProduce: ['raider'],
    requires: [['barracks']],
    buildCategory: 'advanced',
  },
  farm: {
    name: 'Farm', faction: 'humans',
    hp: 400, tileWidth: 2, tileHeight: 2, buildTime: 80,
    cost: { gold: 500, lumber: 250 }, supplyProvided: 4,
    canProduce: [],
    requires: [],
    buildCategory: 'basic',
  },
  pig_farm: {
    name: 'Pig Farm', faction: 'orcs',
    hp: 400, tileWidth: 2, tileHeight: 2, buildTime: 80,
    cost: { gold: 500, lumber: 250 }, supplyProvided: 4,
    canProduce: [],
    requires: [],
    buildCategory: 'basic',
  },
  tower: {
    name: 'Scout Tower', faction: 'humans',
    hp: 500, tileWidth: 2, tileHeight: 2, buildTime: 100,
    cost: { gold: 550, lumber: 200 }, supplyProvided: 0,
    canProduce: [],
    requires: [['lumber_mill']],
    buildCategory: 'advanced',
  },
  guard_tower: {
    name: 'Guard Tower', faction: 'orcs',
    hp: 500, tileWidth: 2, tileHeight: 2, buildTime: 100,
    cost: { gold: 550, lumber: 200 }, supplyProvided: 0,
    canProduce: [],
    requires: [['war_mill']],
    buildCategory: 'advanced',
  },
};

/**
 * Return the building kinds a player can construct,
 * filtered by faction, prerequisites, and build-menu category.
 */
export function getBuildableBuildings(
  ownerFaction: FactionId,
  ownedBuildingKinds: ReadonlySet<BuildingKind>,
  category: 'basic' | 'advanced',
): BuildingKind[] {
  const result: BuildingKind[] = [];
  for (const [kind, data] of Object.entries(BUILDING_DATA) as [BuildingKind, BuildingDataEntry][]) {
    if (data.buildCategory !== category) continue;
    if (data.faction !== 'any' && data.faction !== ownerFaction) continue;
    if (!meetsPrerequisites(data.requires, ownedBuildingKinds)) continue;
    result.push(kind);
  }
  return result;
}
