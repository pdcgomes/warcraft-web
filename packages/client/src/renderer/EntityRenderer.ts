import { Container, Graphics, Text } from 'pixi.js';
import {
  Position, Health, Owner, UnitType, Building,
  Selectable, ResourceSource, Combat,
  tileToScreen, getTileDepth,
} from '@warcraft-web/shared';
import type { EntityId } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';

/** Color palette for players. */
const PLAYER_COLORS: Record<number, number> = {
  0: 0x888888, // Neutral
  1: 0x3366ff, // Player 1 (blue)
  2: 0xcc3333, // Player 2 (red)
};

/** Unit shape colors by type. */
const UNIT_BODY_COLOR: Record<string, number> = {
  worker: 0xcc9933,
  footman: 0x6666cc,
  grunt: 0x66cc66,
  archer: 0x33aa33,
  troll_axethrower: 0x33cc99,
  knight: 0xdddddd,
  raider: 0x999933,
  catapult: 0x8b6914,
  ballista: 0x8b6914,
  cleric: 0xeeeedd,
  shaman: 0x9933cc,
};

interface EntitySprite {
  container: Container;
  body: Graphics;
  healthBar: Graphics;
  selectionCircle: Graphics;
  label: Text;
}

/**
 * Renders units and buildings as colored shapes on the isometric map.
 * Manages sprite creation, update, and removal.
 * Supports smooth interpolation between simulation ticks.
 */
export class EntityRenderer {
  private readonly parentContainer: Container;
  private readonly game: LocalGame;
  private readonly entityContainer: Container;
  private sprites: Map<EntityId, EntitySprite> = new Map();

  /**
   * Snapshot of entity positions (fixed-point) taken just before each tick.
   * Used for smooth interpolation between ticks.
   */
  private prevPositions: Map<EntityId, { x: number; y: number }> = new Map();

  constructor(parentContainer: Container, game: LocalGame) {
    this.parentContainer = parentContainer;
    this.game = game;
    this.entityContainer = new Container();
    this.entityContainer.label = 'entities';
    this.entityContainer.sortableChildren = true;
    this.parentContainer.addChild(this.entityContainer);
  }

  /**
   * Snapshot all current entity positions before a tick runs.
   * Must be called once before each localGame.tick().
   */
  snapshotPositions(): void {
    const world = this.game.world;
    const entities = world.query(Position.type);
    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      this.prevPositions.set(entityId, { x: pos.x, y: pos.y });
    }
  }

  update(alpha: number): void {
    const world = this.game.world;
    const currentEntities = new Set<EntityId>();

    // Update/create sprites for all entities with Position
    const entities = world.query(Position.type);

    for (const entityId of entities) {
      currentEntities.add(entityId);
      const pos = world.getComponent(entityId, Position)!;

      // Interpolate between previous tick position and current position
      const prev = this.prevPositions.get(entityId);
      let renderTileX: number;
      let renderTileY: number;

      if (prev) {
        const lerpX = prev.x + (pos.x - prev.x) * alpha;
        const lerpY = prev.y + (pos.y - prev.y) * alpha;
        renderTileX = lerpX / 1000;
        renderTileY = lerpY / 1000;
      } else {
        renderTileX = pos.tileX;
        renderTileY = pos.tileY;
      }

      const screen = tileToScreen(renderTileX, renderTileY);

      let sprite = this.sprites.get(entityId);
      if (!sprite) {
        sprite = this.createEntitySprite(entityId);
        this.sprites.set(entityId, sprite);
        this.entityContainer.addChild(sprite.container);
      }

      // Update position (interpolated)
      sprite.container.x = screen.x;
      sprite.container.y = screen.y;
      sprite.container.zIndex = getTileDepth(renderTileX, renderTileY);

      // Update selection circle
      const selectable = world.getComponent(entityId, Selectable);
      sprite.selectionCircle.visible = selectable?.selected ?? false;

      // Update health bar
      const health = world.getComponent(entityId, Health);
      this.updateHealthBar(sprite, health);
    }

    // Remove sprites for destroyed entities
    for (const [entityId, sprite] of this.sprites) {
      if (!currentEntities.has(entityId)) {
        this.entityContainer.removeChild(sprite.container);
        sprite.container.destroy();
        this.sprites.delete(entityId);
        this.prevPositions.delete(entityId);
      }
    }
  }

  private createEntitySprite(entityId: EntityId): EntitySprite {
    const world = this.game.world;
    const container = new Container();
    container.label = `entity-${entityId}`;

    // Selection circle
    const selectionCircle = new Graphics();
    selectionCircle.ellipse(0, 4, 18, 10);
    selectionCircle.stroke({ width: 1.5, color: 0x00ff00 });
    selectionCircle.visible = false;
    container.addChild(selectionCircle);

    // Body shape
    const body = new Graphics();
    const building = world.getComponent(entityId, Building);
    const unitType = world.getComponent(entityId, UnitType);
    const resourceSource = world.getComponent(entityId, ResourceSource);
    const owner = world.getComponent(entityId, Owner);
    const playerColor = owner ? (PLAYER_COLORS[owner.playerId] ?? 0xffffff) : 0x888888;

    if (building) {
      this.drawBuilding(body, building, playerColor);
    } else if (unitType) {
      this.drawUnit(body, unitType, playerColor);
    } else if (resourceSource) {
      this.drawResource(body, resourceSource);
    }

    container.addChild(body);

    // Health bar
    const healthBar = new Graphics();
    healthBar.y = -24;
    container.addChild(healthBar);

    // Label
    const labelText = building?.name ?? unitType?.name ?? '';
    const label = new Text({
      text: labelText,
      style: { fontSize: 9, fill: 0xffffff, fontFamily: 'sans-serif' },
    });
    label.anchor.set(0.5, 1);
    label.y = -28;
    label.visible = false;
    container.addChild(label);

    return { container, body, healthBar, selectionCircle, label };
  }

  private drawUnit(g: Graphics, unitType: { kind: string }, playerColor: number): void {
    const color = UNIT_BODY_COLOR[unitType.kind] ?? 0xaaaaaa;

    // Body circle
    g.circle(0, 0, 8);
    g.fill(color);
    g.circle(0, 0, 8);
    g.stroke({ width: 1.5, color: playerColor });

    // Head
    g.circle(0, -10, 4);
    g.fill(0xeeccaa);
  }

  private drawBuilding(g: Graphics, building: { kind: string; tileWidth: number; tileHeight: number; isComplete: boolean }, playerColor: number): void {
    const w = building.tileWidth * 20;
    const h = building.tileHeight * 16;
    const alpha = building.isComplete ? 1 : 0.6;

    g.rect(-w / 2, -h / 2, w, h);
    g.fill({ color: playerColor, alpha });
    g.rect(-w / 2, -h / 2, w, h);
    g.stroke({ width: 1.5, color: 0xc8a82e });

    // Roof triangle for town halls
    if (building.kind === 'town_hall' || building.kind === 'great_hall') {
      g.poly([-w / 2, -h / 2, 0, -h / 2 - 10, w / 2, -h / 2]);
      g.fill({ color: 0x8b4513, alpha });
    }
  }

  private drawResource(g: Graphics, source: { resourceType: string }): void {
    if (source.resourceType === 'gold') {
      // Gold mine: yellow diamond
      g.poly([0, -10, 10, 0, 0, 10, -10, 0]);
      g.fill(0xffd700);
      g.poly([0, -10, 10, 0, 0, 10, -10, 0]);
      g.stroke({ width: 1, color: 0xb8860b });
    } else {
      // Lumber: brown rectangle (tree stump)
      g.rect(-6, -8, 12, 16);
      g.fill(0x8b4513);
      g.rect(-6, -8, 12, 16);
      g.stroke({ width: 1, color: 0x5c3a1e });
    }
  }

  private updateHealthBar(sprite: EntitySprite, health: { current: number; max: number; ratio: number } | undefined): void {
    const g = sprite.healthBar;
    g.clear();

    if (!health || health.current === health.max) {
      g.visible = false;
      return;
    }

    g.visible = true;
    const width = 24;
    const height = 3;

    // Background
    g.rect(-width / 2, 0, width, height);
    g.fill(0x333333);

    // Health fill
    const fillWidth = Math.max(0, width * health.ratio);
    const color = health.ratio > 0.6 ? 0x00cc00 : health.ratio > 0.3 ? 0xcccc00 : 0xcc0000;
    g.rect(-width / 2, 0, fillWidth, height);
    g.fill(color);
  }

  /** Get the entity at a screen position (relative to world container). */
  getEntityAtWorldPos(worldX: number, worldY: number): EntityId | null {
    const world = this.game.world;
    const entities = world.query(Position.type, Selectable.type);
    const hitRadius = 14;

    let nearest: EntityId | null = null;
    let nearestDist = Infinity;

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      const screen = tileToScreen(pos.tileX, pos.tileY);

      const dx = worldX - screen.x;
      const dy = worldY - screen.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < hitRadius && dist < nearestDist) {
        nearestDist = dist;
        nearest = entityId;
      }
    }

    return nearest;
  }
}
