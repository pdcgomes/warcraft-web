import {
  Selectable, Owner, UnitType, Building, Health, Combat,
  ResourceCarrier, Production,
  BUILDING_DATA, UNIT_DATA, getUnitDisplayName,
} from '@warcraft-web/shared';
import type { EntityId, OrderDefinition, BuildingKind, ProductionQueueItem } from '@warcraft-web/shared';
import type { LocalGame } from '../game/LocalGame.js';
import type { GameRenderer } from '../renderer/GameRenderer.js';
import type { InputManager } from '../input/InputManager.js';

function hpBarColor(ratio: number): string {
  if (ratio > 0.6) return '#4caf50';
  if (ratio > 0.3) return '#ff9800';
  return '#f44336';
}

/**
 * Manages the HUD overlay: resource display, selected unit info, order buttons,
 * build submenus, and production buttons.
 */
export class HUD {
  private readonly game: LocalGame;
  private readonly renderer: GameRenderer;
  private readonly input: InputManager;

  private goldEl: HTMLElement;
  private lumberEl: HTMLElement;
  private supplyEl: HTMLElement;
  private tickEl: HTMLElement;
  private nameEl: HTMLElement;
  private statsEl: HTMLElement;
  private actionPanel: HTMLElement;

  /** Track the last rendered panel content to avoid redundant DOM updates. */
  private lastPanelKey: string = '';

  constructor(game: LocalGame, renderer: GameRenderer, input: InputManager) {
    this.game = game;
    this.renderer = renderer;
    this.input = input;

    this.goldEl = document.getElementById('gold-count')!;
    this.lumberEl = document.getElementById('lumber-count')!;
    this.supplyEl = document.getElementById('supply-count')!;
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
    const pid = this.game.localPlayerId;
    const res = this.game.getPlayerResources(pid);
    this.goldEl.textContent = res.gold.toString();
    this.lumberEl.textContent = res.lumber.toString();

    const supply = this.game.playerResources.getSupply(pid);
    this.supplyEl.textContent = `${supply.used}/${supply.cap}`;
  }

  private updateTick(): void {
    this.tickEl.textContent = `Tick: ${this.game.world.tick}`;
  }

  private updateSelection(): void {
    const selected = this.getSelectedEntities();

    const buildCat = this.input.getBuildMenuCategory();
    if (buildCat !== null) {
      this.renderBuildMenu(buildCat);
      return;
    }
    if (this.input.getPlacingBuilding() !== null) {
      this.renderPlacementInfo();
      return;
    }

    if (selected.length === 0) {
      this.nameEl.textContent = 'No selection';
      this.statsEl.innerHTML = '';
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

    let statsHtml = '';
    if (health) {
      const ratio = health.current / health.max;
      statsHtml += `<div style="font-size:12px;color:#a0a0c0;margin-bottom:2px;">HP: ${health.current}/${health.max}</div>`;
      statsHtml += `<div class="hp-bar-container"><div class="hp-bar-fill" style="width:${ratio * 100}%;background:${hpBarColor(ratio)};"></div></div>`;
    }
    if (combat) {
      statsHtml += `<div style="font-size:11px;color:#a0a0c0;margin-top:3px;">ATK: ${combat.totalAttack} | ARM: ${combat.totalArmor} | RNG: ${Math.round(combat.attackRange / 1000)}</div>`;
    }
    if (building && !building.isComplete) {
      const pct = Math.round(building.constructionRatio * 100);
      statsHtml += `<div style="font-size:11px;color:#a0a0c0;margin-top:3px;">Construction: ${pct}%</div>`;
      statsHtml += `<div class="hp-bar-container"><div class="hp-bar-fill" style="width:${pct}%;background:#c8a82e;"></div></div>`;
    }
    const carrier = world.getComponent(entityId, ResourceCarrier);
    if (carrier && carrier.carrying > 0) {
      statsHtml += `<div style="font-size:11px;color:#a0a0c0;margin-top:3px;">Carrying: ${carrier.carrying} ${carrier.carryingType}</div>`;
    }

    if (isOwn && production && building?.isComplete && production.queue.length > 0) {
      statsHtml += this.renderProductionQueueHtml(production.queue, owner?.faction ?? 'humans');
    }

    this.statsEl.innerHTML = statsHtml;

    if (isOwn && unitType) {
      this.renderOrderButtons();
    } else if (isOwn && production && building?.isComplete) {
      this.renderProductionButtons(entityId, production);
    } else {
      this.clearActionPanel();
    }
  }

  private renderProductionQueueHtml(queue: ProductionQueueItem[], faction: string): string {
    let html = '<div class="prod-queue">';
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const displayName = getUnitDisplayName(item.unitKind, faction as 'humans' | 'orcs');
      const abbr = displayName.slice(0, 4);
      if (i === 0) {
        const pct = Math.round(((item.totalTicks - item.ticksRemaining) / item.totalTicks) * 100);
        html += `<div class="prod-queue-item"><div class="prod-queue-progress" style="width:${pct}%"></div>${abbr}</div>`;
      } else {
        html += `<div class="prod-queue-item">${abbr}</div>`;
      }
    }
    html += '</div>';
    return html;
  }

  private updateMultiSelection(selected: EntityId[]): void {
    const world = this.game.world;
    const ownCount = selected.filter(id => this.game.isOwnedByLocal(id)).length;
    const totalCount = selected.length;

    if (ownCount === totalCount) {
      this.nameEl.textContent = `${totalCount} units selected`;
    } else {
      this.nameEl.textContent = `${totalCount} selected (${ownCount} own)`;
    }

    let gridHtml = '<div class="multi-select-grid">';
    const maxDisplay = Math.min(selected.length, 12);
    for (let i = 0; i < maxDisplay; i++) {
      const eid = selected[i];
      const unitType = world.getComponent(eid, UnitType);
      const building = world.getComponent(eid, Building);
      const health = world.getComponent(eid, Health);
      const label = building?.name ?? unitType?.name ?? '?';
      const abbr = label.length > 6 ? label.slice(0, 6) : label;

      let hpHtml = '';
      if (health) {
        const ratio = health.current / health.max;
        hpHtml = `<div class="hp-bar-container"><div class="hp-bar-fill" style="width:${ratio * 100}%;background:${hpBarColor(ratio)};"></div></div>`;
      }
      gridHtml += `<div class="multi-select-unit"><span class="multi-select-label">${abbr}</span>${hpHtml}</div>`;
    }
    if (selected.length > maxDisplay) {
      gridHtml += `<div class="multi-select-unit"><span class="multi-select-label">+${selected.length - maxDisplay}</span></div>`;
    }
    gridHtml += '</div>';
    this.statsEl.innerHTML = gridHtml;

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

    const panelKey = 'orders:' + orders.map(o => o.id).join(',') + '|' + (activeOrder ?? '');

    if (panelKey === this.lastPanelKey) {
      this.updateOrderHighlight(activeOrder);
      return;
    }
    this.lastPanelKey = panelKey;

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

  // ---- Build submenu ----

  private renderBuildMenu(category: 'basic' | 'advanced'): void {
    const buildings = this.input.getAvailableBuildings(category);
    const panelKey = `build:${category}:${buildings.join(',')}`;
    if (panelKey === this.lastPanelKey) return;
    this.lastPanelKey = panelKey;

    this.nameEl.textContent = category === 'basic' ? 'Build' : 'Build Advanced';
    this.statsEl.textContent = 'Select a building to place (Esc to cancel)';

    this.actionPanel.innerHTML = '';

    for (let i = 0; i < buildings.length; i++) {
      const kind = buildings[i];
      const data = BUILDING_DATA[kind];
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = `<span class="order-hotkey">${i + 1}</span><span class="order-name">${data.name}</span><span class="order-hotkey">${data.cost.gold}g ${data.cost.lumber}l</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.input.selectBuildingToPlace(kind);
      });
      this.actionPanel.appendChild(btn);
    }
  }

  // ---- Placement info ----

  private renderPlacementInfo(): void {
    const kind = this.input.getPlacingBuilding()!;
    const data = BUILDING_DATA[kind];
    const panelKey = `place:${kind}`;
    if (panelKey === this.lastPanelKey) return;
    this.lastPanelKey = panelKey;

    this.nameEl.textContent = `Placing ${data.name}`;
    this.statsEl.textContent = 'Click to place, right-click or Esc to cancel';
    this.actionPanel.innerHTML = '';
  }

  // ---- Production buttons ----

  private renderProductionButtons(entityId: EntityId, production: { canProduce: string[] }): void {
    const owner = this.game.world.getComponent(entityId, Owner);
    const faction = owner?.faction ?? 'humans';
    const ownedKinds = this.game.getOwnedBuildingKinds(owner?.playerId ?? this.game.localPlayerId);

    const panelKey = `prod:${entityId}:${production.canProduce.join(',')}`;
    if (panelKey === this.lastPanelKey) return;
    this.lastPanelKey = panelKey;

    this.actionPanel.innerHTML = '';

    for (let i = 0; i < production.canProduce.length; i++) {
      const unitKind = production.canProduce[i] as import('@warcraft-web/shared').UnitKind;
      const unitData = UNIT_DATA[unitKind];
      if (!unitData) continue;

      if (unitData.requires.length > 0) {
        let met = true;
        for (const group of unitData.requires) {
          if (!group.some(k => ownedKinds.has(k))) { met = false; break; }
        }
        if (!met) continue;
      }

      const displayName = getUnitDisplayName(unitKind, faction);
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.innerHTML = `<span class="order-hotkey">${i + 1}</span><span class="order-name">${displayName}</span><span class="order-hotkey">${unitData.cost.gold}g ${unitData.cost.lumber}l</span>`;
      btn.addEventListener('click', () => {
        const failReason = this.game.queueProduction(entityId, unitKind);
        if (failReason) {
          this.game.eventLog.push(
            'order_confirmed',
            { key: 'system', label: 'System' },
            failReason,
            this.game.world.tick,
          );
        }
      });
      this.actionPanel.appendChild(btn);
    }
  }

  private clearActionPanel(): void {
    if (this.lastPanelKey !== '') {
      this.lastPanelKey = '';
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
