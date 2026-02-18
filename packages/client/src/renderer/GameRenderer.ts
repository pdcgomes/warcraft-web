import { Application, Container } from 'pixi.js';
import { TerrainRenderer } from './TerrainRenderer.js';
import { EntityRenderer } from './EntityRenderer.js';
import { MinimapRenderer } from './MinimapRenderer.js';
import type { LocalGame } from '../game/LocalGame.js';
import type { Point } from '@warcraft-web/shared';

/**
 * Manages the PixiJS stage, camera/viewport (pan, zoom).
 * Coordinates terrain, entity, and minimap rendering.
 */
export class GameRenderer {
  readonly app: Application;
  readonly game: LocalGame;

  /** The main world container that moves with the camera. */
  readonly worldContainer: Container;

  readonly terrainRenderer: TerrainRenderer;
  readonly entityRenderer: EntityRenderer;
  readonly minimapRenderer: MinimapRenderer;

  /** Camera position (screen offset in pixels). */
  cameraX = 0;
  cameraY = 0;
  zoom = 1;

  private readonly MIN_ZOOM = 0.5;
  private readonly MAX_ZOOM = 2;

  constructor(app: Application, game: LocalGame) {
    this.app = app;
    this.game = game;

    this.worldContainer = new Container();
    app.stage.addChild(this.worldContainer);

    this.terrainRenderer = new TerrainRenderer(this.worldContainer, game);
    this.entityRenderer = new EntityRenderer(this.worldContainer, game);
    this.minimapRenderer = new MinimapRenderer(game);

    // Initial terrain draw
    this.terrainRenderer.buildTerrain();
  }

  /** Move camera by delta pixels. */
  pan(dx: number, dy: number): void {
    this.cameraX += dx;
    this.cameraY += dy;
  }

  /** Set camera to center on a world position (pixels). */
  centerOn(world: Point): void {
    this.cameraX = -world.x + this.app.screen.width / 2;
    this.cameraY = -world.y + this.app.screen.height / 2;
  }

  /** Zoom in/out at a screen point. */
  adjustZoom(delta: number, screen: Point): void {
    const oldZoom = this.zoom;
    this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom + delta));

    const zoomFactor = this.zoom / oldZoom;
    this.cameraX = screen.x - (screen.x - this.cameraX) * zoomFactor;
    this.cameraY = screen.y - (screen.y - this.cameraY) * zoomFactor;
  }

  /** Convert screen coordinates to world coordinates. */
  screenToWorld(screen: Point): Point {
    return {
      x: (screen.x - this.cameraX) / this.zoom,
      y: (screen.y - this.cameraY) / this.zoom,
    };
  }

  /** Convert world coordinates to screen coordinates. */
  worldToScreen(world: Point): Point {
    return {
      x: world.x * this.zoom + this.cameraX,
      y: world.y * this.zoom + this.cameraY,
    };
  }

  /** Get the visible game area height (total screen minus HUD). */
  get gameAreaHeight(): number {
    return this.app.screen.height - 160; // HUD is 160px
  }

  render(alpha: number): void {
    this.worldContainer.x = this.cameraX;
    this.worldContainer.y = this.cameraY;
    this.worldContainer.scale.set(this.zoom);

    this.entityRenderer.update(alpha);
    this.minimapRenderer.render();
  }
}
