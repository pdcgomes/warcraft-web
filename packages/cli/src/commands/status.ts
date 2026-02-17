import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { run, rootDir } from '../utils/run.js';
import { getPackages } from '../utils/packages.js';

export async function statusCommand(): Promise<void> {
  p.log.step('Project status overview\n');

  const packages = getPackages().filter((pkg) => pkg.shortName !== 'cli');

  // Package status table
  const rows: string[] = [];
  for (const pkg of packages) {
    const source = pkg.hasSource ? pc.green('✓ has source') : pc.yellow('⚠ no source files');
    const build = pkg.hasDist ? pc.green('✓ built') : pc.dim('○ not built');
    const scripts = Object.keys(pkg.scripts)
      .filter((s) => s !== 'typecheck')
      .join(', ');

    rows.push(
      `  ${pc.cyan(pkg.shortName.padEnd(10))} ${source.padEnd(30)}  ${build.padEnd(26)}  ${pc.dim(scripts)}`
    );
  }

  p.log.info(
    `${pc.bold('Packages:')}\n` +
    `  ${pc.dim('Name'.padEnd(10))} ${pc.dim('Source'.padEnd(18))}  ${pc.dim('Build'.padEnd(14))}  ${pc.dim('Scripts')}\n` +
    rows.join('\n')
  );

  // Source file counts
  const sharedSrc = join(rootDir(), 'packages', 'shared', 'src');
  const componentCount = countFiles(join(sharedSrc, 'components'));
  const systemCount = countFiles(join(sharedSrc, 'systems'));

  p.log.info(
    `\n${pc.bold('ECS Overview:')}\n` +
    `  Components: ${pc.green(String(componentCount))}\n` +
    `  Systems:    ${pc.green(String(systemCount))}`
  );

  // Git status
  const gitResult = await run('git status --short', { cwd: rootDir() });
  if (gitResult.code === 0) {
    const changes = gitResult.stdout.trim().split('\n').filter(Boolean);
    const status = changes.length === 0
      ? pc.green('clean')
      : pc.yellow(`${changes.length} changed file(s)`);
    p.log.info(`\n${pc.bold('Git:')} ${status}`);
  }

  // Node/npm versions
  const nodeVersion = await run('node --version');
  const npmVersion = await run('npm --version');
  p.log.info(
    `\n${pc.bold('Environment:')}\n` +
    `  Node: ${pc.dim(nodeVersion.stdout.trim())}\n` +
    `  npm:  ${pc.dim(npmVersion.stdout.trim())}`
  );
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.startsWith('index')).length;
}
