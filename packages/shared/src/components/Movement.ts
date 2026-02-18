import type { Component } from '../ecs/Component.js';
import type { Point } from '../math/Point.js';
import { ZERO } from '../math/Point.js';

export class Movement implements Component {
  static readonly type = 'Movement' as const;
  readonly type = Movement.type;

  /** Speed in fixed-point units per tick (tile * 1000 / tick) */
  speed: number;

  /** Current path to follow (in fixed-point coords) */
  path: Point[] = [];

  /** Index of current path node being moved toward */
  pathIndex: number = 0;

  /** Target position in fixed-point (final destination) */
  target: Point = ZERO;

  /** Whether the unit is currently moving */
  isMoving: boolean = false;

  constructor(speed: number) {
    this.speed = speed;
  }

  setPath(path: Point[]): void {
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = path.length > 0;
    if (path.length > 0) {
      this.target = path[path.length - 1];
    }
  }

  clearPath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.isMoving = false;
  }
}
