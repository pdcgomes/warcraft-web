import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runWithSpinner, rootDir } from '../utils/run.js';
import { getPackages, pkgLabel } from '../utils/packages.js';

export async function typecheckCommand(): Promise<void> {
  const packages = getPackages().filter(
    (pkg) => pkg.hasSource && pkg.scripts['typecheck'] && pkg.shortName !== 'cli'
  );

  p.log.step('Running TypeScript type checking across all packages...\n');

  let allPassed = true;

  for (const pkg of packages) {
    const result = await runWithSpinner(
      `npm run typecheck -w packages/${pkg.shortName}`,
      {
        cwd: rootDir(),
        label: `Type checking ${pkgLabel(pkg.shortName)}`,
        successMessage: `${pkgLabel(pkg.shortName)} ${pc.green('no errors')}`,
        failMessage: `${pkgLabel(pkg.shortName)} ${pc.red('has errors')}`,
      }
    );

    if (result.code !== 0) {
      allPassed = false;
      const output = (result.stdout + result.stderr).trim();
      if (output) {
        p.log.error(output);
      }
    }
  }

  if (allPassed) {
    p.log.success(pc.green('All packages pass type checking!'));
  } else {
    p.log.error(pc.red('Some packages have type errors. See above for details.'));
  }
}
