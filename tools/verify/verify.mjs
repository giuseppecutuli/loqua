#!/usr/bin/env node
/**
 * Autonomous verification harness.
 *
 * Usage:
 *   node tools/verify/verify.mjs --level=fast
 *   node tools/verify/verify.mjs --level=core --strict
 *   node tools/verify/verify.mjs --level=full --live
 *   node tools/verify/verify.mjs --only=typecheck,lint --json
 *
 * Design goals:
 * - one command an agent can run without guessing;
 * - compact output (summary + failure excerpt), token-efficient;
 * - no network by default; live AI eval only with --live;
 * - missing scripts are SKIP unless --strict or required by the level.
 */

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PNPM = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';

const STEPS = {
  typecheck: {
    label: 'typecheck',
    args: ['typecheck'],
    levels: ['fast', 'core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  lint: {
    label: 'lint',
    args: ['lint'],
    levels: ['fast', 'core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  unit: {
    label: 'unit tests',
    args: ['test:ci'],
    levels: ['fast', 'core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  dbcheck: {
    label: 'schema drift',
    args: ['db:check'],
    levels: ['fast', 'core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  supabase: {
    label: 'supabase reset + seed',
    args: ['supabase:reset'],
    levels: ['core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  rls: {
    label: 'RLS two-user isolation',
    args: ['test:rls'],
    levels: ['core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  evalRecorded: {
    label: 'recorded prompt eval',
    args: ['eval:recorded'],
    levels: ['core', 'full', 'nightly'],
    required: ['core', 'full', 'nightly'],
  },
  build: {
    label: 'web build',
    args: ['build:web'],
    levels: ['full', 'nightly'],
    required: ['full', 'nightly'],
  },
  e2eWeb: {
    label: 'web E2E',
    args: ['test:e2e:web'],
    levels: ['full', 'nightly'],
    required: ['full', 'nightly'],
  },
  e2eMobile: {
    label: 'mobile E2E',
    args: ['test:e2e:mobile'],
    levels: ['nightly'],
    required: ['nightly'],
  },
  evalLive: {
    label: 'live prompt eval (sampled)',
    args: ['eval'],
    levels: ['nightly'],
    required: [],
    liveOnly: true,
  },
};

const args = parseArgs(process.argv.slice(2));
const level = args.level ?? 'fast';
if (!['fast', 'core', 'full', 'nightly'].includes(level)) {
  console.error(`Unknown level: ${level}`);
  process.exit(2);
}

const selected = Object.entries(STEPS).filter(([key, step]) => {
  if (!step.levels.includes(level)) return false;
  if (step.liveOnly && !args.live) return false;
  if (args.only.length > 0 && !args.only.includes(key)) return false;
  return true;
});

if (args.list) {
  for (const [key, step] of Object.entries(STEPS)) {
    console.log(`${key}\t${step.label}\t${step.levels.join(',')}`);
  }
  process.exit(0);
}

if (!existsSync(path.join(ROOT, 'package.json'))) {
  const skipped = { level, skipped: true, reason: 'no package.json yet (phase 0 docs-only repo)' };
  if (args.json) console.log(JSON.stringify(skipped, null, 2));
  else console.log('verify: skipped (no package.json yet; phase 0 docs-only repo)');
  process.exit(0);
}

const results = [];
const startedAt = Date.now();
console.log(`verify level=${level}${args.strict ? ' strict' : ''} steps=${selected.length}`);

for (const [key, step] of selected) {
  const required = args.strict ? true : step.required.includes(level);
  const result = await runStep(key, step, required);
  results.push(result);
  if (result.status === 'fail' && args.stopOnFail) break;
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');
const passed = results.filter((r) => r.status === 'pass');

if (!args.json) {
  for (const r of results) {
    const line = `${r.status.toUpperCase().padEnd(4)} ${r.label} (${(r.ms / 1000).toFixed(1)}s)`;
    console.log(line);
    if (r.status === 'fail') printFailure(r);
    if (r.status === 'skip' && r.reason) console.log(`     skip: ${r.reason}`);
  }
  console.log(
    `\nsummary: pass=${passed.length} fail=${failed.length} skip=${skipped.length} in ${elapsed}s`,
  );
}

const report = {
  level,
  strict: args.strict,
  live: args.live,
  elapsedSec: Number(elapsed),
  summary: { pass: passed.length, fail: failed.length, skip: skipped.length },
  results: results.map(({ key, label, status, ms, reason, excerpt, exitCode }) => ({
    key,
    label,
    status,
    ms,
    reason,
    exitCode,
    excerpt,
  })),
};

if (args.report) {
  writeFileSync(path.resolve(ROOT, args.report), JSON.stringify(report, null, 2));
  if (!args.json) console.log(`report: ${args.report}`);
}
if (args.json) console.log(JSON.stringify(report, null, 2));

process.exit(failed.length > 0 ? 1 : 0);

function parseArgs(argv) {
  const out = { only: [] };
  for (const raw of argv) {
    if (raw === '--strict') out.strict = true;
    else if (raw === '--json') out.json = true;
    else if (raw === '--live') out.live = true;
    else if (raw === '--list') out.list = true;
    else if (raw === '--stop-on-fail') out.stopOnFail = true;
    else if (raw.startsWith('--level=')) out.level = raw.slice(8);
    else if (raw.startsWith('--only=')) out.only = raw.slice(7).split(',').filter(Boolean);
    else if (raw.startsWith('--report=')) out.report = raw.slice(9);
    else if (raw.startsWith('--timeout=')) out.timeout = Number(raw.slice(10));
    else {
      console.error(`Unknown argument: ${raw}`);
      process.exit(2);
    }
  }
  out.timeout = out.timeout || 180000;
  return out;
}

function runStep(key, step, required) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(PNPM, step.args, {
      cwd: ROOT,
      shell: false,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        NODE_ENV: process.env.NODE_ENV ?? 'test',
      },
    });

    let output = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), args.timeout);

    child.stdout.on('data', (d) => {
      output += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        key,
        label: step.label,
        status: required ? 'fail' : 'skip',
        reason: `spawn error: ${err.message}`,
        ms: Date.now() - started,
        exitCode: null,
        excerpt: '',
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const combined = `${output}\n${stderr}`;
      const ms = Date.now() - started;
      const missing = /Missing script|ERR_PNPM_NO_SCRIPT|Command .* not found/i.test(combined);
      if (missing && !required) {
        resolve({
          key,
          label: step.label,
          status: 'skip',
          reason: 'script not defined yet',
          ms,
          exitCode: code,
        });
        return;
      }
      if (code === 0) {
        resolve({ key, label: step.label, status: 'pass', ms, exitCode: 0 });
        return;
      }
      resolve({
        key,
        label: step.label,
        status: 'fail',
        ms,
        exitCode: code,
        excerpt: summarizeFailure(combined),
      });
    });
  });
}

function summarizeFailure(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const important = lines.filter((l) =>
    /(error|failed|failure|assertionerror|expected|received|✗|×|cannot find|not found|syntaxerror|typeerror)/i.test(
      l,
    ),
  );
  const chosen = [...new Set([...important, ...lines.slice(-25)])].slice(-40);
  const joined = chosen.join('\n');
  return joined.length > 4000 ? `${joined.slice(0, 4000)}\n…(truncated)` : joined;
}

function printFailure(r) {
  console.log(`     exit=${r.exitCode} ${r.reason ?? ''}`.trimEnd());
  if (r.excerpt) {
    for (const line of r.excerpt.split('\n')) console.log(`     ${line}`);
  }
}
