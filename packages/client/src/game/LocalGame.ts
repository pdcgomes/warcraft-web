import {
  World, Position, Movement, Production, Health, Owner, Building,
  MovementSystem, PatrolSystem, CombatSystem, ResourceGatheringSystem,
  ProductionSystem, BuildingConstructionSystem, CollisionSystem,
  RepairSystem, DeathCleanupSystem,
  GameMap, toFixed, tileToScreen,
  PlayerResources, GameEventLog, FogOfWar,
  UNIT_DATA, BUILDING_DATA, meetsPrerequisites,
  Combat,
  AISystem, AI_PRESETS,
  LevelGenerator, createDefaultConfig,
} from '@warcraft-web/shared';
import type { EntityId, UnitKind, FactionId, BuildingKind, Point, AIGameInterface } from '@warcraft-web/shared';
import { EntityFactory } from './EntityFactory.js';

const TICK_MS = 100;

/**
 * Runs a local single-player game session.
 * Creates the world, registers systems, spawns initial entities, and runs the game loop.
 */
export class LocalGame implements AIGameInterface {
  readonly world: World = new World();
  gameMap!: GameMap;

  /** The player ID controlled by this client. */
  readonly localPlayerId: number = 1;
  localFaction: FactionId = 'humans';

  /** World-pixel position of the local player's spawn (for initial camera). */
  spawnScreen: Point = { x: 0, y: 0 };

  /** Shared player resources accessible by systems and UI. */
  readonly playerResources: PlayerResources = new PlayerResources();

  /** Game event log for the chat-like message feed. */
  readonly eventLog: GameEventLog = new GameEventLog();

  /** Fog of war for the local player. */
  fog!: FogOfWar;

  /** Game-over state: null while playing, or the winning player's ID. */
  winner: number | null = null;

  /** When true the simulation is suspended (menu open, etc.). */
  paused = false;

  aiSystem!: AISystem;

  private movementSystem!: MovementSystem;
  private patrolSystem!: PatrolSystem;
  private collisionSystem!: CollisionSystem;
  private combatSystem!: CombatSystem;
  private resourceSystem!: ResourceGatheringSystem;
  private productionSystem!: ProductionSystem;
  private buildingSystem!: BuildingConstructionSystem;
  private repairSystem!: RepairSystem;
  private deathSystem!: DeathCleanupSystem;

  init(faction: FactionId = 'humans'): void {
    this.localFaction = faction;
    const opponentFaction: FactionId = faction === 'humans' ? 'orcs' : 'humans';

    // --- Level generation ---
    const levelConfig = createDefaultConfig(faction, opponentFaction);
    const generator = new LevelGenerator();
    const level = generator.generate(levelConfig);
    console.log(`[Level] seed=${level.seed}, spawns=${level.playerSpawns.length}, resources=${level.resourceSpawns.length}, entities=${level.entitySpawns.length}`);

    this.gameMap = level.map;

    // --- Register systems ---
    this.movementSystem = new MovementSystem();
    this.patrolSystem = new PatrolSystem();
    this.collisionSystem = new CollisionSystem();
    this.combatSystem = new CombatSystem();
    this.resourceSystem = new ResourceGatheringSystem(this.playerResources);
    this.productionSystem = new ProductionSystem();
    this.buildingSystem = new BuildingConstructionSystem();
    this.repairSystem = new RepairSystem(this.playerResources);
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
    this.world.addSystem(this.repairSystem);
    this.world.addSystem(this.deathSystem);

    this.productionSystem.setSpawnCallback((world, unitKind, spawnPos, playerId, fac) => {
      const s = this.playerResources.getSupply(playerId);
      const data = UNIT_DATA[unitKind];
      s.used += data.supply;
      return EntityFactory.createUnit(world, unitKind, spawnPos, playerId, fac);
    });

    // --- Apply starting resources from level ---
    for (const sr of level.startingResources) {
      const res = this.playerResources.get(sr.playerId);
      res.gold = sr.gold;
      res.lumber = sr.lumber;
    }

    // --- Spawn resource nodes ---
    for (const spawn of level.resourceSpawns) {
      EntityFactory.createResource(
        this.world,
        spawn.type,
        { x: toFixed(spawn.pos.x), y: toFixed(spawn.pos.y) },
        spawn.amount,
      );
    }

    // --- Spawn starting entities (buildings + units) ---
    for (const es of level.entitySpawns) {
      if (es.entityType === 'building') {
        EntityFactory.createBuilding(
          this.world,
          es.kind as BuildingKind,
          { x: toFixed(es.pos.x), y: toFixed(es.pos.y) },
          es.playerId, es.faction, true,
        );
      } else {
        EntityFactory.createUnit(
          this.world,
          es.kind as UnitKind,
          { x: toFixed(es.pos.x), y: toFixed(es.pos.y) },
          es.playerId, es.faction,
        );
      }
    }

    // --- Camera and fog ---
    const p1Spawn = level.playerSpawns.find(s => s.playerId === this.localPlayerId);
    const camPos = p1Spawn ? p1Spawn.pos : { x: 3, y: 3 };
    this.spawnScreen = tileToScreen({ x: camPos.x + 1, y: camPos.y + 1 });

    this.fog = new FogOfWar(this.gameMap.width, this.gameMap.height);

    this.recalculateSupply();
    this.updateFog();

    // --- AI ---
    this.aiSystem = new AISystem(this.gameMap, this.playerResources, this);
    this.world.addSystem(this.aiSystem);
    const presetKeys = Object.keys(AI_PRESETS);
    const aiPreset = AI_PRESETS[presetKeys[Math.floor(Math.random() * presetKeys.length)]];
    console.log(`[AI] Personality: ${aiPreset.name}`);
    this.aiSystem.addPlayer(2, opponentFaction, aiPreset);
  }

  /** Advance one simulation tick. */
  tick(): void {
    if (this.paused || this.winner !== null) return;
    this.world.step(TICK_MS);
    this.updateFog();
    this.checkVictory();
  }

  /** Check if a player has lost all buildings. */
  private checkVictory(): void {
    const buildings = this.world.query(Building.type, Owner.type);
    const playerHasBuildings = new Set<number>();

    for (const eid of buildings) {
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId > 0) {
        playerHasBuildings.add(owner.playerId);
      }
    }

    if (!playerHasBuildings.has(1) && playerHasBuildings.has(2)) {
      this.winner = 2;
    } else if (!playerHasBuildings.has(2) && playerHasBuildings.has(1)) {
      this.winner = 1;
    }
  }

  /** Update fog of war visibility based on owned entities' sight ranges. */
  private updateFog(): void {
    this.fog.clearVisible();

    const entities = this.world.query(Position.type, Owner.type);
    for (const eid of entities) {
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId !== this.localPlayerId) continue;

      const pos = this.world.getComponent(eid, Position)!;
      const combat = this.world.getComponent(eid, Combat);

      const sightRange = combat ? combat.sightRange : 4000;
      const radiusTiles = sightRange / 1000;

      this.fog.revealCircle(pos.tileX, pos.tileY, radiusTiles);
    }
  }

  /** Queue unit production at a building. Returns a failure reason string, or null on success. */
  queueProduction(buildingEntity: EntityId, unitKind: UnitKind): string | null {
    const production = this.world.getComponent(buildingEntity, Production);
    if (!production) return 'No production capability';

    if (production.queue.length >= production.maxQueueSize) return 'Queue is full';
    if (!production.canProduce.includes(unitKind)) return 'Cannot produce this unit';

    const owner = this.world.getComponent(buildingEntity, Owner);
    if (!owner) return null;

    const unitData = UNIT_DATA[unitKind];

    const ownedKinds = this.getOwnedBuildingKinds(owner.playerId);
    if (!meetsPrerequisites(unitData.requires, ownedKinds)) return 'Missing prerequisite buildings';

    if (!this.playerResources.canAfford(owner.playerId, unitData.cost)) return 'Not enough resources';

    if (!this.playerResources.hasSupply(owner.playerId, unitData.supply)) return 'Not enough supply — build farms';

    this.playerResources.deduct(owner.playerId, unitData.cost);

    production.queue.push({
      unitKind,
      ticksRemaining: unitData.trainTime,
      totalTicks: unitData.trainTime,
    });
    return null;
  }

  /** Cancel the last item in a building's production queue and refund its cost. */
  cancelProduction(buildingEntity: EntityId): void {
    const production = this.world.getComponent(buildingEntity, Production);
    if (!production || production.queue.length === 0) return;

    const owner = this.world.getComponent(buildingEntity, Owner);
    if (!owner) return;

    const item = production.queue.pop()!;
    const unitData = UNIT_DATA[item.unitKind];
    this.playerResources.refund(owner.playerId, unitData.cost);
  }

  /** Place a new building on the map (incomplete, needs worker construction). */
  placeBuilding(kind: BuildingKind, tileX: number, tileY: number, playerId?: number, faction?: string): EntityId {
    const pid = playerId ?? this.localPlayerId;
    const fac = (faction ?? this.localFaction) as FactionId;
    const data = BUILDING_DATA[kind];

    for (let dy = 0; dy < data.tileHeight; dy++) {
      for (let dx = 0; dx < data.tileWidth; dx++) {
        this.gameMap.setTerrain({ x: tileX + dx, y: tileY + dy }, 4 /* TerrainType.Stone */);
      }
    }

    const entity = EntityFactory.createBuilding(
      this.world, kind,
      { x: toFixed(tileX), y: toFixed(tileY) },
      pid, fac,
      false,
    );

    this.recalculateSupply();
    return entity;
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

  /** Get the set of completed building kinds owned by a player. */
  getOwnedBuildingKinds(playerId: number): Set<BuildingKind> {
    const entities = this.world.query(Building.type, Owner.type);
    const kinds = new Set<BuildingKind>();
    for (const eid of entities) {
      const building = this.world.getComponent(eid, Building)!;
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId === playerId && building.isComplete) {
        kinds.add(building.kind);
      }
    }
    return kinds;
  }

  /** Recalculate supply cap and used for all players based on current world state. */
  recalculateSupply(): void {
    for (const pid of [1, 2]) {
      const s = this.playerResources.getSupply(pid);
      s.cap = 0;
      s.used = 0;
    }

    // Sum supply provided by all complete buildings
    const buildings = this.world.query(Building.type, Owner.type);
    for (const eid of buildings) {
      const building = this.world.getComponent(eid, Building)!;
      const owner = this.world.getComponent(eid, Owner)!;
      if (building.isComplete && owner.playerId > 0) {
        const s = this.playerResources.getSupply(owner.playerId);
        s.cap += building.supplyProvided;
      }
    }

    // Count supply used by all units
    const units = this.world.query('UnitType', Owner.type);
    for (const eid of units) {
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId > 0) {
        const s = this.playerResources.getSupply(owner.playerId);
        s.used += 1;
      }
    }
  }
}
