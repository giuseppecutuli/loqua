#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALL_CONCEPTS,
  CONCEPT_EDGES,
  CORE_SKILLS,
  FOUNDATION_ITEMS,
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
        JSON.stringify({ prompt: item.prompt, options: item.options }),
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

  await client.query('COMMIT');
  console.log(
    `seed:content applied ${CORE_SKILLS.length} skills, ${ALL_CONCEPTS.length} concepts, ${FOUNDATION_ITEMS.length} items`,
  );
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
