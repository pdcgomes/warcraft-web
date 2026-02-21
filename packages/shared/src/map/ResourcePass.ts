import type { GameMap } from './GameMap.js';
import { TerrainType } from './Terrain.js';
import { SeededRng } from './SeededRng.js';
import type { LevelConfig } from './LevelConfig.js';
import { resolveMapDimensions, scaledGoldMines } from './LevelConfig.js';
import type { PlayerSpawn } from './FactionPass.js';
import type { Point } from '../math/Point.js';

export interface ResourceSpawn {
  pos: Point;
  type: 'gold' | 'lumber';
  amount: number;
}

/**
 * Pass 2 (runs after terrain + faction placement):
 * Places gold mines symmetrically around spawn points and registers
 * forest clusters as lumber resource spawns.
 */
export class ResourcePass {
  private rng: SeededRng;
  private config: LevelConfig;

  constructor(rng: SeededRng, config: LevelConfig) {
    this.rng = rng;
    this.config = config;
  }

  place(map: GameMap, spawns: PlayerSpawn[]): ResourceSpawn[] {
    const resources: ResourceSpawn[] = [];
    const { width, height } = resolveMapDimensions(this.config);

    this.placeGoldMines(map, spawns, resources, width, height);
    this.registerForestClusters(map, resources, width, height);

    return resources;
  }

  /**
   * Place gold mines near each player's spawn using rotational symmetry.
   * For each mine placed near player 1, a mirror mine is placed near player 2
   * (180-degree rotation around map center).
   */
  private placeGoldMines(
    map: GameMap,
    spawns: PlayerSpawn[],
    resources: ResourceSpawn[],
    w: number,
    h: number,
  ): void {
    const minesPerPlayer = scaledGoldMines(this.config);
    const cx = w / 2;
    const cy = h / 2;

    if (spawns.length < 2) return;

    const p1 = spawns[0].pos;
    const minDistFromSpawn = 4;
    const maxDistFromSpawn = Math.max(12, Math.floor(Math.min(w, h) * 0.25));

    const placed: Point[] = [];
    const minMineDist = 6;

    for (let i = 0; i < minesPerPlayer; i++) {
      const candidate = this.findGoldCandidate(
        map, p1, minDistFromSpawn, maxDistFromSpawn, placed, minMineDist, w, h,
      );

      if (!candidate) continue;

      this.stampGoldMine(map, candidate);
      placed.push(candidate);
      resources.push({ pos: { ...candidate }, type: 'gold', amount: this.config.goldPerMine });

      const mirror: Point = {
        x: Math.max(2, Math.min(w - 3, Math.round(2 * cx - candidate.x - 1))),
        y: Math.max(2, Math.min(h - 3, Math.round(2 * cy - candidate.y - 1))),
      };

      this.stampGoldMine(map, mirror);
      placed.push(mirror);
      resources.push({ pos: { ...mirror }, type: 'gold', amount: this.config.goldPerMine });
    }
  }

  /** Try random positions near a spawn to find a valid gold mine location. */
  private findGoldCandidate(
    map: GameMap,
    spawn: Point,
    minDist: number,
    maxDist: number,
    existing: Point[],
    minMineDist: number,
    w: number,
    h: number,
  ): Point | null {
    for (let attempt = 0; attempt < 80; attempt++) {
      const angle = this.rng.nextFloat(0, Math.PI * 2);
      const dist = this.rng.nextFloat(minDist, maxDist);
      const x = Math.round(spawn.x + Math.cos(angle) * dist);
      const y = Math.round(spawn.y + Math.sin(angle) * dist);

      if (x < 2 || x >= w - 2 || y < 2 || y >= h - 2) continue;
      if (!this.canPlaceMine(map, { x, y })) continue;

      const tooClose = existing.some(e => {
        const dx = e.x - x;
        const dy = e.y - y;
        return dx * dx + dy * dy < minMineDist * minMineDist;
      });
      if (tooClose) continue;

      return { x, y };
    }
    return null;
  }

  /** Check if a 3x3 gold mine can be placed (all tiles are walkable ground). */
  private canPlaceMine(map: GameMap, center: Point): boolean {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const p = { x: center.x + dx, y: center.y + dy };
        if (!map.inBounds(p)) return false;
        const t = map.getTerrain(p);
        if (t === TerrainType.Water || t === TerrainType.Stone) return false;
      }
    }
    return true;
  }

  /** Stamp a 3x3 stone patch for a gold mine. */
  private stampGoldMine(map: GameMap, center: Point): void {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const p = { x: center.x + dx, y: center.y + dy };
        if (map.inBounds(p)) {
          map.setTerrain(p, TerrainType.Stone);
        }
      }
    }
  }

  /**
   * Find contiguous forest clusters via flood-fill and register each
   * cluster >= minSize as a lumber resource spawn at the cluster centroid.
   */
  private registerForestClusters(
    map: GameMap,
    resources: ResourceSpawn[],
    w: number,
    h: number,
  ): void {
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];
    const minClusterSize = 6;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (visited[idx]) continue;
        if (map.getTerrain({ x, y }) !== TerrainType.Forest) continue;

        const cluster: Point[] = [];
        queue.push(idx);
        visited[idx] = 1;

        while (queue.length > 0) {
          const ci = queue.pop()!;
          const cx = ci % w;
          const cy = (ci - cx) / w;
          cluster.push({ x: cx, y: cy });

          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = ny * w + nx;
            if (visited[ni]) continue;
            if (map.getTerrain({ x: nx, y: ny }) !== TerrainType.Forest) continue;
            visited[ni] = 1;
            queue.push(ni);
          }
        }

        if (cluster.length >= minClusterSize) {
          const centroid = this.centroid(cluster);
          resources.push({
            pos: centroid,
            type: 'lumber',
            amount: this.config.lumberPerCluster,
          });
        }
      }
    }
  }

  private centroid(points: Point[]): Point {
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return {
      x: Math.round(sx / points.length),
      y: Math.round(sy / points.length),
    };
  }
}
