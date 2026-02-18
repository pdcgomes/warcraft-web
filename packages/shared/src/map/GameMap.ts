import { TerrainType, TERRAIN_DATA } from './Terrain.js';
import type { Point } from '../math/Point.js';

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
  inBounds(p: Point): boolean {
    return p.x >= 0 && p.x < this.width && p.y >= 0 && p.y < this.height;
  }

  /** Get terrain at tile position. Returns Stone for out-of-bounds. */
  getTerrain(p: Point): TerrainType {
    if (!this.inBounds(p)) return TerrainType.Stone;
    return this.tiles[p.y * this.width + p.x];
  }

  /** Set terrain at tile position. */
  setTerrain(p: Point, terrain: TerrainType): void {
    if (!this.inBounds(p)) return;
    this.tiles[p.y * this.width + p.x] = terrain;
  }

  /** Whether a unit can walk on this tile. */
  isWalkable(p: Point): boolean {
    const terrain = this.getTerrain(p);
    return TERRAIN_DATA[terrain].walkable;
  }

  /** Whether a building can be placed on this tile. */
  isBuildable(p: Point): boolean {
    const terrain = this.getTerrain(p);
    return TERRAIN_DATA[terrain].buildable;
  }

  /**
   * Check if a rectangular area is fully walkable.
   * Used for building placement and multi-tile units.
   */
  isAreaWalkable(origin: Point, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.isWalkable({ x: origin.x + dx, y: origin.y + dy })) return false;
      }
    }
    return true;
  }

  /**
   * Check if a rectangular area is fully buildable.
   */
  isAreaBuildable(origin: Point, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (!this.isBuildable({ x: origin.x + dx, y: origin.y + dy })) return false;
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
