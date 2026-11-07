#!/usr/bin/env node
/**
 * Data-retention job. Dry-run by default; pass --apply to mutate.
 *
 * Policy (docs/13-safety-privacy.md):
 * - audio references cleared after 48 hours;
 * - conversation turns deleted after 90 days;
 * - shown media recommendations expire after 14 days;
 * - private generated items are retired after their TTL.
 */
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

const apply = process.argv.includes('--apply');
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres';
const client = new pg.Client({ connectionString: databaseUrl });

const AUDIO = "now() - interval '48 hours'";
const TRANSCRIPT = "now() - interval '90 days'";
const MEDIA_RECOMMENDATION = "now() - interval '14 days'";

try {
  await client.connect();
  await client.query('BEGIN');

  const audio = apply
    ? await client.query(
        `UPDATE public.session_turns SET audio_ref = NULL
         WHERE created_at < ${AUDIO} AND audio_ref IS NOT NULL`,
      )
    : await client.query(
        `SELECT count(*)::int AS n FROM public.session_turns
         WHERE created_at < ${AUDIO} AND audio_ref IS NOT NULL`,
      );

  const transcripts = apply
    ? await client.query(`DELETE FROM public.session_turns WHERE created_at < ${TRANSCRIPT}`)
    : await client.query(
        `SELECT count(*)::int AS n FROM public.session_turns WHERE created_at < ${TRANSCRIPT}`,
      );

  const recommendations = apply
    ? await client.query(
        `UPDATE public.recommendations SET status = 'expired'
         WHERE status = 'shown' AND created_at < ${MEDIA_RECOMMENDATION}`,
      )
    : await client.query(
        `SELECT count(*)::int AS n FROM public.recommendations
         WHERE status = 'shown' AND created_at < ${MEDIA_RECOMMENDATION}`,
      );

  const items = apply
    ? await client.query(
        `UPDATE public.items SET review_status = 'retired', retired_at = now()
         WHERE owner_user_id IS NOT NULL AND review_status <> 'retired'
           AND expires_at IS NOT NULL AND expires_at < now()`,
      )
    : await client.query(
        `SELECT count(*)::int AS n FROM public.items
         WHERE owner_user_id IS NOT NULL AND review_status <> 'retired'
           AND expires_at IS NOT NULL AND expires_at < now()`,
      );

  if (apply) await client.query('COMMIT');
  else await client.query('ROLLBACK');

  const count = (result) => (apply ? (result.rowCount ?? 0) : (result.rows[0]?.n ?? 0));
  const mode = apply ? 'applied' : 'dry-run';
  console.log(
    `retention ${mode}: audio=${count(audio)} transcripts=${count(transcripts)} ` +
      `recommendations=${count(recommendations)} items=${count(items)}`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(`retention failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
