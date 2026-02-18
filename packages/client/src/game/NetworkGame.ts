import {
  World, Position, Movement, Production, Health, Owner, Building, Combat,
  MovementSystem, PatrolSystem, CombatSystem, ResourceGatheringSystem,
  ProductionSystem, BuildingConstructionSystem, CollisionSystem,
  RepairSystem, DeathCleanupSystem,
  GameMap, generateStarterMap, toFixed, tileToScreen,
  PlayerResources, GameEventLog, FogOfWar,
  UNIT_DATA, BUILDING_DATA, meetsPrerequisites,
} from '@warcraft-web/shared';
import type {
  EntityId, UnitKind, FactionId, BuildingKind, Point,
  ServerMessage, ServerTickMessage, ProtocolGameCommand,
} from '@warcraft-web/shared';
import { EntityFactory } from './EntityFactory.js';

const TICK_MS = 100;

/**
 * Multiplayer game session that communicates with a server via WebSocket.
 * Instead of self-ticking, it receives tick messages from the server
 * and applies commands from all players deterministically.
 */
export class NetworkGame {
  readonly world: World = new World();
  gameMap!: GameMap;

  readonly localPlayerId: number;
  readonly localFaction: FactionId;

  spawnScreen: Point = { x: 0, y: 0 };
  readonly playerResources: PlayerResources = new PlayerResources();
  readonly eventLog: GameEventLog = new GameEventLog();
  fog!: FogOfWar;

  private readonly ws: WebSocket;

  /** Pending commands for the current tick (queued by local input, sent to server). */
  private pendingCommands: ProtocolGameCommand[] = [];

  private movementSystem!: MovementSystem;
  private patrolSystem!: PatrolSystem;
  private collisionSystem!: CollisionSystem;
  private combatSystem!: CombatSystem;
  private resourceSystem!: ResourceGatheringSystem;
  private productionSystem!: ProductionSystem;
  private buildingSystem!: BuildingConstructionSystem;
  private repairSystem!: RepairSystem;
  private deathSystem!: DeathCleanupSystem;

  /** Fires when a server tick message is processed (so the game loop can render). */
  onTick: (() => void) | null = null;

  constructor(
    playerId: number,
    faction: FactionId,
    ws: WebSocket,
  ) {
    this.localPlayerId = playerId;
    this.localFaction = faction;
    this.ws = ws;

    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data) as ServerMessage;
      if (msg.type === 'tick') {
        this.applyServerTick(msg);
      } else if (msg.type === 'desync') {
        console.error(`DESYNC at tick ${msg.tick}! Expected checksum: ${msg.expectedChecksum}`);
      }
    });
  }

  init(): void {
    const generated = generateStarterMap(64, 64);
    this.gameMap = generated.map;

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

    this.productionSystem.setSpawnCallback((world, unitKind, spawnPos, playerId, faction) => {
      const s = this.playerResources.getSupply(playerId);
      const data = UNIT_DATA[unitKind];
      s.used += data.supply;
      return EntityFactory.createUnit(world, unitKind, spawnPos, playerId, faction);
    });

    this.playerResources.get(1).gold = 400;
    this.playerResources.get(1).lumber = 200;
    this.playerResources.get(2).gold = 400;
    this.playerResources.get(2).lumber = 200;

    for (const spawn of generated.resourceSpawns) {
      EntityFactory.createResource(
        this.world,
        spawn.type,
        { x: toFixed(spawn.pos.x), y: toFixed(spawn.pos.y) },
        spawn.amount,
      );
    }

    // Player 1 (Humans)
    const p1 = generated.playerSpawns[0].pos;
    EntityFactory.createBuilding(this.world, 'town_hall', { x: toFixed(p1.x), y: toFixed(p1.y) }, 1, 'humans', true);
    EntityFactory.createUnit(this.world, 'worker', { x: toFixed(p1.x + 1), y: toFixed(p1.y + 4) }, 1, 'humans');
    EntityFactory.createUnit(this.world, 'worker', { x: toFixed(p1.x + 2), y: toFixed(p1.y + 4) }, 1, 'humans');
    EntityFactory.createUnit(this.world, 'worker', { x: toFixed(p1.x + 3), y: toFixed(p1.y + 4) }, 1, 'humans');
    EntityFactory.createUnit(this.world, 'footman', { x: toFixed(p1.x - 2), y: toFixed(p1.y + 1) }, 1, 'humans');
    EntityFactory.createUnit(this.world, 'footman', { x: toFixed(p1.x - 2), y: toFixed(p1.y + 2) }, 1, 'humans');

    // Player 2 (Orcs)
    const p2 = generated.playerSpawns[1].pos;
    EntityFactory.createBuilding(this.world, 'great_hall', { x: toFixed(p2.x), y: toFixed(p2.y) }, 2, 'orcs', true);
    EntityFactory.createUnit(this.world, 'worker', { x: toFixed(p2.x + 1), y: toFixed(p2.y - 2) }, 2, 'orcs');
    EntityFactory.createUnit(this.world, 'worker', { x: toFixed(p2.x + 2), y: toFixed(p2.y - 2) }, 2, 'orcs');
    EntityFactory.createUnit(this.world, 'worker', { x: toFixed(p2.x + 3), y: toFixed(p2.y - 2) }, 2, 'orcs');
    EntityFactory.createUnit(this.world, 'grunt', { x: toFixed(p2.x + 4), y: toFixed(p2.y + 1) }, 2, 'orcs');
    EntityFactory.createUnit(this.world, 'grunt', { x: toFixed(p2.x + 4), y: toFixed(p2.y + 2) }, 2, 'orcs');

    // Center camera on own player spawn
    const spawnIdx = this.localPlayerId === 1 ? 0 : 1;
    const sp = generated.playerSpawns[spawnIdx].pos;
    this.spawnScreen = tileToScreen({ x: sp.x + 1, y: sp.y + 1 });

    this.fog = new FogOfWar(this.gameMap.width, this.gameMap.height);
    this.recalculateSupply();
    this.updateFog();
  }

  /** Queue a command to be sent to the server on the next tick. */
  queueCommand(cmd: ProtocolGameCommand): void {
    this.pendingCommands.push(cmd);
  }

  /** Send pending commands to the server and clear. */
  flushCommands(): void {
    if (this.pendingCommands.length > 0 && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'command',
        tick: this.world.tick,
        commands: this.pendingCommands,
      }));
      this.pendingCommands = [];
    }
  }

  private applyServerTick(msg: ServerTickMessage): void {
    // Apply all player commands for this tick
    // (In a full implementation, commands would drive the simulation deterministically.)
    // For now, the game advances by one tick and players rely on local state.
    this.world.step(TICK_MS);
    this.updateFog();
    this.onTick?.();
  }

  /** Queue unit production (same checks as LocalGame). */
  queueProduction(buildingEntity: EntityId, unitKind: UnitKind): void {
    const production = this.world.getComponent(buildingEntity, Production);
    if (!production) return;
    if (production.queue.length >= production.maxQueueSize) return;
    if (!production.canProduce.includes(unitKind)) return;

    const owner = this.world.getComponent(buildingEntity, Owner);
    if (!owner) return;

    const unitData = UNIT_DATA[unitKind];
    const ownedKinds = this.getOwnedBuildingKinds(owner.playerId);
    if (!meetsPrerequisites(unitData.requires, ownedKinds)) return;
    if (!this.playerResources.canAfford(owner.playerId, unitData.cost)) return;
    if (!this.playerResources.hasSupply(owner.playerId, unitData.supply)) return;

    this.playerResources.deduct(owner.playerId, unitData.cost);

    production.queue.push({
      unitKind,
      ticksRemaining: unitData.trainTime,
      totalTicks: unitData.trainTime,
    });
  }

  placeBuilding(kind: BuildingKind, tileX: number, tileY: number): EntityId {
    const data = BUILDING_DATA[kind];
    for (let dy = 0; dy < data.tileHeight; dy++) {
      for (let dx = 0; dx < data.tileWidth; dx++) {
        this.gameMap.setTerrain({ x: tileX + dx, y: tileY + dy }, 4);
      }
    }
    const entity = EntityFactory.createBuilding(
      this.world, kind,
      { x: toFixed(tileX), y: toFixed(tileY) },
      this.localPlayerId, this.localFaction, false,
    );
    this.recalculateSupply();
    return entity;
  }

  getPlayerResources(playerId: number): { gold: number; lumber: number } {
    return this.playerResources.get(playerId);
  }

  isOwnedByLocal(entityId: EntityId): boolean {
    const owner = this.world.getComponent(entityId, Owner);
    return owner !== undefined && owner.playerId === this.localPlayerId;
  }

  getOwnedBuildingKinds(playerId: number): Set<BuildingKind> {
    const entities = this.world.query(Building.type, Owner.type);
    const kinds = new Set<BuildingKind>();
    for (const eid of entities) {
      const building = this.world.getComponent(eid, Building)!;
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId === playerId && building.isComplete) kinds.add(building.kind);
    }
    return kinds;
  }

  recalculateSupply(): void {
    for (const pid of [1, 2]) {
      const s = this.playerResources.getSupply(pid);
      s.cap = 0;
      s.used = 0;
    }
    const buildings = this.world.query(Building.type, Owner.type);
    for (const eid of buildings) {
      const building = this.world.getComponent(eid, Building)!;
      const owner = this.world.getComponent(eid, Owner)!;
      if (building.isComplete && owner.playerId > 0) {
        this.playerResources.getSupply(owner.playerId).cap += building.supplyProvided;
      }
    }
    const units = this.world.query('UnitType', Owner.type);
    for (const eid of units) {
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId > 0) {
        this.playerResources.getSupply(owner.playerId).used += 1;
      }
    }
  }

  private updateFog(): void {
    this.fog.clearVisible();
    const entities = this.world.query(Position.type, Owner.type);
    for (const eid of entities) {
      const owner = this.world.getComponent(eid, Owner)!;
      if (owner.playerId !== this.localPlayerId) continue;
      const pos = this.world.getComponent(eid, Position)!;
      const combat = this.world.getComponent(eid, Combat);
      const sightRange = combat ? combat.sightRange : 4000;
      this.fog.revealCircle(pos.tileX, pos.tileY, sightRange / 1000);
    }
  }
}
