import type { GameMap } from './GameMap.js';
import { TerrainType } from './Terrain.js';
import { SeededRng } from './SeededRng.js';
import type { LevelConfig } from './LevelConfig.js';
import { resolveMapDimensions } from './LevelConfig.js';
import type { Point } from '../math/Point.js';

export interface PlayerSpawn {
  pos: Point;
  playerId: number;
}

const SPAWN_CLEAR_RADIUS = 3;
const SPAWN_SCAN_SIZE = 7;
const SCAN_STEP = 3;

/**
 * Pass 3: Place faction spawn points on the generated terrain.
 *
 * Finds large walkable candidate zones, picks spawn locations with a
 * minimum-distance constraint, clears the spawn area, and validates
 * connectivity between all spawns via BFS.
 */
export class FactionPass {
  private rng: SeededRng;
  private config: LevelConfig;

  constructor(rng: SeededRng, config: LevelConfig) {
    this.rng = rng;
    this.config = config;
  }

  place(map: GameMap): PlayerSpawn[] {
    const { width, height } = resolveMapDimensions(this.config);
    const minDist = Math.sqrt(width * width + height * height) * this.config.minSpawnDistanceFraction;
    const playerCount = this.config.players.length;

    const candidates = this.findCandidateZones(map, width, height);
    if (candidates.length < playerCount) {
      this.forceCandidates(map, width, height, candidates, playerCount);
    }

    this.rng.shuffle(candidates);

    const spawns: PlayerSpawn[] = [];

    const p1Idx = 0;
    spawns.push({
      pos: candidates[p1Idx],
      playerId: this.config.players[0].playerId,
    });

    for (let pi = 1; pi < playerCount; pi++) {
      const validCandidates = candidates.filter(c =>
        spawns.every(s => euclidean(s.pos, c) >= minDist),
      );

      let chosen: Point;
      if (validCandidates.length > 0) {
        chosen = this.weightedPick(validCandidates, spawns[0].pos, width, height);
      } else {
        // Fallback: pick the farthest candidate from all existing spawns
        let bestDist = -1;
        chosen = candidates[candidates.length - 1];
        for (const c of candidates) {
          const d = Math.min(...spawns.map(s => euclidean(s.pos, c)));
          if (d > bestDist) {
            bestDist = d;
            chosen = c;
          }
        }
      }

      spawns.push({
        pos: chosen,
        playerId: this.config.players[pi].playerId,
      });
    }

    for (const spawn of spawns) {
      this.clearSpawnArea(map, spawn.pos);
    }

    if (!this.validateConnectivity(map, spawns, width, height)) {
      this.carveCorridor(map, spawns[0].pos, spawns[1].pos);
    }

    return spawns;
  }

  /** Slide a window across the map to find walkable zones large enough for a base. */
  private findCandidateZones(map: GameMap, w: number, h: number): Point[] {
    const candidates: Point[] = [];
    const margin = SPAWN_CLEAR_RADIUS + 1;
    for (let y = margin; y <= h - SPAWN_SCAN_SIZE - margin; y += SCAN_STEP) {
      for (let x = margin; x <= w - SPAWN_SCAN_SIZE - margin; x += SCAN_STEP) {
        if (map.isAreaWalkable({ x, y }, SPAWN_SCAN_SIZE, SPAWN_SCAN_SIZE)) {
          candidates.push({ x: x + Math.floor(SPAWN_SCAN_SIZE / 2), y: y + Math.floor(SPAWN_SCAN_SIZE / 2) });
        }
      }
    }
    return candidates;
  }

  /**
   * If not enough candidates were found naturally, clear patches in the corners
   * and edges to guarantee at least `needed` candidates.
   */
  private forceCandidates(map: GameMap, w: number, h: number, candidates: Point[], needed: number): void {
    const fallbacks: Point[] = [
      { x: 6, y: 6 },
      { x: w - 7, y: h - 7 },
      { x: 6, y: h - 7 },
      { x: w - 7, y: 6 },
      { x: Math.floor(w / 2), y: 6 },
      { x: Math.floor(w / 2), y: h - 7 },
    ];

    for (const fb of fallbacks) {
      if (candidates.length >= needed) break;
      this.clearSpawnArea(map, fb);
      candidates.push(fb);
    }
  }

  /**
   * Weighted random pick favouring candidates opposite to the first spawn.
   * Distance-based weight: farther candidates are exponentially more likely.
   */
  private weightedPick(candidates: Point[], reference: Point, _w: number, _h: number): Point {
    const distances = candidates.map(c => euclidean(c, reference));
    const maxDist = Math.max(...distances);
    const weights = distances.map(d => {
      const norm = maxDist > 0 ? d / maxDist : 1;
      return norm * norm;
    });

    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let r = this.rng.next() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  /** Clear the spawn area to grass with a dirt center. */
  private clearSpawnArea(map: GameMap, center: Point): void {
    const r = SPAWN_CLEAR_RADIUS;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const p = { x: center.x + dx, y: center.y + dy };
        if (map.inBounds(p)) {
          map.setTerrain(p, TerrainType.Grass);
        }
      }
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const p = { x: center.x + dx, y: center.y + dy };
        if (map.inBounds(p)) {
          map.setTerrain(p, TerrainType.Dirt);
        }
      }
    }
  }

  /** BFS connectivity check between all spawn positions on walkable tiles. */
  private validateConnectivity(map: GameMap, spawns: PlayerSpawn[], w: number, h: number): boolean {
    if (spawns.length < 2) return true;

    const start = spawns[0].pos;
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    const si = start.y * w + start.x;
    visited[si] = 1;
    queue.push(si);

    let head = 0;
    while (head < queue.length) {
      const ci = queue[head++];
      const cx = ci % w;
      const cy = (ci - cx) / w;

      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (visited[ni]) continue;
        if (!map.isWalkable({ x: nx, y: ny })) continue;
        visited[ni] = 1;
        queue.push(ni);
      }
    }

    for (let i = 1; i < spawns.length; i++) {
      const p = spawns[i].pos;
      if (!visited[p.y * w + p.x]) return false;
    }
    return true;
  }

  /** Carve a walkable corridor between two points using Bresenham. */
  private carveCorridor(map: GameMap, from: Point, to: Point): void {
    let x0 = from.x, y0 = from.y;
    const x1 = to.x, y1 = to.y;
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const p = { x: x0 + ox, y: y0 + oy };
          if (map.inBounds(p) && !map.isWalkable(p)) {
            map.setTerrain(p, TerrainType.Dirt);
          }
        }
      }

      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }
}

function euclidean(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
