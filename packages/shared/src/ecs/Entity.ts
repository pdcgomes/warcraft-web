/**
 * Entity is simply a unique numeric ID.
 * All game objects (units, buildings, resources) are entities.
 */
export type EntityId = number;

let nextEntityId = 1;

export function createEntityId(): EntityId {
  return nextEntityId++;
}

export function resetEntityIdCounter(startFrom: number = 1): void {
  nextEntityId = startFrom;
}
