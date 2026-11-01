#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const recorded = process.argv.includes('--recorded');

if (!recorded) {
  const hasKey = Boolean(process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY);
  if (!hasKey) {
    console.error('eval: live mode needs GEMINI_API_KEY or OPENAI_API_KEY; use --recorded');
    process.exit(1);
  }
  console.error('eval: live runner is not implemented yet; use --recorded');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';
const result = spawnSync(
  command,
  ['exec', 'vitest', 'run', 'packages/ai/src/eval.recorded.test.ts', '--reporter=dot'],
  {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, CI: '1', NO_COLOR: '1' },
  },
);

process.exit(result.status ?? 1);
