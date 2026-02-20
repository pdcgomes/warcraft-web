const TAU = Math.PI * 2;
const UP_MIN = -Math.PI * 0.75;
const UP_MAX = -Math.PI * 0.25;

export type TextureKey = 'circle2' | 'circle4' | 'square2' | 'glow16';

export interface EmitterConfig {
  count: [number, number];
  lifetime: [number, number];
  speed: [number, number];
  angle: [number, number];
  gravity: number;
  alphaStart: number;
  alphaEnd: number;
  scaleStart: number;
  scaleEnd: number;
  tint: number;
  textureKey: TextureKey;
  additive?: boolean;
}

// ---- Phase 1: Combat ----

export const MELEE_HIT_SPARK: EmitterConfig = {
  count: [3, 5],
  lifetime: [0.15, 0.3],
  speed: [40, 80],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 1,
  scaleEnd: 0.5,
  tint: 0xffffcc,
  textureKey: 'square2',
};

export const RANGED_HIT_SPARK: EmitterConfig = {
  count: [2, 4],
  lifetime: [0.1, 0.2],
  speed: [30, 60],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 0.8,
  scaleEnd: 0.3,
  tint: 0xcccccc,
  textureKey: 'square2',
};

export const DEATH_PUFF: EmitterConfig = {
  count: [5, 8],
  lifetime: [0.3, 0.6],
  speed: [15, 35],
  angle: [0, TAU],
  gravity: -10,
  alphaStart: 0.7,
  alphaEnd: 0,
  scaleStart: 1,
  scaleEnd: 2,
  tint: 0x666666,
  textureKey: 'circle4',
};

export const DEATH_FLASH: EmitterConfig = {
  count: [1, 1],
  lifetime: [0.1, 0.15],
  speed: [0, 0],
  angle: [0, 0],
  gravity: 0,
  alphaStart: 0.8,
  alphaEnd: 0,
  scaleStart: 1.5,
  scaleEnd: 3,
  tint: 0xff4444,
  textureKey: 'circle4',
};

// ---- Phase 2: Buildings & economy ----

export const CONSTRUCTION_DUST: EmitterConfig = {
  count: [1, 2],
  lifetime: [0.5, 1],
  speed: [5, 15],
  angle: [UP_MIN, UP_MAX],
  gravity: 0,
  alphaStart: 0.4,
  alphaEnd: 0,
  scaleStart: 0.8,
  scaleEnd: 1.5,
  tint: 0xccaa77,
  textureKey: 'circle4',
};

export const GOLD_SPARKLE: EmitterConfig = {
  count: [1, 2],
  lifetime: [0.2, 0.4],
  speed: [10, 25],
  angle: [0, TAU],
  gravity: 20,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 0.5,
  scaleEnd: 0.3,
  tint: 0xffd700,
  textureKey: 'square2',
};

// ---- Phase 3: Ambient ----

export const CHIMNEY_SMOKE: EmitterConfig = {
  count: [1, 1],
  lifetime: [1, 2],
  speed: [3, 8],
  angle: [-Math.PI * 0.6, -Math.PI * 0.4],
  gravity: 0,
  alphaStart: 0.3,
  alphaEnd: 0,
  scaleStart: 0.5,
  scaleEnd: 2,
  tint: 0x555555,
  textureKey: 'circle4',
};

export const TORCH_GLOW: EmitterConfig = {
  count: [1, 1],
  lifetime: [0.3, 0.5],
  speed: [0, 3],
  angle: [UP_MIN, UP_MAX],
  gravity: 0,
  alphaStart: 0.4,
  alphaEnd: 0,
  scaleStart: 1,
  scaleEnd: 1.5,
  tint: 0xffaa33,
  textureKey: 'glow16',
  additive: true,
};

export const DUST_TRAIL: EmitterConfig = {
  count: [1, 1],
  lifetime: [0.3, 0.5],
  speed: [2, 5],
  angle: [UP_MIN, UP_MAX],
  gravity: 0,
  alphaStart: 0.3,
  alphaEnd: 0,
  scaleStart: 0.5,
  scaleEnd: 1,
  tint: 0xbbaa88,
  textureKey: 'circle2',
};

export const WATER_SPARKLE: EmitterConfig = {
  count: [1, 1],
  lifetime: [0.15, 0.3],
  speed: [0, 2],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 0.8,
  alphaEnd: 0,
  scaleStart: 0.5,
  scaleEnd: 0.3,
  tint: 0xffffff,
  textureKey: 'square2',
};

// ---- Order feedback markers ----

export const ORDER_MOVE_RING: EmitterConfig = {
  count: [12, 12],
  lifetime: [0.4, 0.55],
  speed: [50, 60],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 1.2,
  scaleEnd: 0.5,
  tint: 0x44ee44,
  textureKey: 'circle4',
};

export const ORDER_MOVE_CENTER: EmitterConfig = {
  count: [1, 1],
  lifetime: [0.35, 0.4],
  speed: [0, 0],
  angle: [0, 0],
  gravity: 0,
  alphaStart: 0.8,
  alphaEnd: 0,
  scaleStart: 1.5,
  scaleEnd: 4,
  tint: 0x44ee44,
  textureKey: 'glow16',
  additive: true,
};

export const ORDER_ATTACK_RING: EmitterConfig = {
  count: [12, 12],
  lifetime: [0.35, 0.5],
  speed: [45, 55],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 1.2,
  scaleEnd: 0.5,
  tint: 0xff4444,
  textureKey: 'circle4',
};

export const ORDER_ATTACK_CENTER: EmitterConfig = {
  count: [1, 1],
  lifetime: [0.3, 0.35],
  speed: [0, 0],
  angle: [0, 0],
  gravity: 0,
  alphaStart: 0.8,
  alphaEnd: 0,
  scaleStart: 1.5,
  scaleEnd: 4,
  tint: 0xff4444,
  textureKey: 'glow16',
  additive: true,
};

export const ORDER_GATHER_RING: EmitterConfig = {
  count: [10, 10],
  lifetime: [0.4, 0.55],
  speed: [45, 55],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 1,
  scaleEnd: 0.5,
  tint: 0xffd700,
  textureKey: 'square2',
};

export const ORDER_REJECT: EmitterConfig = {
  count: [10, 12],
  lifetime: [0.25, 0.4],
  speed: [35, 60],
  angle: [0, TAU],
  gravity: 0,
  alphaStart: 1,
  alphaEnd: 0,
  scaleStart: 1.2,
  scaleEnd: 0.5,
  tint: 0xff2222,
  textureKey: 'square2',
};
