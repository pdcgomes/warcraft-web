/**
 * Per-player visibility grid for fog of war.
 *
 * Tile states:
 *   0 = unexplored (never seen)
 *   1 = explored   (previously seen, terrain visible but not units)
 *   2 = visible    (currently in sight range of an owned entity)
 *
 * Each tick:
 *   1. All tiles in state 2 revert to 1 (explored).
 *   2. Tiles within sight range of owned entities are set to 2 (visible).
 */
export class FogOfWar {
  readonly width: number;
  readonly height: number;
  /** Raw grid: [y * width + x]. */
  readonly grid: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
  }

  getState(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0;
    return this.grid[y * this.width + x];
  }

  /** Step 1: revert all visible tiles to explored. */
  clearVisible(): void {
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === 2) this.grid[i] = 1;
    }
  }

  /** Step 2: mark tiles within circular radius as visible. */
  revealCircle(cx: number, cy: number, radiusTiles: number): void {
    const r = Math.ceil(radiusTiles);
    const r2 = radiusTiles * radiusTiles;
    const minX = Math.max(0, Math.floor(cx) - r);
    const maxX = Math.min(this.width - 1, Math.floor(cx) + r);
    const minY = Math.max(0, Math.floor(cy) - r);
    const maxY = Math.min(this.height - 1, Math.floor(cy) + r);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          this.grid[y * this.width + x] = 2;
        }
      }
    }
  }

  /** Check if a tile is currently visible (state 2). */
  isVisible(x: number, y: number): boolean {
    return this.getState(x, y) === 2;
  }

  /** Check if a tile has been explored (state >= 1). */
  isExplored(x: number, y: number): boolean {
    return this.getState(x, y) >= 1;
  }
}
