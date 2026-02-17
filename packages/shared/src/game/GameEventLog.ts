/**
 * Extensible game event log.
 *
 * Any system or client code can push events. The log maintains a capped
 * history that the UI reads from. Event types are a discriminated union
 * so new categories can be added without touching existing code.
 *
 * Each event carries a `sender` describing who or what produced the event.
 * Senders can be specific entities (units/buildings) identified by a
 * unique key and a display label, or system-level alerts with a fixed
 * label like "Alert". The event model itself carries no color information;
 * the UI layer assigns and tracks colors per sender.
 */

export type GameEventType =
  | 'order_confirmed'
  | 'order_completed'
  | 'training_complete'
  | 'unit_under_attack'
  | 'unit_killed'
  | 'building_complete'
  | 'resources_depleted'
  | 'generic';

/**
 * Identifies the source of a game event.
 *
 * - `key`   — stable identifier for color assignment (e.g. "entity:42"
 *             or "system:alert"). Two events with the same key will always
 *             share a color in the UI.
 * - `label` — human-readable name shown in the log (e.g. "Footman",
 *             "Town Hall", "Alert").
 */
export interface EventSender {
  readonly key: string;
  readonly label: string;
}

export interface GameEvent {
  /** Event category for filtering. */
  type: GameEventType;
  /** Who or what produced this event. */
  sender: EventSender;
  /** Human-readable message body. */
  message: string;
  /** Simulation tick when the event occurred. */
  tick: number;
  /** Wall-clock timestamp (ms) for UI display. */
  timestamp: number;
}

const MAX_EVENTS = 100;

/**
 * Default throttle window in simulation ticks.
 * At 10 ticks/second this is ~5 seconds.
 */
const DEFAULT_THROTTLE_TICKS = 50;

export class GameEventLog {
  private events: GameEvent[] = [];

  /** Monotonically increasing counter so the UI can detect new entries. */
  private _version = 0;

  /**
   * Tracks the last tick at which a throttled event was emitted,
   * keyed by `"type|senderKey"`.
   */
  private throttleMap: Map<string, number> = new Map();

  get version(): number {
    return this._version;
  }

  /** Push a new event unconditionally. */
  push(type: GameEventType, sender: EventSender, message: string, tick: number): void {
    this.events.push({
      type,
      sender,
      message,
      tick,
      timestamp: Date.now(),
    });

    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }

    this._version++;
  }

  /**
   * Push an event only if enough ticks have elapsed since the last event
   * with the same (type, sender.key) pair.
   *
   * Returns true if the event was actually emitted.
   */
  pushThrottled(
    type: GameEventType,
    sender: EventSender,
    message: string,
    tick: number,
    cooldownTicks: number = DEFAULT_THROTTLE_TICKS,
  ): boolean {
    const throttleKey = `${type}|${sender.key}`;
    const lastTick = this.throttleMap.get(throttleKey);

    if (lastTick !== undefined && tick - lastTick < cooldownTicks) {
      return false;
    }

    this.throttleMap.set(throttleKey, tick);
    this.push(type, sender, message, tick);
    return true;
  }

  /** Get the N most recent events (newest last). */
  recent(count: number): readonly GameEvent[] {
    const start = Math.max(0, this.events.length - count);
    return this.events.slice(start);
  }

  /** Total number of events ever pushed (wraps on clear). */
  get length(): number {
    return this.events.length;
  }

  clear(): void {
    this.events.length = 0;
    this.throttleMap.clear();
    this._version++;
  }
}
