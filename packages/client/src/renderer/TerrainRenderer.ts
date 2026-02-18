import { Container, Graphics } from 'pixi.js';
import { tileToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import { TerrainType, TERRAIN_DATA } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';

/**
 * Renders the isometric tile map using colored diamond shapes (placeholder art).
 */
export class TerrainRenderer {
  private readonly container: Container;
  private readonly game: LocalGame;
  private readonly terrainContainer: Container;

  constructor(parentContainer: Container, game: LocalGame) {
    this.container = parentContainer;
    this.game = game;
    this.terrainContainer = new Container();
    this.terrainContainer.label = 'terrain';
    this.container.addChildAt(this.terrainContainer, 0);
  }

  /**
   * Build the full terrain grid. Call once on init and when map changes.
   */
  buildTerrain(): void {
    this.terrainContainer.removeChildren();

    const map = this.game.gameMap;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.getTerrain({ x, y });
        const info = TERRAIN_DATA[terrain];
        const screen = tileToScreen({ x, y });

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
          this.drawTreeIcon(g, screen.x, screen.y - 4);
        }

        this.terrainContainer.addChild(g);
      }
    }
  }

  private drawTreeIcon(g: Graphics, cx: number, cy: number): void {
    g.poly([cx, cy - 8, cx - 4, cy + 2, cx + 4, cy + 2]);
    g.fill(0x1a4010);
    g.rect(cx - 1, cy + 2, 2, 3);
    g.fill(0x5c3a1e);
  }
}
