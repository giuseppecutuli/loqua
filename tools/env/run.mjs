#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // The command may only need variables from the shell.
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node tools/env/run.mjs <command> [...args]');
  process.exit(2);
}

const pnpm = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';
const result = spawnSync(pnpm, ['exec', command, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

process.exit(result.status ?? 1);
