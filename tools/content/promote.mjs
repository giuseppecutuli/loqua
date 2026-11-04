#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Optional env files.
  }
}

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const isLocal = /(?:^|[/@])(?:127\.0\.0\.1|localhost)(?::|\/)/.test(databaseUrl);
if (!isLocal && !process.argv.includes('--remote')) {
  console.error('refusing to promote on a remote database without --remote');
  process.exit(1);
}

const apply = process.argv.includes('--apply');
const json = process.argv.includes('--json');
const approve = readIds('--approve');
const reject = readIds('--reject');

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

function readIds(flag) {
  const value = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!value) return [];
  return value
    .slice(flag.length + 1)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function promotionGate(row) {
  const prompt = isRecord(row.prompt_json) ? row.prompt_json : {};
  const answer = isRecord(row.answer_key_json) ? row.answer_key_json : {};
  const options = Array.isArray(prompt.options) ? prompt.options : [];
  const problems = [];
  if (!row.auto_validated) problems.push('not_auto_validated');
  if (typeof prompt.prompt !== 'string' || prompt.prompt.trim().length === 0) {
    problems.push('missing_prompt');
  }
  if (typeof answer.correctOptionId !== 'string') problems.push('missing_answer');
  if (!options.some((option) => option?.id === answer.correctOptionId)) {
    problems.push('answer_not_in_options');
  }
  if (typeof row.explanation_target !== 'string' || row.explanation_target.trim().length === 0) {
    problems.push('missing_explanation');
  }
  if (!row.has_concept) problems.push('missing_concept_link');
  if (row.expires_at !== null && new Date(row.expires_at).getTime() < Date.now()) {
    problems.push('expired');
  }
  return problems;
}

try {
  const pending = await client.query(
    `SELECT i.id, i.target_lang, i.cefr_level, i.prompt_json, i.answer_key_json,
            i.explanation_target, i.auto_validated, i.review_status, i.owner_user_id,
            i.expires_at, i.created_at,
            EXISTS (SELECT 1 FROM public.item_concepts ic WHERE ic.item_id = i.id) AS has_concept
     FROM public.items i
     WHERE i.source = 'generated' AND i.review_status = 'pending'
     ORDER BY i.created_at`,
  );

  const candidates = pending.rows.map((row) => ({
    id: row.id,
    targetLang: row.target_lang,
    cefrLevel: row.cefr_level,
    problems: promotionGate(row),
  }));

  if (!apply) {
    if (json) {
      console.log(JSON.stringify({ apply, candidates }, null, 2));
    } else {
      console.log(`promotion dry-run: ${candidates.length} pending generated item(s)`);
      for (const candidate of candidates) {
        console.log(
          `${candidate.id}\t${candidate.targetLang}\t${candidate.cefrLevel}\t${
            candidate.problems.length === 0 ? 'ready' : candidate.problems.join(',')
          }`,
        );
      }
      console.log('use --apply --approve=<id,id> or --apply --reject=<id>');
    }
    process.exit(0);
  }

  const now = new Date().toISOString();
  const approved = [];
  const rejected = [];
  const blocked = [];

  for (const id of approve) {
    const candidate = candidates.find((entry) => entry.id === id);
    if (!candidate || candidate.problems.length > 0) {
      blocked.push({ id, problems: candidate?.problems ?? ['not_pending'] });
      continue;
    }
    const result = await client.query(
      `UPDATE public.items
       SET owner_user_id = NULL,
           generated_for_profile_id = NULL,
           review_status = 'approved',
           auto_validated = true,
           expires_at = NULL,
           updated_at = $2
       WHERE id = $1 AND source = 'generated' AND review_status = 'pending'
       RETURNING id`,
      [id, now],
    );
    if (result.rowCount === 1) approved.push(id);
    else blocked.push({ id, problems: ['not_pending'] });
  }

  for (const id of reject) {
    const result = await client.query(
      `UPDATE public.items
       SET review_status = 'rejected', expires_at = $2, updated_at = $2
       WHERE id = $1 AND source = 'generated' AND review_status = 'pending'
       RETURNING id`,
      [id, now],
    );
    if (result.rowCount === 1) rejected.push(id);
    else blocked.push({ id, problems: ['not_pending'] });
  }

  if (json) {
    console.log(JSON.stringify({ approved, rejected, blocked }, null, 2));
  } else {
    console.log(`approved: ${approved.length}`);
    console.log(`rejected: ${rejected.length}`);
    console.log(`blocked: ${blocked.length}`);
    for (const entry of blocked) console.log(`blocked ${entry.id}: ${entry.problems.join(',')}`);
  }
} finally {
  await client.end().catch(() => undefined);
}
