import type { GameMap } from './GameMap.js';
import { SeededRng } from './SeededRng.js';
import type { LevelConfig } from './LevelConfig.js';
import { TerrainPass } from './TerrainPass.js';
import { FactionPass } from './FactionPass.js';
import type { PlayerSpawn } from './FactionPass.js';
import { ResourcePass } from './ResourcePass.js';
import type { ResourceSpawn } from './ResourcePass.js';
import { StartingForcePass } from './StartingForcePass.js';
import type { EntitySpawn, StartingResources } from './StartingForcePass.js';

export interface GeneratedLevel {
  seed: number;
  map: GameMap;
  playerSpawns: PlayerSpawn[];
  resourceSpawns: ResourceSpawn[];
  entitySpawns: EntitySpawn[];
  startingResources: StartingResources[];
}

const MAX_RETRIES = 3;

/**
 * Orchestrates the multi-pass level generation pipeline.
 *
 * 1. TerrainPass  — procedural terrain via simplex noise
 * 2. FactionPass  — spawn point placement with distance constraints
 * 3. ResourcePass — gold mine + lumber cluster placement with fairness
 * 4. StartingForcePass — starting buildings, units, and resources
 *
 * If connectivity validation fails, the generator retries with a derived
 * seed up to MAX_RETRIES times.
 */
export class LevelGenerator {
  generate(config: LevelConfig): GeneratedLevel {
    let seed = config.seed;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const rng = new SeededRng(seed);

      const terrainPass = new TerrainPass(rng, config);
      const map = terrainPass.generate();

      const factionPass = new FactionPass(rng, config);
      const playerSpawns = factionPass.place(map);

      if (playerSpawns.length < config.players.length && attempt < MAX_RETRIES) {
        seed = (seed + 0x9e3779b9) | 0;
        continue;
      }

      const resourcePass = new ResourcePass(rng, config);
      const resourceSpawns = resourcePass.place(map, playerSpawns);

      const forcePass = new StartingForcePass(config);
      const { entities, resources } = forcePass.compose(map, playerSpawns);

      return {
        seed,
        map,
        playerSpawns,
        resourceSpawns,
        entitySpawns: entities,
        startingResources: resources,
      };
    }

    // Should never reach here, but satisfy the type system
    throw new Error('Level generation failed after maximum retries');
  }
}
