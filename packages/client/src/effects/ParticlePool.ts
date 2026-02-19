import { Sprite, Texture, Container } from 'pixi.js';
import type { Particle } from './Particle.js';

/**
 * Fixed-size pool of Sprite-backed particles. Sprites are pre-created
 * and hidden; acquire() hands one out, release() returns it.
 */
export class ParticlePool {
  private readonly particles: Particle[];
  private activeCount = 0;

  constructor(container: Container, size: number) {
    this.particles = [];
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(Texture.WHITE);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      container.addChild(sprite);
      this.particles.push({
        sprite,
        x: 0, y: 0, vx: 0, vy: 0, gravity: 0,
        life: 0, maxLife: 1,
        alphaStart: 1, alphaEnd: 0,
        scaleStart: 1, scaleEnd: 1,
        active: false,
      });
    }
  }

  acquire(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.sprite.visible = true;
        this.activeCount++;
        return p;
      }
    }
    return null;
  }

  release(p: Particle): void {
    p.active = false;
    p.sprite.visible = false;
    this.activeCount--;
  }

  get active(): number {
    return this.activeCount;
  }

  forEachActive(fn: (p: Particle) => void): void {
    for (const p of this.particles) {
      if (p.active) fn(p);
    }
  }
}
