/**
 * Universal 2D point / vector type used across all coordinate spaces
 * (tile, world/fixed-point, screen).
 */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const ZERO: Point = { x: 0, y: 0 };

export function point(x: number, y: number): Point {
  return { x, y };
}

export function pointAdd(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function pointSub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function pointScale(p: Point, s: number): Point {
  return { x: p.x * s, y: p.y * s };
}

export function pointEquals(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Squared distance -- avoids sqrt, good for comparisons. Divides by FP_SCALE for fixed-point. */
export function pointDistSq(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.round((dx * dx + dy * dy) / 1000);
}

/** Euclidean distance using integer sqrt (deterministic). */
export function pointDist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return isqrt(dx * dx + dy * dy);
}

function isqrt(n: number): number {
  if (n < 0) return 0;
  if (n < 2) return n;

  let x = n;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}
