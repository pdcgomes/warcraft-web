import { Container, Graphics, Sprite, Texture, Rectangle } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { tileToScreen, TILE_WIDTH, TILE_HEIGHT, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import { TerrainType, TERRAIN_DATA } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import type { AssetLoader } from '../assets/AssetLoader.js';
import { TERRAIN_ASSETS } from '../assets/AssetManifest.js';
import { debugState } from '../debug/DebugState.js';
import type { ViewportBounds } from './GameRenderer.js';

const CHUNK_SIZE = 16;

interface ChunkEntry {
  sprite: Sprite;
  worldMinX: number;
  worldMinY: number;
  worldMaxX: number;
  worldMaxY: number;
}

/**
 * Renders the isometric tile map by baking tiles into chunk RenderTextures.
 * Each chunk covers CHUNK_SIZE x CHUNK_SIZE tiles and is a single Sprite,
 * drastically reducing the scene graph size. Viewport culling hides
 * off-screen chunks every frame.
 */
export class TerrainRenderer {
  private readonly game: LocalGame;
  private readonly assetLoader: AssetLoader;
  private readonly renderer: Renderer;
  private readonly terrainContainer: Container;
  private chunks: ChunkEntry[] = [];

  constructor(parentContainer: Container, game: LocalGame, assetLoader: AssetLoader, renderer: Renderer) {
    this.game = game;
    this.assetLoader = assetLoader;
    this.renderer = renderer;
    this.terrainContainer = new Container();
    this.terrainContainer.label = 'terrain';
    parentContainer.addChildAt(this.terrainContainer, 0);
  }

  buildTerrain(): void {
    this.terrainContainer.removeChildren();
    this.chunks = [];

    const map = this.game.gameMap;
    const chunksX = Math.ceil(map.width / CHUNK_SIZE);
    const chunksY = Math.ceil(map.height / CHUNK_SIZE);

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const entry = this.buildChunk(cx, cy);
        this.chunks.push(entry);
        this.terrainContainer.addChild(entry.sprite);
      }
    }
  }

  /** Toggle visibility of chunks based on the current viewport. */
  cullChunks(vp: ViewportBounds): void {
    for (const chunk of this.chunks) {
      chunk.sprite.visible = (
        chunk.worldMaxX >= vp.minX &&
        chunk.worldMinX <= vp.maxX &&
        chunk.worldMaxY >= vp.minY &&
        chunk.worldMinY <= vp.maxY
      );
    }
  }

  private buildChunk(cx: number, cy: number): ChunkEntry {
    const map = this.game.gameMap;
    const useSprites = !debugState.forceGraphics;

    const startTileX = cx * CHUNK_SIZE;
    const startTileY = cy * CHUNK_SIZE;
    const endTileX = Math.min(startTileX + CHUNK_SIZE, map.width);
    const endTileY = Math.min(startTileY + CHUNK_SIZE, map.height);

    let worldMinX = Infinity, worldMinY = Infinity;
    let worldMaxX = -Infinity, worldMaxY = -Infinity;

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const s = tileToScreen({ x, y });
        worldMinX = Math.min(worldMinX, s.x - TILE_WIDTH_HALF);
        worldMinY = Math.min(worldMinY, s.y - TILE_HEIGHT_HALF);
        worldMaxX = Math.max(worldMaxX, s.x + TILE_WIDTH_HALF);
        worldMaxY = Math.max(worldMaxY, s.y + TILE_HEIGHT_HALF);
      }
    }

    const tempContainer = new Container();
    tempContainer.x = -worldMinX;
    tempContainer.y = -worldMinY;

    for (let y = startTileY; y < endTileY; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const terrain = map.getTerrain({ x, y });
        const screen = tileToScreen({ x, y });

        let placed = false;
        if (useSprites) {
          const variationIndex = ((x * 7 + y * 13) & 0x7fffffff) % 3;
          const variations = TERRAIN_ASSETS[terrain];
          if (variations) {
            const texture = this.assetLoader.getTexture(variations[variationIndex]);
            if (texture) {
              const tileC = new Container();
              tileC.x = screen.x;
              tileC.y = screen.y;

              const spr = new Sprite(texture);
              spr.anchor.set(0.5, 0.5);
              spr.width = TILE_WIDTH;
              spr.height = TILE_HEIGHT;
              tileC.addChild(spr);

              const mask = new Graphics();
              mask.poly([
                0, -TILE_HEIGHT_HALF,
                TILE_WIDTH_HALF, 0,
                0, TILE_HEIGHT_HALF,
                -TILE_WIDTH_HALF, 0,
              ]);
              mask.fill(0xffffff);
              tileC.addChild(mask);
              spr.mask = mask;

              tempContainer.addChild(tileC);
              placed = true;
            }
          }
        }

        if (!placed) {
          this.addFallbackTile(tempContainer, screen, terrain);
        }
      }
    }

    const texWidth = Math.ceil(worldMaxX - worldMinX);
    const texHeight = Math.ceil(worldMaxY - worldMinY);

    let chunkTexture: Texture;
    try {
      chunkTexture = this.renderer.generateTexture({
        target: tempContainer,
        resolution: 1,
        frame: new Rectangle(0, 0, texWidth, texHeight),
      });
    } catch {
      chunkTexture = this.renderer.generateTexture(tempContainer);
    }

    tempContainer.destroy({ children: true });

    const chunkSprite = new Sprite(chunkTexture);
    chunkSprite.x = worldMinX;
    chunkSprite.y = worldMinY;

    return { sprite: chunkSprite, worldMinX, worldMinY, worldMaxX, worldMaxY };
  }

  private addFallbackTile(parent: Container, screen: { x: number; y: number }, terrain: TerrainType): void {
    const info = TERRAIN_DATA[terrain];
    const g = new Graphics();

    g.poly([
      screen.x, screen.y - TILE_HEIGHT_HALF,
      screen.x + TILE_WIDTH_HALF, screen.y,
      screen.x, screen.y + TILE_HEIGHT_HALF,
      screen.x - TILE_WIDTH_HALF, screen.y,
    ]);
    g.fill(info.color);
    g.poly([
      screen.x, screen.y - TILE_HEIGHT_HALF,
      screen.x + TILE_WIDTH_HALF, screen.y,
      screen.x, screen.y + TILE_HEIGHT_HALF,
      screen.x - TILE_WIDTH_HALF, screen.y,
    ]);
    g.stroke({ width: 0.5, color: 0x000000, alpha: 0.15 });

    if (terrain === TerrainType.Forest) {
      const cx = screen.x, cy = screen.y - 4;
      g.poly([cx, cy - 8, cx - 4, cy + 2, cx + 4, cy + 2]);
      g.fill(0x1a4010);
      g.rect(cx - 1, cy + 2, 2, 3);
      g.fill(0x5c3a1e);
    }

    parent.addChild(g);
  }
}
