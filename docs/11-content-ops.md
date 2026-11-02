# Content operations

> **Online-first (ADR-023).** Offline/SQLite/PowerSync references in this document are
> superseded: the app requires connectivity and has no local write queue.

Content is the product. This document defines how items, audio, and the media catalog are
created, reviewed, published, measured, and retired. It closes the gap between "AI generates
items" and "learners receive trustworthy content".

## 1. Content types and ownership

| Type                            | Owner                        | Source                     | Stored in                             |
| ------------------------------- | ---------------------------- | -------------------------- | ------------------------------------- |
| Skills, concepts, prerequisites | maintainer                   | CEFR + language research   | `skills`, `concepts`, `concept_edges` |
| Grammar rules                   | maintainer                   | rule-bank authoring        | `rule_bank`                           |
| Practice items                  | AI + human review            | `exercise.generate`        | `items`                               |
| Assessment items                | AI + human review            | `assessment.item.generate` | `items` (separate pool)               |
| Scenarios                       | maintainer + AI draft        | authored                   | `scenarios`                           |
| Audio                           | TTS or recording             | provider / voice talent    | `audio_ref`, `audio_cache`            |
| Media catalog                   | maintainer + metadata import | legal metadata sources     | `media_titles`                        |
| Media guides                    | AI on demand                 | `media.guide`              | `media_guides`                        |

No content is copied from commercial courses, apps, books, or subtitles. Short user-provided
quotes are allowed for study; full transcripts are not stored.

## 2. Item lifecycle

```
draft -> generated -> automated checks -> pending review -> approved -> published in pack
      -> monitored -> (retired | rewritten)
```

| State      | Meaning                                | Allowed actions    |
| ---------- | -------------------------------------- | ------------------ |
| `draft`    | template or manual stub                | edit               |
| `pending`  | generated, passed automated gates      | human review       |
| `approved` | reviewed and eligible to be served     | publish            |
| `rejected` | failed review                          | rewrite or discard |
| `retired`  | removed from service, kept for history | no serving         |

Rules:

- Only `approved` items are served (`docs/08-data-schema.md` invariant 12).
- Retirement never deletes the row: existing attempts and SRS history stay valid.
- An SRS card pointing to a retired item is migrated to a replacement or suspended, never
  silently broken.
- Assessment items use a separate pool and exposure budget; they are not shown in practice.

## 2.1 Adaptive content layer

The foundation bank is not the whole product. Session content is composed, and generated only
when needed:

```
ContentPlanner -> foundation/cache -> if no fit -> ContentRequest
  -> content.generate -> automated gates -> private item (owner, TTL)
  -> serve -> 10% human sample -> promote to global or expire
```

- Target ratio: 70-80% foundation/cached, 20-30% generated/personalized; 0% generated offline.
- Generation triggers: missing fit, remediation, new can-do, "more like this", media guide,
  conversation scenario.
- Cache by `spec_json` hash; dedupe before generation.
- Private items are `owner_user_id`-scoped and expire after 30-90 days.
- Promotion to the global bank only after human review.
- No free-text PII in specs; use typed interests/context.
- Per-session/day caps; deterministic fallback on cap/timeout.

## 3. Required metadata

Every item carries:

- `target_lang`, `native_lang` (where transfer matters)
- `type`, `skill_id`, `cefr_level`
- `prompt_json`, `answer_key_json`, `explanation_target`
- `rule_id` (if grammatical), `concept` links
- `difficulty_b`, `discrimination`
- `tags_json` (topic, function, register, exam relevance)
- `topic`, `register`
- `license`, `source`, `prompt_id`, `prompt_version`
- `audio_ref` (if listening/shadowing)
- `review_status`

## 4. Coverage targets

Phase 1 (English, A1-C1):

| Dimension         | Target                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| Concepts          | 150-220 micro-skills across grammar, vocabulary, listening, speaking, reading, writing, pragmatics |
| Items per concept | ≥ 10 approved, across ≥ 3 exercise types                                                           |
| Practice bank     | 1,600-2,100 approved items across A1-C1                                                            |
| Assessment bank   | 200 calibrated items, separate pool                                                                |
| A1                | 250-300 practice items                                                                             |
| A2                | 350-400 practice items                                                                             |
| B1                | 400-500 practice items                                                                             |
| B2                | 400-500 practice items                                                                             |
| C1                | 300-400 practice items                                                                             |
| Per skill         | ≥ 60 items per level                                                                               |
| Audio items       | ≥ 25% of listening/speaking items with audio                                                       |
| Media catalog     | 50 titles across A1-C1 at M5.5; 200 later                                                          |

Phased content waves (do not block the engine on full C1 coverage):

1. M2: assessment bank A1-C1 + practice A1-B1 + starter B2.
2. M3: B1/B2 depth.
3. M4: C1 content wave (complex texts, idioms, register, fast speech).
4. M5+: C1 polish and media catalog expansion.

Cold start: if a concept has fewer than 5 approved items, the planner may use a generic item
of the same skill/level and mark the concept as "low coverage".

## 5. Automated quality gates

Every generated item must pass:

1. Zod schema and type-specific payload shape.
2. Exactly one defensible answer (`selfCheck.uniqueAnswer === true`, `ambiguous === false`).
3. `ruleId` exists in the rule-bank for the target language and matches the namespace.
4. No semantic duplicate (normalized stem + answer hash).
5. CEFR lexical check against a frequency list; max 1 word above level if transparent.
6. Sentence length limits per level.
7. Distractor quality: same class, plausible, not ambiguous.
8. Safety/bias check: no protected-group stereotypes, no politics/religion, no real people.
9. Copyright check: no known protected phrases; no brand names.
10. Explanation readability in the requested explanation language.

Failed items are logged with the reason and never enter a `content_pack`.

## 6. Human review

- 10% random sample per pack, minimum 20 items.
- 100% of new rule types, listening items, speaking/writing rubric items, and assessment items.
- Reviewer rubric: correctness, uniqueness, level fit, clarity, cultural safety, explanation.
- Two reviewers for disputed items; disagreement logged.
- Rejection reasons feed prompt improvements and the golden set.

Review throughput target: 40-60 items/hour for experienced review. Budget time accordingly.

## 7. Calibration

1. Initial `difficulty_b` from the LLM estimate (1-5 mapped to the logit scale).
2. Pilot with 30-50 responses (author + early use).
3. After 100 responses: check p-value and discrimination.
4. Retire or rewrite if p-value > 0.95, < 0.15, or discrimination < 0.2.
5. Update `difficulty_b` in a batch job, never from the client.
6. Recalibrate CEFR cut scores every 3 months with real data.

## 8. Audio

- Drill audio: TTS with cache; one voice per target locale.
- Listening items: recorded or high-quality TTS; US/UK accent mix.
- Every audio asset has a transcript/caption for accessibility.
- Store `audio_ref` on the item; cache by text hash + voice + language.
- No background music or copyrighted sound in generated audio.
- Retention: audio assets for content are kept with the content pack; user audio is deleted
  within 24-48h.

## 9. Media catalog (movies, series, books)

The catalog stores metadata and difficulty estimates, not copyrighted content.

Required fields: kind, target language, title, original title, year, spoiler-free synopsis,
difficulty band/score, lexical coverage by level, editorial quality, language variety, subtitle
availability, speech rate (audio), length, age rating, content warnings, genres, themes, tags,
external IDs, license note.

Difficulty estimation:

- Lexical coverage for the learner's level (target 90-95%).
- Speech rate (WPM) for audio; sentence length and idiom density for books.
- Subtitle availability and language.
- Human spot-check on 10% of titles.

Availability:

- Only legal providers; store region, provider, access type, optional URL.
- No piracy links, no unofficial streaming.
- Re-check availability quarterly; expire stale rows.

Policy:

- Synopsis must be spoiler-free.
- No full transcripts, no chapter text, no subtitle dumps.
- Short user-entered phrases are allowed for study and SRS.
- Media guides suggest functional phrases and concepts, not exact dialogue.

## 10. Content packs

- A pack is immutable and versioned: `code`, `target_lang`, `native_lang`, `version`.
- `checksum` covers the pack JSON; `min_app_version` prevents incompatible installs.
- Import is idempotent and transactional.
- Updates are delta-friendly: new items are added; retired items keep history.
- Rollback restores the previous pack version without deleting attempts.
- Pack size target: ≤ 20 MB compressed for the A1-C1 bank, split by level; audio streamed or
  cached separately.

## 11. Metrics

| Metric                          | Target                    |
| ------------------------------- | ------------------------- |
| Automated gate pass rate        | ≥ 85%                     |
| Human approval rate             | ≥ 80%                     |
| Items per concept coverage      | ≥ 90% of active concepts  |
| p-value in 0.2-0.9              | ≥ 90% of calibrated items |
| Discrimination > 0.2            | ≥ 85%                     |
| User-reported content errors    | < 1% of served items      |
| Adaptive content share          | 20-30% of session items   |
| Generation cache hit            | ≥ 60%                     |
| Generated item approval         | ≥ 80%                     |
| Generation cost                 | ≤ €0.01 per session       |
| Media recommendation acceptance | ≥ 25%                     |
| Media completion rate           | ≥ 40% of started titles   |

## 12. Tooling

- `pnpm seed` — generate/import packs (batch, offline).
- `pnpm eval` — golden-set quality gates.
- Review queue — a minimal internal screen (or SQL export) listing `pending` items.
- `tools/seed` writes both the JSON pack and the `content_packs` metadata.
- Runtime generation is limited to conversation, correction, evaluation, media guides, and
  `content.generate` under caps; the foundation bank and cache come first.

## 13. M2 content foundation

The typed catalogs in `packages/content` are the source for seeding the M2 knowledge graph,
can-do statements, placement blueprint, and rule-bank: `knowledge-graph.ts`, `can-do.ts`,
`rule-bank.ts`, and `skills.ts`. Seeding imports these catalogs; it does not re-author them.

These files are a foundation, not a final curriculum. Every concept, can-do statement, and
rule still requires human review before it is treated as approved content, and any prompt or
generation change built on top of them follows the usual review, coverage, and licensing
checks in this document.

## M2 item bank slice

The authored expansion now adds 495 items: 295 practice items across 61 text concepts (at least
5 per concept in the DB, including legacy links) and 200 assessment items (25 A1, 25 A2, 50 B1,
50 B2, 50 C1). They are seeded as `approved` after
automated gates; human spot-check sampling is still pending. Listening/speaking/writing
concepts still have no items, and practice depth remains below the 600-item target. The
original 18-item placement bank remains in `supabase/seed/seed.sql`.
