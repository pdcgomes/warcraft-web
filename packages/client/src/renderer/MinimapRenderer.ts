import {
  TERRAIN_DATA, Position, Owner, Building,
  screenToTile, tileToScreen,
} from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import type { GameRenderer } from './GameRenderer.js';

const PLAYER_MINIMAP_COLORS: Record<number, string> = {
  0: '#888888',
  1: '#3366ff',
  2: '#cc3333',
};

/**
 * Renders a small overview map showing terrain, entity positions,
 * and the camera viewport rectangle. Supports click/drag to pan the camera.
 */
export class MinimapRenderer {
  private readonly game: LocalGame;
  private readonly gameRenderer: GameRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private isDragging = false;

  constructor(game: LocalGame, gameRenderer: GameRenderer) {
    this.game = game;
    this.gameRenderer = gameRenderer;
    this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.style.cursor = 'crosshair';

    this.setupMouse();
  }

  render(): void {
    const map = this.game.gameMap;
    const ctx = this.ctx;
    const canvas = this.canvas;

    const scaleX = canvas.width / map.width;
    const scaleY = canvas.height / map.height;

    const fog = this.game.fog;

    // Terrain + fog overlay
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const fogState = fog ? fog.getState(x, y) : 2;
        if (fogState === 0) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
          continue;
        }

        const terrain = map.getTerrain({ x, y });
        const info = TERRAIN_DATA[terrain];
        const color = '#' + info.color.toString(16).padStart(6, '0');
        ctx.fillStyle = color;
        ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));

        if (fogState === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        }
      }
    }

    // Entities
    const world = this.game.world;
    const entities = world.query(Position.type, Owner.type);

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      const owner = world.getComponent(entityId, Owner)!;
      const building = world.getComponent(entityId, Building);

      // Hide enemies in fog
      if (fog && owner.playerId !== this.game.localPlayerId && owner.playerId !== 0) {
        const tx = Math.floor(pos.tileX);
        const ty = Math.floor(pos.tileY);
        if (!fog.isVisible(tx, ty)) continue;
      }

      ctx.fillStyle = PLAYER_MINIMAP_COLORS[owner.playerId] ?? '#ffffff';
      const size = building ? 3 : 2;
      ctx.fillRect(
        pos.tileX * scaleX - size / 2,
        pos.tileY * scaleY - size / 2,
        size,
        size,
      );
    }

    // Viewport rectangle
    this.drawViewport(ctx, scaleX, scaleY);
  }

  /**
   * Draw the camera's visible area as an axis-aligned rectangle on the minimap.
   *
   * We project the four screen corners into tile space and take the bounding
   * box, giving a simple rectangular indicator regardless of the isometric
   * projection angle.
   */
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

  // ---- Mouse interaction ----

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

  /** Convert a mouse event position to tile coords and center the camera there. */
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
