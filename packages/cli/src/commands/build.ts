import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runWithSpinner, rootDir } from '../utils/run.js';
import { getPackages, pkgLabel } from '../utils/packages.js';

export async function buildCommand(): Promise<void> {
  const packages = getPackages().filter(
    (pkg) => pkg.hasSource && pkg.scripts['build'] && pkg.shortName !== 'cli'
  );

  const options = [
    { value: 'all', label: `${pc.magenta('All packages')} — Build shared → client → server` },
    ...packages.map((pkg) => ({
      value: pkg.shortName,
      label: pkgLabel(pkg.shortName),
    })),
  ];

  const selected = await p.select({
    message: 'What to build?',
    options,
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    return;
  }

  if (selected === 'all') {
    p.log.step('Building all packages in dependency order...\n');

    const buildOrder = ['shared', ...packages.filter((p) => p.shortName !== 'shared').map((p) => p.shortName)];

    for (const name of buildOrder) {
      const pkg = packages.find((p) => p.shortName === name);
      if (!pkg) continue;

      const result = await runWithSpinner(`npm run build -w packages/${name}`, {
        cwd: rootDir(),
        label: `Building ${pkgLabel(name)}`,
        successMessage: `${pkgLabel(name)} built ${pc.green('✓')}`,
        failMessage: `${pkgLabel(name)} build ${pc.red('failed')}`,
      });

      if (result.code !== 0) {
        p.log.error(result.stderr || result.stdout);
        p.log.error(`Build failed at ${pkgLabel(name)}. Stopping.`);
        return;
      }
    }

    p.log.success(pc.green('All packages built successfully!'));
  } else {
    const result = await runWithSpinner(`npm run build -w packages/${selected}`, {
      cwd: rootDir(),
      label: `Building ${pkgLabel(selected as string)}`,
      successMessage: `${pkgLabel(selected as string)} built ${pc.green('✓')}`,
      failMessage: `${pkgLabel(selected as string)} build ${pc.red('failed')}`,
    });

    if (result.code !== 0) {
      p.log.error(result.stderr || result.stdout);
    }
  }
}
