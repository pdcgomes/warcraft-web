import type { Application } from 'pixi.js';
import {
  Position, Selectable, Owner, ResourceSource, Health, Building,
  Movement, ResourceCarrier, UnitType, Combat,
  UnitBehavior,
  getAvailableOrders, ORDER_DEFINITIONS,
  screenToTile, tileToScreen, toFixed, findPath,
} from '@warcraft-web/shared';
import type { EntityId, OrderId, OrderDefinition, UnitKind, EventSender, Point } from '@warcraft-web/shared';
import type { GameRenderer } from '../renderer/GameRenderer.js';
import type { LocalGame } from '../game/LocalGame.js';
import { SelectionBox } from '../ui/SelectionBox.js';
import { debugState } from '../debug/DebugState.js';

const CAMERA_SCROLL_SPEED = 8;
const EDGE_SCROLL_MARGIN = 20;

/**
 * Handles mouse and keyboard input for selection, commands, camera,
 * and the order targeting system.
 *
 * Order flow:
 * 1. Player clicks an order button (HUD) or presses a hotkey (1-9)
 * 2. Instant orders (Stop, Hold) execute immediately
 * 3. Targeted orders enter targeting mode -- next left-click executes
 * 4. Escape or right-click cancels targeting mode
 */
export class InputManager {
  private readonly app: Application;
  private readonly renderer: GameRenderer;
  private readonly game: LocalGame;
  private readonly selectionBox: SelectionBox;

  private keysDown: Set<string> = new Set();

  // Left-click / drag state
  private isLeftDown = false;
  private isDragging = false;
  private readonly dragThreshold = 5;
  private mouseDownX = 0;
  private mouseDownY = 0;

  // Right-click drag-to-pan state
  private isRightMouseDown = false;
  private isRightDragging = false;
  private rightDownX = 0;
  private rightDownY = 0;

  // General mouse tracking
  private lastMouseX = 0;
  private lastMouseY = 0;

  // ---- Order targeting state ----
  /** The order currently awaiting a target click, or null if none. */
  private activeOrder: OrderId | null = null;

  /** Cached list of available orders for current selection (updated per-frame). */
  private currentOrders: OrderDefinition[] = [];

  /** Callback fired whenever targeting mode changes (for HUD highlight). */
  onTargetingChanged: ((orderId: OrderId | null) => void) | null = null;

  constructor(app: Application, renderer: GameRenderer, game: LocalGame) {
    this.app = app;
    this.renderer = renderer;
    this.game = game;
    this.selectionBox = new SelectionBox();

    this.setupKeyboard();
    this.setupMouse();
  }

  // ---- Public API for HUD ----

  /** Activate an order (called by HUD buttons or hotkeys). */
  activateOrder(orderId: OrderId): void {
    const def = ORDER_DEFINITIONS[orderId];
    if (!def) return;

    if (def.targeting === 'instant') {
      this.executeInstantOrder(orderId);
      return;
    }

    if (def.targeting === 'submenu') {
      return;
    }

    this.activeOrder = orderId;
    this.onTargetingChanged?.(orderId);
  }

  /** Get the current targeting order (for HUD to highlight). */
  getActiveOrder(): OrderId | null {
    return this.activeOrder;
  }

  /** Get the current available orders for the selection. */
  getCurrentOrders(): OrderDefinition[] {
    return this.currentOrders;
  }

  // ---- Keyboard ----

  private setupKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.keysDown.add(e.key);

      if (e.key === 'Escape') {
        if (this.activeOrder !== null) {
          this.cancelTargeting();
        } else {
          this.deselectAll();
        }
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        this.refreshCurrentOrders();
        const slot = parseInt(e.key) - 1;
        if (slot < this.currentOrders.length) {
          this.activateOrder(this.currentOrders[slot].id);
        }
        return;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.key);
    });
  }

  // ---- Mouse ----

  private setupMouse(): void {
    const canvas = this.app.canvas;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isLeftDown = true;
        this.isDragging = false;
        this.mouseDownX = e.clientX;
        this.mouseDownY = e.clientY;
        if (this.activeOrder === null) {
          this.selectionBox.begin(e.clientX, e.clientY);
        }
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
        this.isRightDragging = false;
        this.rightDownX = e.clientX;
        this.rightDownY = e.clientY;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.isLeftDown && this.selectionBox.active && this.activeOrder === null) {
        const dx = e.clientX - this.mouseDownX;
        const dy = e.clientY - this.mouseDownY;
        if (!this.isDragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
          this.isDragging = true;
        }
        this.selectionBox.move(e.clientX, e.clientY);
      }

      if (this.isRightMouseDown) {
        const dx = e.clientX - this.rightDownX;
        const dy = e.clientY - this.rightDownY;
        if (!this.isRightDragging && (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold)) {
          this.isRightDragging = true;
        }
        if (this.isRightDragging) {
          this.renderer.pan(e.clientX - this.lastMouseX, e.clientY - this.lastMouseY);
        }
      }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.isLeftDown) {
        this.isLeftDown = false;

        if (this.activeOrder !== null) {
          this.selectionBox.end();
          this.executeTargetedOrder({ x: e.clientX, y: e.clientY });
        } else if (this.isDragging) {
          const rect = this.selectionBox.end();
          this.handleBoxSelect(rect);
        } else {
          this.selectionBox.end();
          this.handleLeftClick({ x: e.clientX, y: e.clientY }, e.shiftKey);
        }
        this.isDragging = false;
      } else if (e.button === 2) {
        if (this.isRightMouseDown && !this.isRightDragging) {
          if (this.activeOrder !== null) {
            this.cancelTargeting();
          } else {
            this.handleRightClick({ x: e.clientX, y: e.clientY });
          }
        }
        this.isRightMouseDown = false;
        this.isRightDragging = false;
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.renderer.adjustZoom(delta, { x: e.clientX, y: e.clientY });
    }, { passive: false });
  }

  // ---- Per-frame update ----

  update(): void {
    if (this.keysDown.has('ArrowLeft')) this.renderer.pan(CAMERA_SCROLL_SPEED, 0);
    if (this.keysDown.has('ArrowRight')) this.renderer.pan(-CAMERA_SCROLL_SPEED, 0);
    if (this.keysDown.has('ArrowUp')) this.renderer.pan(0, CAMERA_SCROLL_SPEED);
    if (this.keysDown.has('ArrowDown')) this.renderer.pan(0, -CAMERA_SCROLL_SPEED);

    const rect = this.app.canvas.getBoundingClientRect();
    const mx = this.lastMouseX - rect.left;
    const my = this.lastMouseY - rect.top;
    if (mx >= 0 && mx < EDGE_SCROLL_MARGIN) this.renderer.pan(CAMERA_SCROLL_SPEED, 0);
    if (mx > rect.width - EDGE_SCROLL_MARGIN && mx <= rect.width) this.renderer.pan(-CAMERA_SCROLL_SPEED, 0);
    if (my >= 0 && my < EDGE_SCROLL_MARGIN) this.renderer.pan(0, CAMERA_SCROLL_SPEED);
    if (my > rect.height - EDGE_SCROLL_MARGIN && my <= rect.height) this.renderer.pan(0, -CAMERA_SCROLL_SPEED);

    this.refreshCurrentOrders();
  }

  // ---- Order infrastructure ----

  private refreshCurrentOrders(): void {
    const ownUnits = this.getCommandableSelected();
    const world = this.game.world;

    const unitKinds: UnitKind[] = [];
    for (const entityId of ownUnits) {
      const ut = world.getComponent(entityId, UnitType);
      if (ut) unitKinds.push(ut.kind);
    }

    this.currentOrders = getAvailableOrders(unitKinds);

    if (this.activeOrder !== null) {
      if (!this.currentOrders.some(o => o.id === this.activeOrder)) {
        this.cancelTargeting();
      }
    }
  }

  private cancelTargeting(): void {
    this.activeOrder = null;
    this.onTargetingChanged?.(null);
  }

  private executeInstantOrder(orderId: OrderId): void {
    const units = this.getCommandableSelected();
    if (units.length === 0) return;

    switch (orderId) {
      case 'stop':
        this.commandStop(units);
        break;
      case 'hold_position':
        this.commandHoldPosition(units);
        break;
    }
  }

  private executeTargetedOrder(screenPos: Point): void {
    const orderId = this.activeOrder;
    if (orderId === null) return;

    const units = this.getCommandableSelected();
    if (units.length === 0) {
      this.cancelTargeting();
      return;
    }

    const worldPos = this.renderer.screenToWorld(screenPos);
    const targetEntity = this.renderer.entityRenderer.getEntityAtWorldPos(worldPos);
    const world = this.game.world;

    switch (orderId) {
      case 'move': {
        const tile = screenToTile(worldPos);
        this.commandMove(units, { x: toFixed(tile.x), y: toFixed(tile.y) });
        break;
      }
      case 'attack': {
        if (targetEntity !== null) {
          const targetOwner = world.getComponent(targetEntity, Owner);
          const targetHealth = world.getComponent(targetEntity, Health);
          if (targetHealth && targetOwner && targetOwner.playerId !== this.game.localPlayerId) {
            this.commandAttack(units, targetEntity);
          } else {
            const tile = screenToTile(worldPos);
            this.commandMove(units, { x: toFixed(tile.x), y: toFixed(tile.y) });
          }
        } else {
          const tile = screenToTile(worldPos);
          this.commandMove(units, { x: toFixed(tile.x), y: toFixed(tile.y) });
        }
        break;
      }
      case 'patrol': {
        const tile = screenToTile(worldPos);
        this.commandPatrol(units, { x: toFixed(tile.x), y: toFixed(tile.y) });
        break;
      }
      case 'gather': {
        if (targetEntity !== null) {
          const targetResource = world.getComponent(targetEntity, ResourceSource);
          if (targetResource) {
            this.commandGather(units, targetEntity);
          }
        }
        break;
      }
      case 'repair': {
        if (targetEntity !== null) {
          const targetBuilding = world.getComponent(targetEntity, Building);
          const targetOwner = world.getComponent(targetEntity, Owner);
          if (targetBuilding && targetOwner && targetOwner.playerId === this.game.localPlayerId) {
            const targetPos = world.getComponent(targetEntity, Position);
            if (targetPos) {
              const tile = screenToTile(worldPos);
              this.commandMove(units, { x: toFixed(tile.x), y: toFixed(tile.y) });
            }
          }
        }
        break;
      }
    }

    this.cancelTargeting();
  }

  // ---- Left-click (normal mode) ----

  private handleLeftClick(screenPos: Point, shiftKey: boolean): void {
    const worldPos = this.renderer.screenToWorld(screenPos);
    const clickedEntity = this.renderer.entityRenderer.getEntityAtWorldPos(worldPos);
    const world = this.game.world;

    if (clickedEntity !== null) {
      if (!shiftKey) this.deselectAll();
      const sel = world.getComponent(clickedEntity, Selectable);
      if (sel) sel.selected = true;
      return;
    }

    const ownSelected = this.getCommandableSelected();
    if (ownSelected.length > 0) {
      this.issueSmartCommand(ownSelected, worldPos, null);
    } else {
      this.deselectAll();
    }
  }

  // ---- Box select ----

  private handleBoxSelect(rect: { x: number; y: number; width: number; height: number }): void {
    this.deselectAll();
    const world = this.game.world;
    const localId = this.game.localPlayerId;
    const entities = world.query(Position.type, Selectable.type, Owner.type);

    let selectedAny = false;

    for (const entityId of entities) {
      const owner = world.getComponent(entityId, Owner)!;
      if (owner.playerId !== localId) continue;
      if (world.hasComponent(entityId, Building.type)) continue;

      const pos = world.getComponent(entityId, Position)!;
      const screenPx = tileToScreen({ x: pos.tileX, y: pos.tileY });
      const sp = this.renderer.worldToScreen(screenPx);

      if (sp.x >= rect.x && sp.x <= rect.x + rect.width &&
          sp.y >= rect.y && sp.y <= rect.y + rect.height) {
        world.getComponent(entityId, Selectable)!.selected = true;
        selectedAny = true;
      }
    }

    if (!selectedAny) {
      for (const entityId of entities) {
        const pos = world.getComponent(entityId, Position)!;
        const screenPx = tileToScreen({ x: pos.tileX, y: pos.tileY });
        const sp = this.renderer.worldToScreen(screenPx);

        if (sp.x >= rect.x && sp.x <= rect.x + rect.width &&
            sp.y >= rect.y && sp.y <= rect.y + rect.height) {
          world.getComponent(entityId, Selectable)!.selected = true;
          break;
        }
      }
    }
  }

  // ---- Right-click (smart command) ----

  private handleRightClick(screenPos: Point): void {
    const ownSelected = this.getCommandableSelected();
    if (ownSelected.length === 0) return;

    const worldPos = this.renderer.screenToWorld(screenPos);
    const targetEntity = this.renderer.entityRenderer.getEntityAtWorldPos(worldPos);

    this.issueSmartCommand(ownSelected, worldPos, targetEntity);
  }

  private issueSmartCommand(
    ownUnits: EntityId[],
    worldPos: Point,
    targetEntity: EntityId | null,
  ): void {
    const world = this.game.world;

    if (targetEntity !== null) {
      const targetOwner = world.getComponent(targetEntity, Owner);
      const targetResource = world.getComponent(targetEntity, ResourceSource);

      if (targetResource) {
        this.commandGather(ownUnits, targetEntity);
        return;
      }

      if (targetOwner && targetOwner.playerId !== this.game.localPlayerId && targetOwner.playerId !== 0) {
        this.commandAttack(ownUnits, targetEntity);
        return;
      }
    }

    const tile = screenToTile(worldPos);
    this.commandMove(ownUnits, { x: toFixed(tile.x), y: toFixed(tile.y) });
  }

  // ---- Event log helpers ----

  private senderForUnits(entities: EntityId[]): EventSender {
    const world = this.game.world;

    if (entities.length === 1) {
      const ut = world.getComponent(entities[0], UnitType);
      const label = ut?.name ?? 'Unit';
      return { key: `entity:${entities[0]}`, label };
    }

    const sorted = [...entities].sort((a, b) => a - b);
    return { key: `group:${sorted.join(',')}`, label: `${entities.length} units` };
  }

  private emitOrderConfirmed(orderName: string, entities: EntityId[]): void {
    const sender = this.senderForUnits(entities);
    this.game.eventLog.push('order_confirmed', sender, orderName, this.game.world.tick);
  }

  // ---- Command implementations ----

  private clearAllStates(entityId: EntityId): void {
    const world = this.game.world;

    const behavior = world.getComponent(entityId, UnitBehavior);
    if (behavior) {
      behavior.state = 'idle';
      behavior.returnState = null;
    }

    const mov = world.getComponent(entityId, Movement);
    if (mov) mov.clearPath();

    debugState.activePaths = debugState.activePaths.filter(e => e.entityId !== entityId);

    const combat = world.getComponent(entityId, Combat);
    if (combat) combat.targetEntity = null;

    const carrier = world.getComponent(entityId, ResourceCarrier);
    if (carrier) {
      carrier.state = 'idle';
      carrier.gatherTarget = null;
    }
  }

  private commandMove(entities: EntityId[], target: Point): void {
    const world = this.game.world;
    const goalTileX = Math.round(target.x / 1000);
    const goalTileY = Math.round(target.y / 1000);
    const offsets = InputManager.getFormationOffsets(entities.length);

    if (debugState.showPaths) {
      debugState.activePaths = debugState.activePaths.filter(
        e => !entities.includes(e.entityId),
      );
    }

    for (let i = 0; i < entities.length; i++) {
      const entityId = entities[i];
      const mov = world.getComponent(entityId, Movement);
      const pos = world.getComponent(entityId, Position);
      if (!mov || !pos) continue;

      this.clearAllStates(entityId);

      const behavior = world.getComponent(entityId, UnitBehavior);
      if (behavior) behavior.state = 'moving';

      const offset = offsets[i];
      let unitGoalX = goalTileX + offset.dx;
      let unitGoalY = goalTileY + offset.dy;
      if (!this.game.gameMap.isWalkable({ x: unitGoalX, y: unitGoalY })) {
        unitGoalX = goalTileX;
        unitGoalY = goalTileY;
      }

      const startTileX = Math.round(pos.x / 1000);
      const startTileY = Math.round(pos.y / 1000);
      const path = findPath(this.game.gameMap, { x: startTileX, y: startTileY }, { x: unitGoalX, y: unitGoalY });
      if (path.length > 0) {
        mov.setPath(path);
        if (debugState.showPaths) {
          debugState.activePaths.push({ entityId, path: [...path] });
        }
      } else {
        const fallback = [{ x: unitGoalX * 1000, y: unitGoalY * 1000 }];
        mov.setPath(fallback);
        if (debugState.showPaths) {
          debugState.activePaths.push({ entityId, path: [...fallback] });
        }
      }
    }

    this.emitOrderConfirmed('Move', entities);
  }

  private commandAttack(entities: EntityId[], targetEntity: EntityId): void {
    const world = this.game.world;
    const targetPos = world.getComponent(targetEntity, Position);

    for (const entityId of entities) {
      this.clearAllStates(entityId);

      const behavior = world.getComponent(entityId, UnitBehavior);
      if (behavior) behavior.state = 'attacking';

      const combat = world.getComponent(entityId, Combat);
      if (combat) combat.targetEntity = targetEntity;

      const mov = world.getComponent(entityId, Movement);
      if (mov && targetPos) {
        mov.setPath([targetPos.toPoint()]);
      }
    }

    this.emitOrderConfirmed('Attack', entities);
  }

  private commandPatrol(entities: EntityId[], target: Point): void {
    const world = this.game.world;

    for (const entityId of entities) {
      const pos = world.getComponent(entityId, Position);
      const mov = world.getComponent(entityId, Movement);
      if (!pos || !mov) continue;

      this.clearAllStates(entityId);

      const behavior = world.getComponent(entityId, UnitBehavior);
      if (behavior) {
        behavior.state = 'patrolling';
        behavior.patrolOrigin = pos.toPoint();
        behavior.patrolTarget = target;
        behavior.patrolForward = true;
      }

      mov.setPath([target]);
    }

    this.emitOrderConfirmed('Patrol', entities);
  }

  private commandGather(entities: EntityId[], targetEntity: EntityId): void {
    const world = this.game.world;
    const targetPos = world.getComponent(targetEntity, Position);
    if (!targetPos) return;

    for (const entityId of entities) {
      const carrier = world.getComponent(entityId, ResourceCarrier);
      const mov = world.getComponent(entityId, Movement);

      if (carrier && mov) {
        this.clearAllStates(entityId);

        const behavior = world.getComponent(entityId, UnitBehavior);
        if (behavior) behavior.state = 'gathering';

        carrier.gatherTarget = targetEntity;
        carrier.state = 'moving_to_resource';
        mov.setPath([targetPos.toPoint()]);
      } else if (mov) {
        this.clearAllStates(entityId);
        const behavior = world.getComponent(entityId, UnitBehavior);
        if (behavior) behavior.state = 'moving';
        mov.setPath([targetPos.toPoint()]);
      }
    }

    this.emitOrderConfirmed('Gather', entities);
  }

  private commandStop(entities: EntityId[]): void {
    for (const entityId of entities) {
      this.clearAllStates(entityId);
    }
    this.emitOrderConfirmed('Stop', entities);
  }

  private commandHoldPosition(entities: EntityId[]): void {
    for (const entityId of entities) {
      this.clearAllStates(entityId);
      const behavior = this.game.world.getComponent(entityId, UnitBehavior);
      if (behavior) behavior.state = 'holding';
    }
    this.emitOrderConfirmed('Hold Position', entities);
  }

  // ---- Formation ----

  private static getFormationOffsets(count: number): { dx: number; dy: number }[] {
    if (count <= 1) return [{ dx: 0, dy: 0 }];

    const maxRing = Math.ceil(Math.sqrt(count)) + 1;
    const candidates: { dx: number; dy: number; dist: number }[] = [];

    for (let dx = -maxRing; dx <= maxRing; dx++) {
      for (let dy = -maxRing; dy <= maxRing; dy++) {
        candidates.push({ dx, dy, dist: dx * dx + dy * dy });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    return candidates.slice(0, count).map(c => ({ dx: c.dx, dy: c.dy }));
  }

  // ---- Selection helpers ----

  getCommandableSelected(): EntityId[] {
    const world = this.game.world;
    const localId = this.game.localPlayerId;
    const entities = world.query(Selectable.type, Owner.type);
    const result: EntityId[] = [];

    for (const entityId of entities) {
      const sel = world.getComponent(entityId, Selectable)!;
      if (!sel.selected) continue;

      const owner = world.getComponent(entityId, Owner)!;
      if (owner.playerId !== localId) continue;

      if (world.hasComponent(entityId, Movement.type)) {
        result.push(entityId);
      }
    }

    return result;
  }

  getAllSelected(): EntityId[] {
    const world = this.game.world;
    const entities = world.query(Selectable.type);
    const result: EntityId[] = [];
    for (const entityId of entities) {
      if (world.getComponent(entityId, Selectable)!.selected) {
        result.push(entityId);
      }
    }
    return result;
  }

  private deselectAll(): void {
    const world = this.game.world;
    for (const entityId of world.query(Selectable.type)) {
      world.getComponent(entityId, Selectable)!.selected = false;
    }
  }
}
