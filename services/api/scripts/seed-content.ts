#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALL_CONCEPTS,
  CONCEPT_EDGES,
  CORE_SKILLS,
  FOUNDATION_ITEMS,
  MEDIA_CATALOG,
  validateFoundationItems,
} from '@loqua/content';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Optional env files.
  }
}

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54322/postgres';
const errors = validateFoundationItems(FOUNDATION_ITEMS, ALL_CONCEPTS);
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
const timestamp = new Date().toISOString();
await client.connect();
try {
  await client.query('BEGIN');

  for (const skill of CORE_SKILLS) {
    await client.query(
      `INSERT INTO public.skills
         (id, code, target_lang, domain, cefr_level, label, description, created_at)
       VALUES ($1, $2, 'en', $3, 'B1', $4, $5, $6)
       ON CONFLICT (id) DO UPDATE
       SET label = EXCLUDED.label,
           description = EXCLUDED.description`,
      [skill.id, skill.domain, skill.domain, skill.name, skill.description, timestamp],
    );
  }

  for (const concept of ALL_CONCEPTS) {
    await client.query(
      `INSERT INTO public.concepts
         (id, code, target_lang, label, skill_id, cefr_level, rule_text, explanation_target, created_at)
       VALUES ($1, $2, 'en', $3, $4, $5, $6, $6, $7)
       ON CONFLICT (id) DO UPDATE
       SET label = EXCLUDED.label,
           cefr_level = EXCLUDED.cefr_level,
           rule_text = EXCLUDED.rule_text,
           explanation_target = EXCLUDED.explanation_target`,
      [
        concept.id,
        concept.id,
        concept.title,
        `skill-en-${concept.domain}`,
        concept.level,
        concept.description,
        timestamp,
      ],
    );
  }

  for (const edge of CONCEPT_EDGES) {
    await client.query(
      `INSERT INTO public.concept_edges (parent_id, child_id, weight)
       VALUES ($1, $2, $3)
       ON CONFLICT (parent_id, child_id) DO UPDATE SET weight = EXCLUDED.weight`,
      [edge.from, edge.to, edge.weight],
    );
  }

  for (const item of FOUNDATION_ITEMS) {
    await client.query(
      `INSERT INTO public.items
         (id, target_lang, native_lang, type, skill_id, cefr_level, prompt_json,
          answer_key_json, explanation_target, difficulty_b, discrimination, tags_json,
          topic, register, license, review_status, source, auto_validated, created_at, updated_at)
       VALUES ($1, 'en', 'it', $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, 1.2, $9::jsonb,
               $10, $11, 'original', 'approved', 'authored', true, $12, $12)
       ON CONFLICT (id) DO UPDATE
       SET prompt_json = EXCLUDED.prompt_json,
           answer_key_json = EXCLUDED.answer_key_json,
           explanation_target = EXCLUDED.explanation_target,
           difficulty_b = EXCLUDED.difficulty_b,
           tags_json = EXCLUDED.tags_json,
           topic = EXCLUDED.topic,
           register = EXCLUDED.register,
           review_status = EXCLUDED.review_status,
           updated_at = EXCLUDED.updated_at`,
      [
        item.id,
        item.type,
        `skill-en-${item.skill}`,
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
        item.difficultyB,
        JSON.stringify(item.tags),
        item.topic,
        item.register ?? 'neutral',
        timestamp,
      ],
    );
    await client.query(
      `INSERT INTO public.item_concepts (item_id, concept_id, weight)
       VALUES ($1, $2, 1)
       ON CONFLICT (item_id, concept_id) DO UPDATE SET weight = EXCLUDED.weight`,
      [item.id, item.conceptId],
    );
  }

  for (const media of MEDIA_CATALOG) {
    await client.query(
      `INSERT INTO public.media_titles
         (id, kind, target_lang, title, original_title, release_year, synopsis_native,
          difficulty_band, difficulty_score, coverage_json, editorial_quality, language_variety,
          subtitle_availability_json, speech_rate_wpm, duration_minutes, episode_count,
          episode_minutes, page_count, age_rating, content_warnings_json, genres_json,
          themes_json, external_ids_json, cover_ref, license_note, review_status,
          created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14,
               $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb, $22::jsonb, '{}'::jsonb,
               NULL, $23, $24, $25, $25)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           original_title = EXCLUDED.original_title,
           release_year = EXCLUDED.release_year,
           synopsis_native = EXCLUDED.synopsis_native,
           difficulty_band = EXCLUDED.difficulty_band,
           difficulty_score = EXCLUDED.difficulty_score,
           coverage_json = EXCLUDED.coverage_json,
           editorial_quality = EXCLUDED.editorial_quality,
           language_variety = EXCLUDED.language_variety,
           subtitle_availability_json = EXCLUDED.subtitle_availability_json,
           duration_minutes = EXCLUDED.duration_minutes,
           episode_count = EXCLUDED.episode_count,
           episode_minutes = EXCLUDED.episode_minutes,
           page_count = EXCLUDED.page_count,
           age_rating = EXCLUDED.age_rating,
           content_warnings_json = EXCLUDED.content_warnings_json,
           genres_json = EXCLUDED.genres_json,
           themes_json = EXCLUDED.themes_json,
           license_note = EXCLUDED.license_note,
           review_status = EXCLUDED.review_status,
           updated_at = EXCLUDED.updated_at`,
      [
        media.id,
        media.kind,
        media.targetLang,
        media.title,
        media.originalTitle ?? null,
        media.releaseYear,
        media.synopsis,
        media.difficultyBand,
        media.difficultyScore,
        JSON.stringify(media.coverage),
        media.editorialQuality,
        media.languageVariety ?? null,
        JSON.stringify(media.subtitleAvailability),
        media.kind === 'book' ? null : 140,
        media.durationMinutes ?? null,
        media.episodeCount ?? null,
        media.episodeMinutes ?? null,
        media.pageCount ?? null,
        media.ageRating ?? null,
        JSON.stringify(media.contentWarnings),
        JSON.stringify(media.genres),
        JSON.stringify(media.themes),
        media.licenseNote,
        media.reviewStatus,
        timestamp,
      ],
    );

    await client.query('DELETE FROM public.media_title_tags WHERE media_id = $1', [media.id]);
    for (const tag of [...media.genres, ...media.themes, ...media.conceptTags]) {
      await client.query(
        `INSERT INTO public.media_title_tags (media_id, tag, weight)
         VALUES ($1, $2, 1) ON CONFLICT (media_id, tag) DO UPDATE SET weight = 1`,
        [media.id, tag],
      );
    }

    for (const availability of media.availability) {
      await client.query(
        `INSERT INTO public.media_availability
           (id, media_id, region, provider, access_type, provider_url, price_note, last_checked_at)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
         ON CONFLICT (media_id, region, provider, access_type) DO UPDATE
         SET price_note = EXCLUDED.price_note,
             last_checked_at = EXCLUDED.last_checked_at`,
        [
          `${media.id}:${availability.region}:${availability.provider}:${availability.accessType}`,
          media.id,
          availability.region,
          availability.provider,
          availability.accessType,
          availability.priceNote ?? null,
          timestamp,
        ],
      );
    }
  }

  await client.query('COMMIT');
  console.log(
    `seed:content applied ${CORE_SKILLS.length} skills, ${ALL_CONCEPTS.length} concepts, ${FOUNDATION_ITEMS.length} items, ${MEDIA_CATALOG.length} media titles`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
