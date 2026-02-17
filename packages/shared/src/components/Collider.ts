import type { Component } from '../ecs/Component.js';

/**
 * Collision body for an entity.
 *
 * - `dynamic` entities (units) get pushed away from overlapping entities.
 * - `static` entities (buildings, resources) never move but push dynamic
 *   entities away from them.
 *
 * Radius is in fixed-point units (1 tile = 1000).
 */
export class Collider implements Component {
  static readonly type = 'Collider' as const;
  readonly type = Collider.type;

  /** Collision radius in fixed-point units. */
  radius: number;

  /** Whether this entity can be pushed by collision resolution. */
  isStatic: boolean;

  constructor(radius: number, isStatic: boolean = false) {
    this.radius = radius;
    this.isStatic = isStatic;
  }
}
