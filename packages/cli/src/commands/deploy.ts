import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { runWithSpinner, runStreaming, rootDir } from '../utils/run.js';

export async function deployCommand(): Promise<void> {
  const target = await p.select({
    message: 'What do you want to deploy?',
    options: [
      { value: 'client', label: `${pc.cyan('Client')} — Build and deploy the web client` },
      { value: 'server', label: `${pc.cyan('Server')} — Build and deploy the game server` },
      { value: 'both', label: `${pc.magenta('Both')} — Full deployment` },
    ],
  });

  if (p.isCancel(target)) {
    p.cancel('Cancelled.');
    return;
  }

  p.log.step('Starting deployment pipeline...\n');

  // Step 1: Build shared (always needed)
  const sharedResult = await runWithSpinner('npm run build -w packages/shared', {
    cwd: rootDir(),
    label: 'Building shared package',
    successMessage: `Shared package built ${pc.green('✓')}`,
    failMessage: `Shared build ${pc.red('failed')}`,
  });

  if (sharedResult.code !== 0) {
    p.log.error(sharedResult.stderr || sharedResult.stdout);
    p.log.error('Deployment aborted — shared package failed to build.');
    return;
  }

  // Step 2: Build target package(s)
  const targets = target === 'both' ? ['client', 'server'] : [target as string];

  for (const t of targets) {
    const buildResult = await runWithSpinner(`npm run build -w packages/${t}`, {
      cwd: rootDir(),
      label: `Building ${t} package`,
      successMessage: `${pc.cyan(t)} built ${pc.green('✓')}`,
      failMessage: `${pc.cyan(t)} build ${pc.red('failed')}`,
    });

    if (buildResult.code !== 0) {
      p.log.error(buildResult.stderr || buildResult.stdout);
      p.log.error(`Deployment aborted — ${t} package failed to build.`);
      return;
    }
  }

  // Step 3: Deploy
  p.log.info(
    pc.yellow('\n  Deployment target not yet configured.\n') +
    pc.dim('  To set up deployment, consider:\n') +
    pc.dim('  • Client: Vercel, Netlify, Cloudflare Pages\n') +
    pc.dim('  • Server: Fly.io, Railway, AWS ECS\n') +
    pc.dim('  • Full stack: Docker Compose\n\n') +
    pc.dim('  Add a "deploy" script to the relevant package.json,\n') +
    pc.dim('  and this command will pick it up automatically.')
  );

  // Check if packages have deploy scripts
  for (const t of targets) {
    const checkDeploy = await runWithSpinner(`npm run deploy -w packages/${t} --if-present`, {
      cwd: rootDir(),
      label: `Deploying ${t}`,
      successMessage: `${pc.cyan(t)} deployed ${pc.green('✓')}`,
      failMessage: `No deploy script for ${pc.cyan(t)} — ${pc.dim('skipped')}`,
    });

    if (checkDeploy.code === 0 && checkDeploy.stdout.includes('deploy')) {
      p.log.success(`${pc.cyan(t)} deployment complete!`);
    }
  }
}
