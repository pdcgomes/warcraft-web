import type { Component } from '../ecs/Component.js';

export interface PathNode {
  x: number;
  y: number;
}

export class Movement implements Component {
  static readonly type = 'Movement' as const;
  readonly type = Movement.type;

  /** Speed in fixed-point units per tick (tile * 1000 / tick) */
  speed: number;

  /** Current path to follow (in fixed-point coords) */
  path: PathNode[] = [];

  /** Index of current path node being moved toward */
  pathIndex: number = 0;

  /** Target position in fixed-point (final destination) */
  targetX: number = 0;
  targetY: number = 0;

  /** Whether the unit is currently moving */
  isMoving: boolean = false;

  constructor(speed: number) {
    this.speed = speed;
  }

  setPath(path: PathNode[]): void {
    this.path = path;
    this.pathIndex = 0;
    this.isMoving = path.length > 0;
    if (path.length > 0) {
      const last = path[path.length - 1];
      this.targetX = last.x;
      this.targetY = last.y;
    }
  }

  clearPath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.isMoving = false;
  }
}
