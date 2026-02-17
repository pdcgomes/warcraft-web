import type { Component } from '../ecs/Component.js';

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

  /** Set from tile coordinates */
  static fromTile(tileX: number, tileY: number): Position {
    return new Position(Math.round(tileX * 1000), Math.round(tileY * 1000));
  }
}
