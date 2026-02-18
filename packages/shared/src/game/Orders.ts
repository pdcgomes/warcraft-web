import type { UnitKind } from '../components/UnitType.js';
import { UNIT_DATA } from '../data/UnitData.js';

/**
 * All possible order identifiers.
 */
export type OrderId =
  | 'move' | 'stop' | 'attack' | 'patrol' | 'hold_position'
  | 'gather' | 'repair' | 'build' | 'build_advanced';

/**
 * What kind of targeting an order needs before execution.
 * - position: click on ground
 * - entity: click on an entity
 * - position_or_entity: either ground or entity
 * - instant: executes immediately, no targeting phase
 * - submenu: opens a submenu (e.g. build menu) -- not yet implemented
 */
export type OrderTargeting =
  | 'position'
  | 'entity'
  | 'position_or_entity'
  | 'instant'
  | 'submenu';

export interface OrderDefinition {
  readonly id: OrderId;
  readonly name: string;
  readonly targeting: OrderTargeting;
}

/** Master registry of all order definitions. */
export const ORDER_DEFINITIONS: Record<OrderId, OrderDefinition> = {
  move:           { id: 'move',           name: 'Move',    targeting: 'position' },
  stop:           { id: 'stop',           name: 'Stop',    targeting: 'instant' },
  attack:         { id: 'attack',         name: 'Attack',  targeting: 'position_or_entity' },
  patrol:         { id: 'patrol',         name: 'Patrol',  targeting: 'position' },
  hold_position:  { id: 'hold_position',  name: 'Hold',    targeting: 'instant' },
  gather:         { id: 'gather',         name: 'Gather',  targeting: 'entity' },
  repair:         { id: 'repair',         name: 'Repair',  targeting: 'entity' },
  build:          { id: 'build',          name: 'Build',   targeting: 'submenu' },
  build_advanced: { id: 'build_advanced', name: 'Build+',  targeting: 'submenu' },
};

/** Orders available per unit kind, derived from UNIT_DATA. */
export const UNIT_ORDERS: Record<UnitKind, readonly OrderId[]> = (() => {
  const result = {} as Record<UnitKind, readonly OrderId[]>;
  for (const [kind, data] of Object.entries(UNIT_DATA) as [UnitKind, typeof UNIT_DATA[UnitKind]][]) {
    result[kind] = data.orders;
  }
  return result;
})();

/**
 * Get the intersection of available orders for a set of unit kinds.
 * Preserves the display order from the first unit kind.
 */
export function getAvailableOrders(unitKinds: UnitKind[]): OrderDefinition[] {
  if (unitKinds.length === 0) return [];

  const firstOrders = UNIT_ORDERS[unitKinds[0]];
  if (unitKinds.length === 1) {
    return firstOrders.map(id => ORDER_DEFINITIONS[id]);
  }

  const otherSets = unitKinds.slice(1).map(kind => new Set(UNIT_ORDERS[kind]));
  const common = firstOrders.filter(id => otherSets.every(set => set.has(id)));

  return common.map(id => ORDER_DEFINITIONS[id]);
}
