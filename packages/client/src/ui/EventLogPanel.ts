import type { GameEventLog, GameEvent, GameEventType } from '@warcraft-web/shared';
import { Position, tileToScreen } from '@warcraft-web/shared';
import type { FogOfWar } from '@warcraft-web/shared';
import type { World } from '@warcraft-web/shared';
import type { GameRenderer } from '../renderer/GameRenderer.js';

const TICKS_PER_SECOND = 10;
const MAX_DISPLAY = 100;

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

const MESSAGE_VARIANTS: Partial<Record<GameEventType, Record<string, string[]>>> = {
  order_completed: {
    'Arrived at destination': [
      'Arrived at destination',
      'In position',
      'Awaiting orders',
      'Ready',
      'Standing by',
    ],
  },
  unit_under_attack: {
    'Under attack!': [
      'Under attack!',
      'We are under siege!',
      'Taking damage!',
      'We need help!',
      'Enemy engaged!',
      'They\'re upon us!',
    ],
  },
  unit_killed: {
    'Destroyed': [
      'Destroyed',
      'Lost in battle',
      'Fallen',
      'Eliminated',
      'Perished',
    ],
  },
  training_complete: {
    _suffix_ready: [
      'ready',
      'reporting for duty',
      'at your service',
      'awaiting orders',
      'standing by',
    ],
  },
  order_confirmed: {
    'Move': ['Move', 'Moving out', 'On the march', 'Yes, milord', 'Right away'],
    'Attack': ['Attack', 'For glory!', 'Engaging the enemy', 'To battle!', 'Charge!'],
    'Gather': ['Gather', 'Heading to gather', 'Off to work', 'Gathering resources'],
    'Patrol': ['Patrol', 'Patrolling the area', 'On patrol', 'Scouting ahead'],
    'Stop': ['Stop', 'Holding position', 'Halting'],
    'Hold Position': ['Hold Position', 'Holding ground', 'Standing firm', 'Not moving an inch'],
    'Repair': ['Repair', 'On my way to repair', 'Fixing it up'],
    'Cannot build here': ['Cannot build here', 'Obstructed', 'Invalid placement'],
    'Not enough resources': ['Not enough resources', 'We need more gold', 'Insufficient funds', 'Our coffers are low'],
  },
};

function formatGameTime(tick: number): string {
  const totalSeconds = Math.floor(tick / TICKS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function varyMessage(type: GameEventType, message: string): string {
  const typeVariants = MESSAGE_VARIANTS[type];
  if (!typeVariants) return message;

  const pool = typeVariants[message];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  if (typeVariants._suffix_ready && message.endsWith(' ready')) {
    const prefix = message.slice(0, -' ready'.length);
    const suffixes = typeVariants._suffix_ready;
    return `${prefix} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
  }

  return message;
}

function parseEntityId(senderKey: string): number | null {
  if (!senderKey.startsWith('entity:')) return null;
  const id = parseInt(senderKey.slice(7));
  return isNaN(id) ? null : id;
}

export interface EventLogDeps {
  world: World;
  fog: FogOfWar;
  renderer: GameRenderer;
}

/**
 * Fixed-height, scrollable event log panel overlaid on the game viewport.
 *
 * - Mouse wheel scrolls through history
 * - Auto-scrolls to bottom on new messages (unless user scrolled up)
 * - Dismiss button hides the panel; a small toggle icon re-opens it
 * - Clicking an entity message centers the camera (fog permitting)
 */
export class EventLogPanel {
  private readonly log: GameEventLog;
  private readonly wrapper: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly scrollArea: HTMLElement;
  private readonly toggleBtn: HTMLElement;
  private deps: EventLogDeps | null = null;
  private lastVersion = -1;
  private userScrolledUp = false;
  private expanded = true;

  private senderColors: Map<string, string> = new Map();
  private nextColorIndex = 0;

  constructor(log: GameEventLog, deps?: EventLogDeps) {
    this.log = log;
    if (deps) this.deps = deps;

    this.wrapper = document.createElement('div');
    this.wrapper.id = 'event-log-wrapper';

    this.panel = this.createPanel();
    this.scrollArea = this.panel.querySelector('.event-log-scroll')!;
    this.toggleBtn = this.createToggleButton();

    this.wrapper.appendChild(this.panel);
    this.wrapper.appendChild(this.toggleBtn);
    document.getElementById('game-container')!.appendChild(this.wrapper);

    this.scrollArea.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.scrollArea;
      this.userScrolledUp = scrollTop + clientHeight < scrollHeight - 10;
    });
  }

  setDeps(deps: EventLogDeps): void {
    this.deps = deps;
  }

  private createPanel(): HTMLElement {
    const el = document.createElement('div');
    el.id = 'event-log';

    const header = document.createElement('div');
    header.className = 'event-log-header';

    const title = document.createElement('span');
    title.className = 'event-log-title';
    title.textContent = 'Event Log';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'event-log-close';
    closeBtn.textContent = '\u00D7';
    closeBtn.title = 'Hide event log';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setExpanded(false);
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    const scroll = document.createElement('div');
    scroll.className = 'event-log-scroll';

    el.appendChild(header);
    el.appendChild(scroll);
    return el;
  }

  private createToggleButton(): HTMLElement {
    const btn = document.createElement('button');
    btn.id = 'event-log-toggle';
    btn.title = 'Show event log';
    btn.textContent = '\uD83D\uDCDC';
    btn.style.display = 'none';
    btn.addEventListener('click', () => this.setExpanded(true));
    return btn;
  }

  private setExpanded(open: boolean): void {
    this.expanded = open;
    this.panel.style.display = open ? '' : 'none';
    this.toggleBtn.style.display = open ? 'none' : '';
    if (open) {
      this.lastVersion = -1;
      this.rebuild();
    }
  }

  update(): void {
    if (!this.expanded) return;
    if (this.log.version === this.lastVersion) return;
    this.lastVersion = this.log.version;
    this.rebuild();
  }

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
    const events = this.log.recent(MAX_DISPLAY);
    const frag = document.createDocumentFragment();

    for (const evt of events) {
      const color = this.colorForSender(evt.sender.key);
      const displayMessage = varyMessage(evt.type, evt.message);

      const line = document.createElement('div');
      line.className = 'event-log-line';
      line.dataset.senderKey = evt.sender.key;

      const entityId = parseEntityId(evt.sender.key);
      if (entityId !== null) {
        line.classList.add('event-log-clickable');
        line.addEventListener('click', () => this.handleClick(entityId));
      }

      const timeSpan = document.createElement('span');
      timeSpan.className = 'event-log-time';
      timeSpan.textContent = formatGameTime(evt.tick);

      const senderSpan = document.createElement('span');
      senderSpan.className = 'event-log-sender';
      senderSpan.style.color = color;
      senderSpan.textContent = evt.sender.label;

      const msgSpan = document.createElement('span');
      msgSpan.className = 'event-log-msg';
      msgSpan.textContent = displayMessage;

      line.appendChild(timeSpan);
      line.appendChild(senderSpan);
      line.appendChild(msgSpan);
      frag.appendChild(line);
    }

    this.scrollArea.replaceChildren(frag);

    if (!this.userScrolledUp) {
      this.scrollArea.scrollTop = this.scrollArea.scrollHeight;
    }
  }

  private handleClick(entityId: number): void {
    if (!this.deps) return;
    const { world, fog, renderer } = this.deps;

    const pos = world.getComponent(entityId, Position);
    if (!pos) return;

    const tileX = Math.round(pos.x / 1000);
    const tileY = Math.round(pos.y / 1000);

    if (!fog.isVisible(tileX, tileY)) return;

    const screenPos = tileToScreen({ x: tileX, y: tileY });
    renderer.centerOn(screenPos);
  }
}
