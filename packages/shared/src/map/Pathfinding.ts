import type { GameMap } from './GameMap.js';
import { FP_SCALE } from '../math/FixedPoint.js';
import type { PathNode } from '../components/Movement.js';

/**
 * A* pathfinding on the tile grid.
 * Returns a path in fixed-point coordinates.
 */

interface AStarNode {
  x: number;
  y: number;
  g: number;     // Cost from start
  h: number;     // Heuristic to goal
  f: number;     // g + h
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
function heuristic(x1: number, y1: number, x2: number, y2: number): number {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  return 10 * (dx + dy) + (14 - 20) * Math.min(dx, dy);
}

function nodeKey(x: number, y: number): number {
  return y * 10000 + x;
}

/**
 * Find a path from start tile to goal tile using A*.
 * Returns an array of fixed-point PathNodes, or empty array if no path found.
 *
 * @param map The game map for walkability checks
 * @param startTileX Start tile X coordinate
 * @param startTileY Start tile Y coordinate
 * @param goalTileX Goal tile X coordinate
 * @param goalTileY Goal tile Y coordinate
 */
export function findPath(
  map: GameMap,
  startTileX: number,
  startTileY: number,
  goalTileX: number,
  goalTileY: number,
): PathNode[] {
  startTileX = Math.round(startTileX);
  startTileY = Math.round(startTileY);
  goalTileX = Math.round(goalTileX);
  goalTileY = Math.round(goalTileY);

  // Trivial case
  if (startTileX === goalTileX && startTileY === goalTileY) {
    return [];
  }

  // If goal is not walkable, find nearest walkable tile
  if (!map.isWalkable(goalTileX, goalTileY)) {
    const nearest = findNearestWalkable(map, goalTileX, goalTileY);
    if (!nearest) return [];
    goalTileX = nearest.x;
    goalTileY = nearest.y;
  }

  if (!map.isWalkable(startTileX, startTileY)) {
    // Can't path from an unwalkable tile
    return [{ x: goalTileX * FP_SCALE, y: goalTileY * FP_SCALE }];
  }

  const openSet: AStarNode[] = [];
  const closedSet: Set<number> = new Set();
  const gScores: Map<number, number> = new Map();

  const startNode: AStarNode = {
    x: startTileX,
    y: startTileY,
    g: 0,
    h: heuristic(startTileX, startTileY, goalTileX, goalTileY),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openSet.push(startNode);
  gScores.set(nodeKey(startTileX, startTileY), 0);

  let iterations = 0;

  while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    // Find node with lowest f score
    let lowestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[lowestIdx].f) {
        lowestIdx = i;
      }
    }

    const current = openSet[lowestIdx];
    openSet.splice(lowestIdx, 1);

    // Check if we've reached the goal
    if (current.x === goalTileX && current.y === goalTileY) {
      return reconstructPath(current);
    }

    const currentKey = nodeKey(current.x, current.y);
    closedSet.add(currentKey);

    // Explore neighbors
    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = nodeKey(nx, ny);

      if (closedSet.has(nKey)) continue;
      if (!map.inBounds(nx, ny)) continue;
      if (!map.isWalkable(nx, ny)) continue;

      // For diagonal movement, check that both adjacent cells are walkable
      if (dir.dx !== 0 && dir.dy !== 0) {
        if (!map.isWalkable(current.x + dir.dx, current.y) ||
            !map.isWalkable(current.x, current.y + dir.dy)) {
          continue;
        }
      }

      const tentativeG = current.g + dir.cost;
      const prevG = gScores.get(nKey);

      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScores.set(nKey, tentativeG);

      const h = heuristic(nx, ny, goalTileX, goalTileY);
      const neighbor: AStarNode = {
        x: nx,
        y: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current,
      };

      // Remove existing entry in open set if present
      const existingIdx = openSet.findIndex(n => n.x === nx && n.y === ny);
      if (existingIdx !== -1) {
        openSet.splice(existingIdx, 1);
      }

      openSet.push(neighbor);
    }
  }

  // No path found - return direct line to goal
  return [{ x: goalTileX * FP_SCALE, y: goalTileY * FP_SCALE }];
}

/** Reconstruct path from goal node back to start, convert to fixed-point. */
function reconstructPath(node: AStarNode): PathNode[] {
  const path: PathNode[] = [];
  let current: AStarNode | null = node;

  while (current !== null) {
    path.push({
      x: current.x * FP_SCALE,
      y: current.y * FP_SCALE,
    });
    current = current.parent;
  }

  path.reverse();

  // Remove the first node (starting position)
  if (path.length > 0) {
    path.shift();
  }

  // Simplify path: remove intermediate nodes on straight lines
  return simplifyPath(path);
}

/** Remove collinear waypoints to smooth the path. */
function simplifyPath(path: PathNode[]): PathNode[] {
  if (path.length <= 2) return path;

  const result: PathNode[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    // If direction changes, keep this waypoint
    if (dx1 !== dx2 || dy1 !== dy2) {
      result.push(curr);
    }
  }

  result.push(path[path.length - 1]);
  return result;
}

/** Find the nearest walkable tile to the given position. */
function findNearestWalkable(map: GameMap, x: number, y: number): { x: number; y: number } | null {
  for (let radius = 1; radius <= 10; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (map.inBounds(nx, ny) && map.isWalkable(nx, ny)) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return null;
}
