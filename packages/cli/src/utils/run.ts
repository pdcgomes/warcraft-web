import { spawn } from 'node:child_process';
import { spinner } from './prompts.js';
import pc from 'picocolors';

export interface RunOptions {
  cwd?: string;
  label?: string;
  stream?: boolean;
  env?: Record<string, string>;
}

const ROOT_DIR = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '');

export function rootDir(): string {
  return ROOT_DIR;
}

/**
 * Run a shell command and return its output.
 * If `stream` is true, pipes stdout/stderr directly to the terminal.
 */
export function run(command: string, opts: RunOptions = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  const cwd = opts.cwd ?? ROOT_DIR;

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: opts.stream ? 'inherit' : 'pipe',
      env: { ...process.env, ...opts.env, FORCE_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    if (!opts.stream) {
      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });
    }

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Run a command with a clack spinner, showing progress.
 */
export async function runWithSpinner(
  command: string,
  opts: RunOptions & { successMessage?: string; failMessage?: string } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  const s = spinner();
  s.start(opts.label ?? `Running: ${pc.dim(command)}`);

  const result = await run(command, { ...opts, stream: false });

  if (result.code === 0) {
    s.stop(opts.successMessage ?? `${opts.label ?? command} ${pc.green('✓')}`);
  } else {
    s.stop(opts.failMessage ?? `${opts.label ?? command} ${pc.red('✗')}`);
  }

  return result;
}

/**
 * Run a command and stream output directly to terminal (for dev servers, etc.).
 */
export async function runStreaming(command: string, opts: RunOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? ROOT_DIR;

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
      env: { ...process.env, ...opts.env, FORCE_COLOR: '1' },
    });

    child.on('close', (code) => resolve(code ?? 1));
  });
}
