// ECS core
export { World } from './ecs/World.js';
export { System } from './ecs/System.js';
export type { Component, ComponentType, ComponentClass } from './ecs/Component.js';
export type { EntityId } from './ecs/Entity.js';
export { createEntityId, resetEntityIdCounter } from './ecs/Entity.js';

// Components
export { Position } from './components/Position.js';
export { Movement } from './components/Movement.js';
export { Health } from './components/Health.js';
export { Combat } from './components/Combat.js';
export type { DamageType } from './components/Combat.js';
export { Owner } from './components/Owner.js';
export type { PlayerId, FactionId } from './components/Owner.js';
export { UnitType } from './components/UnitType.js';
export type { UnitKind } from './components/UnitType.js';
export { Building } from './components/Building.js';
export type { BuildingKind } from './components/Building.js';
export { Selectable } from './components/Selectable.js';
export { ResourceCarrier } from './components/ResourceCarrier.js';
export type { ResourceType } from './components/ResourceCarrier.js';
export { ResourceSource } from './components/ResourceSource.js';
export { Production } from './components/Production.js';
export type { ProductionQueueItem } from './components/Production.js';
export { UnitBehavior } from './components/UnitBehavior.js';
export type { BehaviorState } from './components/UnitBehavior.js';
export { Collider } from './components/Collider.js';

// Game data
export { PlayerResources } from './game/PlayerResources.js';
export { ORDER_DEFINITIONS, UNIT_ORDERS, getAvailableOrders } from './game/Orders.js';
export type { OrderId, OrderTargeting, OrderDefinition } from './game/Orders.js';
export { GameEventLog, factionSender } from './game/GameEventLog.js';
export type { GameEvent, GameEventType, EventSender } from './game/GameEventLog.js';
export { FogOfWar } from './game/FogOfWar.js';

// Data tables
export { UNIT_DATA, getUnitDisplayName, meetsPrerequisites, getTrainableUnits } from './data/UnitData.js';
export type { ResourceCost, UnitDataEntry } from './data/UnitData.js';
export { BUILDING_DATA, getBuildableBuildings } from './data/BuildingData.js';
export type { BuildingDataEntry } from './data/BuildingData.js';

// Math
export type { Point } from './math/Point.js';
export { point, ZERO, pointAdd, pointSub, pointScale, pointEquals, pointDistSq, pointDist } from './math/Point.js';
export { FP_SCALE, toFixed, toFloat, fpMul, fpDiv, distanceSquared, isqrt, fpDistance } from './math/FixedPoint.js';
export {
  TILE_WIDTH, TILE_HEIGHT, TILE_WIDTH_HALF, TILE_HEIGHT_HALF,
  tileToScreen, screenToTile, screenToTileRounded, getTileDepth,
} from './math/IsoMath.js';

// Systems
export { MovementSystem } from './systems/MovementSystem.js';
export { CombatSystem } from './systems/CombatSystem.js';
export { ResourceGatheringSystem } from './systems/ResourceGatheringSystem.js';
export { ProductionSystem } from './systems/ProductionSystem.js';
export type { UnitSpawnCallback } from './systems/ProductionSystem.js';
export { BuildingConstructionSystem } from './systems/BuildingConstructionSystem.js';
export { PatrolSystem } from './systems/PatrolSystem.js';
export { CollisionSystem } from './systems/CollisionSystem.js';
export { RepairSystem } from './systems/RepairSystem.js';
export { DeathCleanupSystem } from './systems/DeathCleanupSystem.js';

// AI
export { AISystem } from './ai/AISystem.js';
export { AIController } from './ai/AIController.js';
export { AIRandom } from './ai/AIRandom.js';
export { CommandDispatcher } from './ai/CommandDispatcher.js';
export { buildWorldView } from './ai/AIWorldView.js';
export type { AIWorldView, Threat } from './ai/AIWorldView.js';
export type { AIPersonality } from './ai/AIPersonality.js';
export { AI_PRESETS, domainWeight } from './ai/AIPersonality.js';
export type { AIGameInterface } from './ai/AIGameInterface.js';
export type { Advisor, Proposal } from './ai/advisors/Advisor.js';
export type { Task, TaskContext } from './ai/tasks/Task.js';
export type { AIDebugSnapshot, ProposalDebugEntry, AdvisorDebugEntry, TaskDebugEntry } from './ai/AIDebugState.js';
export { createDefaultAIDebugSnapshot } from './ai/AIDebugState.js';

// Map
export { TerrainType, TERRAIN_DATA } from './map/Terrain.js';
export type { TerrainInfo } from './map/Terrain.js';
export { GameMap } from './map/GameMap.js';
export { generateStarterMap } from './map/MapGenerator.js';
export type { ResourceSpawn as LegacyResourceSpawn, PlayerSpawn as LegacyPlayerSpawn, GeneratedMap } from './map/MapGenerator.js';
export { findPath } from './map/Pathfinding.js';

// Level generation
export { LevelGenerator } from './map/LevelGenerator.js';
export type { GeneratedLevel } from './map/LevelGenerator.js';
export { SeededRng } from './map/SeededRng.js';
export { createDefaultConfig, resolveMapDimensions, MAP_SIZE_PRESETS } from './map/LevelConfig.js';
export type { LevelConfig, PlayerConfig, MapSize } from './map/LevelConfig.js';
export { TerrainPass } from './map/TerrainPass.js';
export { FactionPass } from './map/FactionPass.js';
export type { PlayerSpawn } from './map/FactionPass.js';
export { ResourcePass } from './map/ResourcePass.js';
export type { ResourceSpawn } from './map/ResourcePass.js';
export { StartingForcePass } from './map/StartingForcePass.js';
export type { EntitySpawn, StartingResources } from './map/StartingForcePass.js';

// Protocol
export type {
  ClientMessage, ClientJoinMessage, ClientReadyMessage,
  ClientCommandMessage, ClientChecksumMessage,
  ServerMessage, ServerWelcomeMessage, ServerLobbyUpdateMessage,
  ServerGameStartMessage, ServerTickMessage, ServerDesyncMessage,
  GameCommand as ProtocolGameCommand,
} from './protocol/Protocol.js';
