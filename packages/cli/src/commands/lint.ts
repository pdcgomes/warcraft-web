import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runStreaming, run, rootDir } from '../utils/run.js';

export async function lintCommand(): Promise<void> {
  const hasEslint = await run('npx eslint --version', { cwd: rootDir() });

  if (hasEslint.code !== 0) {
    p.log.warn(
      `${pc.yellow('eslint')} is not configured. To set up linting, run:\n` +
      pc.dim('  npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin -w\n') +
      pc.dim('  Then create an eslint.config.js at the project root.')
    );
    return;
  }

  const mode = await p.select({
    message: 'Lint mode:',
    options: [
      { value: 'check', label: 'Check for errors (read-only)' },
      { value: 'fix', label: 'Auto-fix what can be fixed' },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel('Cancelled.');
    return;
  }

  const fixFlag = mode === 'fix' ? ' --fix' : '';
  const command = `npx eslint "packages/*/src/**/*.ts"${fixFlag}`;

  p.log.step(`Running: ${pc.dim(command)}\n`);
  await runStreaming(command, { cwd: rootDir() });
}
