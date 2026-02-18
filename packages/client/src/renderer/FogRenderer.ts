import { Container, Graphics } from 'pixi.js';
import { tileToScreen, TILE_WIDTH_HALF, TILE_HEIGHT_HALF } from '@warcraft-web/shared';
import type { FogOfWar } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';

/**
 * Renders a fog overlay on top of terrain and entities.
 * Unexplored tiles are fully black; explored-but-not-visible tiles are dimmed.
 */
export class FogRenderer {
  readonly container: Container;
  private readonly game: LocalGame;
  private readonly fogGraphics: Graphics;

  constructor(parentContainer: Container, game: LocalGame) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'fog';
    parentContainer.addChild(this.container);

    this.fogGraphics = new Graphics();
    this.container.addChild(this.fogGraphics);
  }

  update(): void {
    const fog = this.game.fog;
    if (!fog) return;

    const g = this.fogGraphics;
    g.clear();

    const map = this.game.gameMap;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const state = fog.getState(x, y);
        if (state === 2) continue;

        const screen = tileToScreen({ x, y });
        const alpha = state === 0 ? 0.9 : 0.5;

        g.poly([
          screen.x, screen.y - TILE_HEIGHT_HALF,
          screen.x + TILE_WIDTH_HALF, screen.y,
          screen.x, screen.y + TILE_HEIGHT_HALF,
          screen.x - TILE_WIDTH_HALF, screen.y,
        ]);
        g.fill({ color: 0x000000, alpha });
      }
    }
  }
}
