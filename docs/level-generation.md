# Level Generation System

## Overview

The level generation system produces complete game levels procedurally from a single integer seed. Every aspect of the level — terrain, resources, spawn locations, and starting forces — is deterministic for a given seed, which is critical for multiplayer lockstep synchronisation.

The system is a pipeline of four sequential passes, each building on the output of the previous.

```
LevelConfig ─► TerrainPass ─► FactionPass ─► ResourcePass ─► StartingForcePass ─► GeneratedLevel
```

All generation code lives in `packages/shared/src/map/` and runs identically on client and server.

---

## Architecture

### Pipeline Passes

| Pass | File | Input | Output |
|------|------|-------|--------|
| 1. Terrain | `TerrainPass.ts` | LevelConfig + RNG | GameMap (tile grid) |
| 2. Factions | `FactionPass.ts` | GameMap + RNG | PlayerSpawn[] (positions + cleared areas) |
| 3. Resources | `ResourcePass.ts` | GameMap + PlayerSpawns + RNG | ResourceSpawn[] (gold mines + lumber clusters) |
| 4. Starting Force | `StartingForcePass.ts` | GameMap + PlayerSpawns + Config | EntitySpawn[] + StartingResources[] |

### Seeded RNG

`SeededRng` (mulberry32 algorithm) provides deterministic random numbers from a 32-bit integer seed. Each pass receives the same RNG instance, which is consumed sequentially. Child seeds can be derived for sub-generators (e.g., separate noise instances) via `rng.deriveSeed()`.

### LevelGenerator Orchestrator

`LevelGenerator.generate(config)` chains the passes and returns a `GeneratedLevel` containing everything needed to initialise a game session. If a generation attempt fails connectivity validation, it retries with a derived seed up to 3 times.

---

## Pass Details

### Pass 1: Terrain Generation

Uses multi-octave 2D simplex noise to generate two maps:
- **Heightmap** — controls elevation-based biomes (water, sand, grass, stone/mountains)
- **Moisture map** — controls vegetation (forest placement)

Biome thresholds are computed dynamically to hit target coverage fractions (e.g., 12% water, 15% forest). An edge falloff prevents water and mountains from abutting the map boundary.

Post-processing:
- Small isolated water pools (< 6 tiles) are converted to grass
- Isolated forest tiles with fewer than 3 forest neighbours are removed
- Sand beaches are added as a 1-tile fringe around water
- If total walkable area falls below 50%, forest/stone tiles are converted to grass

### Pass 2: Faction Placement

Scans the terrain for candidate spawn zones — contiguous 7×7 walkable regions. Player 1's spawn is chosen randomly from candidates. Player 2's spawn is selected with:
- A minimum distance constraint (55% of the map diagonal by default)
- A weighted preference for positions far from Player 1 (quadratic distance weighting)

After selection, each spawn gets a 7×7 area cleared to grass with a 3×3 dirt center. A BFS connectivity check ensures all spawns are reachable; if not, a 3-tile-wide corridor is carved using Bresenham's line algorithm.

### Pass 3: Resource Placement

**Gold mines** are placed in symmetric pairs using 180° rotational symmetry around the map center. For each mine near Player 1's spawn, a mirror mine appears at the corresponding position relative to Player 2. Mines are 3×3 stone patches with 10,000 gold each.

**Lumber** clusters are detected via flood-fill on existing forest tiles from the terrain pass. Clusters of 6+ tiles each get a lumber resource spawn (5,000 lumber) at their centroid.

The number of gold mines scales with map area: 2 on small/medium maps, more on larger maps.

### Pass 4: Starting Force Composition

Uses per-faction templates to define starting buildings, units, and resources:

| Faction | Building | Units | Resources |
|---------|----------|-------|-----------|
| Humans | Town Hall | 3 Peasants, 2 Footmen | 2000 gold, 1000 lumber |
| Orcs | Great Hall | 3 Peons, 2 Grunts | 2000 gold, 1000 lumber |

Unit positions are resolved relative to the spawn point. If a target tile is unwalkable (e.g., overlapping a resource), the system spirals outward to find the nearest walkable tile.

---

## Configuration

`LevelConfig` controls all generation parameters:

```typescript
interface LevelConfig {
  seed: number;
  mapSize: MapSize;                    // 'small' | 'medium' | 'large' | 'extra_large' | 'extra_extra_large'
  mapWidth?: number;                   // override preset
  mapHeight?: number;
  players: PlayerConfig[];
  waterCoverage: number;               // target fraction (default 0.12)
  forestCoverage: number;              // target fraction (default 0.15)
  mountainCoverage: number;            // target fraction (default 0.04)
  noiseScale: number;                  // feature size multiplier (default 1.0)
  goldMinesPerPlayer: number;          // default 2
  goldPerMine: number;                 // default 10000
  lumberPerCluster: number;            // default 5000
  minSpawnDistanceFraction: number;    // fraction of diagonal (default 0.55)
}
```

### Map Size Presets

| Preset | Dimensions | Typical Gold Mines/Player |
|--------|-----------|---------------------------|
| `small` | 48×48 | 2 |
| `medium` | 64×64 | 2 |
| `large` | 96×96 | 3 |
| `extra_large` | 128×128 | 5 |
| `extra_extra_large` | 192×192 | 10 |

`createDefaultConfig(faction, opponentFaction)` returns sensible defaults for a standard 2-player game.

---

## Integration

### LocalGame / NetworkGame

Both `LocalGame.init()` and `NetworkGame.init()` create a `LevelGenerator`, call `generate()`, and iterate the resulting `GeneratedLevel` to spawn entities via `EntityFactory`. No spawn logic remains inline — all entity composition is data-driven through the `StartingForcePass` templates.

### Multiplayer

For multiplayer, the server distributes the seed to all clients. Since the entire pipeline is deterministic for a given seed, all clients produce identical levels without transferring map data.

---

## Future Extensions

- **Asymmetric resource distribution** — adjust `ResourcePass` fairness tolerance for harder scenarios
- **Variable starting forces** — different `StartingForcePass` templates for difficulty levels
- **Map size UI** — wire `LevelConfig.mapSize` to the faction selection screen
- **Multiple terrain themes** — swap biome threshold tables for desert, snow, or volcanic maps
- **More than 2 players** — `FactionPass` already supports N players via the `players[]` config array
