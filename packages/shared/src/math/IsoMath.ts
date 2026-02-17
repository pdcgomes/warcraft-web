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

/** Width of a single tile diamond in pixels */
export const TILE_WIDTH = 64;
/** Height of a single tile diamond in pixels */
export const TILE_HEIGHT = 32;

export const TILE_WIDTH_HALF = TILE_WIDTH / 2;
export const TILE_HEIGHT_HALF = TILE_HEIGHT / 2;

/** Convert tile coordinates to screen pixel coordinates. */
export function tileToScreen(tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: (tileX - tileY) * TILE_WIDTH_HALF,
    y: (tileX + tileY) * TILE_HEIGHT_HALF,
  };
}

/** Convert screen pixel coordinates to tile coordinates. */
export function screenToTile(screenX: number, screenY: number): { tileX: number; tileY: number } {
  const tileX = (screenX / TILE_WIDTH_HALF + screenY / TILE_HEIGHT_HALF) / 2;
  const tileY = (screenY / TILE_HEIGHT_HALF - screenX / TILE_WIDTH_HALF) / 2;
  return { tileX, tileY };
}

/** Convert screen coordinates to the nearest integer tile. */
export function screenToTileRounded(screenX: number, screenY: number): { tileX: number; tileY: number } {
  const { tileX, tileY } = screenToTile(screenX, screenY);
  return {
    tileX: Math.round(tileX),
    tileY: Math.round(tileY),
  };
}

/**
 * Get the rendering depth for a tile position.
 * Higher Y tiles should render on top of lower Y tiles.
 * Within same row, higher X renders on top.
 */
export function getTileDepth(tileX: number, tileY: number): number {
  return tileX + tileY;
}
