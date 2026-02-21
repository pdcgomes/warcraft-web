import type { FactionId } from '../components/Owner.js';

export type MapSize = 'small' | 'medium' | 'large' | 'extra_large' | 'extra_extra_large';

export const MAP_SIZE_PRESETS: Record<MapSize, { width: number; height: number }> = {
  small:             { width: 48, height: 48 },
  medium:            { width: 64, height: 64 },
  large:             { width: 96, height: 96 },
  extra_large:       { width: 128, height: 128 },
  extra_extra_large: { width: 192, height: 192 },
};

export interface LevelConfig {
  seed: number;
  mapSize: MapSize;
  /** Override preset dimensions when set. */
  mapWidth?: number;
  mapHeight?: number;

  players: PlayerConfig[];

  waterCoverage: number;
  forestCoverage: number;
  mountainCoverage: number;
  noiseScale: number;

  goldMinesPerPlayer: number;
  goldPerMine: number;
  lumberPerCluster: number;

  /** Minimum spawn distance as a fraction of the map diagonal. */
  minSpawnDistanceFraction: number;
}

export interface PlayerConfig {
  playerId: number;
  faction: FactionId;
}

export function resolveMapDimensions(config: LevelConfig): { width: number; height: number } {
  if (config.mapWidth !== undefined && config.mapHeight !== undefined) {
    return { width: config.mapWidth, height: config.mapHeight };
  }
  return MAP_SIZE_PRESETS[config.mapSize];
}

/** Compute how many gold mines each player should get based on map area. */
export function scaledGoldMines(config: LevelConfig): number {
  if (config.goldMinesPerPlayer > 0) return config.goldMinesPerPlayer;
  const { width, height } = resolveMapDimensions(config);
  const area = width * height;
  const baseArea = 64 * 64;
  return Math.max(2, Math.floor(2 + (area / baseArea - 1)));
}

export function createDefaultConfig(
  faction: FactionId,
  opponentFaction: FactionId,
  overrides?: Partial<LevelConfig>,
): LevelConfig {
  return {
    seed: (Math.random() * 0xffffffff) | 0,
    mapSize: 'medium',
    players: [
      { playerId: 1, faction },
      { playerId: 2, faction: opponentFaction },
    ],
    waterCoverage: 0.12,
    forestCoverage: 0.15,
    mountainCoverage: 0.04,
    noiseScale: 1.0,
    goldMinesPerPlayer: 2,
    goldPerMine: 10000,
    lumberPerCluster: 5000,
    minSpawnDistanceFraction: 0.55,
    ...overrides,
  };
}
