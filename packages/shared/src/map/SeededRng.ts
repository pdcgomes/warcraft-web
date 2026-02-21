/**
 * Deterministic seeded PRNG using the mulberry32 algorithm.
 * Produces uniform values in [0, 1) from a 32-bit integer seed.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Return a float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Return an integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Return a float in [min, max). */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Shuffle an array in-place (Fisher-Yates). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Pick a random element from an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Derive a child seed for sub-generators. */
  deriveSeed(): number {
    return (this.next() * 0xffffffff) | 0;
  }
}
