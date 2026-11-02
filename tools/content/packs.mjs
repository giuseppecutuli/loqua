#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import pg from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
  }),
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function checksum(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') fail('manifest must be an object');
  for (const key of ['code', 'targetLang', 'nativeLang', 'version', 'items']) {
    if (!(key in manifest)) fail(`manifest.${key} is required`);
  }
  if (!Number.isInteger(manifest.version) || manifest.version < 1) fail('version must be >= 1');
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) fail('items must be non-empty');
  for (const item of manifest.items) {
    for (const key of [
      'id',
      'type',
      'skillId',
      'cefrLevel',
      'prompt',
      'options',
      'correctOptionId',
      'explanation',
      'conceptId',
    ]) {
      if (!(key in item)) fail(`item ${item.id ?? '?'}: ${key} is required`);
    }
    if (
      !Array.isArray(item.options) ||
      !item.options.some((option) => option.id === item.correctOptionId)
    ) {
      fail(`item ${item.id}: correctOptionId must reference an option`);
    }
  }
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  if (args.apply) {
    const manifest = JSON.parse(await readFile(String(args.apply), 'utf8'));
    validateManifest(manifest);
    const packId = `pack.${manifest.code}.v${manifest.version}`;
    const digest = checksum(manifest);
    const timestamp = new Date().toISOString();

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO content_packs
         (id, code, target_lang, native_lang, version, checksum, item_count, applied_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       ON CONFLICT (code, target_lang, native_lang, version) DO UPDATE
       SET checksum = EXCLUDED.checksum,
           item_count = EXCLUDED.item_count,
           applied_at = EXCLUDED.applied_at`,
      [
        packId,
        manifest.code,
        manifest.targetLang,
        manifest.nativeLang,
        manifest.version,
        digest,
        manifest.items.length,
        timestamp,
      ],
    );

    for (const item of manifest.items) {
      await client.query(
        `INSERT INTO items
           (id, target_lang, native_lang, type, skill_id, cefr_level, prompt_json, answer_key_json,
            explanation_target, difficulty_b, discrimination, tags_json, topic, register, license,
            review_status, source, auto_validated, content_pack_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, 1.2, $11::jsonb,
                 $12, $13, $14, 'approved', 'authored', true, $15, $16, $16)
         ON CONFLICT (id) DO UPDATE
         SET prompt_json = EXCLUDED.prompt_json,
             answer_key_json = EXCLUDED.answer_key_json,
             explanation_target = EXCLUDED.explanation_target,
             difficulty_b = EXCLUDED.difficulty_b,
             tags_json = EXCLUDED.tags_json,
             topic = EXCLUDED.topic,
             register = EXCLUDED.register,
             license = EXCLUDED.license,
             review_status = 'approved',
             content_pack_id = EXCLUDED.content_pack_id,
             retired_at = NULL,
             updated_at = EXCLUDED.updated_at`,
        [
          item.id,
          manifest.targetLang,
          manifest.nativeLang,
          item.type,
          item.skillId,
          item.cefrLevel,
          JSON.stringify({
            prompt: item.prompt,
            options: item.options,
            ...(item.audioText ? { audioText: item.audioText } : {}),
            ...(item.answerMode ? { answerMode: item.answerMode } : {}),
            ...(item.wordBank ? { wordBank: item.wordBank } : {}),
          }),
          JSON.stringify({ correctOptionId: item.correctOptionId }),
          item.explanation,
          item.difficultyB ?? 0,
          JSON.stringify(item.tags ?? []),
          item.topic ?? null,
          item.register ?? 'neutral',
          item.license ?? 'original',
          packId,
          timestamp,
        ],
      );
      await client.query(
        `INSERT INTO item_concepts (item_id, concept_id, weight)
         VALUES ($1, $2, 1)
         ON CONFLICT (item_id, concept_id) DO UPDATE SET weight = EXCLUDED.weight`,
        [item.id, item.conceptId],
      );
    }
    await client.query('COMMIT');
    console.log('content pack applied', {
      packId,
      checksum: digest,
      items: manifest.items.length,
    });
  } else if (args.rollback) {
    const code = String(args.rollback);
    const target = Number(args.to);
    if (!Number.isInteger(target) || target < 1) fail('--to=<version> is required');
    await client.query('BEGIN');
    const retired = await client.query(
      `UPDATE items i
       SET retired_at = now(), updated_at = now()
       FROM content_packs p
       WHERE i.content_pack_id = p.id AND p.code = $1 AND p.version > $2
         AND i.retired_at IS NULL`,
      [code, target],
    );
    const restored = await client.query(
      `UPDATE items i
       SET retired_at = NULL, updated_at = now()
       FROM content_packs p
       WHERE i.content_pack_id = p.id AND p.code = $1 AND p.version = $2`,
      [code, target],
    );
    await client.query(
      `UPDATE content_packs SET applied_at = now() WHERE code = $1 AND version = $2`,
      [code, target],
    );
    await client.query('COMMIT');
    console.log('content pack rollback', {
      code,
      to: target,
      retired: retired.rowCount ?? 0,
      restored: restored.rowCount ?? 0,
    });
  } else {
    fail('usage: --apply=<manifest.json> | --rollback=<code> --to=<version>');
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
