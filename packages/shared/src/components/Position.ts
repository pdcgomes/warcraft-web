import type { Component } from '../ecs/Component.js';
import type { Point } from '../math/Point.js';

/**
 * Position in world tile coordinates.
 * Uses fixed-point integers (multiplied by 1000) for deterministic math.
 * So a position of (3500, 2000) means tile (3.5, 2.0).
 */
export class Position implements Component {
  static readonly type = 'Position' as const;
  readonly type = Position.type;

  /** X in fixed-point (tile * 1000) */
  x: number;
  /** Y in fixed-point (tile * 1000) */
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** Get tile X (floating point, for rendering only) */
  get tileX(): number {
    return this.x / 1000;
  }

  /** Get tile Y (floating point, for rendering only) */
  get tileY(): number {
    return this.y / 1000;
  }

  /** Return current position as a Point. */
  toPoint(): Point {
    return { x: this.x, y: this.y };
  }

  /** Set position from a Point. */
  setFrom(p: Point): void {
    this.x = p.x;
    this.y = p.y;
  }

  /** Create from tile coordinates. */
  static fromTile(tile: Point): Position {
    return new Position(Math.round(tile.x * 1000), Math.round(tile.y * 1000));
  }
}
