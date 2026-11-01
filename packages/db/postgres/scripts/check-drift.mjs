#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const tempOut = path.join(root, '.verify', 'db-drift');

await rm(tempOut, { recursive: true, force: true });
await mkdir(tempOut, { recursive: true });

const metaDir = path.join(migrationsDir, 'meta');
try {
  await cp(metaDir, path.join(tempOut, 'meta'), { recursive: true });
} catch {
  console.error('drift: no migration metadata found; run pnpm db:generate first');
  process.exit(1);
}

const pnpm = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';
const result = spawnSync(
  pnpm,
  [
    'exec',
    'drizzle-kit',
    'generate',
    '--out',
    tempOut,
    '--schema',
    './src/schema.ts',
    '--dialect',
    'postgresql',
  ],
  {
    cwd: path.resolve(here, '..'),
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, NO_COLOR: '1' },
  },
);

const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
await rm(tempOut, { recursive: true, force: true });

if (result.status !== 0) {
  console.error('drift: drizzle-kit generate failed');
  console.error(output.trim().split('\n').slice(-12).join('\n'));
  process.exit(1);
}

if (/Your SQL migration file/i.test(output)) {
  console.error('drift: schema changed without a generated migration');
  const lines = output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(-8);
  console.error(lines.join('\n'));
  process.exit(1);
}

console.log('schema drift: none');
