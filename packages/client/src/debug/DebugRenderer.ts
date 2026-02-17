import { Container, Graphics, Text } from 'pixi.js';
import {
  Position, Collider, UnitBehavior, UnitType, Building,
  Movement, tileToScreen,
} from '@warcraft-web/shared';
import type { EntityId } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import type { EntityRenderer } from '../renderer/EntityRenderer.js';
import { debugState } from './DebugState.js';

/**
 * Renders debug overlays in world-space on top of entities.
 *
 * Uses the same position interpolation as EntityRenderer so that
 * debug visuals (labels, colliders, path start points) move in
 * perfect sync with the entity sprites.
 */
export class DebugRenderer {
  readonly container: Container;
  private readonly game: LocalGame;
  private readonly entityRenderer: EntityRenderer;
  private readonly pathGraphics: Graphics;
  private readonly colliderGraphics: Graphics;
  private readonly labelContainer: Container;
  private labels: Map<EntityId, Text> = new Map();

  constructor(game: LocalGame, entityRenderer: EntityRenderer) {
    this.game = game;
    this.entityRenderer = entityRenderer;

    this.container = new Container();
    this.container.label = 'debug';

    this.pathGraphics = new Graphics();
    this.pathGraphics.label = 'debug-paths';
    this.container.addChild(this.pathGraphics);

    this.colliderGraphics = new Graphics();
    this.colliderGraphics.label = 'debug-colliders';
    this.container.addChild(this.colliderGraphics);

    this.labelContainer = new Container();
    this.labelContainer.label = 'debug-labels';
    this.container.addChild(this.labelContainer);
  }

  /** Call once per frame with the same alpha used by EntityRenderer. */
  update(alpha: number): void {
    if (!debugState.enabled) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    this.drawPaths(alpha);
    this.drawColliders(alpha);
    this.drawUnitLabels(alpha);
  }

  /**
   * Compute the interpolated screen position for an entity, matching
   * exactly what EntityRenderer does for the sprite.
   */
  private interpolatedScreen(entityId: EntityId, pos: Position, alpha: number): { x: number; y: number } {
    const prev = this.entityRenderer.prevPositions.get(entityId);
    let tileX: number;
    let tileY: number;

    if (prev) {
      const lerpX = prev.x + (pos.x - prev.x) * alpha;
      const lerpY = prev.y + (pos.y - prev.y) * alpha;
      tileX = lerpX / 1000;
      tileY = lerpY / 1000;
    } else {
      tileX = pos.tileX;
      tileY = pos.tileY;
    }

    return tileToScreen(tileX, tileY);
  }

  // ---- Pathfinding lines ----

  private drawPaths(alpha: number): void {
    this.pathGraphics.clear();
    if (!debugState.showPaths) return;

    for (const entry of debugState.activePaths) {
      const world = this.game.world;
      const pos = world.getComponent(entry.entityId, Position);
      if (!pos) continue;

      const startScreen = this.interpolatedScreen(entry.entityId, pos, alpha);
      this.pathGraphics.moveTo(startScreen.x, startScreen.y);

      for (const node of entry.path) {
        const screen = tileToScreen(node.x / 1000, node.y / 1000);
        this.pathGraphics.lineTo(screen.x, screen.y);
      }

      this.pathGraphics.stroke({ width: 1.5, color: 0x00ff88, alpha: 0.7 });

      for (const node of entry.path) {
        const screen = tileToScreen(node.x / 1000, node.y / 1000);
        this.pathGraphics.circle(screen.x, screen.y, 2.5);
        this.pathGraphics.fill({ color: 0xffff00, alpha: 0.8 });
      }
    }
  }

  // ---- Collision radii ----

  private drawColliders(alpha: number): void {
    this.colliderGraphics.clear();
    if (!debugState.showColliders) return;

    const world = this.game.world;
    const entities = world.query(Position.type, Collider.type);

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position)!;
      const collider = world.getComponent(entityId, Collider)!;

      const screen = this.interpolatedScreen(entityId, pos, alpha);
      const radiusPx = (collider.radius / 1000) * 32;

      const color = collider.isStatic ? 0xff4444 : 0x44aaff;
      this.colliderGraphics.circle(screen.x, screen.y, radiusPx);
      this.colliderGraphics.stroke({ width: 1, color, alpha: 0.5 });
    }
  }

  // ---- Unit labels (name and/or behavior state) ----

  private drawUnitLabels(alpha: number): void {
    const showName = debugState.showUnitNames;
    const showState = debugState.showBehaviorState;

    if (!showName && !showState) {
      for (const [, label] of this.labels) {
        label.visible = false;
      }
      return;
    }

    const world = this.game.world;
    const entities = world.query(Position.type, UnitBehavior.type);
    const activeIds = new Set<EntityId>();

    for (const entityId of entities) {
      activeIds.add(entityId);
      const pos = world.getComponent(entityId, Position)!;
      const behavior = world.getComponent(entityId, UnitBehavior)!;
      const ut = world.getComponent(entityId, UnitType);
      const screen = this.interpolatedScreen(entityId, pos, alpha);

      let label = this.labels.get(entityId);
      if (!label) {
        label = new Text({
          text: '',
          style: { fontSize: 8, fill: 0x00ff88, fontFamily: 'monospace', align: 'center' },
        });
        label.anchor.set(0.5, 1);
        this.labelContainer.addChild(label);
        this.labels.set(entityId, label);
      }

      const lines: string[] = [];
      if (showName && ut) lines.push(ut.name);
      if (showState) lines.push(behavior.state);
      label.text = lines.join('\n');
      label.x = screen.x;
      label.y = screen.y - 32;
      label.visible = true;
    }

    for (const [entityId, label] of this.labels) {
      if (!activeIds.has(entityId)) {
        this.labelContainer.removeChild(label);
        label.destroy();
        this.labels.delete(entityId);
      }
    }
  }
}
