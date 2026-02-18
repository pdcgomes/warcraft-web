import type { GameMap } from './GameMap.js';
import { FP_SCALE } from '../math/FixedPoint.js';
import type { Point } from '../math/Point.js';

/**
 * A* pathfinding on the tile grid.
 * Returns a path in fixed-point coordinates.
 */

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

/** 8-directional neighbors. Diagonal cost is ~1.414, approximated as 14 vs 10. */
const DIRECTIONS: { dx: number; dy: number; cost: number }[] = [
  { dx: 0, dy: -1, cost: 10 },
  { dx: 1, dy: 0, cost: 10 },
  { dx: 0, dy: 1, cost: 10 },
  { dx: -1, dy: 0, cost: 10 },
  { dx: 1, dy: -1, cost: 14 },
  { dx: 1, dy: 1, cost: 14 },
  { dx: -1, dy: 1, cost: 14 },
  { dx: -1, dy: -1, cost: 14 },
];

/** Maximum nodes to explore before giving up (prevents freeze on impossible paths). */
const MAX_ITERATIONS = 2000;

/** Octile distance heuristic (scaled by 10 for integer math). */
function heuristic(a: Point, b: Point): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return 10 * (dx + dy) + (14 - 20) * Math.min(dx, dy);
}

function nodeKey(p: Point): number {
  return p.y * 10000 + p.x;
}

/**
 * Find a path from start tile to goal tile using A*.
 * Returns an array of fixed-point Points, or empty array if no path found.
 */
export function findPath(map: GameMap, start: Point, goal: Point): Point[] {
  let sx = Math.round(start.x);
  let sy = Math.round(start.y);
  let gx = Math.round(goal.x);
  let gy = Math.round(goal.y);

  if (sx === gx && sy === gy) {
    return [];
  }

  const goalP = { x: gx, y: gy };
  if (!map.isWalkable(goalP)) {
    const nearest = findNearestWalkable(map, goalP);
    if (!nearest) return [];
    gx = nearest.x;
    gy = nearest.y;
  }

  const startP = { x: sx, y: sy };
  if (!map.isWalkable(startP)) {
    return [{ x: gx * FP_SCALE, y: gy * FP_SCALE }];
  }

  const openSet: AStarNode[] = [];
  const closedSet: Set<number> = new Set();
  const gScores: Map<number, number> = new Map();

  const startNode: AStarNode = {
    x: sx,
    y: sy,
    g: 0,
    h: heuristic(startP, { x: gx, y: gy }),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openSet.push(startNode);
  gScores.set(nodeKey(startP), 0);

  let iterations = 0;

  while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) {
        lowestIdx = i;
      }
    }

    const current = openSet[lowestIdx];
    openSet.splice(lowestIdx, 1);

    if (current.x === gx && current.y === gy) {
      return reconstructPath(current);
    }

    const currentP = { x: current.x, y: current.y };
    closedSet.add(nodeKey(currentP));

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const np = { x: nx, y: ny };
      const nKey = nodeKey(np);

      if (closedSet.has(nKey)) continue;
      if (!map.inBounds(np)) continue;
      if (!map.isWalkable(np)) continue;

      if (dir.dx !== 0 && dir.dy !== 0) {
        if (!map.isWalkable({ x: current.x + dir.dx, y: current.y }) ||
            !map.isWalkable({ x: current.x, y: current.y + dir.dy })) {
          continue;
        }
      }

      const tentativeG = current.g + dir.cost;
      const prevG = gScores.get(nKey);

      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScores.set(nKey, tentativeG);

      const h = heuristic(np, { x: gx, y: gy });
      const neighbor: AStarNode = {
        x: nx,
        y: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      };

      const existingIdx = openSet.findIndex(n => n.x === nx && n.y === ny);
      if (existingIdx !== -1) {
        openSet.splice(existingIdx, 1);
      }

      openSet.push(neighbor);
    }
  }

  return [{ x: gx * FP_SCALE, y: gy * FP_SCALE }];
}

/** Reconstruct path from goal node back to start, convert to fixed-point. */
function reconstructPath(node: AStarNode): Point[] {
  const path: Point[] = [];
  let current: AStarNode | null = node;

  while (current !== null) {
    path.push({
      x: current.x * FP_SCALE,
      y: current.y * FP_SCALE,
    });
    current = current.parent;
  }

  path.reverse();

  if (path.length > 0) {
    path.shift();
  }

  return simplifyPath(path);
}

/** Remove collinear waypoints to smooth the path. */
function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path;

  const result: Point[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    if (dx1 !== dx2 || dy1 !== dy2) {
      result.push(curr);
    }
  }

  result.push(path[path.length - 1]);
  return result;
}

/** Find the nearest walkable tile to the given position. */
function findNearestWalkable(map: GameMap, p: Point): Point | null {
  for (let radius = 1; radius <= 10; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const np = { x: p.x + dx, y: p.y + dy };
        if (map.inBounds(np) && map.isWalkable(np)) {
          return np;
        }
      }
    }
  }
  return null;
}
