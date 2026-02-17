// ECS core
export { World } from './ecs/World.js';
export { System } from './ecs/System.js';
export type { Component, ComponentType, ComponentClass } from './ecs/Component.js';
export type { EntityId } from './ecs/Entity.js';
export { createEntityId, resetEntityIdCounter } from './ecs/Entity.js';

// Components
export { Position } from './components/Position.js';
export { Movement } from './components/Movement.js';
export type { PathNode } from './components/Movement.js';
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
export { GameEventLog } from './game/GameEventLog.js';
export type { GameEvent, GameEventType, EventSender } from './game/GameEventLog.js';

// Math
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
export { DeathCleanupSystem } from './systems/DeathCleanupSystem.js';

// Map
export { TerrainType, TERRAIN_DATA } from './map/Terrain.js';
export type { TerrainInfo } from './map/Terrain.js';
export { GameMap } from './map/GameMap.js';
export { generateStarterMap } from './map/MapGenerator.js';
export type { ResourceSpawn, PlayerSpawn, GeneratedMap } from './map/MapGenerator.js';
export { findPath } from './map/Pathfinding.js';

// Protocol
export type {
  ClientMessage, ClientJoinMessage, ClientReadyMessage,
  ClientCommandMessage, ClientChecksumMessage,
  ServerMessage, ServerWelcomeMessage, ServerLobbyUpdateMessage,
  ServerGameStartMessage, ServerTickMessage, ServerDesyncMessage,
  GameCommand as ProtocolGameCommand,
} from './protocol/Protocol.js';
