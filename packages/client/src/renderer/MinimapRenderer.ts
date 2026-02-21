import {
  TERRAIN_DATA, Position, Owner, Building,
  screenToTile, tileToScreen,
} from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import type { GameRenderer } from './GameRenderer.js';
import { debugState } from '../debug/DebugState.js';

const PLAYER_MINIMAP_COLORS: Record<number, [number, number, number]> = {
  0: [0x88, 0x88, 0x88],
  1: [0x33, 0x66, 0xff],
  2: [0xcc, 0x33, 0x33],
};

/**
 * Renders a small overview map showing terrain, entity positions,
 * and the camera viewport rectangle.
 *
 * Terrain is rendered once into a cached ImageData buffer. Each frame
 * copies the cache, applies fog as alpha modifications, then draws
 * entity dots on top -- replacing thousands of fillRect calls with
 * typed-array operations.
 */
export class MinimapRenderer {
  private readonly game: LocalGame;
  private readonly gameRenderer: GameRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private isDragging = false;

  private terrainCache: ImageData | null = null;
  private workingBuffer: ImageData | null = null;

  constructor(game: LocalGame, gameRenderer: GameRenderer) {
    this.game = game;
    this.gameRenderer = gameRenderer;
    this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.style.cursor = 'crosshair';
    this.setupMouse();
    this.buildTerrainCache();
  }

  /** Pre-render all terrain tiles into an ImageData at minimap resolution. */
  private buildTerrainCache(): void {
    const map = this.game.gameMap;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scaleX = w / map.width;
    const scaleY = h / map.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d')!;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.getTerrain({ x, y });
        const info = TERRAIN_DATA[terrain];
        offCtx.fillStyle = '#' + info.color.toString(16).padStart(6, '0');
        offCtx.fillRect(
          Math.floor(x * scaleX),
          Math.floor(y * scaleY),
          Math.ceil(scaleX),
          Math.ceil(scaleY),
        );
      }
    }

    this.terrainCache = offCtx.getImageData(0, 0, w, h);
    this.workingBuffer = this.ctx.createImageData(w, h);
  }

  render(): void {
    if (!this.terrainCache || !this.workingBuffer) {
      this.buildTerrainCache();
      return;
    }

    const map = this.game.gameMap;
    const ctx = this.ctx;
    const canvas = this.canvas;
    const scaleX = canvas.width / map.width;
    const scaleY = canvas.height / map.height;
    const fog = this.game.fog;

    const srcData = this.terrainCache.data;
    const dstData = this.workingBuffer.data;
    dstData.set(srcData);

    // Apply fog overlay by darkening pixels per tile
    if (!debugState.disableFog && fog) {
      for (let ty = 0; ty < map.height; ty++) {
        for (let tx = 0; tx < map.width; tx++) {
          const fogState = fog.getState(tx, ty);
          if (fogState === 2) continue;

          const px0 = Math.floor(tx * scaleX);
          const py0 = Math.floor(ty * scaleY);
          const px1 = Math.min(canvas.width, px0 + Math.ceil(scaleX));
          const py1 = Math.min(canvas.height, py0 + Math.ceil(scaleY));

          if (fogState === 0) {
            for (let py = py0; py < py1; py++) {
              for (let px = px0; px < px1; px++) {
                const i = (py * canvas.width + px) * 4;
                dstData[i] = 0;
                dstData[i + 1] = 0;
                dstData[i + 2] = 0;
                dstData[i + 3] = 255;
              }
            }
          } else {
            for (let py = py0; py < py1; py++) {
              for (let px = px0; px < px1; px++) {
                const i = (py * canvas.width + px) * 4;
                dstData[i] = dstData[i] >> 1;
                dstData[i + 1] = dstData[i + 1] >> 1;
                dstData[i + 2] = dstData[i + 2] >> 1;
              }
            }
          }
        }
      }
    }

    ctx.putImageData(this.workingBuffer, 0, 0);

    // Entity dots (small count, fillRect is fine)
    const world = this.game.world;
    const entities = world.query(Position.type, Owner.type);

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      const owner = world.getComponent(entityId, Owner)!;
      const building = world.getComponent(entityId, Building);

      if (!debugState.disableFog && fog && owner.playerId !== this.game.localPlayerId && owner.playerId !== 0) {
        const ttx = Math.floor(pos.tileX);
        const tty = Math.floor(pos.tileY);
        if (!fog.isVisible(ttx, tty)) continue;
      }

      const rgb = PLAYER_MINIMAP_COLORS[owner.playerId] ?? [0xff, 0xff, 0xff];
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      const size = building ? 3 : 2;
      ctx.fillRect(
        pos.tileX * scaleX - size / 2,
        pos.tileY * scaleY - size / 2,
        size,
        size,
      );
    }

    this.drawViewport(ctx, scaleX, scaleY);
  }

  private drawViewport(ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number): void {
    const r = this.gameRenderer;
    const screenW = r.app.screen.width;
    const screenH = r.gameAreaHeight;

    const corners = [
      screenToTile(r.screenToWorld({ x: 0, y: 0 })),
      screenToTile(r.screenToWorld({ x: screenW, y: 0 })),
      screenToTile(r.screenToWorld({ x: screenW, y: screenH })),
      screenToTile(r.screenToWorld({ x: 0, y: screenH })),
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      minX * scaleX,
      minY * scaleY,
      (maxX - minX) * scaleX,
      (maxY - minY) * scaleY,
    );
  }

  private setupMouse(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.isDragging = true;
      this.panToMinimapPos(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panToMinimapPos(e);
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      this.isDragging = false;
    });
  }

  private panToMinimapPos(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const map = this.game.gameMap;
    const scaleX = this.canvas.width / map.width;
    const scaleY = this.canvas.height / map.height;

    const tileX = mx / scaleX;
    const tileY = my / scaleY;

    const worldPos = tileToScreen({ x: tileX, y: tileY });
    this.gameRenderer.centerOn(worldPos);
  }
}
