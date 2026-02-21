import { Application, Container, Graphics } from 'pixi.js';
import { tileToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import type { Point } from '@warcraft-web/shared';
import { TerrainRenderer } from './TerrainRenderer.js';
import { EntityRenderer } from './EntityRenderer.js';
import { MinimapRenderer } from './MinimapRenderer.js';
import { FogRenderer } from './FogRenderer.js';
import { EffectsManager } from '../effects/EffectsManager.js';
import type { LocalGame } from '../game/LocalGame.js';
import type { AssetLoader } from '../assets/AssetLoader.js';

export interface ViewportBounds {
  minX: number; minY: number; maxX: number; maxY: number;
}

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
  readonly effectsManager: EffectsManager;
  readonly minimapRenderer: MinimapRenderer;
  readonly fogRenderer: FogRenderer;

  /** Graphics overlay for the building placement ghost. */
  private readonly ghostGraphics: Graphics;

  /** Camera position (screen offset in pixels). */
  cameraX = 0;
  cameraY = 0;
  zoom = 1;

  private readonly MIN_ZOOM = 0.5;
  private readonly MAX_ZOOM = 2;

  private animTarget: { x: number; y: number } | null = null;
  private animStartX = 0;
  private animStartY = 0;
  private animStartTime = 0;
  private readonly ANIM_DURATION_MS = 280;

  /** World-pixel bounding box of the full tile map (computed once). */
  private mapBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  constructor(app: Application, game: LocalGame, assetLoader: AssetLoader) {
    this.app = app;
    this.game = game;

    this.worldContainer = new Container();
    app.stage.addChild(this.worldContainer);

    this.terrainRenderer = new TerrainRenderer(this.worldContainer, game, assetLoader, app.renderer);
    this.entityRenderer = new EntityRenderer(this.worldContainer, game, assetLoader);

    this.effectsManager = new EffectsManager(this.worldContainer, game, app.renderer);
    this.worldContainer.addChild(this.effectsManager.effectsContainer);
    this.worldContainer.addChild(this.effectsManager.glowContainer);

    this.fogRenderer = new FogRenderer(this.worldContainer, game);
    this.minimapRenderer = new MinimapRenderer(game, this);

    this.ghostGraphics = new Graphics();
    this.worldContainer.addChild(this.ghostGraphics);

    this.terrainRenderer.buildTerrain();
    this.computeMapBounds();
  }

  /** Move camera by delta pixels. Cancels any active animation. */
  pan(dx: number, dy: number): void {
    this.animTarget = null;
    this.cameraX += dx;
    this.cameraY += dy;
  }

  /**
   * Center camera on a world position.
   * By default the camera glides to the target with a smooth
   * ease-in-ease-out curve. Pass `{ animate: false }` for immediate
   * jumps (initial placement, continuous minimap drag).
   */
  centerOn(world: Point, opts?: { animate?: boolean }): void {
    const shouldAnimate = opts?.animate ?? true;
    const targetX = -world.x * this.zoom + this.app.screen.width / 2;
    const targetY = -world.y * this.zoom + this.app.screen.height / 2;

    if (shouldAnimate) {
      this.animStartX = this.cameraX;
      this.animStartY = this.cameraY;
      this.animTarget = { x: targetX, y: targetY };
      this.animStartTime = performance.now();
    } else {
      this.animTarget = null;
      this.cameraX = targetX;
      this.cameraY = targetY;
    }
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
    return this.app.screen.height - 160;
  }

  /** Compute the world-pixel AABB of the currently visible area. */
  getViewportWorldBounds(): ViewportBounds {
    const screenW = this.app.screen.width;
    const screenH = this.gameAreaHeight;
    const tl = this.screenToWorld({ x: 0, y: 0 });
    const br = this.screenToWorld({ x: screenW, y: screenH });
    return {
      minX: Math.min(tl.x, br.x),
      minY: Math.min(tl.y, br.y),
      maxX: Math.max(tl.x, br.x),
      maxY: Math.max(tl.y, br.y),
    };
  }

  render(alpha: number): void {
    this.stepCameraAnimation();
    this.clampCamera();

    this.worldContainer.x = this.cameraX;
    this.worldContainer.y = this.cameraY;
    this.worldContainer.scale.set(this.zoom);

    const vp = this.getViewportWorldBounds();
    this.terrainRenderer.cullChunks(vp);

    const dt = this.app.ticker.deltaMS / 1000;
    this.entityRenderer.update(alpha, vp);
    this.effectsManager.update(dt);
    this.fogRenderer.update(dt);
    this.minimapRenderer.render();
  }

  /**
   * Draw a semi-transparent isometric footprint for building placement.
   * Called externally from the game loop when placement mode is active.
   */
  drawBuildGhost(tilePos: Point, tileW: number, tileH: number, canPlace: boolean): void {
    const g = this.ghostGraphics;
    g.clear();
    g.visible = true;

    const color = canPlace ? 0x00ff00 : 0xff0000;

    for (let dy = 0; dy < tileH; dy++) {
      for (let dx = 0; dx < tileW; dx++) {
        const screen = tileToScreen({ x: tilePos.x + dx, y: tilePos.y + dy });

        g.poly([
          screen.x, screen.y - TILE_HEIGHT_HALF,
          screen.x + TILE_WIDTH_HALF, screen.y,
          screen.x, screen.y + TILE_HEIGHT_HALF,
          screen.x - TILE_WIDTH_HALF, screen.y,
        ]);
        g.fill({ color, alpha: 0.3 });
        g.stroke({ color, width: 1, alpha: 0.6 });
      }
    }
  }

  /** Hide the build ghost. */
  hideBuildGhost(): void {
    this.ghostGraphics.clear();
    this.ghostGraphics.visible = false;
  }

  /**
   * Compute the world-pixel bounding box of the isometric tile map.
   * The four tile-grid corners projected into screen space give us
   * the extent of the map in world pixels.
   */
  private computeMapBounds(): void {
    const w = this.game.gameMap.width;
    const h = this.game.gameMap.height;

    const corners = [
      tileToScreen({ x: 0, y: 0 }),
      tileToScreen({ x: w, y: 0 }),
      tileToScreen({ x: 0, y: h }),
      tileToScreen({ x: w, y: h }),
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }

    this.mapBounds = { minX, minY, maxX, maxY };
  }

  private stepCameraAnimation(): void {
    if (!this.animTarget) return;

    const elapsed = performance.now() - this.animStartTime;
    const t = Math.min(1, elapsed / this.ANIM_DURATION_MS);
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    this.cameraX = this.animStartX + (this.animTarget.x - this.animStartX) * ease;
    this.cameraY = this.animStartY + (this.animTarget.y - this.animStartY) * ease;

    if (t >= 1) this.animTarget = null;
  }

  /**
   * Clamp camera so the viewport stays within the map bounds.
   *
   * The visible world region spans:
   *   left  = -cameraX / zoom
   *   right = (screenW - cameraX) / zoom
   *   top   = -cameraY / zoom
   *   bot   = (screenH - cameraY) / zoom
   *
   * We enforce: left >= mapMinX  and  right <= mapMaxX  (likewise for Y).
   * When the map is smaller than the viewport, we center on that axis.
   */
  private clampCamera(): void {
    const { minX, minY, maxX, maxY } = this.mapBounds;
    const screenW = this.app.screen.width;
    const screenH = this.gameAreaHeight;

    const camMinX = screenW - maxX * this.zoom;
    const camMaxX = -minX * this.zoom;

    if (camMinX > camMaxX) {
      this.cameraX = (camMinX + camMaxX) / 2;
    } else {
      this.cameraX = Math.max(camMinX, Math.min(camMaxX, this.cameraX));
    }

    const camMinY = screenH - maxY * this.zoom;
    const camMaxY = -minY * this.zoom;

    if (camMinY > camMaxY) {
      this.cameraY = (camMinY + camMaxY) / 2;
    } else {
      this.cameraY = Math.max(camMinY, Math.min(camMaxY, this.cameraY));
    }
  }
}
