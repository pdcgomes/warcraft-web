import type { Component } from '../ecs/Component.js';

export type UnitKind =
  | 'worker'
  | 'footman' | 'grunt'
  | 'archer' | 'troll_axethrower'
  | 'knight' | 'raider'
  | 'catapult' | 'ballista'
  | 'cleric' | 'shaman';

export class UnitType implements Component {
  static readonly type = 'UnitType' as const;
  readonly type = UnitType.type;

  kind: UnitKind;

  /** Display name */
  name: string;

  /** Size in tiles (1 for units, 2+ for large units) */
  tileSize: number;

  constructor(kind: UnitKind, name: string, tileSize: number = 1) {
    this.kind = kind;
    this.name = name;
    this.tileSize = tileSize;
  }
}
