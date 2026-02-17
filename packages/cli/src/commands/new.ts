import * as p from '../utils/prompts.js';
import pc from 'picocolors';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from '../utils/run.js';

export async function newCommand(): Promise<void> {
  const type = await p.select({
    message: 'What do you want to scaffold?',
    options: [
      { value: 'component', label: `${pc.green('Component')} — New ECS data component` },
      { value: 'system', label: `${pc.blue('System')} — New ECS game system` },
    ],
  });

  if (p.isCancel(type)) {
    p.cancel('Cancelled.');
    return;
  }

  const name = await p.text({
    message: `${type === 'component' ? 'Component' : 'System'} name (PascalCase):`,
    placeholder: type === 'component' ? 'e.g. Inventory' : 'e.g. FogOfWarSystem',
    validate: (val) => {
      if (!val || val.trim().length === 0) return 'Name is required.';
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(val.trim())) return 'Must be PascalCase (e.g. MyComponent).';
    },
  });

  if (p.isCancel(name)) {
    p.cancel('Cancelled.');
    return;
  }

  const trimmedName = (name as string).trim();

  if (type === 'component') {
    await scaffoldComponent(trimmedName);
  } else {
    await scaffoldSystem(trimmedName);
  }
}

async function scaffoldComponent(name: string): Promise<void> {
  const sharedSrc = join(rootDir(), 'packages', 'shared', 'src');
  const filePath = join(sharedSrc, 'components', `${name}.ts`);

  if (existsSync(filePath)) {
    p.log.error(`Component ${pc.cyan(name)} already exists at ${pc.dim(filePath)}`);
    return;
  }

  const content = `import type { Component } from '../ecs/Component.js';

export class ${name} implements Component {
  static readonly type = '${name}' as const;
  readonly type = ${name}.type;

  constructor() {
    // TODO: Add component properties
  }
}
`;

  writeFileSync(filePath, content, 'utf-8');
  p.log.success(`Created ${pc.green(filePath.replace(rootDir() + '/', ''))}`);

  // Add export to barrel
  addBarrelExport(sharedSrc, name, 'component');
}

async function scaffoldSystem(name: string): Promise<void> {
  const sharedSrc = join(rootDir(), 'packages', 'shared', 'src');
  const systemName = name.endsWith('System') ? name : `${name}System`;
  const filePath = join(sharedSrc, 'systems', `${systemName}.ts`);

  if (existsSync(filePath)) {
    p.log.error(`System ${pc.cyan(systemName)} already exists at ${pc.dim(filePath)}`);
    return;
  }

  const content = `import { System } from '../ecs/System.js';
import type { World } from '../ecs/World.js';

/**
 * TODO: Describe what this system does.
 */
export class ${systemName} extends System {
  readonly name = '${systemName}';
  readonly priority = 50;

  update(world: World, _deltaMs: number): void {
    // TODO: Implement system logic
    // Example:
    // const entities = world.query(SomeComponent.type);
    // for (const entityId of entities) {
    //   const comp = world.getComponent(entityId, SomeComponent)!;
    //   ...
    // }
  }
}
`;

  writeFileSync(filePath, content, 'utf-8');
  p.log.success(`Created ${pc.green(filePath.replace(rootDir() + '/', ''))}`);

  // Add export to barrel
  addBarrelExport(sharedSrc, systemName, 'system');
}

function addBarrelExport(sharedSrc: string, name: string, kind: 'component' | 'system'): void {
  const indexPath = join(sharedSrc, 'index.ts');

  if (!existsSync(indexPath)) {
    p.log.warn('Could not find index.ts barrel file. Please add the export manually.');
    return;
  }

  const content = readFileSync(indexPath, 'utf-8');
  const folder = kind === 'component' ? 'components' : 'systems';
  const exportLine = `export { ${name} } from './${folder}/${name}.js';`;

  if (content.includes(exportLine)) {
    p.log.info(pc.dim('Export already exists in index.ts'));
    return;
  }

  // Find the right section to insert
  const sectionComment = kind === 'component' ? '// Components' : '// Systems';
  const lines = content.split('\n');
  let insertIndex = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(`export`) && lines[i].includes(`./${folder}/`)) {
      insertIndex = i + 1;
      break;
    }
  }

  if (insertIndex === -1) {
    // Fallback: append at end
    lines.push('', exportLine);
  } else {
    lines.splice(insertIndex, 0, exportLine);
  }

  writeFileSync(indexPath, lines.join('\n'), 'utf-8');
  p.log.success(`Added export to ${pc.green('packages/shared/src/index.ts')}`);
}
