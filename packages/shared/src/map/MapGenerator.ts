import { GameMap } from './GameMap.js';
import { TerrainType } from './Terrain.js';
import type { Point } from '../math/Point.js';

/**
 * Generates a starter map for development and gameplay.
 * Creates a symmetric 2-player map with resources.
 */

export interface ResourceSpawn {
  pos: Point;
  type: 'gold' | 'lumber';
  amount: number;
}

export interface PlayerSpawn {
  pos: Point;
}

export interface GeneratedMap {
  map: GameMap;
  playerSpawns: PlayerSpawn[];
  resourceSpawns: ResourceSpawn[];
}

/**
 * Generate a simple symmetric starter map.
 * Layout: two player bases in opposite corners, gold mines nearby,
 * forests scattered around, a lake in the center.
 */
export function generateStarterMap(width: number = 64, height: number = 64): GeneratedMap {
  const map = new GameMap(width, height, TerrainType.Grass);
  const resourceSpawns: ResourceSpawn[] = [];

  // Add dirt paths from corners toward center
  for (let i = 0; i < width; i++) {
    const cx = Math.floor(width / 2);

    // Diagonal paths
    if (i < cx) {
      setArea(map, { x: i, y: i }, 2, 2, TerrainType.Dirt);
      setArea(map, { x: width - 1 - i, y: height - 1 - i }, 2, 2, TerrainType.Dirt);
    }
  }

  // Central lake
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dy * dy <= 20) {
        map.setTerrain({ x: cx + dx, y: cy + dy }, TerrainType.Water);
      }
    }
  }

  // Sand beaches around lake
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const dist = dx * dx + dy * dy;
      if (dist > 20 && dist <= 36) {
        const tp = { x: cx + dx, y: cy + dy };
        if (map.getTerrain(tp) === TerrainType.Grass) {
          map.setTerrain(tp, TerrainType.Sand);
        }
      }
    }
  }

  // Forest clusters - scattered around the map
  const forestClusters = [
    { x: 10, y: Math.floor(height / 2), r: 4 },
    { x: width - 11, y: Math.floor(height / 2), r: 4 },
    { x: Math.floor(width / 2), y: 8, r: 3 },
    { x: Math.floor(width / 2), y: height - 9, r: 3 },
    { x: 18, y: 18, r: 3 },
    { x: width - 19, y: height - 19, r: 3 },
    { x: 18, y: height - 19, r: 3 },
    { x: width - 19, y: 18, r: 3 },
  ];

  for (const cluster of forestClusters) {
    for (let dy = -cluster.r; dy <= cluster.r; dy++) {
      for (let dx = -cluster.r; dx <= cluster.r; dx++) {
        if (dx * dx + dy * dy <= cluster.r * cluster.r) {
          const tp = { x: cluster.x + dx, y: cluster.y + dy };
          if (map.inBounds(tp) && map.getTerrain(tp) === TerrainType.Grass) {
            map.setTerrain(tp, TerrainType.Forest);
          }
        }
      }
    }

    resourceSpawns.push({
      pos: { x: cluster.x, y: cluster.y },
      type: 'lumber',
      amount: 5000,
    });
  }

  // Gold mines near player spawns
  const goldMines = [
    { x: 8, y: 4 },
    { x: 4, y: 8 },
    { x: width - 9, y: height - 5 },
    { x: width - 5, y: height - 9 },
  ];

  for (const mine of goldMines) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const mp = { x: mine.x + dx, y: mine.y + dy };
        if (map.inBounds(mp)) {
          map.setTerrain(mp, TerrainType.Stone);
        }
      }
    }
    resourceSpawns.push({
      pos: { x: mine.x, y: mine.y },
      type: 'gold',
      amount: 10000,
    });
  }

  // Player spawn areas - clear grass
  const playerSpawns: PlayerSpawn[] = [
    { pos: { x: 3, y: 3 } },
    { pos: { x: width - 6, y: height - 6 } },
  ];

  for (const spawn of playerSpawns) {
    setArea(map, { x: spawn.pos.x - 1, y: spawn.pos.y - 1 }, 5, 5, TerrainType.Grass);
    setArea(map, spawn.pos, 3, 3, TerrainType.Dirt);
  }

  return { map, playerSpawns, resourceSpawns };
}

function setArea(map: GameMap, origin: Point, w: number, h: number, terrain: TerrainType): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const p = { x: origin.x + dx, y: origin.y + dy };
      if (map.inBounds(p)) {
        map.setTerrain(p, terrain);
      }
    }
  }
}
