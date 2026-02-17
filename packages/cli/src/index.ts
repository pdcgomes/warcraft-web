import * as p from './utils/prompts.js';
import pc from 'picocolors';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { testCommand } from './commands/test.js';
import { typecheckCommand } from './commands/typecheck.js';
import { lintCommand } from './commands/lint.js';
import { cleanCommand } from './commands/clean.js';
import { deployCommand } from './commands/deploy.js';
import { newCommand } from './commands/new.js';
import { statusCommand } from './commands/status.js';

const commands: Record<string, { handler: () => Promise<void>; label: string; hint?: string }> = {
  dev:       { handler: devCommand,       label: 'Dev',        hint: 'Start development servers' },
  build:     { handler: buildCommand,     label: 'Build',      hint: 'Build packages for production' },
  test:      { handler: testCommand,      label: 'Test',       hint: 'Run test suites' },
  typecheck: { handler: typecheckCommand, label: 'Typecheck',  hint: 'Run TypeScript type checking' },
  lint:      { handler: lintCommand,      label: 'Lint',       hint: 'Lint and fix code' },
  clean:     { handler: cleanCommand,     label: 'Clean',      hint: 'Remove build artifacts and caches' },
  deploy:    { handler: deployCommand,    label: 'Deploy',     hint: 'Build and deploy to production' },
  new:       { handler: newCommand,       label: 'New',        hint: 'Scaffold a new component or system' },
  status:    { handler: statusCommand,    label: 'Status',     hint: 'View project health overview' },
};

async function main(): Promise<void> {
  console.clear();

  p.intro(`${pc.bgCyan(pc.black(' warcraft-web '))} ${pc.dim('v0.1.0')}`);

  // Support direct command from CLI args: npm run cli -- build
  // Skip '--' separator that npm passes through
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const directCommand = args[0];

  if (directCommand && commands[directCommand]) {
    await commands[directCommand].handler();
    p.outro(pc.dim('Done.'));
    return;
  }

  if (directCommand) {
    p.log.warn(`Unknown command: ${pc.yellow(directCommand)}`);
    p.log.info(`Available commands: ${Object.keys(commands).join(', ')}`);
    p.outro('');
    return;
  }

  // Interactive menu
  const selected = await p.select({
    message: 'Work Work?',
    options: Object.entries(commands).map(([value, { label, hint }]) => ({
      value,
      label: label,
      hint: pc.dim(hint ?? ''),
    })),
  });

  if (p.isCancel(selected)) {
    p.cancel('See you later!');
    process.exit(0);
  }

  console.log();
  await commands[selected].handler();
  p.outro(pc.dim('Done.'));
}

main().catch((err) => {
  p.log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
