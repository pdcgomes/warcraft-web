import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';
import type { GameMap } from '../map/GameMap.js';
import type { PlayerResources } from '../game/PlayerResources.js';
import type { FactionId } from '../components/Owner.js';
import type { AIPersonality } from './AIPersonality.js';
import type { AIGameInterface } from './AIGameInterface.js';
import type { TaskContext } from './tasks/Task.js';
import { AIController } from './AIController.js';
import { CommandDispatcher } from './CommandDispatcher.js';

export class AISystem extends System {
  readonly name = 'AISystem';
  readonly priority = 5;

  private controllers: AIController[] = [];
  private gameMap: GameMap;
  private playerResources: PlayerResources;
  private gameInterface: AIGameInterface;

  constructor(gameMap: GameMap, playerResources: PlayerResources, gameInterface: AIGameInterface) {
    super();
    this.gameMap = gameMap;
    this.playerResources = playerResources;
    this.gameInterface = gameInterface;
  }

  addPlayer(playerId: number, faction: FactionId, personality: AIPersonality): AIController {
    const controller = new AIController(playerId, faction, personality);
    this.controllers.push(controller);
    return controller;
  }

  getController(playerId: number): AIController | undefined {
    return this.controllers.find(c => c.playerId === playerId);
  }

  getControllers(): readonly AIController[] {
    return this.controllers;
  }

  update(world: World, _deltaMs: number): void {
    for (const controller of this.controllers) {
      const dispatch = new CommandDispatcher(world, this.gameMap);
      const ctx: TaskContext = {
        world,
        gameMap: this.gameMap,
        playerResources: this.playerResources,
        playerId: controller.playerId,
        dispatch,
        gameInterface: this.gameInterface,
      };

      controller.update(ctx);
    }
  }
}
