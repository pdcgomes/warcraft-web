import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runWithSpinner, rootDir } from '../utils/run.js';

export async function cleanCommand(): Promise<void> {
  const target = await p.select({
    message: 'What to clean?',
    options: [
      { value: 'dist', label: `${pc.yellow('Build artifacts')} — Remove all dist/ directories` },
      { value: 'deps', label: `${pc.yellow('Dependencies')} — Remove all node_modules/` },
      { value: 'all', label: `${pc.red('Everything')} — Remove dist/ + node_modules/ (requires reinstall)` },
    ],
  });

  if (p.isCancel(target)) {
    p.cancel('Cancelled.');
    return;
  }

  if (target === 'deps' || target === 'all') {
    const confirm = await p.confirm({
      message: 'This will delete node_modules. You will need to run npm install again. Continue?',
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Cancelled.');
      return;
    }
  }

  let command: string;

  switch (target) {
    case 'dist':
      command = 'rm -rf packages/*/dist';
      break;
    case 'deps':
      command = 'rm -rf packages/*/node_modules node_modules';
      break;
    case 'all':
      command = 'rm -rf packages/*/dist packages/*/node_modules node_modules';
      break;
    default:
      return;
  }

  const result = await runWithSpinner(command, {
    cwd: rootDir(),
    label: 'Cleaning...',
    successMessage: `Cleaned ${pc.green('✓')}`,
    failMessage: `Clean ${pc.red('failed')}`,
  });

  if (result.code !== 0) {
    p.log.error(result.stderr || result.stdout);
  } else {
    if (target === 'deps' || target === 'all') {
      p.log.info(pc.dim('Run npm install to restore dependencies.'));
    }
  }
}
