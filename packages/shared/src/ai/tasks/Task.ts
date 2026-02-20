import type { World } from '../../ecs/World.js';
import type { GameMap } from '../../map/GameMap.js';
import type { PlayerResources } from '../../game/PlayerResources.js';
import type { CommandDispatcher } from '../CommandDispatcher.js';
import type { AIGameInterface } from '../AIGameInterface.js';

export interface TaskContext {
  world: World;
  gameMap: GameMap;
  playerResources: PlayerResources;
  playerId: number;
  dispatch: CommandDispatcher;
  gameInterface: AIGameInterface;
}

export interface Task {
  readonly id: string;
  readonly domain: string;
  readonly label: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  execute(ctx: TaskContext): void;
  isValid(ctx: TaskContext): boolean;
}

let taskIdCounter = 0;
export function nextTaskId(prefix: string): string {
  return `${prefix}-${++taskIdCounter}`;
}
