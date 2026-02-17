import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { rootDir } from './run.js';

export interface PackageInfo {
  name: string;
  shortName: string;
  dir: string;
  hasSource: boolean;
  hasDist: boolean;
  scripts: Record<string, string>;
}

/**
 * Discover all workspace packages and their metadata.
 */
export function getPackages(): PackageInfo[] {
  const packagesDir = join(rootDir(), 'packages');
  const entries = readdirSync(packagesDir).filter((e) => {
    const fullPath = join(packagesDir, e);
    return statSync(fullPath).isDirectory() && existsSync(join(fullPath, 'package.json'));
  });

  return entries.map((dir) => {
    const fullPath = join(packagesDir, dir);
    const pkg = JSON.parse(readFileSync(join(fullPath, 'package.json'), 'utf-8'));
    const srcDir = join(fullPath, 'src');
    const distDir = join(fullPath, 'dist');

    return {
      name: pkg.name ?? dir,
      shortName: dir,
      dir: fullPath,
      hasSource: existsSync(srcDir) && readdirSync(srcDir).length > 0,
      hasDist: existsSync(distDir),
      scripts: pkg.scripts ?? {},
    };
  });
}

/**
 * Get a styled label for a package name.
 */
export function pkgLabel(name: string): string {
  return pc.cyan(`@warcraft-web/${name}`);
}
