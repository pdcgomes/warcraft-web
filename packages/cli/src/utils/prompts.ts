/**
 * Lightweight interactive prompts using Node built-in readline.
 * Provides a @clack/prompts-compatible API with a polished terminal UI.
 */
import * as readline from 'node:readline';
import pc from 'picocolors';

const CANCEL = Symbol('cancel');

export function isCancel(value: unknown): value is symbol {
  return value === CANCEL;
}

// ── Styling helpers ──────────────────────────────────────────────

const S_BAR = '│';
const S_BAR_END = '└';
const S_RADIO_ACTIVE = '●';
const S_RADIO_INACTIVE = '○';
const S_STEP_SUBMIT = '◇';
const S_INFO = '●';
const S_WARN = '▲';
const S_ERROR = '■';
const S_SUCCESS = '◆';

const bar = pc.gray(S_BAR);
const barEnd = pc.gray(S_BAR_END);

function symbol(state: 'initial' | 'submit' | 'cancel'): string {
  switch (state) {
    case 'initial': return pc.cyan('◆');
    case 'submit': return pc.green(S_STEP_SUBMIT);
    case 'cancel': return pc.red(S_STEP_SUBMIT);
  }
}

// ── Raw input helpers ────────────────────────────────────────────

let keypressInitialized = false;

function enableRawMode(): void {
  if (process.stdin.isTTY) {
    if (!keypressInitialized) {
      readline.emitKeypressEvents(process.stdin);
      keypressInitialized = true;
    }
    process.stdin.setRawMode(true);
  }
}

function disableRawMode(): void {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
}

function readKeypress(): Promise<{ name: string; ctrl: boolean }> {
  return new Promise((resolve) => {
    process.stdin.resume();
    const handler = (_: unknown, key: { name: string; ctrl: boolean }) => {
      process.stdin.removeListener('keypress', handler);
      resolve(key ?? { name: '', ctrl: false });
    };
    process.stdin.on('keypress', handler);
  });
}

/**
 * Erase `count` lines of content that were written with a trailing `\n`.
 * After writing lines.join('\n') + '\n', the cursor sits on the empty
 * line below the content. This function clears that empty line, then
 * moves up through all `count` content lines clearing each one,
 * leaving the cursor at the start of where the first line was.
 */
function clearLines(count: number): void {
  process.stdout.write('\x1b[2K'); // clear the current (empty) line
  for (let i = 0; i < count; i++) {
    process.stdout.write('\x1b[1A\x1b[2K'); // move up one line + clear it
  }
  process.stdout.write('\r');
}

function hideCursor(): void {
  process.stdout.write('\x1b[?25l');
}

function showCursor(): void {
  process.stdout.write('\x1b[?25h');
}

// ── Public API ───────────────────────────────────────────────────

export function intro(title: string): void {
  console.log();
  console.log(` ${pc.gray('┌')}  ${title}`);
}

export function outro(message: string): void {
  console.log(` ${barEnd}  ${message}`);
  console.log();
}

export function cancel(message: string): void {
  console.log(` ${pc.red(S_BAR_END)}  ${pc.red(message)}`);
  console.log();
}

export const log = {
  step(message: string): void {
    console.log(` ${pc.green(S_STEP_SUBMIT)}  ${message}`);
  },
  info(message: string): void {
    console.log(` ${pc.blue(S_INFO)}  ${message}`);
  },
  warn(message: string): void {
    console.log(` ${pc.yellow(S_WARN)}  ${message}`);
  },
  error(message: string): void {
    console.log(` ${pc.red(S_ERROR)}  ${message}`);
  },
  success(message: string): void {
    console.log(` ${pc.green(S_SUCCESS)}  ${message}`);
  },
  message(message: string): void {
    console.log(` ${bar}  ${message}`);
  },
};

export interface SelectOption<T> {
  value: T;
  label: string;
  hint?: string;
}

export async function select<T extends string>(opts: {
  message: string;
  options: SelectOption<T>[];
}): Promise<T | symbol> {
  const { message, options } = opts;
  let cursor = 0;

  function render(final = false): string[] {
    const lines: string[] = [];
    if (final) {
      lines.push(` ${symbol('submit')}  ${message}`);
      lines.push(` ${bar}  ${pc.dim(options[cursor].label)}`);
    } else {
      lines.push(` ${symbol('initial')}  ${message}`);
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const isActive = i === cursor;
        const radio = isActive ? pc.green(S_RADIO_ACTIVE) : pc.dim(S_RADIO_INACTIVE);
        const label = isActive ? opt.label : pc.dim(opt.label);
        const hint = opt.hint && isActive ? `  ${pc.dim(opt.hint)}` : '';
        lines.push(` ${bar}  ${radio} ${label}${hint}`);
      }
      lines.push(` ${bar}`);
    }
    return lines;
  }

  // Initial render
  let prevLines = render();
  process.stdout.write(prevLines.join('\n') + '\n');

  enableRawMode();
  hideCursor();

  try {
    while (true) {
      const key = await readKeypress();

      if (key.ctrl && key.name === 'c') {
        clearLines(prevLines.length);
        showCursor();
        process.stdout.write(` ${symbol('cancel')}  ${message}\n`);
        process.stdout.write(` ${pc.red(S_BAR)}  ${pc.strikethrough(pc.dim(options[cursor].label))}\n`);
        return CANCEL as unknown as symbol;
      }

      if (key.name === 'up' || key.name === 'k') {
        cursor = (cursor - 1 + options.length) % options.length;
      } else if (key.name === 'down' || key.name === 'j') {
        cursor = (cursor + 1) % options.length;
      } else if (key.name === 'return') {
        clearLines(prevLines.length);
        showCursor();
        const finalLines = render(true);
        process.stdout.write(finalLines.join('\n') + '\n');
        return options[cursor].value;
      } else {
        // Ignore other keys — don't re-render
        continue;
      }

      // Re-render
      clearLines(prevLines.length);
      prevLines = render();
      process.stdout.write(prevLines.join('\n') + '\n');
    }
  } finally {
    showCursor();
    disableRawMode();
    process.stdin.pause();
  }
}

export async function text(opts: {
  message: string;
  placeholder?: string;
  validate?: (value: string) => string | undefined | void;
}): Promise<string | symbol> {
  const { message, placeholder, validate } = opts;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = placeholder ? pc.dim(placeholder) : '';
    process.stdout.write(` ${symbol('initial')}  ${message}\n`);
    process.stdout.write(` ${bar}  `);

    if (placeholder) {
      process.stdout.write(pc.dim(`(${placeholder}) `));
    }

    let cancelled = false;
    rl.on('SIGINT', () => {
      cancelled = true;
      rl.close();
      console.log();
      resolve(CANCEL as unknown as symbol);
    });

    rl.on('line', (answer) => {
      if (cancelled) return;
      const value = answer.trim();

      if (validate) {
        const error = validate(value);
        if (error) {
          process.stdout.write(` ${bar}  ${pc.red(error)}\n`);
          process.stdout.write(` ${bar}  `);
          return;
        }
      }

      rl.close();
      resolve(value);
    });
  });
}

export async function confirm(opts: {
  message: string;
}): Promise<boolean | symbol> {
  const result = await select({
    message: opts.message,
    options: [
      { value: 'yes' as const, label: 'Yes' },
      { value: 'no' as const, label: 'No' },
    ],
  });

  if (isCancel(result)) return CANCEL as unknown as symbol;
  return result === 'yes';
}

export function spinner(): { start: (msg: string) => void; stop: (msg: string) => void } {
  const frames = ['◒', '◐', '◓', '◑'];
  let interval: ReturnType<typeof setInterval> | null = null;
  let frameIndex = 0;
  let currentMsg = '';

  return {
    start(msg: string) {
      currentMsg = msg;
      frameIndex = 0;
      process.stdout.write(` ${pc.magenta(frames[0])}  ${msg}`);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        process.stdout.write(`\r ${pc.magenta(frames[frameIndex])}  ${currentMsg}`);
      }, 80);
    },
    stop(msg: string) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      process.stdout.write(`\r\x1b[2K ${pc.green(S_STEP_SUBMIT)}  ${msg}\n`);
    },
  };
}
