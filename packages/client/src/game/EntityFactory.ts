import {
  World, Position, Movement, Health, Combat, Owner,
  UnitType, Building, Selectable, ResourceCarrier,
  ResourceSource, Production, UnitBehavior, Collider, toFixed,
} from '@warcraft-web/shared';
import type { EntityId, UnitKind, FactionId, BuildingKind } from '@warcraft-web/shared';

/**
 * Unit stat definitions: keyed by UnitKind.
 */
export const UNIT_STATS: Record<string, {
  name: string;
  hp: number;
  speed: number;
  attack: number;
  armor: number;
  range: number;
  cooldown: number;
  damageType: 'melee' | 'ranged' | 'siege' | 'magic';
  sightRange: number;
  collisionRadius: number;
  isWorker?: boolean;
}> = {
  worker: { name: 'Peasant', hp: 30, speed: 200, attack: 3, armor: 0, range: 1500, cooldown: 15, damageType: 'melee', sightRange: 5000, collisionRadius: 350, isWorker: true },
  footman: { name: 'Footman', hp: 60, speed: 180, attack: 6, armor: 2, range: 1500, cooldown: 12, damageType: 'melee', sightRange: 5000, collisionRadius: 400 },
  grunt: { name: 'Grunt', hp: 60, speed: 180, attack: 6, armor: 2, range: 1500, cooldown: 12, damageType: 'melee', sightRange: 5000, collisionRadius: 400 },
  archer: { name: 'Archer', hp: 40, speed: 200, attack: 4, armor: 0, range: 5000, cooldown: 10, damageType: 'ranged', sightRange: 6000, collisionRadius: 350 },
  troll_axethrower: { name: 'Troll Axethrower', hp: 40, speed: 200, attack: 4, armor: 0, range: 5000, cooldown: 10, damageType: 'ranged', sightRange: 6000, collisionRadius: 350 },
  knight: { name: 'Knight', hp: 90, speed: 250, attack: 8, armor: 4, range: 1500, cooldown: 14, damageType: 'melee', sightRange: 5000, collisionRadius: 450 },
  raider: { name: 'Raider', hp: 90, speed: 250, attack: 8, armor: 4, range: 1500, cooldown: 14, damageType: 'melee', sightRange: 5000, collisionRadius: 450 },
  catapult: { name: 'Catapult', hp: 110, speed: 100, attack: 25, armor: 0, range: 8000, cooldown: 30, damageType: 'siege', sightRange: 9000, collisionRadius: 550 },
  ballista: { name: 'Ballista', hp: 110, speed: 100, attack: 25, armor: 0, range: 8000, cooldown: 30, damageType: 'siege', sightRange: 9000, collisionRadius: 550 },
  cleric: { name: 'Cleric', hp: 25, speed: 180, attack: 2, armor: 0, range: 1500, cooldown: 15, damageType: 'magic', sightRange: 6000, collisionRadius: 350 },
  shaman: { name: 'Shaman', hp: 25, speed: 180, attack: 2, armor: 0, range: 1500, cooldown: 15, damageType: 'magic', sightRange: 6000, collisionRadius: 350 },
};

/**
 * Building definitions: keyed by BuildingKind.
 */
const BUILDING_STATS: Record<string, {
  name: string;
  hp: number;
  tileWidth: number;
  tileHeight: number;
  buildTime: number;
  supplyProvided: number;
  canProduce: UnitKind[];
}> = {
  town_hall: { name: 'Town Hall', hp: 1200, tileWidth: 3, tileHeight: 3, buildTime: 200, supplyProvided: 1, canProduce: ['worker'] },
  great_hall: { name: 'Great Hall', hp: 1200, tileWidth: 3, tileHeight: 3, buildTime: 200, supplyProvided: 1, canProduce: ['worker'] },
  barracks: { name: 'Barracks', hp: 800, tileWidth: 3, tileHeight: 3, buildTime: 150, supplyProvided: 0, canProduce: ['footman', 'archer'] },
  lumber_mill: { name: 'Lumber Mill', hp: 600, tileWidth: 2, tileHeight: 2, buildTime: 100, supplyProvided: 0, canProduce: [] },
  war_mill: { name: 'War Mill', hp: 600, tileWidth: 2, tileHeight: 2, buildTime: 100, supplyProvided: 0, canProduce: [] },
  stable: { name: 'Stable', hp: 500, tileWidth: 3, tileHeight: 3, buildTime: 150, supplyProvided: 0, canProduce: ['knight'] },
  beastiary: { name: 'Beastiary', hp: 500, tileWidth: 3, tileHeight: 3, buildTime: 150, supplyProvided: 0, canProduce: ['raider'] },
  farm: { name: 'Farm', hp: 400, tileWidth: 2, tileHeight: 2, buildTime: 80, supplyProvided: 4, canProduce: [] },
  pig_farm: { name: 'Pig Farm', hp: 400, tileWidth: 2, tileHeight: 2, buildTime: 80, supplyProvided: 4, canProduce: [] },
  tower: { name: 'Scout Tower', hp: 500, tileWidth: 2, tileHeight: 2, buildTime: 100, supplyProvided: 0, canProduce: [] },
  guard_tower: { name: 'Guard Tower', hp: 500, tileWidth: 2, tileHeight: 2, buildTime: 100, supplyProvided: 0, canProduce: [] },
  blacksmith: { name: 'Blacksmith', hp: 600, tileWidth: 2, tileHeight: 2, buildTime: 120, supplyProvided: 0, canProduce: [] },
};

/** Production time in ticks per unit kind. */
const PRODUCTION_TIMES: Record<string, number> = {
  worker: 50,
  footman: 60,
  grunt: 60,
  archer: 70,
  troll_axethrower: 70,
  knight: 90,
  raider: 90,
  catapult: 120,
  ballista: 120,
  cleric: 80,
  shaman: 80,
};

export class EntityFactory {
  /**
   * Spawn a unit at the given fixed-point position.
   */
  static createUnit(
    world: World,
    kind: UnitKind,
    x: number,
    y: number,
    playerId: number,
    faction: FactionId,
  ): EntityId {
    const stats = UNIT_STATS[kind];
    if (!stats) throw new Error(`Unknown unit kind: ${kind}`);

    const entity = world.createEntity();

    world.addComponent(entity, new Position(x, y));
    world.addComponent(entity, new Movement(stats.speed));
    world.addComponent(entity, new Health(stats.hp));
    world.addComponent(entity, new Combat({
      attackDamage: stats.attack,
      armor: stats.armor,
      attackRange: stats.range,
      attackCooldown: stats.cooldown,
      damageType: stats.damageType,
      sightRange: stats.sightRange,
    }));
    world.addComponent(entity, new Owner(playerId, faction));
    world.addComponent(entity, new UnitType(kind, stats.name));
    world.addComponent(entity, new Selectable(16, 20));
    world.addComponent(entity, new UnitBehavior());
    world.addComponent(entity, new Collider(stats.collisionRadius, false));

    if (stats.isWorker) {
      world.addComponent(entity, new ResourceCarrier(100, 2));
    }

    return entity;
  }

  /**
   * Spawn a building at the given fixed-point position.
   */
  static createBuilding(
    world: World,
    kind: BuildingKind,
    x: number,
    y: number,
    playerId: number,
    faction: FactionId,
    isComplete: boolean = false,
  ): EntityId {
    const stats = BUILDING_STATS[kind];
    if (!stats) throw new Error(`Unknown building kind: ${kind}`);

    const entity = world.createEntity();

    world.addComponent(entity, new Position(x, y));
    world.addComponent(entity, new Health(stats.hp));
    world.addComponent(entity, new Building({
      kind,
      name: stats.name,
      tileWidth: stats.tileWidth,
      tileHeight: stats.tileHeight,
      buildTime: stats.buildTime,
      supplyProvided: stats.supplyProvided,
      isComplete,
    }));
    world.addComponent(entity, new Owner(playerId, faction));
    world.addComponent(entity, new Selectable(stats.tileWidth * 20, stats.tileHeight * 16));

    // Static collider: radius covers the building footprint (half the diagonal in fp)
    const buildingRadius = Math.round(Math.max(stats.tileWidth, stats.tileHeight) * 500 * 0.9);
    world.addComponent(entity, new Collider(buildingRadius, true));

    if (stats.canProduce.length > 0) {
      world.addComponent(entity, new Production(stats.canProduce));
    }

    // If already complete, set health to max
    if (isComplete) {
      const health = world.getComponent(entity, Health)!;
      health.current = health.max;
    }

    return entity;
  }

  /**
   * Spawn a resource node (gold mine, tree).
   */
  static createResource(
    world: World,
    type: 'gold' | 'lumber',
    x: number,
    y: number,
    amount: number,
  ): EntityId {
    const entity = world.createEntity();

    world.addComponent(entity, new Position(x, y));
    world.addComponent(entity, new Owner(0, 'humans')); // Neutral
    world.addComponent(entity, new Selectable(20, 20));

    // Gold mines are larger than trees
    const resourceRadius = type === 'gold' ? 700 : 400;
    world.addComponent(entity, new Collider(resourceRadius, true));

    const maxGatherers = type === 'gold' ? 5 : 2;
    world.addComponent(entity, new ResourceSource(type, amount, maxGatherers));

    return entity;
  }

  /**
   * Get the production time for a unit kind.
   */
  static getProductionTime(kind: UnitKind): number {
    return PRODUCTION_TIMES[kind] ?? 60;
  }
}
