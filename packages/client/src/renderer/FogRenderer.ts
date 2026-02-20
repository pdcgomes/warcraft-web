import { Container, Sprite, Texture, Matrix, BlurFilter } from 'pixi.js';
import { TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import { debugState } from '../debug/DebugState.js';

const FOG_RES = 4;

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

/** GPU blur strength – roughly equivalent to the old 5-pass CPU box blur. */
const BLUR_STRENGTH = 8;
const BLUR_QUALITY = 4;

/**
 * Renders fog of war as a blurred overlay decoupled from the tile grid.
 *
 * Per-tile alpha values are interpolated smoothly over time so that
 * fog transitions (explore, reveal, re-fog) feel gradual rather than
 * snapping. The interpolated values are rasterised into a small
 * offscreen canvas, then a GPU BlurFilter produces soft, rounded edges.
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

    const data = this.imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      data[i] = UNEXPLORED_ALPHA;
    }

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

    this.fogSprite.filters = [new BlurFilter({ strength: BLUR_STRENGTH, quality: BLUR_QUALITY })];

    this.container.addChild(this.fogSprite);
  }

  update(dt: number): void {
    this.container.visible = !debugState.disableFog;
    if (debugState.disableFog) return;

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
    this.ctx.putImageData(imageData, 0, 0);
    this.fogTexture.source.update();
  }
}
