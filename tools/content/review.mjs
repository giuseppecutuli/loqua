#!/usr/bin/env node
import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const sampleArg = process.argv.find((arg) => arg.startsWith('--sample='));
const sampleRate = sampleArg ? Number(sampleArg.slice('--sample='.length)) : 0.1;
if (!Number.isFinite(sampleRate) || sampleRate <= 0 || sampleRate > 1) {
  throw new Error('--sample must be between 0 and 1');
}

const forbidden = [
  'porn',
  'nude',
  'sex',
  'suicide',
  'kill yourself',
  'terrorist',
  'nazi',
  'racial slur',
  'torrent',
  'pirated',
  'free movie download',
];

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const totals = await client.query(
    `SELECT count(*)::int AS total FROM items WHERE review_status = 'approved'`,
  );
  const total = totals.rows[0]?.total ?? 0;
  const sampleSize = Math.max(1, Math.ceil(total * sampleRate));
  const sample = await client.query(
    `SELECT id, target_lang, type, cefr_level, prompt_json, answer_key_json,
            explanation_target, tags_json
     FROM items
     WHERE review_status = 'approved'
     ORDER BY md5(id)
     LIMIT $1`,
    [sampleSize],
  );

  const failures = [];
  const seenPrompts = new Map();
  for (const item of sample.rows) {
    const prompt = item.prompt_json;
    const answer = item.answer_key_json;
    const options = Array.isArray(prompt?.options) ? prompt.options : [];
    const optionIds = new Set(options.map((option) => option.id));
    const text = `${prompt?.prompt ?? ''} ${options.map((option) => option.text).join(' ')}`
      .toLowerCase();

    if (item.target_lang !== 'en') failures.push(`${item.id}: target_lang is not en`);
    if (typeof prompt?.prompt !== 'string' || prompt.prompt.trim().length < 8) {
      failures.push(`${item.id}: prompt is missing or too short`);
    }
    const minOptions =
      prompt?.answerMode === 'text' || prompt?.answerMode === 'order' ? 1 : 2;
    if (options.length < minOptions) failures.push(`${item.id}: fewer than ${minOptions} options`);
    if (!optionIds.has(answer?.correctOptionId)) {
      failures.push(`${item.id}: correctOptionId is not an option`);
    }
    if (new Set(options.map((option) => option.text)).size !== options.length) {
      failures.push(`${item.id}: duplicate option text`);
    }
    if (typeof item.explanation_target !== 'string' || item.explanation_target.trim().length < 5) {
      failures.push(`${item.id}: missing explanation`);
    }
    for (const term of forbidden) {
      if (text.includes(term)) failures.push(`${item.id}: forbidden term "${term}"`);
    }
    const normalized = prompt?.prompt?.trim().toLowerCase() ?? '';
    if (seenPrompts.has(normalized)) {
      failures.push(`${item.id}: duplicate prompt with ${seenPrompts.get(normalized)}`);
    } else {
      seenPrompts.set(normalized, item.id);
    }
  }

  const duplicatePrompts = await client.query(
    `SELECT lower(prompt_json->>'prompt') AS prompt, count(*)::int AS n
     FROM items
     WHERE review_status = 'approved'
     GROUP BY lower(prompt_json->>'prompt')
     HAVING count(*) > 1
     ORDER BY n DESC
     LIMIT 10`,
  );

  console.log('CONTENT REVIEW');
  console.log({ approved: total, sampleSize, sampleRate });
  console.log('duplicate approved prompts', duplicatePrompts.rows);
  console.log('sample ids', sample.rows.map((item) => item.id));
  console.log('failures', failures);
  if (failures.length > 0 || duplicatePrompts.rows.length > 0) process.exitCode = 1;
} finally {
  await client.end();
}
