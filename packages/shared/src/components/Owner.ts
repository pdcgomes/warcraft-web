import type { Component } from '../ecs/Component.js';

export type PlayerId = number;
export type FactionId = 'humans' | 'orcs';

/**
 * Identifies which player owns this entity and their faction.
 * PlayerId 0 = neutral (resources, critters).
 */
export class Owner implements Component {
  static readonly type = 'Owner' as const;
  readonly type = Owner.type;

  playerId: PlayerId;
  faction: FactionId;

  constructor(playerId: PlayerId, faction: FactionId) {
    this.playerId = playerId;
    this.faction = faction;
  }
}
