/**
 * Isometric coordinate conversion utilities.
 *
 * Coordinate spaces:
 * - Tile space: (tileX, tileY) integer grid
 * - World space: fixed-point (x, y) = tile * 1000
 * - Screen space: pixel coordinates after isometric projection + camera
 *
 * The isometric projection uses a 2:1 diamond ratio.
 */

import type { Point } from './Point.js';

/** Width of a single tile diamond in pixels */
export const TILE_WIDTH = 64;
/** Height of a single tile diamond in pixels */
export const TILE_HEIGHT = 32;

export const TILE_WIDTH_HALF = TILE_WIDTH / 2;
export const TILE_HEIGHT_HALF = TILE_HEIGHT / 2;

/** Convert tile coordinates to screen pixel coordinates. */
export function tileToScreen(tile: Point): Point {
  return {
    x: (tile.x - tile.y) * TILE_WIDTH_HALF,
    y: (tile.x + tile.y) * TILE_HEIGHT_HALF,
  };
}

/** Convert screen pixel coordinates to tile coordinates (fractional). */
export function screenToTile(screen: Point): Point {
  const tileX = (screen.x / TILE_WIDTH_HALF + screen.y / TILE_HEIGHT_HALF) / 2;
  const tileY = (screen.y / TILE_HEIGHT_HALF - screen.x / TILE_WIDTH_HALF) / 2;
  return { x: tileX, y: tileY };
}

/** Convert screen coordinates to the nearest integer tile. */
export function screenToTileRounded(screen: Point): Point {
  const tile = screenToTile(screen);
  return {
    x: Math.round(tile.x),
    y: Math.round(tile.y),
  };
}

/**
 * Get the rendering depth for a tile position.
 * Higher Y tiles should render on top of lower Y tiles.
 * Within same row, higher X renders on top.
 */
export function getTileDepth(tile: Point): number {
  return tile.x + tile.y;
}
