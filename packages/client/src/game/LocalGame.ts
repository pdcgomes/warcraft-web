import {
  World, Position, Movement, Production, Health, Owner,
  MovementSystem, PatrolSystem, CombatSystem, ResourceGatheringSystem,
  ProductionSystem, BuildingConstructionSystem, CollisionSystem,
  DeathCleanupSystem,
  GameMap, generateStarterMap, toFixed, tileToScreen,
  PlayerResources, GameEventLog,
} from '@warcraft-web/shared';
import type { EntityId, UnitKind, FactionId } from '@warcraft-web/shared';
import { EntityFactory } from './EntityFactory.js';

const TICK_MS = 100;

/**
 * Runs a local single-player game session.
 * Creates the world, registers systems, spawns initial entities, and runs the game loop.
 */
export class LocalGame {
  readonly world: World = new World();
  gameMap!: GameMap;

  /** The player ID controlled by this client. */
  readonly localPlayerId: number = 1;
  readonly localFaction: FactionId = 'humans';

  /** World-pixel position of the local player's spawn (for initial camera). */
  spawnScreenX = 0;
  spawnScreenY = 0;

  /** Shared player resources accessible by systems and UI. */
  readonly playerResources: PlayerResources = new PlayerResources();

  /** Game event log for the chat-like message feed. */
  readonly eventLog: GameEventLog = new GameEventLog();

  private movementSystem!: MovementSystem;
  private patrolSystem!: PatrolSystem;
  private collisionSystem!: CollisionSystem;
  private combatSystem!: CombatSystem;
  private resourceSystem!: ResourceGatheringSystem;
  private productionSystem!: ProductionSystem;
  private buildingSystem!: BuildingConstructionSystem;
  private deathSystem!: DeathCleanupSystem;

  init(): void {
    const generated = generateStarterMap(64, 64);
    this.gameMap = generated.map;

    // Register systems
    this.movementSystem = new MovementSystem();
    this.patrolSystem = new PatrolSystem();
    this.collisionSystem = new CollisionSystem();
    this.combatSystem = new CombatSystem();
    this.resourceSystem = new ResourceGatheringSystem(this.playerResources);
    this.productionSystem = new ProductionSystem();
    this.buildingSystem = new BuildingConstructionSystem();
    this.deathSystem = new DeathCleanupSystem();

    this.movementSystem.setEventLog(this.eventLog);
    this.combatSystem.setEventLog(this.eventLog);
    this.productionSystem.setEventLog(this.eventLog);
    this.deathSystem.setEventLog(this.eventLog);

    this.world.addSystem(this.movementSystem);
    this.world.addSystem(this.patrolSystem);
    this.world.addSystem(this.collisionSystem);
    this.world.addSystem(this.combatSystem);
    this.world.addSystem(this.resourceSystem);
    this.world.addSystem(this.productionSystem);
    this.world.addSystem(this.buildingSystem);
    this.world.addSystem(this.deathSystem);

    // Set up production callback
    this.productionSystem.setSpawnCallback((world, unitKind, spawnX, spawnY, playerId, faction) => {
      return EntityFactory.createUnit(world, unitKind, spawnX, spawnY, playerId, faction);
    });

    // Set initial resources
    this.playerResources.get(1).gold = 400;
    this.playerResources.get(1).lumber = 200;
    this.playerResources.get(2).gold = 400;
    this.playerResources.get(2).lumber = 200;

    // Spawn resource nodes
    for (const spawn of generated.resourceSpawns) {
      EntityFactory.createResource(
        this.world,
        spawn.type,
        toFixed(spawn.x),
        toFixed(spawn.y),
        spawn.amount,
      );
    }

    // Spawn Player 1 (Humans) - top-left
    const p1 = generated.playerSpawns[0];
    EntityFactory.createBuilding(
      this.world, 'town_hall',
      toFixed(p1.x), toFixed(p1.y),
      1, 'humans', true,
    );
    // Workers south of town hall (away from gold mines to the east)
    EntityFactory.createUnit(this.world, 'worker', toFixed(p1.x + 1), toFixed(p1.y + 4), 1, 'humans');
    EntityFactory.createUnit(this.world, 'worker', toFixed(p1.x + 2), toFixed(p1.y + 4), 1, 'humans');
    EntityFactory.createUnit(this.world, 'worker', toFixed(p1.x + 3), toFixed(p1.y + 4), 1, 'humans');
    // Footmen west of town hall
    EntityFactory.createUnit(this.world, 'footman', toFixed(p1.x - 2), toFixed(p1.y + 1), 1, 'humans');
    EntityFactory.createUnit(this.world, 'footman', toFixed(p1.x - 2), toFixed(p1.y + 2), 1, 'humans');

    // Spawn Player 2 (Orcs) - bottom-right
    const p2 = generated.playerSpawns[1];
    EntityFactory.createBuilding(
      this.world, 'great_hall',
      toFixed(p2.x), toFixed(p2.y),
      2, 'orcs', true,
    );
    EntityFactory.createUnit(this.world, 'worker', toFixed(p2.x + 1), toFixed(p2.y - 2), 2, 'orcs');
    EntityFactory.createUnit(this.world, 'worker', toFixed(p2.x + 2), toFixed(p2.y - 2), 2, 'orcs');
    EntityFactory.createUnit(this.world, 'worker', toFixed(p2.x + 3), toFixed(p2.y - 2), 2, 'orcs');
    EntityFactory.createUnit(this.world, 'grunt', toFixed(p2.x + 4), toFixed(p2.y + 1), 2, 'orcs');
    EntityFactory.createUnit(this.world, 'grunt', toFixed(p2.x + 4), toFixed(p2.y + 2), 2, 'orcs');

    // Compute spawn screen position for camera centering
    const spawnScreen = tileToScreen(p1.x + 1, p1.y + 1);
    this.spawnScreenX = spawnScreen.x;
    this.spawnScreenY = spawnScreen.y;
  }

  /** Advance one simulation tick. */
  tick(): void {
    this.world.step(TICK_MS);
  }

  /** Queue unit production at a building. */
  queueProduction(buildingEntity: EntityId, unitKind: UnitKind): void {
    const production = this.world.getComponent(buildingEntity, Production);
    if (!production) return;

    if (production.queue.length >= production.maxQueueSize) return;
    if (!production.canProduce.includes(unitKind)) return;

    const time = EntityFactory.getProductionTime(unitKind);
    production.queue.push({
      unitKind,
      ticksRemaining: time,
      totalTicks: time,
    });
  }

  /** Get player resources from the shared PlayerResources. */
  getPlayerResources(playerId: number): { gold: number; lumber: number } {
    return this.playerResources.get(playerId);
  }

  /** Whether the given entity belongs to the local player. */
  isOwnedByLocal(entityId: EntityId): boolean {
    const owner = this.world.getComponent(entityId, Owner);
    return owner !== undefined && owner.playerId === this.localPlayerId;
  }
}
