import type { Component } from '../ecs/Component.js';

export class Health implements Component {
  static readonly type = 'Health' as const;
  readonly type = Health.type;

  current: number;
  max: number;

  constructor(max: number) {
    this.current = max;
    this.max = max;
  }

  get ratio(): number {
    return this.current / this.max;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  takeDamage(amount: number): void {
    this.current = Math.max(0, this.current - amount);
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + amount);
  }
}
