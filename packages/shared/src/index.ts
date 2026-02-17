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

// Math
export { FP_SCALE, toFixed, toFloat, fpMul, fpDiv, distanceSquared, isqrt, fpDistance } from './math/FixedPoint.js';
export {
  TILE_WIDTH, TILE_HEIGHT, TILE_WIDTH_HALF, TILE_HEIGHT_HALF,
  tileToScreen, screenToTile, screenToTileRounded, getTileDepth,
} from './math/IsoMath.js';

// Map
export { TerrainType, TERRAIN_DATA } from './map/Terrain.js';
export type { TerrainInfo } from './map/Terrain.js';
