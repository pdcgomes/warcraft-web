import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runStreaming, run, rootDir } from '../utils/run.js';
import { getPackages } from '../utils/packages.js';

export async function testCommand(): Promise<void> {
  const hasVitest = await run('npx vitest --version', { cwd: rootDir() });

  if (hasVitest.code !== 0) {
    p.log.warn(
      `${pc.yellow('vitest')} is not installed. To set up testing, run:\n` +
      pc.dim('  npm install -D vitest -w\n') +
      pc.dim('  Then add test files like src/**/*.test.ts')
    );
    return;
  }

  const packages = getPackages().filter((pkg) => pkg.hasSource && pkg.shortName !== 'cli');

  const mode = await p.select({
    message: 'How do you want to run tests?',
    options: [
      { value: 'all', label: 'Run all tests' },
      { value: 'watch', label: 'Watch mode (re-run on changes)' },
      { value: 'coverage', label: 'Run with coverage report' },
      { value: 'package', label: 'Test a specific package' },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel('Cancelled.');
    return;
  }

  let command: string;

  switch (mode) {
    case 'all':
      command = 'npx vitest run';
      break;
    case 'watch':
      command = 'npx vitest';
      break;
    case 'coverage':
      command = 'npx vitest run --coverage';
      break;
    case 'package': {
      const selected = await p.select({
        message: 'Which package?',
        options: packages.map((pkg) => ({
          value: pkg.shortName,
          label: pkg.name,
        })),
      });

      if (p.isCancel(selected)) {
        p.cancel('Cancelled.');
        return;
      }

      command = `npx vitest run --project packages/${selected}`;
      break;
    }
    default:
      command = 'npx vitest run';
  }

  p.log.step(`Running: ${pc.dim(command)}\n`);
  await runStreaming(command, { cwd: rootDir() });
}
