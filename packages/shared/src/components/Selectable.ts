import type { Component } from '../ecs/Component.js';

/**
 * Marks an entity as selectable by the player.
 */
export class Selectable implements Component {
  static readonly type = 'Selectable' as const;
  readonly type = Selectable.type;

  /** Whether this entity is currently selected */
  selected: boolean = false;

  /** Bounding box for click detection (in pixels, relative to sprite origin) */
  hitboxWidth: number;
  hitboxHeight: number;

  constructor(hitboxWidth: number, hitboxHeight: number) {
    this.hitboxWidth = hitboxWidth;
    this.hitboxHeight = hitboxHeight;
  }
}
