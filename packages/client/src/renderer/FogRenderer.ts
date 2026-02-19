import { Container, Sprite, Texture, Matrix } from 'pixi.js';
import { TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';

/** Pixels per tile in the offscreen fog canvas. */
const FOG_RES = 4;
/** Number of box-blur passes on the alpha channel. */
const BLUR_PASSES = 4;
const UNEXPLORED_ALPHA = 230;
const EXPLORED_ALPHA = 128;

/**
 * Renders fog of war as a blurred overlay decoupled from the tile grid.
 *
 * Fog state is rasterised into a small offscreen canvas in tile-space,
 * box-blurred for soft edges, then displayed as a single isometric-
 * transformed sprite on top of the world.
 */
export class FogRenderer {
  readonly container: Container;
  private readonly game: LocalGame;

  private readonly offscreen: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fogSprite: Sprite;
  private readonly fogTexture: Texture;

  private readonly cw: number; // canvas width
  private readonly ch: number; // canvas height

  private readonly imageData: ImageData;
  private readonly alphaBuf: Uint8ClampedArray;
  private readonly tmpBuf: Uint8ClampedArray;

  constructor(parentContainer: Container, game: LocalGame) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'fog';
    parentContainer.addChild(this.container);

    const map = game.gameMap;
    this.cw = map.width * FOG_RES;
    this.ch = map.height * FOG_RES;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.cw;
    this.offscreen.height = this.ch;
    this.ctx = this.offscreen.getContext('2d')!;

    this.imageData = this.ctx.createImageData(this.cw, this.ch);
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
      0, 0,
    ).decompose(this.fogSprite);

    this.container.addChild(this.fogSprite);
  }

  update(): void {
    const fog = this.game.fog;
    if (!fog) return;

    const { cw, imageData } = this;
    const data = imageData.data;
    const map = this.game.gameMap;

    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        const state = fog.getState(tx, ty);
        const alpha = state === 2 ? 0 : state === 1 ? EXPLORED_ALPHA : UNEXPLORED_ALPHA;

        const bx = tx * FOG_RES;
        const by = ty * FOG_RES;
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

    this.blurAlpha(data);
    this.ctx.putImageData(imageData, 0, 0);
    this.fogTexture.source.update();
  }

  /**
   * Separable multi-pass box blur on the alpha channel.
   * Edges are clamped (border pixels replicate).
   */
  private blurAlpha(data: Uint8ClampedArray): void {
    const { cw: w, ch: h, alphaBuf: buf, tmpBuf: tmp } = this;
    const len = w * h;

    for (let i = 0; i < len; i++) buf[i] = data[i * 4 + 3];

    for (let pass = 0; pass < BLUR_PASSES; pass++) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const l = x > 0 ? buf[row + x - 1] : buf[row + x];
          const r = x < w - 1 ? buf[row + x + 1] : buf[row + x];
          tmp[row + x] = ((l + buf[row + x] + r) / 3) | 0;
        }
      }

      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const t = y > 0 ? tmp[row - w + x] : tmp[row + x];
          const b = y < h - 1 ? tmp[row + w + x] : tmp[row + x];
          buf[row + x] = ((t + tmp[row + x] + b) / 3) | 0;
        }
      }
    }

    for (let i = 0; i < len; i++) data[i * 4 + 3] = buf[i];
  }
}
