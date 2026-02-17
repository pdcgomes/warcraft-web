import {
  Selectable, Owner, UnitType, Building, Health, Combat,
  ResourceCarrier, Production,
} from '@warcraft-web/shared';
import type { EntityId, OrderDefinition } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import type { GameRenderer } from '../renderer/GameRenderer.js';
import type { InputManager } from '../input/InputManager.js';

/**
 * Manages the HUD overlay: resource display, selected unit info, order buttons.
 */
export class HUD {
  private readonly game: LocalGame;
  private readonly renderer: GameRenderer;
  private readonly input: InputManager;

  private goldEl: HTMLElement;
  private lumberEl: HTMLElement;
  private tickEl: HTMLElement;
  private nameEl: HTMLElement;
  private statsEl: HTMLElement;
  private actionPanel: HTMLElement;

  /** Track the last rendered order set to avoid redundant DOM updates. */
  private lastOrderKey: string = '';

  constructor(game: LocalGame, renderer: GameRenderer, input: InputManager) {
    this.game = game;
    this.renderer = renderer;
    this.input = input;

    this.goldEl = document.getElementById('gold-count')!;
    this.lumberEl = document.getElementById('lumber-count')!;
    this.tickEl = document.getElementById('tick-count')!;
    this.nameEl = document.getElementById('selected-name')!;
    this.statsEl = document.getElementById('selected-stats')!;
    this.actionPanel = document.getElementById('action-panel')!;
  }

  update(): void {
    this.updateResources();
    this.updateSelection();
    this.updateTick();
  }

  private updateResources(): void {
    const res = this.game.getPlayerResources(this.game.localPlayerId);
    this.goldEl.textContent = res.gold.toString();
    this.lumberEl.textContent = res.lumber.toString();
  }

  private updateTick(): void {
    this.tickEl.textContent = `Tick: ${this.game.world.tick}`;
  }

  private updateSelection(): void {
    const selected = this.getSelectedEntities();

    if (selected.length === 0) {
      this.nameEl.textContent = 'No selection';
      this.statsEl.textContent = '';
      this.clearActionPanel();
      return;
    }

    if (selected.length === 1) {
      this.updateSingleSelection(selected[0]);
    } else {
      this.updateMultiSelection(selected);
    }
  }

  private updateSingleSelection(entityId: EntityId): void {
    const world = this.game.world;

    const unitType = world.getComponent(entityId, UnitType);
    const building = world.getComponent(entityId, Building);
    const health = world.getComponent(entityId, Health);
    const combat = world.getComponent(entityId, Combat);
    const production = world.getComponent(entityId, Production);
    const owner = world.getComponent(entityId, Owner);

    const name = building?.name ?? unitType?.name ?? 'Entity';
    const isOwn = owner !== undefined && owner.playerId === this.game.localPlayerId;
    const factionLabel = !isOwn && owner ? ` (${owner.faction})` : '';
    this.nameEl.textContent = name + factionLabel;

    const stats: string[] = [];
    if (health) {
      stats.push(`HP: ${health.current}/${health.max}`);
    }
    if (combat) {
      stats.push(`ATK: ${combat.totalAttack} | ARM: ${combat.totalArmor}`);
    }
    if (building && !building.isComplete) {
      stats.push(`Building: ${Math.round(building.constructionRatio * 100)}%`);
    }
    const carrier = world.getComponent(entityId, ResourceCarrier);
    if (carrier && carrier.carrying > 0) {
      stats.push(`Carrying: ${carrier.carrying} ${carrier.carryingType}`);
    }
    this.statsEl.textContent = stats.join(' | ');

    // Action panel: order buttons for own units, production for own buildings
    if (isOwn && unitType) {
      this.renderOrderButtons();
    } else if (isOwn && production && building?.isComplete) {
      this.renderProductionButtons(entityId, production);
    } else {
      this.clearActionPanel();
    }
  }

  private updateMultiSelection(selected: EntityId[]): void {
    const ownCount = selected.filter(id => this.game.isOwnedByLocal(id)).length;
    const totalCount = selected.length;

    if (ownCount === totalCount) {
      this.nameEl.textContent = `${totalCount} units selected`;
    } else {
      this.nameEl.textContent = `${totalCount} selected (${ownCount} own)`;
    }
    this.statsEl.textContent = '';

    // Show order buttons for multi-selection (intersection)
    if (ownCount > 0) {
      this.renderOrderButtons();
    } else {
      this.clearActionPanel();
    }
  }

  // ---- Order buttons ----

  private renderOrderButtons(): void {
    const orders = this.input.getCurrentOrders();
    const activeOrder = this.input.getActiveOrder();

    // Build a key to detect if we need to rebuild DOM
    const orderKey = orders.map(o => o.id).join(',') + '|' + (activeOrder ?? '');

    if (orderKey === this.lastOrderKey) {
      // Just update highlight state without rebuilding
      this.updateOrderHighlight(activeOrder);
      return;
    }
    this.lastOrderKey = orderKey;

    this.actionPanel.innerHTML = '';

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      if (order.id === activeOrder) {
        btn.classList.add('action-btn-active');
      }
      btn.dataset.orderId = order.id;
      btn.innerHTML = `<span class="order-hotkey">${i + 1}</span><span class="order-name">${order.name}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.input.activateOrder(order.id);
      });
      this.actionPanel.appendChild(btn);
    }
  }

  private updateOrderHighlight(activeOrder: string | null): void {
    const buttons = this.actionPanel.querySelectorAll('.action-btn');
    for (const btn of buttons) {
      const el = btn as HTMLElement;
      if (el.dataset.orderId === activeOrder) {
        el.classList.add('action-btn-active');
      } else {
        el.classList.remove('action-btn-active');
      }
    }
  }

  private renderProductionButtons(entityId: EntityId, production: { canProduce: string[] }): void {
    this.lastOrderKey = '';
    this.actionPanel.innerHTML = '';

    for (let i = 0; i < production.canProduce.length; i++) {
      const unitKind = production.canProduce[i];
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = `<span class="order-hotkey">${i + 1}</span><span class="order-name">${unitKind.replace('_', ' ')}</span>`;
      btn.addEventListener('click', () => {
        this.game.queueProduction(entityId, unitKind as any);
      });
      this.actionPanel.appendChild(btn);
    }
  }

  private clearActionPanel(): void {
    if (this.lastOrderKey !== '') {
      this.lastOrderKey = '';
      this.actionPanel.innerHTML = '';
    }
  }

  // ---- Helpers ----

  private getSelectedEntities(): EntityId[] {
    const world = this.game.world;
    const entities = world.query(Selectable.type);
    const selected: EntityId[] = [];

    for (const entityId of entities) {
      const selectable = world.getComponent(entityId, Selectable)!;
      if (selectable.selected) {
        selected.push(entityId);
      }
    }

    return selected;
  }
}
