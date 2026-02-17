import type { EntityId, UnitKind, BuildingKind } from '@warcraft-web/shared';

/**
 * Game command types for the command queue.
 */
export type GameCommand =
  | { type: 'move'; entities: EntityId[]; targetX: number; targetY: number }
  | { type: 'attack'; entities: EntityId[]; targetEntity: EntityId }
  | { type: 'gather'; entities: EntityId[]; targetEntity: EntityId }
  | { type: 'build'; entity: EntityId; buildingKind: BuildingKind; x: number; y: number }
  | { type: 'train'; buildingEntity: EntityId; unitKind: UnitKind }
  | { type: 'stop'; entities: EntityId[] }
  | { type: 'patrol'; entities: EntityId[]; targetX: number; targetY: number };

/**
 * Queues player commands to be processed on the next simulation tick.
 * In multiplayer, commands are sent to the server; in single-player they execute immediately.
 */
export class CommandQueue {
  private commands: GameCommand[] = [];

  push(command: GameCommand): void {
    this.commands.push(command);
  }

  drain(): GameCommand[] {
    const cmds = this.commands;
    this.commands = [];
    return cmds;
  }

  isEmpty(): boolean {
    return this.commands.length === 0;
  }
}
