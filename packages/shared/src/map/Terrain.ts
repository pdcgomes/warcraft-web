/**
 * Terrain types and their properties.
 */

export enum TerrainType {
  Grass = 0,
  Dirt = 1,
  Water = 2,
  Forest = 3,
  Stone = 4,
  Sand = 5,
}

export interface TerrainInfo {
  type: TerrainType;
  name: string;
  walkable: boolean;
  buildable: boolean;
  /** Color for placeholder rendering (hex) */
  color: number;
}

export const TERRAIN_DATA: Record<TerrainType, TerrainInfo> = {
  [TerrainType.Grass]: {
    type: TerrainType.Grass,
    name: 'Grass',
    walkable: true,
    buildable: true,
    color: 0x4a7c3f,
  },
  [TerrainType.Dirt]: {
    type: TerrainType.Dirt,
    name: 'Dirt',
    walkable: true,
    buildable: true,
    color: 0x8b7355,
  },
  [TerrainType.Water]: {
    type: TerrainType.Water,
    name: 'Water',
    walkable: false,
    buildable: false,
    color: 0x2e5984,
  },
  [TerrainType.Forest]: {
    type: TerrainType.Forest,
    name: 'Forest',
    walkable: false,
    buildable: false,
    color: 0x2d5a1e,
  },
  [TerrainType.Stone]: {
    type: TerrainType.Stone,
    name: 'Stone',
    walkable: false,
    buildable: false,
    color: 0x808080,
  },
  [TerrainType.Sand]: {
    type: TerrainType.Sand,
    name: 'Sand',
    walkable: true,
    buildable: true,
    color: 0xc2b280,
  },
};
