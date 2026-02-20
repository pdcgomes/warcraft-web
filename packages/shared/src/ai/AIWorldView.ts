import type { EntityId } from '../ecs/Entity.js';
import type { World } from '../ecs/World.js';
import type { GameMap } from '../map/GameMap.js';
import type { PlayerResources } from '../game/PlayerResources.js';
import type { UnitKind } from '../components/UnitType.js';
import type { BuildingKind } from '../components/Building.js';
import type { Point } from '../math/Point.js';
import type { FactionId } from '../components/Owner.js';
import { Position } from '../components/Position.js';
import { Owner } from '../components/Owner.js';
import { UnitType } from '../components/UnitType.js';
import { Building } from '../components/Building.js';
import { Health } from '../components/Health.js';
import { Combat } from '../components/Combat.js';
import { UnitBehavior } from '../components/UnitBehavior.js';
import { ResourceCarrier } from '../components/ResourceCarrier.js';
import { ResourceSource } from '../components/ResourceSource.js';
import { UNIT_DATA } from '../data/UnitData.js';

export interface Threat {
  entityId: EntityId;
  position: Point;
  distanceToBase: number;
}

export interface AIWorldView {
  gold: number;
  lumber: number;
  supplyCap: number;
  supplyUsed: number;

  ownUnits: Map<UnitKind, EntityId[]>;
  ownBuildings: Map<BuildingKind, EntityId[]>;
  ownBuildingKinds: Set<BuildingKind>;
  idleWorkers: EntityId[];
  idleMilitary: EntityId[];
  workersGathering: { gold: number; lumber: number };

  knownEnemyUnits: EntityId[];
  knownEnemyBuildings: EntityId[];
  estimatedEnemyStrength: number;

  activeThreats: Threat[];
  baseCenter: Point;

  knownResourceNodes: EntityId[];
  unexploredRegions: Point[];

  ownMilitaryStrength: number;
  economyScore: number;
  techLevel: number;

  tick: number;
  faction: FactionId;
}

const THREAT_RADIUS = 10000;
const QUADRANT_SIZE = 16;

function unitStrength(world: World, eid: EntityId): number {
  const health = world.getComponent(eid, Health);
  const combat = world.getComponent(eid, Combat);
  if (!health || !combat) return 0;
  return (combat.totalAttack * health.current) / health.max;
}

export function buildWorldView(
  world: World,
  playerId: number,
  faction: FactionId,
  playerResources: PlayerResources,
  gameMap: GameMap,
): AIWorldView {
  const res = playerResources.get(playerId);
  const supply = playerResources.getSupply(playerId);

  const ownUnits = new Map<UnitKind, EntityId[]>();
  const ownBuildings = new Map<BuildingKind, EntityId[]>();
  const ownBuildingKinds = new Set<BuildingKind>();
  const idleWorkers: EntityId[] = [];
  const idleMilitary: EntityId[] = [];
  const workersGathering = { gold: 0, lumber: 0 };

  const knownEnemyUnits: EntityId[] = [];
  const knownEnemyBuildings: EntityId[] = [];
  let enemyStrength = 0;
  let ownStrength = 0;

  const knownResourceNodes: EntityId[] = [];
  let baseCenter: Point = { x: 0, y: 0 };
  let baseCenterFound = false;

  const allEntities = world.query(Position.type, Owner.type);

  for (const eid of allEntities) {
    const owner = world.getComponent(eid, Owner)!;
    const pos = world.getComponent(eid, Position)!;

    if (owner.playerId === playerId) {
      const unitType = world.getComponent(eid, UnitType);
      const building = world.getComponent(eid, Building);

      if (unitType) {
        const list = ownUnits.get(unitType.kind) ?? [];
        list.push(eid);
        ownUnits.set(unitType.kind, list);

        const behavior = world.getComponent(eid, UnitBehavior);
        const data = UNIT_DATA[unitType.kind];

        if (data.isWorker) {
          if (behavior && behavior.state === 'idle') {
            idleWorkers.push(eid);
          }
          const carrier = world.getComponent(eid, ResourceCarrier);
          if (carrier && carrier.state !== 'idle') {
            if (carrier.carryingType === 'gold' || (carrier.gatherTarget !== null && isGoldSource(world, carrier.gatherTarget))) {
              workersGathering.gold++;
            } else {
              workersGathering.lumber++;
            }
          }
        } else {
          ownStrength += unitStrength(world, eid);
          if (behavior && behavior.state === 'idle') {
            idleMilitary.push(eid);
          }
        }
      }

      if (building) {
        const list = ownBuildings.get(building.kind) ?? [];
        list.push(eid);
        ownBuildings.set(building.kind, list);
        if (building.isComplete) {
          ownBuildingKinds.add(building.kind);
        }
        if (!baseCenterFound && (building.kind === 'town_hall' || building.kind === 'great_hall')) {
          baseCenter = pos.toPoint();
          baseCenterFound = true;
        }
      }
    } else if (owner.playerId > 0) {
      const unitType = world.getComponent(eid, UnitType);
      const building = world.getComponent(eid, Building);

      if (unitType) {
        knownEnemyUnits.push(eid);
        enemyStrength += unitStrength(world, eid);
      }
      if (building) {
        knownEnemyBuildings.push(eid);
      }
    } else {
      const resource = world.getComponent(eid, ResourceSource);
      if (resource && !resource.isDepleted) {
        knownResourceNodes.push(eid);
      }
    }
  }

  const activeThreats: Threat[] = [];
  const r2 = THREAT_RADIUS * THREAT_RADIUS;
  for (const eid of knownEnemyUnits) {
    const pos = world.getComponent(eid, Position)!;
    const dx = pos.x - baseCenter.x;
    const dy = pos.y - baseCenter.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= r2) {
      activeThreats.push({
        entityId: eid,
        position: pos.toPoint(),
        distanceToBase: Math.sqrt(dist2),
      });
    }
  }

  const unexploredRegions: Point[] = [];
  for (let qy = 0; qy < gameMap.height; qy += QUADRANT_SIZE) {
    for (let qx = 0; qx < gameMap.width; qx += QUADRANT_SIZE) {
      unexploredRegions.push({ x: qx + Math.floor(QUADRANT_SIZE / 2), y: qy + Math.floor(QUADRANT_SIZE / 2) });
    }
  }

  let techLevel = 0;
  if (ownBuildingKinds.has('barracks')) techLevel = 1;
  if (ownBuildingKinds.has('lumber_mill') || ownBuildingKinds.has('war_mill')) techLevel = 2;
  if (ownBuildingKinds.has('blacksmith')) techLevel = 3;
  if (ownBuildingKinds.has('stable') || ownBuildingKinds.has('beastiary')) techLevel = 4;

  const totalWorkers = countAll(ownUnits, 'worker');
  const economyScore = (workersGathering.gold + workersGathering.lumber) / Math.max(1, totalWorkers);

  return {
    gold: res.gold,
    lumber: res.lumber,
    supplyCap: supply.cap,
    supplyUsed: supply.used,
    ownUnits,
    ownBuildings,
    ownBuildingKinds,
    idleWorkers,
    idleMilitary,
    workersGathering,
    knownEnemyUnits,
    knownEnemyBuildings,
    estimatedEnemyStrength: enemyStrength,
    activeThreats,
    baseCenter,
    knownResourceNodes,
    unexploredRegions,
    ownMilitaryStrength: ownStrength,
    economyScore,
    techLevel,
    tick: world.tick,
    faction,
  };
}

function isGoldSource(world: World, eid: EntityId): boolean {
  const rs = world.getComponent(eid, ResourceSource);
  return rs !== undefined && rs.resourceType === 'gold';
}

function countAll(map: Map<UnitKind, EntityId[]>, kind: UnitKind): number {
  return map.get(kind)?.length ?? 0;
}
