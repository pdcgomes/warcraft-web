import type { Component } from '../ecs/Component.js';

export type BuildingKind =
  | 'town_hall' | 'great_hall'
  | 'barracks'
  | 'lumber_mill' | 'war_mill'
  | 'stable' | 'beastiary'
  | 'farm' | 'pig_farm'
  | 'tower' | 'guard_tower'
  | 'blacksmith';

export class Building implements Component {
  static readonly type = 'Building' as const;
  readonly type = Building.type;

  kind: BuildingKind;
  name: string;

  /** Size in tiles (e.g., 3x3 for town hall) */
  tileWidth: number;
  tileHeight: number;

  /** Whether construction is complete */
  isComplete: boolean;

  /** Construction progress (0 to buildTime) in ticks */
  constructionProgress: number = 0;

  /** Total ticks required to build */
  buildTime: number;

  /** Supply provided by this building (e.g., farms) */
  supplyProvided: number;

  /** Worker entity absorbed into the building during construction. */
  builderId: number | null = null;

  constructor(params: {
    kind: BuildingKind;
    name: string;
    tileWidth: number;
    tileHeight: number;
    buildTime: number;
    supplyProvided?: number;
    isComplete?: boolean;
  }) {
    this.kind = params.kind;
    this.name = params.name;
    this.tileWidth = params.tileWidth;
    this.tileHeight = params.tileHeight;
    this.buildTime = params.buildTime;
    this.supplyProvided = params.supplyProvided ?? 0;
    this.isComplete = params.isComplete ?? false;
  }

  get constructionRatio(): number {
    return this.constructionProgress / this.buildTime;
  }
}
