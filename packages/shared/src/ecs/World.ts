import type { EntityId } from './Entity.js';
import { createEntityId } from './Entity.js';
import type { Component, ComponentClass, ComponentType } from './Component.js';
import type { System } from './System.js';

/**
 * The World is the central container for the ECS.
 * It manages all entities, components, and systems.
 * Must be fully deterministic -- identical inputs produce identical outputs.
 */
export class World {
  private entities: Set<EntityId> = new Set();
  private componentStores: Map<ComponentType, Map<EntityId, Component>> = new Map();
  private systems: System[] = [];
  private entitiesToDestroy: EntityId[] = [];

  /** Current simulation tick number. */
  tick: number = 0;

  // --- Entity Management ---

  createEntity(): EntityId {
    const id = createEntityId();
    this.entities.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    this.entitiesToDestroy.push(id);
  }

  hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  getEntityCount(): number {
    return this.entities.size;
  }

  getAllEntities(): EntityId[] {
    return Array.from(this.entities);
  }

  // --- Component Management ---

  addComponent<T extends Component>(entityId: EntityId, component: T): void {
    if (!this.entities.has(entityId)) return;

    let store = this.componentStores.get(component.type);
    if (!store) {
      store = new Map();
      this.componentStores.set(component.type, store);
    }
    store.set(entityId, component);
  }

  removeComponent(entityId: EntityId, componentType: ComponentType): void {
    const store = this.componentStores.get(componentType);
    if (store) {
      store.delete(entityId);
    }
  }

  getComponent<T extends Component>(entityId: EntityId, componentClass: ComponentClass<T>): T | undefined {
    const store = this.componentStores.get(componentClass.type);
    if (!store) return undefined;
    return store.get(entityId) as T | undefined;
  }

  hasComponent(entityId: EntityId, componentType: ComponentType): boolean {
    const store = this.componentStores.get(componentType);
    return store !== undefined && store.has(entityId);
  }

  /**
   * Query all entities that have ALL of the specified component types.
   * Returns entity IDs sorted for deterministic iteration.
   */
  query(...componentTypes: ComponentType[]): EntityId[] {
    if (componentTypes.length === 0) return Array.from(this.entities).sort((a, b) => a - b);

    const smallestStore = componentTypes
      .map(type => this.componentStores.get(type))
      .filter((store): store is Map<EntityId, Component> => store !== undefined)
      .sort((a, b) => a.size - b.size)[0];

    if (!smallestStore) return [];

    const result: EntityId[] = [];
    for (const entityId of smallestStore.keys()) {
      if (componentTypes.every(type => this.hasComponent(entityId, type))) {
        result.push(entityId);
      }
    }

    return result.sort((a, b) => a - b);
  }

  /**
   * Get all components of a given type. Returns a Map of entityId -> component.
   */
  getComponentStore<T extends Component>(componentClass: ComponentClass<T>): Map<EntityId, T> {
    const store = this.componentStores.get(componentClass.type);
    if (!store) return new Map();
    return store as Map<EntityId, T>;
  }

  // --- System Management ---

  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    system.init(this);
  }

  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system);
    if (idx !== -1) {
      system.destroy(this);
      this.systems.splice(idx, 1);
    }
  }

  // --- Simulation Step ---

  /**
   * Advance the simulation by one tick.
   * Runs all systems in priority order, then processes deferred entity destruction.
   */
  step(deltaMs: number): void {
    this.tick++;

    for (const system of this.systems) {
      system.update(this, deltaMs);
    }

    this.flushDestroyQueue();
  }

  private flushDestroyQueue(): void {
    for (const entityId of this.entitiesToDestroy) {
      for (const store of this.componentStores.values()) {
        store.delete(entityId);
      }
      this.entities.delete(entityId);
    }
    this.entitiesToDestroy.length = 0;
  }

  // --- Serialization ---

  /**
   * Compute a deterministic checksum of the world state.
   * Used for desync detection in multiplayer.
   */
  checksum(): number {
    let hash = 0;
    const entityIds = Array.from(this.entities).sort((a, b) => a - b);

    for (const entityId of entityIds) {
      hash = (hash * 31 + entityId) | 0;

      const componentTypes = Array.from(this.componentStores.keys()).sort();
      for (const type of componentTypes) {
        const store = this.componentStores.get(type)!;
        const comp = store.get(entityId);
        if (comp) {
          const str = JSON.stringify(comp);
          for (let i = 0; i < str.length; i++) {
            hash = (hash * 31 + str.charCodeAt(i)) | 0;
          }
        }
      }
    }

    return hash >>> 0;
  }
}
