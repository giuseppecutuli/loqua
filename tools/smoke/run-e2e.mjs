#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Optional env files.
  }
}
const pnpm = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8787';

async function apiIsUp() {
  try {
    const response = await fetch(`${apiUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

let api = null;

if (!(await apiIsUp())) {
  api = spawn(pnpm, ['--filter', '@loqua/api', 'start'], {
    cwd: root,
    env: { ...process.env, SMOKE_API: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let apiOutput = '';
  api.stdout.on('data', (chunk) => {
    apiOutput += chunk.toString();
  });
  api.stderr.on('data', (chunk) => {
    apiOutput += chunk.toString();
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await apiIsUp()) break;
    if (attempt === 59) {
      throw new Error(`API did not start\n${apiOutput.split('\n').slice(-15).join('\n')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function stopApi() {
  if (!api) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(api.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    api.kill('SIGTERM');
  }
}

let exitCode = 1;
try {
  const smoke = spawnSync(pnpm, ['--filter', '@loqua/app', 'smoke:supabase'], {
    cwd: root,
    env: { ...process.env, SMOKE_API: '1' },
    stdio: 'inherit',
    shell: false,
  });
  exitCode = smoke.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  stopApi();
}

process.exit(exitCode);
