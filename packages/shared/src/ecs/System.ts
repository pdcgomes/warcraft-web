import type { World } from './World.js';

/**
 * Systems contain game logic that operates on entities with specific components.
 * Systems are executed in a fixed order every simulation tick.
 */
export abstract class System {
  abstract readonly name: string;

  /** Priority determines execution order (lower = earlier). */
  readonly priority: number = 0;

  /** Called once when the system is added to the world. */
  init(_world: World): void {}

  /** Called every simulation tick. deltaMs is the fixed timestep in ms. */
  abstract update(world: World, deltaMs: number): void;

  /** Called when the system is removed from the world. */
  destroy(_world: World): void {}
}
