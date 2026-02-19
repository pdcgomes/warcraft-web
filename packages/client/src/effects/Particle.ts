import type { Sprite } from 'pixi.js';

/** Mutable per-particle state. Instances are recycled via the pool. */
export interface Particle {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  alphaStart: number;
  alphaEnd: number;
  scaleStart: number;
  scaleEnd: number;
  active: boolean;
}
