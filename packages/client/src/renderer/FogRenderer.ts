import { Container, Sprite, Texture, Matrix } from 'pixi.js';
import { TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';

const FOG_RES = 6;
const BLUR_PASSES = 5;
const BLUR_RADIUS = 2;
const KERNEL_SIZE = BLUR_RADIUS * 2 + 1;

const UNEXPLORED_ALPHA = 230;
const EXPLORED_ALPHA = 128;
const VISIBLE_ALPHA = 0;

const FADE_RATE = 6;

/**
 * Extra tiles of solid fog added around the map so that the fog sprite
 * fully covers the diamond-shaped halves of edge tiles that extend
 * beyond the tile-grid origin.
 */
const PAD = 1;

/**
 * Renders fog of war as a blurred overlay decoupled from the tile grid.
 *
 * Per-tile alpha values are interpolated smoothly over time so that
 * fog transitions (explore, reveal, re-fog) feel gradual rather than
 * snapping. The interpolated values are rasterised into a small
 * offscreen canvas, box-blurred with a wide kernel for soft, rounded
 * edges, then displayed as a single isometric-transformed sprite.
 */
export class FogRenderer {
  readonly container: Container;
  private readonly game: LocalGame;

  private readonly offscreen: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fogSprite: Sprite;
  private readonly fogTexture: Texture;

  private readonly cw: number;
  private readonly ch: number;

  private readonly imageData: ImageData;
  private readonly alphaBuf: Uint8ClampedArray;
  private readonly tmpBuf: Uint8ClampedArray;

  private readonly mapW: number;
  private readonly mapH: number;
  private readonly tileAlpha: Float32Array;
  private initialised = false;

  constructor(parentContainer: Container, game: LocalGame) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'fog';
    parentContainer.addChild(this.container);

    const map = game.gameMap;
    this.mapW = map.width;
    this.mapH = map.height;
    this.cw = (map.width + PAD * 2) * FOG_RES;
    this.ch = (map.height + PAD * 2) * FOG_RES;

    this.tileAlpha = new Float32Array(this.mapW * this.mapH);
    this.tileAlpha.fill(UNEXPLORED_ALPHA);

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.cw;
    this.offscreen.height = this.ch;
    this.ctx = this.offscreen.getContext('2d')!;

    this.imageData = this.ctx.createImageData(this.cw, this.ch);

    // Fill the entire canvas with solid fog so the padding border
    // (which is never written by the per-tile loop) stays opaque.
    const data = this.imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      data[i] = UNEXPLORED_ALPHA;
    }

    this.alphaBuf = new Uint8ClampedArray(this.cw * this.ch);
    this.tmpBuf = new Uint8ClampedArray(this.cw * this.ch);

    this.fogTexture = Texture.from(this.offscreen);
    this.fogSprite = new Sprite(this.fogTexture);

    const s = 1 / FOG_RES;
    new Matrix(
      TILE_WIDTH_HALF * s,
      TILE_HEIGHT_HALF * s,
      -TILE_WIDTH_HALF * s,
      TILE_HEIGHT_HALF * s,
      0, -PAD * 2 * TILE_HEIGHT_HALF,
    ).decompose(this.fogSprite);

    this.container.addChild(this.fogSprite);
  }

  update(dt: number): void {
    const fog = this.game.fog;
    if (!fog) return;

    const { mapW, mapH, tileAlpha, cw, imageData } = this;
    const data = imageData.data;

    const lerpFactor = 1 - Math.exp(-FADE_RATE * dt);

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        const state = fog.getState(tx, ty);
        const target = state === 2 ? VISIBLE_ALPHA : state === 1 ? EXPLORED_ALPHA : UNEXPLORED_ALPHA;
        const idx = ty * mapW + tx;

        if (!this.initialised) {
          tileAlpha[idx] = target;
        } else {
          tileAlpha[idx] += (target - tileAlpha[idx]) * lerpFactor;
        }

        const alpha = Math.round(tileAlpha[idx]);
        const bx = (tx + PAD) * FOG_RES;
        const by = (ty + PAD) * FOG_RES;
        for (let py = 0; py < FOG_RES; py++) {
          let i = ((by + py) * cw + bx) * 4;
          for (let px = 0; px < FOG_RES; px++, i += 4) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = alpha;
          }
        }
      }
    }

    this.initialised = true;
    this.blurAlpha(data);
    this.ctx.putImageData(imageData, 0, 0);
    this.fogTexture.source.update();
  }

  /**
   * Separable multi-pass box blur on the alpha channel.
   * Uses a configurable radius for wider, softer edges.
   */
  private blurAlpha(data: Uint8ClampedArray): void {
    const { cw: w, ch: h, alphaBuf: buf, tmpBuf: tmp } = this;
    const len = w * h;

    for (let i = 0; i < len; i++) buf[i] = data[i * 4 + 3];

    for (let pass = 0; pass < BLUR_PASSES; pass++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          let sum = 0;
          for (let dx = -BLUR_RADIUS; dx <= BLUR_RADIUS; dx++) {
            const nx = Math.max(0, Math.min(w - 1, x + dx));
            sum += buf[row + nx];
          }
          tmp[row + x] = (sum / KERNEL_SIZE) | 0;
        }
      }

      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          let sum = 0;
          for (let dy = -BLUR_RADIUS; dy <= BLUR_RADIUS; dy++) {
            const ny = Math.max(0, Math.min(h - 1, y + dy));
            sum += tmp[ny * w + x];
          }
          buf[row + x] = (sum / KERNEL_SIZE) | 0;
        }
      }
    }

    for (let i = 0; i < len; i++) data[i * 4 + 3] = buf[i];
  }
}
