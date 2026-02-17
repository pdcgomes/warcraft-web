import { TerrainType, TERRAIN_DATA } from './Terrain.js';

/**
 * A 2D tile grid representing the game world.
 * Each cell stores a TerrainType.
 */
export class GameMap {
  readonly width: number;
  readonly height: number;
  private tiles: TerrainType[];

  constructor(width: number, height: number, fill: TerrainType = TerrainType.Grass) {
    this.width = width;
    this.height = height;
    this.tiles = new Array(width * height).fill(fill);
  }

  /** Check if tile coordinates are within bounds. */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Get terrain at tile (x, y). Returns Stone for out-of-bounds. */
  getTerrain(x: number, y: number): TerrainType {
    if (!this.inBounds(x, y)) return TerrainType.Stone;
    return this.tiles[y * this.width + x];
  }

  /** Set terrain at tile (x, y). */
  setTerrain(x: number, y: number, terrain: TerrainType): void {
    if (!this.inBounds(x, y)) return;
    this.tiles[y * this.width + x] = terrain;
  }

  /** Whether a unit can walk on this tile. */
  isWalkable(x: number, y: number): boolean {
    const terrain = this.getTerrain(x, y);
    return TERRAIN_DATA[terrain].walkable;
  }

  /** Whether a building can be placed on this tile. */
  isBuildable(x: number, y: number): boolean {
    const terrain = this.getTerrain(x, y);
    return TERRAIN_DATA[terrain].buildable;
  }

  /**
   * Check if a rectangular area is fully walkable.
   * Used for building placement and multi-tile units.
   */
  isAreaWalkable(x: number, y: number, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.isWalkable(x + dx, y + dy)) return false;
      }
    }
    return true;
  }

  /**
   * Check if a rectangular area is fully buildable.
   */
  isAreaBuildable(x: number, y: number, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.isBuildable(x + dx, y + dy)) return false;
      }
    }
    return true;
  }

  /** Get the flat array of all tiles (for serialization/rendering). */
  getRawTiles(): readonly TerrainType[] {
    return this.tiles;
  }

  /** Create from a flat array (for deserialization). */
  static fromArray(width: number, height: number, tiles: TerrainType[]): GameMap {
    const map = new GameMap(width, height);
    for (let i = 0; i < tiles.length && i < map.tiles.length; i++) {
      map.tiles[i] = tiles[i];
    }
    return map;
  }
}
