import { TerrainType } from '@warcraft-web/shared';
import type { UnitKind } from '@warcraft-web/shared';
import type { BuildingKind } from '@warcraft-web/shared';

/**
 * Maps terrain types to their 3 variation sprite paths.
 * Index 0/1/2 = variation a/b/c.
 */
export const TERRAIN_ASSETS: Record<TerrainType, readonly string[]> = {
  [TerrainType.Grass]:  ['assets/terrain/grass_a.png',  'assets/terrain/grass_b.png',  'assets/terrain/grass_c.png'],
  [TerrainType.Dirt]:   ['assets/terrain/dirt_a.png',   'assets/terrain/dirt_b.png',   'assets/terrain/dirt_c.png'],
  [TerrainType.Water]:  ['assets/terrain/water_a.png',  'assets/terrain/water_b.png',  'assets/terrain/water_c.png'],
  [TerrainType.Forest]: ['assets/terrain/forest_a.png', 'assets/terrain/forest_b.png', 'assets/terrain/forest_c.png'],
  [TerrainType.Stone]:  ['assets/terrain/stone_a.png',  'assets/terrain/stone_b.png',  'assets/terrain/stone_c.png'],
  [TerrainType.Sand]:   ['assets/terrain/sand_a.png',   'assets/terrain/sand_b.png',   'assets/terrain/sand_c.png'],
};

/**
 * Maps unit kinds to sprite paths.
 * Workers have a faction-specific variant keyed as "worker_orcs".
 */
export const UNIT_ASSETS: Partial<Record<UnitKind | 'worker_orcs', string>> = {
  worker:            'assets/units/worker.png',
  worker_orcs:       'assets/units/peon.png',
  footman:           'assets/units/footman.png',
  grunt:             'assets/units/grunt.png',
  archer:            'assets/units/archer.png',
  troll_axethrower:  'assets/units/troll_axethrower.png',
  knight:            'assets/units/knight.png',
  raider:            'assets/units/raider.png',
  ballista:          'assets/units/ballista.png',
  catapult:          'assets/units/catapult.png',
  cleric:            'assets/units/cleric.png',
  shaman:            'assets/units/shaman.png',
};

export const BUILDING_ASSETS: Partial<Record<BuildingKind, string>> = {
  town_hall:    'assets/buildings/town_hall.png',
  great_hall:   'assets/buildings/great_hall.png',
  barracks:     'assets/buildings/barracks.png',
  lumber_mill:  'assets/buildings/lumber_mill.png',
  war_mill:     'assets/buildings/war_mill.png',
  blacksmith:   'assets/buildings/blacksmith.png',
  stable:       'assets/buildings/stable.png',
  beastiary:    'assets/buildings/beastiary.png',
  farm:         'assets/buildings/farm.png',
  pig_farm:     'assets/buildings/pig_farm.png',
  tower:        'assets/buildings/tower.png',
  guard_tower:  'assets/buildings/guard_tower.png',
};

export const RESOURCE_ASSETS: Record<string, string> = {
  gold_mine: 'assets/resources/gold_mine.png',
  tree_a:    'assets/resources/tree_a.png',
  tree_b:    'assets/resources/tree_b.png',
  tree_c:    'assets/resources/tree_c.png',
};

/** Collect every asset path for bulk preloading. */
export function getAllAssetPaths(): string[] {
  const paths: string[] = [];
  for (const variations of Object.values(TERRAIN_ASSETS)) {
    paths.push(...variations);
  }
  for (const path of Object.values(UNIT_ASSETS)) {
    if (path) paths.push(path);
  }
  for (const path of Object.values(BUILDING_ASSETS)) {
    if (path) paths.push(path);
  }
  for (const path of Object.values(RESOURCE_ASSETS)) {
    paths.push(path);
  }
  return paths;
}
