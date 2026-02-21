import type { GameMap } from './GameMap.js';
import type { FactionId } from '../components/Owner.js';
import type { UnitKind } from '../components/UnitType.js';
import type { BuildingKind } from '../components/Building.js';
import type { LevelConfig } from './LevelConfig.js';
import type { PlayerSpawn } from './FactionPass.js';
import type { Point } from '../math/Point.js';

export interface EntitySpawn {
  playerId: number;
  faction: FactionId;
  kind: UnitKind | BuildingKind;
  entityType: 'unit' | 'building';
  /** Absolute tile position (resolved from spawn + offset). */
  pos: Point;
}

export interface StartingResources {
  playerId: number;
  gold: number;
  lumber: number;
}

interface FactionTemplate {
  buildings: { kind: BuildingKind; dx: number; dy: number }[];
  units: { kind: UnitKind; dx: number; dy: number }[];
  resources: { gold: number; lumber: number };
}

const FACTION_TEMPLATES: Record<FactionId, FactionTemplate> = {
  humans: {
    buildings: [
      { kind: 'town_hall', dx: 0, dy: 0 },
    ],
    units: [
      { kind: 'worker', dx: 1, dy: 4 },
      { kind: 'worker', dx: 2, dy: 4 },
      { kind: 'worker', dx: 3, dy: 4 },
      { kind: 'footman', dx: -2, dy: 1 },
      { kind: 'footman', dx: -2, dy: 2 },
    ],
    resources: { gold: 2000, lumber: 1000 },
  },
  orcs: {
    buildings: [
      { kind: 'great_hall', dx: 0, dy: 0 },
    ],
    units: [
      { kind: 'worker', dx: 1, dy: 4 },
      { kind: 'worker', dx: 2, dy: 4 },
      { kind: 'worker', dx: 3, dy: 4 },
      { kind: 'grunt', dx: -2, dy: 1 },
      { kind: 'grunt', dx: -2, dy: 2 },
    ],
    resources: { gold: 2000, lumber: 1000 },
  },
};

/**
 * Pass 4: Compose starting entities and resources for each player.
 *
 * Uses faction-specific templates to determine buildings, units, and
 * starting resources. Validates that each unit placement lands on a
 * walkable tile, spiralling outward if necessary.
 */
export class StartingForcePass {
  private config: LevelConfig;

  constructor(config: LevelConfig) {
    this.config = config;
  }

  compose(map: GameMap, spawns: PlayerSpawn[]): { entities: EntitySpawn[]; resources: StartingResources[] } {
    const entities: EntitySpawn[] = [];
    const resources: StartingResources[] = [];

    for (const spawn of spawns) {
      const playerCfg = this.config.players.find(p => p.playerId === spawn.playerId);
      if (!playerCfg) continue;

      const template = FACTION_TEMPLATES[playerCfg.faction];

      for (const b of template.buildings) {
        entities.push({
          playerId: spawn.playerId,
          faction: playerCfg.faction,
          kind: b.kind,
          entityType: 'building',
          pos: { x: spawn.pos.x + b.dx, y: spawn.pos.y + b.dy },
        });
      }

      for (const u of template.units) {
        const target = { x: spawn.pos.x + u.dx, y: spawn.pos.y + u.dy };
        const resolved = findNearestWalkable(map, target) ?? target;
        entities.push({
          playerId: spawn.playerId,
          faction: playerCfg.faction,
          kind: u.kind,
          entityType: 'unit',
          pos: resolved,
        });
      }

      resources.push({
        playerId: spawn.playerId,
        gold: template.resources.gold,
        lumber: template.resources.lumber,
      });
    }

    return { entities, resources };
  }
}

/** Spiral outward from `p` to find the nearest walkable tile. */
function findNearestWalkable(map: GameMap, p: Point): Point | null {
  if (map.isWalkable(p)) return p;

  for (let radius = 1; radius <= 8; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const np = { x: p.x + dx, y: p.y + dy };
        if (map.inBounds(np) && map.isWalkable(np)) return np;
      }
    }
  }
  return null;
}
