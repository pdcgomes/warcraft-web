import { GameMap } from './GameMap.js';
import { TerrainType } from './Terrain.js';

/**
 * Generates a starter map for development and gameplay.
 * Creates a symmetric 2-player map with resources.
 */

export interface ResourceSpawn {
  x: number;
  y: number;
  type: 'gold' | 'lumber';
  amount: number;
}

export interface PlayerSpawn {
  x: number;
  y: number;
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
    const cy = Math.floor(height / 2);

    // Diagonal paths
    if (i < cx) {
      setArea(map, i, i, 2, 2, TerrainType.Dirt);
      setArea(map, width - 1 - i, height - 1 - i, 2, 2, TerrainType.Dirt);
    }
  }

  // Central lake
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx + dy * dy <= 20) {
        map.setTerrain(cx + dx, cy + dy, TerrainType.Water);
      }
    }
  }

  // Sand beaches around lake
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const dist = dx * dx + dy * dy;
      if (dist > 20 && dist <= 36) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (map.getTerrain(tx, ty) === TerrainType.Grass) {
          map.setTerrain(tx, ty, TerrainType.Sand);
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
          const tx = cluster.x + dx;
          const ty = cluster.y + dy;
          if (map.inBounds(tx, ty) && map.getTerrain(tx, ty) === TerrainType.Grass) {
            map.setTerrain(tx, ty, TerrainType.Forest);
          }
        }
      }
    }

    // Each forest cluster is a lumber source
    resourceSpawns.push({
      x: cluster.x,
      y: cluster.y,
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
    // Place some stone around gold mine
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (map.inBounds(mine.x + dx, mine.y + dy)) {
          map.setTerrain(mine.x + dx, mine.y + dy, TerrainType.Stone);
        }
      }
    }
    resourceSpawns.push({
      x: mine.x,
      y: mine.y,
      type: 'gold',
      amount: 10000,
    });
  }

  // Player spawn areas - clear grass
  const playerSpawns: PlayerSpawn[] = [
    { x: 3, y: 3 },
    { x: width - 6, y: height - 6 },
  ];

  for (const spawn of playerSpawns) {
    setArea(map, spawn.x - 1, spawn.y - 1, 5, 5, TerrainType.Grass);
    setArea(map, spawn.x, spawn.y, 3, 3, TerrainType.Dirt);
  }

  return { map, playerSpawns, resourceSpawns };
}

function setArea(map: GameMap, x: number, y: number, w: number, h: number, terrain: TerrainType): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (map.inBounds(x + dx, y + dy)) {
        map.setTerrain(x + dx, y + dy, terrain);
      }
    }
  }
}
