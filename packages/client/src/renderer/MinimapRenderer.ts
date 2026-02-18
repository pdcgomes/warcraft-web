import { TERRAIN_DATA, Position, Owner, Building } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';

const PLAYER_MINIMAP_COLORS: Record<number, string> = {
  0: '#888888',
  1: '#3366ff',
  2: '#cc3333',
};

/**
 * Renders a small overview map showing terrain and entity positions.
 */
export class MinimapRenderer {
  private readonly game: LocalGame;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(game: LocalGame) {
    this.game = game;
    this.canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  render(): void {
    const map = this.game.gameMap;
    const ctx = this.ctx;
    const canvas = this.canvas;

    const scaleX = canvas.width / map.width;
    const scaleY = canvas.height / map.height;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.getTerrain({ x, y });
        const info = TERRAIN_DATA[terrain];
        const color = '#' + info.color.toString(16).padStart(6, '0');
        ctx.fillStyle = color;
        ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    const world = this.game.world;
    const entities = world.query(Position.type, Owner.type);

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      const owner = world.getComponent(entityId, Owner)!;
      const building = world.getComponent(entityId, Building);

      ctx.fillStyle = PLAYER_MINIMAP_COLORS[owner.playerId] ?? '#ffffff';
      const size = building ? 3 : 2;
      ctx.fillRect(
        pos.tileX * scaleX - size / 2,
        pos.tileY * scaleY - size / 2,
        size,
        size,
      );
    }
  }
}
