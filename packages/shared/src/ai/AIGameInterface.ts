import type { EntityId } from '../ecs/Entity.js';
import type { BuildingKind } from '../components/Building.js';
import type { UnitKind } from '../components/UnitType.js';

export interface AIGameInterface {
  placeBuilding(kind: BuildingKind, tileX: number, tileY: number, playerId: number, faction: string): EntityId;
  queueProduction(buildingEntity: EntityId, unitKind: UnitKind): string | null;
  getOwnedBuildingKinds(playerId: number): Set<BuildingKind>;
  recalculateSupply(): void;
}
