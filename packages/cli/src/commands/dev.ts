import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runStreaming, rootDir } from '../utils/run.js';
import { getPackages, pkgLabel } from '../utils/packages.js';

export async function devCommand(): Promise<void> {
  const packages = getPackages().filter(
    (pkg) => pkg.hasSource && pkg.scripts['dev'] && pkg.shortName !== 'cli'
  );

  if (packages.length === 0) {
    p.log.warn('No packages with a dev script found.');
    return;
  }

  const options = [
    { value: 'client', label: `${pkgLabel('client')} — Vite dev server (port 3000)` },
    { value: 'server', label: `${pkgLabel('server')} — Express + WebSocket server` },
    { value: 'all', label: `${pc.magenta('All packages')} — Run all dev servers concurrently` },
  ];

  const available = options.filter(
    (opt) => opt.value === 'all' || packages.some((pkg) => pkg.shortName === opt.value)
  );

  const selected = await p.select({
    message: 'Which package(s) to start in dev mode?',
    options: available,
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled.');
    return;
  }

  p.log.step(`Starting dev server${selected === 'all' ? 's' : ''}...`);
  p.log.info(pc.dim('Press Ctrl+C to stop.\n'));

  if (selected === 'all') {
    const concurrently = packages.map((pkg) => `npm run dev -w packages/${pkg.shortName}`).join(' & ');
    await runStreaming(concurrently, { cwd: rootDir() });
  } else {
    await runStreaming(`npm run dev -w packages/${selected}`, { cwd: rootDir() });
  }
}
