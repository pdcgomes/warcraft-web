import {
  World, Position, Movement, Health, Combat, Owner,
  UnitType, Building, Selectable, ResourceCarrier,
  ResourceSource, Production, UnitBehavior, Collider,
  UNIT_DATA, BUILDING_DATA,
} from '@warcraft-web/shared';
import type { EntityId, UnitKind, FactionId, BuildingKind, Point } from '@warcraft-web/shared';

export class EntityFactory {
  /** Spawn a unit at the given fixed-point position. */
  static createUnit(
    world: World,
    kind: UnitKind,
    pos: Point,
    playerId: number,
    faction: FactionId,
  ): EntityId {
    const data = UNIT_DATA[kind];
    if (!data) throw new Error(`Unknown unit kind: ${kind}`);

    const entity = world.createEntity();

    world.addComponent(entity, new Position(pos.x, pos.y));
    const jitter = 1.0 + ((entity % 17) - 8) / 100;
    world.addComponent(entity, new Movement(Math.round(data.speed * jitter)));
    world.addComponent(entity, new Health(data.hp));
    world.addComponent(entity, new Combat({
      attackDamage: data.attack,
      armor: data.armor,
      attackRange: data.range,
      attackCooldown: data.cooldown,
      damageType: data.damageType,
      sightRange: data.sightRange,
    }));
    world.addComponent(entity, new Owner(playerId, faction));
    world.addComponent(entity, new UnitType(kind, data.name));
    world.addComponent(entity, new Selectable(16, 20));
    world.addComponent(entity, new UnitBehavior());
    world.addComponent(entity, new Collider(data.collisionRadius, false));

    if (data.isWorker) {
      world.addComponent(entity, new ResourceCarrier(100, 2));
    }

    return entity;
  }

  /** Spawn a building at the given fixed-point position. */
  static createBuilding(
    world: World,
    kind: BuildingKind,
    pos: Point,
    playerId: number,
    faction: FactionId,
    isComplete: boolean = false,
  ): EntityId {
    const data = BUILDING_DATA[kind];
    if (!data) throw new Error(`Unknown building kind: ${kind}`);

    const entity = world.createEntity();

    world.addComponent(entity, new Position(pos.x, pos.y));
    world.addComponent(entity, new Health(data.hp));
    world.addComponent(entity, new Building({
      kind,
      name: data.name,
      tileWidth: data.tileWidth,
      tileHeight: data.tileHeight,
      buildTime: data.buildTime,
      supplyProvided: data.supplyProvided,
      isComplete,
    }));
    world.addComponent(entity, new Owner(playerId, faction));
    world.addComponent(entity, new Selectable(data.tileWidth * 20, data.tileHeight * 16));

    const buildingRadius = Math.round(Math.max(data.tileWidth, data.tileHeight) * 500 * 0.9);
    world.addComponent(entity, new Collider(buildingRadius, true));

    // Filter canProduce by faction so this building only offers faction-appropriate units
    const factionFiltered = data.canProduce.filter(unitKind => {
      const ud = UNIT_DATA[unitKind];
      return ud.faction === 'any' || ud.faction === faction;
    });

    if (factionFiltered.length > 0) {
      world.addComponent(entity, new Production(factionFiltered));
    }

    // Towers get a Combat component so they auto-attack enemies
    if (kind === 'tower' || kind === 'guard_tower') {
      world.addComponent(entity, new Combat({
        attackDamage: 4,
        armor: 0,
        attackRange: 6000,
        attackCooldown: 12,
        damageType: 'ranged',
        sightRange: 7000,
      }));
    }

    if (isComplete) {
      const health = world.getComponent(entity, Health)!;
      health.current = health.max;
    }

    return entity;
  }

  /** Spawn a resource node (gold mine, tree). */
  static createResource(
    world: World,
    type: 'gold' | 'lumber',
    pos: Point,
    amount: number,
  ): EntityId {
    const entity = world.createEntity();

    world.addComponent(entity, new Position(pos.x, pos.y));
    world.addComponent(entity, new Owner(0, 'humans'));
    world.addComponent(entity, new Selectable(20, 20));

    const resourceRadius = type === 'gold' ? 700 : 400;
    world.addComponent(entity, new Collider(resourceRadius, true));

    const maxGatherers = type === 'gold' ? 5 : 2;
    world.addComponent(entity, new ResourceSource(type, amount, maxGatherers));

    return entity;
  }
}
