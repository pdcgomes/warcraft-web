/**
 * Fixed-point arithmetic utilities for deterministic math.
 * We use a scale factor of 1000 (3 decimal places).
 * All game simulation coordinates and calculations use fixed-point.
 */

import type { Point } from './Point.js';

export const FP_SCALE = 1000;

/** Convert a floating-point number to fixed-point. */
export function toFixed(value: number): number {
  return Math.round(value * FP_SCALE);
}

/** Convert fixed-point to floating-point (for rendering only). */
export function toFloat(fixed: number): number {
  return fixed / FP_SCALE;
}

/** Fixed-point multiplication: (a * b) / SCALE */
export function fpMul(a: number, b: number): number {
  return Math.round((a * b) / FP_SCALE);
}

/** Fixed-point division: (a * SCALE) / b */
export function fpDiv(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a * FP_SCALE) / b);
}

/** Distance squared between two fixed-point positions (avoids sqrt). */
export function distanceSquared(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.round((dx * dx + dy * dy) / FP_SCALE);
}

/**
 * Integer square root (for deterministic distance calculation).
 * Uses Newton's method on integers.
 */
export function isqrt(n: number): number {
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

/** Fixed-point distance between two points. */
export function fpDistance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return isqrt(dx * dx + dy * dy);
}
