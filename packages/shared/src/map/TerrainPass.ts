import { GameMap } from './GameMap.js';
import { TerrainType } from './Terrain.js';
import { SimplexNoise } from './SimplexNoise.js';
import { SeededRng } from './SeededRng.js';
import type { LevelConfig } from './LevelConfig.js';
import { resolveMapDimensions } from './LevelConfig.js';

/**
 * Pass 1: Procedural terrain generation using multi-octave simplex noise.
 *
 * Generates a heightmap and moisture map, then thresholds into terrain types.
 * Post-processes to ensure walkability minimums and cluster coherence.
 */
export class TerrainPass {
  private rng: SeededRng;
  private config: LevelConfig;

  constructor(rng: SeededRng, config: LevelConfig) {
    this.rng = rng;
    this.config = config;
  }

  generate(): GameMap {
    const { width, height } = resolveMapDimensions(this.config);
    const map = new GameMap(width, height, TerrainType.Grass);

    const heightNoise = new SimplexNoise(new SeededRng(this.rng.deriveSeed()));
    const moistureNoise = new SimplexNoise(new SeededRng(this.rng.deriveSeed()));

    const baseFreq = (this.config.noiseScale * 4.5) / Math.max(width, height);
    const moistFreq = (this.config.noiseScale * 3.0) / Math.max(width, height);

    const heightMap = new Float32Array(width * height);
    const moistureMap = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        heightMap[y * width + x] = heightNoise.fractal(x * baseFreq, y * baseFreq, 4, 2.0, 0.5);
        moistureMap[y * width + x] = moistureNoise.fractal(x * moistFreq, y * moistFreq, 3, 2.0, 0.5);
      }
    }

    this.applyEdgeFalloff(heightMap, width, height);
    this.assignBiomes(map, heightMap, moistureMap, width, height);
    this.postProcess(map, width, height);

    return map;
  }

  /**
   * Fade height toward 0 near edges so water doesn't abut the map boundary,
   * keeping a walkable border for unit movement.
   */
  private applyEdgeFalloff(heightMap: Float32Array, w: number, h: number): void {
    const margin = Math.max(4, Math.floor(Math.min(w, h) * 0.06));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = Math.min(x, w - 1 - x);
        const dy = Math.min(y, h - 1 - y);
        const edge = Math.min(dx, dy);
        if (edge < margin) {
          const t = edge / margin;
          const fade = t * t;
          const idx = y * w + x;
          heightMap[idx] = 0.5 + (heightMap[idx] - 0.5) * fade;
        }
      }
    }
  }

  private assignBiomes(
    map: GameMap,
    heightMap: Float32Array,
    moistureMap: Float32Array,
    w: number,
    h: number,
  ): void {
    const waterThresh = this.computeThreshold(heightMap, this.config.waterCoverage, true);
    const sandMargin = 0.04;
    const mountainThresh = this.computeThreshold(heightMap, this.config.mountainCoverage, false);
    const forestMoistThresh = this.computeThreshold(moistureMap, this.config.forestCoverage, false);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const elev = heightMap[idx];
        const moist = moistureMap[idx];

        if (elev < waterThresh) {
          map.setTerrain({ x, y }, TerrainType.Water);
        } else if (elev < waterThresh + sandMargin) {
          map.setTerrain({ x, y }, TerrainType.Sand);
        } else if (elev >= mountainThresh) {
          map.setTerrain({ x, y }, TerrainType.Stone);
        } else if (moist >= forestMoistThresh && elev > waterThresh + sandMargin + 0.02) {
          map.setTerrain({ x, y }, TerrainType.Forest);
        }
        // else remains Grass
      }
    }
  }

  /**
   * Compute a noise-value threshold so that approximately `targetFraction` of
   * pixels fall below (if `below=true`) or above (if `below=false`) that threshold.
   */
  private computeThreshold(values: Float32Array, targetFraction: number, below: boolean): number {
    const sorted = Float32Array.from(values).sort();
    if (below) {
      const idx = Math.floor(targetFraction * sorted.length);
      return sorted[Math.min(idx, sorted.length - 1)];
    }
    const idx = Math.floor((1 - targetFraction) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  private postProcess(map: GameMap, w: number, h: number): void {
    this.removeSmallWaterPools(map, w, h, 6);
    this.removeIsolatedForest(map, w, h, 3);
    this.addSandBeaches(map, w, h);
    this.ensureMinWalkable(map, w, h, 0.50);
  }

  /**
   * Flood-fill water regions; convert pools smaller than `minSize` to grass.
   */
  private removeSmallWaterPools(map: GameMap, w: number, h: number, minSize: number): void {
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (visited[idx] || map.getTerrain({ x, y }) !== TerrainType.Water) continue;

        const region: number[] = [];
        queue.push(idx);
        visited[idx] = 1;

        while (queue.length > 0) {
          const ci = queue.pop()!;
          region.push(ci);
          const cx = ci % w;
          const cy = (ci - cx) / w;

          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const ni = ny * w + nx;
            if (visited[ni]) continue;
            if (map.getTerrain({ x: nx, y: ny }) !== TerrainType.Water) continue;
            visited[ni] = 1;
            queue.push(ni);
          }
        }

        if (region.length < minSize) {
          for (const ri of region) {
            map.setTerrain({ x: ri % w, y: Math.floor(ri / w) }, TerrainType.Grass);
          }
        }
      }
    }
  }

  /** Remove isolated forest tiles (fewer than `minNeighbors` forest neighbors). */
  private removeIsolatedForest(map: GameMap, w: number, h: number, minNeighbors: number): void {
    const toRemove: { x: number; y: number }[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (map.getTerrain({ x, y }) !== TerrainType.Forest) continue;
        let count = 0;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (map.getTerrain({ x: x + dx, y: y + dy }) === TerrainType.Forest) count++;
        }
        if (count < minNeighbors) toRemove.push({ x, y });
      }
    }
    for (const p of toRemove) {
      map.setTerrain(p, TerrainType.Grass);
    }
  }

  /** Add a 1-tile sand fringe wherever grass borders water. */
  private addSandBeaches(map: GameMap, w: number, h: number): void {
    const toSand: { x: number; y: number }[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (map.getTerrain({ x, y }) !== TerrainType.Grass) continue;
        let adjacentWater = false;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          if (map.getTerrain({ x: x + dx, y: y + dy }) === TerrainType.Water) {
            adjacentWater = true;
            break;
          }
        }
        if (adjacentWater) toSand.push({ x, y });
      }
    }
    for (const p of toSand) {
      map.setTerrain(p, TerrainType.Sand);
    }
  }

  /**
   * If walkable fraction is below `minFraction`, convert random forest/stone
   * tiles to grass until the minimum is met.
   */
  private ensureMinWalkable(map: GameMap, w: number, h: number, minFraction: number): void {
    const total = w * h;
    let walkable = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (map.isWalkable({ x, y })) walkable++;
      }
    }

    if (walkable / total >= minFraction) return;

    const nonWalkable: { x: number; y: number; t: TerrainType }[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = map.getTerrain({ x, y });
        if (t === TerrainType.Forest || t === TerrainType.Stone) {
          nonWalkable.push({ x, y, t });
        }
      }
    }

    // Prefer converting forest before stone
    nonWalkable.sort((a, b) => (a.t === TerrainType.Forest ? 0 : 1) - (b.t === TerrainType.Forest ? 0 : 1));

    for (const p of nonWalkable) {
      if (walkable / total >= minFraction) break;
      map.setTerrain(p, TerrainType.Grass);
      walkable++;
    }
  }
}
