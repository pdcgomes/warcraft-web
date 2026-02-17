import type { GameEventLog, GameEvent } from '@warcraft-web/shared';

const VISIBLE_COUNT = 8;
const FADE_AFTER_MS = 6000;

/**
 * Palette of distinguishable colors assigned to senders on first encounter.
 * Designed for readability against a dark game background.
 */
const SENDER_PALETTE = [
  '#88cc88', // soft green
  '#66aaff', // sky blue
  '#ffcc44', // gold
  '#cc88ff', // lavender
  '#ff9966', // peach
  '#66ddcc', // teal
  '#ff88aa', // rose
  '#aabb44', // olive-lime
  '#44ccee', // cyan
  '#ddaa77', // tan
  '#bb88dd', // lilac
  '#88ddaa', // mint
];

/**
 * Scrollable, auto-fading event log panel overlaid on the game viewport.
 * Shows the most recent game events in a chat-like feed.
 *
 * Colors are assigned per-sender (by `sender.key`) the first time a sender
 * emits an event, and reused consistently afterwards. The event model
 * carries no color information.
 */
export class EventLogPanel {
  private readonly log: GameEventLog;
  private readonly container: HTMLElement;
  private lastVersion = -1;

  /** Maps sender keys to palette indices for consistent coloring. */
  private senderColors: Map<string, string> = new Map();
  private nextColorIndex = 0;

  constructor(log: GameEventLog) {
    this.log = log;
    this.container = this.createContainer();
    document.getElementById('game-container')!.appendChild(this.container);
  }

  private createContainer(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'event-log';
    return el;
  }

  /** Call once per frame. Only touches the DOM when new events arrive. */
  update(): void {
    if (this.log.version === this.lastVersion) {
      this.updateFading();
      return;
    }
    this.lastVersion = this.log.version;
    this.rebuild();
  }

  /** Get or assign a color for a sender key. */
  private colorForSender(senderKey: string): string {
    let color = this.senderColors.get(senderKey);
    if (!color) {
      color = SENDER_PALETTE[this.nextColorIndex % SENDER_PALETTE.length];
      this.nextColorIndex++;
      this.senderColors.set(senderKey, color);
    }
    return color;
  }

  private rebuild(): void {
    const events = this.log.recent(VISIBLE_COUNT);
    this.container.innerHTML = '';

    for (const evt of events) {
      const color = this.colorForSender(evt.sender.key);

      const line = document.createElement('div');
      line.className = 'event-log-line';
      line.dataset.timestamp = evt.timestamp.toString();

      const senderSpan = document.createElement('span');
      senderSpan.className = 'event-log-sender';
      senderSpan.style.color = color;
      senderSpan.textContent = evt.sender.label;

      const msgSpan = document.createElement('span');
      msgSpan.className = 'event-log-msg';
      msgSpan.textContent = evt.message;

      line.appendChild(senderSpan);
      line.appendChild(msgSpan);
      this.container.appendChild(line);
    }

    this.container.scrollTop = this.container.scrollHeight;
  }

  private updateFading(): void {
    const now = Date.now();
    const lines = this.container.querySelectorAll('.event-log-line');
    for (const el of lines) {
      const line = el as HTMLElement;
      const ts = parseInt(line.dataset.timestamp ?? '0');
      const age = now - ts;
      if (age > FADE_AFTER_MS) {
        const fadeProgress = Math.min(1, (age - FADE_AFTER_MS) / 2000);
        line.style.opacity = (1 - fadeProgress * 0.7).toString();
      } else {
        line.style.opacity = '1';
      }
    }
  }
}
