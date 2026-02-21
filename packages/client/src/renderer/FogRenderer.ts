import { Container, Sprite, Texture, Matrix, BlurFilter } from 'pixi.js';
import { TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import { debugState } from '../debug/DebugState.js';

const UNEXPLORED_ALPHA = 230;
const EXPLORED_ALPHA = 128;
const VISIBLE_ALPHA = 0;

const FADE_RATE = 6;
const CONVERGENCE_THRESHOLD = 1;

/**
 * Extra tiles of solid fog added around the map so that the fog sprite
 * fully covers the diamond-shaped halves of edge tiles.
 */
const PAD = 1;

const BLUR_STRENGTH = 8;
const BLUR_QUALITY = 4;

/**
 * Renders fog of war as a blurred overlay.
 *
 * Uses 1 pixel per tile (down from 4x4) since the GPU BlurFilter
 * handles smoothing. Tracks which tiles are still transitioning and
 * skips the full texture upload when nothing has changed.
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
  private readonly prevState: Uint8Array;
  private transitioningCount: number;
  private initialised = false;

  constructor(parentContainer: Container, game: LocalGame) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'fog';
    parentContainer.addChild(this.container);

    const map = game.gameMap;
    this.mapW = map.width;
    this.mapH = map.height;
    this.cw = map.width + PAD * 2;
    this.ch = map.height + PAD * 2;

    const total = this.mapW * this.mapH;
    this.tileAlpha = new Float32Array(total);
    this.tileAlpha.fill(UNEXPLORED_ALPHA);
    this.prevState = new Uint8Array(total);
    this.transitioningCount = 0;

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

    new Matrix(
      TILE_WIDTH_HALF,
      TILE_HEIGHT_HALF,
      -TILE_WIDTH_HALF,
      TILE_HEIGHT_HALF,
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

    const { mapW, mapH, tileAlpha, prevState, cw, imageData } = this;
    const data = imageData.data;
    const lerpFactor = 1 - Math.exp(-FADE_RATE * dt);

    let dirty = false;
    let transitioning = 0;

    for (let ty = 0; ty < mapH; ty++) {
      for (let tx = 0; tx < mapW; tx++) {
        const idx = ty * mapW + tx;
        const state = fog.getState(tx, ty);
        const target = state === 2 ? VISIBLE_ALPHA : state === 1 ? EXPLORED_ALPHA : UNEXPLORED_ALPHA;

        if (!this.initialised) {
          tileAlpha[idx] = target;
          prevState[idx] = state;
        } else {
          const current = tileAlpha[idx];
          const diff = target - current;
          if (Math.abs(diff) > CONVERGENCE_THRESHOLD) {
            tileAlpha[idx] = current + diff * lerpFactor;
            transitioning++;
          } else if (tileAlpha[idx] !== target) {
            tileAlpha[idx] = target;
          }
          prevState[idx] = state;
        }

        const alpha = Math.round(tileAlpha[idx]);
        const pi = ((ty + PAD) * cw + (tx + PAD)) * 4;
        if (data[pi + 3] !== alpha) {
          data[pi] = 0;
          data[pi + 1] = 0;
          data[pi + 2] = 0;
          data[pi + 3] = alpha;
          dirty = true;
        }
      }
    }

    this.transitioningCount = transitioning;

    if (dirty || !this.initialised) {
      this.ctx.putImageData(imageData, 0, 0);
      this.fogTexture.source.update();
    }

    this.initialised = true;
  }
}
