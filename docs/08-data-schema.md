# Data schema

**Canonical DB:** Postgres on Supabase (source of truth). **Online-first (ADR-023):** there is no SQLite mirror, no PowerSync, and no offline write queue. The DDL below is the logical schema; the canonical Drizzle schema and migrations live in `packages/db/postgres`.

`users.id = auth.uid()`: the primary key is the Supabase Auth user id (anonymous or email).

## 1. Conventions

- IDs: `uuid`, UUID v7 generated client-side.
- Dates: `timestamptz` UTC in Postgres.
- Local day boundaries use `learner_profiles.timezone` (IANA), never the device clock alone.
- Booleans: `boolean` / `INTEGER` 0/1.
- JSON: `jsonb` / `TEXT` with `CHECK (json_valid(col))`.
- Namespacing: content rows carry `target_lang` (and `native_lang` where L1 transfer matters).
- Rule IDs are namespaced by target language: `en.gram.tense.present_perfect`.
- `cefr_level` is a normalized internal proficiency band A1-C1; the user-facing label follows
  `learner_profiles.proficiency_framework` (CEFR in phase 1).

### Audit-field policy

| Table kind        | Fields                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Mutable user data | `created_at`, `updated_at`, `deleted_at`                                                   |
| Mutable content   | `created_at`, `updated_at`; retirement via `retired_at`                                    |
| Append-only       | `created_at` only (`attempts`, `srs_reviews`, `error_events`, `xp_events`, `prompt_calls`) |
| Derived state     | `created_at`, `updated_at` (reconstructible from events)                                   |
| Global content    | `created_at` (immutable per content pack)                                                  |

This resolves the earlier ambiguity with `AGENTS.md`: not every user table has every field,
but the exceptions are explicit and enforced in review.

## 2. Identity, profiles, consent, settings

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE,
  ui_locale   TEXT NOT NULL DEFAULT 'it',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE devices (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  platform     TEXT NOT NULL CHECK (platform IN ('android','ios','web','desktop')),
  name         TEXT,
  last_seen_at TEXT,
  revoked_at   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE learner_profiles (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id),
  target_lang            TEXT NOT NULL DEFAULT 'en',
  native_lang            TEXT NOT NULL DEFAULT 'it',
  explanation_mode       TEXT NOT NULL DEFAULT 'target_simple'
                           CHECK (explanation_mode IN ('target_simple','native')),
  proficiency_framework  TEXT NOT NULL DEFAULT 'CEFR',
  proficiency_estimate   TEXT,
  goal                   TEXT CHECK (goal IN ('work','travel','daily','comprehension','exam')),
  daily_minutes          INTEGER NOT NULL DEFAULT 20 CHECK (daily_minutes BETWEEN 5 AND 60),
  streak_mode            TEXT NOT NULL DEFAULT 'flexible'
                           CHECK (streak_mode IN ('daily','flexible','weekend_off')),
  timezone               TEXT NOT NULL DEFAULT 'Europe/Rome',
  interests_json         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(interests_json)),
  self_assessment_json   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(self_assessment_json)),
  onboarding_completed   INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0,1)),
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  deleted_at             TEXT,
  UNIQUE (user_id, target_lang, native_lang)
);

CREATE TABLE consents (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  kind        TEXT NOT NULL CHECK (kind IN ('terms','privacy','voice','ai_processing','analytics')),
  version     TEXT NOT NULL,
  granted_at  TEXT,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (user_id, kind, version)
);

CREATE TABLE settings (
  user_id              TEXT PRIMARY KEY REFERENCES users(id),
  desired_retention    REAL NOT NULL DEFAULT 0.90 CHECK (desired_retention BETWEEN 0.80 AND 0.95),
  ai_daily_budget_usd  REAL NOT NULL DEFAULT 0.50 CHECK (ai_daily_budget_usd >= 0),
  model_prefs_json     TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(model_prefs_json)),
  notification_json    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(notification_json)),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT
);
```

Typed settings JSON (validated with Zod, stored as JSON):

```ts
type ModelPrefs = { tier: 'economy' | 'balanced'; overrides?: Record<string, string> };
type NotificationPrefs = {
  enabled: boolean;
  quietHours: [string, string]; // "22:00", "07:00" local
  maxPerDay: 1 | 2;
  planReady: boolean;
  dueReview: boolean;
  streakRisk: boolean;
  mediaRecommendation: boolean;
};
```

## 3. Content

```sql
CREATE TABLE content_packs (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL,
  target_lang     TEXT NOT NULL,
  native_lang     TEXT NOT NULL,
  version         INTEGER NOT NULL,
  checksum        TEXT NOT NULL,
  min_app_version TEXT,
  item_count      INTEGER NOT NULL DEFAULT 0,
  media_count     INTEGER NOT NULL DEFAULT 0,
  applied_at      TEXT,
  created_at      TEXT NOT NULL,
  UNIQUE (code, target_lang, native_lang, version)
);

CREATE TABLE skills (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  domain      TEXT NOT NULL CHECK (domain IN ('grammar','vocabulary','listening','speaking','pragmatics','reading','writing')),
  cefr_level  TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  label       TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (code, target_lang)
);

CREATE TABLE concepts (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL,
  target_lang        TEXT NOT NULL,
  label              TEXT NOT NULL,
  skill_id           TEXT NOT NULL REFERENCES skills(id),
  cefr_level         TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  rule_text          TEXT,
  explanation_target TEXT,
  created_at         TEXT NOT NULL,
  UNIQUE (code, target_lang)
);

CREATE TABLE concept_edges (
  parent_id  TEXT NOT NULL REFERENCES concepts(id),
  child_id   TEXT NOT NULL REFERENCES concepts(id),
  weight     REAL NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (parent_id, child_id),
  CHECK (parent_id <> child_id)
);

CREATE TABLE rule_bank (
  id                 TEXT PRIMARY KEY,
  rule_id            TEXT NOT NULL UNIQUE,   -- <target_lang>.<category>...
  target_lang        TEXT NOT NULL,
  native_lang        TEXT,
  category           TEXT NOT NULL,
  title              TEXT NOT NULL,
  explanation_target TEXT NOT NULL,
  examples_json      TEXT NOT NULL CHECK (json_valid(examples_json)),
  source             TEXT,
  license            TEXT,
  created_at         TEXT NOT NULL
);

CREATE TABLE items (
  id                   TEXT PRIMARY KEY,
  target_lang          TEXT NOT NULL,
  native_lang          TEXT,
  type                 TEXT NOT NULL CHECK (type IN (
                         'cloze','transformation','word_order','dictation','listening_mcq',
                         'reading_mcq','free_writing','roleplay','shadowing','reuse_lexicon',
                         'error_spotting')),
  skill_id             TEXT NOT NULL REFERENCES skills(id),
  cefr_level           TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  prompt_json          TEXT NOT NULL CHECK (json_valid(prompt_json)),
  answer_key_json      TEXT NOT NULL CHECK (json_valid(answer_key_json)),
  explanation_target   TEXT,
  difficulty_b         REAL NOT NULL DEFAULT 0.0,
  discrimination       REAL NOT NULL DEFAULT 1.2,
  tags_json            TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  topic                TEXT,
  register             TEXT CHECK (register IN ('casual','neutral','formal')),
  license              TEXT,
  audio_ref            TEXT,
  review_status        TEXT NOT NULL DEFAULT 'draft'
                         CHECK (review_status IN ('draft','pending','approved','rejected','retired')),
  source               TEXT NOT NULL DEFAULT 'generated',
  prompt_id            TEXT,
  prompt_version       INTEGER,
  content_pack_id      TEXT REFERENCES content_packs(id),
  content_request_id   TEXT,
  owner_user_id        TEXT REFERENCES users(id),        -- null = global bank
  generated_for_profile_id TEXT REFERENCES learner_profiles(id),
  generation_reason    TEXT,
  auto_validated       INTEGER NOT NULL DEFAULT 0 CHECK (auto_validated IN (0,1)),
  expires_at           TEXT,
  retired_at           TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE item_concepts (
  item_id    TEXT NOT NULL REFERENCES items(id),
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  weight     REAL NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (item_id, concept_id)
);

CREATE TABLE item_reviews (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id),
  reviewer    TEXT NOT NULL CHECK (reviewer IN ('human','automated')),
  status      TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  rubric_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rubric_json)),
  notes       TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE content_requests (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id),       -- null for batch jobs
  profile_id     TEXT REFERENCES learner_profiles(id),
  reason         TEXT NOT NULL CHECK (reason IN (
                   'missing_item','remediation','new_can_do','more_like_this',
                   'media_guide','conversation')),
  spec_json      TEXT NOT NULL CHECK (json_valid(spec_json)),
  status         TEXT NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','generating','validated','failed','served','cached')),
  prompt_id      TEXT,
  prompt_version INTEGER,
  cost_usd       REAL NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  fulfilled_at   TEXT
);

CREATE TABLE generation_jobs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('batch_bank','on_demand','promotion')),
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','done','failed')),
  spec_json   TEXT NOT NULL CHECK (json_valid(spec_json)),
  item_count  INTEGER NOT NULL DEFAULT 0,
  cost_usd    REAL NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE scenarios (
  id                    TEXT PRIMARY KEY,
  code                  TEXT NOT NULL,
  target_lang           TEXT NOT NULL,
  title_native          TEXT NOT NULL,
  goal                  TEXT NOT NULL,
  cefr_level            TEXT NOT NULL CHECK (cefr_level IN ('A1','A2','B1','B2','C1','C2')),
  setting               TEXT NOT NULL,
  register              TEXT NOT NULL CHECK (register IN ('casual','neutral','formal')),
  target_phrases_json   TEXT NOT NULL CHECK (json_valid(target_phrases_json)),
  success_criteria_json TEXT NOT NULL CHECK (json_valid(success_criteria_json)),
  max_turns             INTEGER NOT NULL DEFAULT 12,
  created_at            TEXT NOT NULL,
  UNIQUE (code, target_lang)
);
```

### 3.1 Media catalog (movies, series, books)

Metadata only. No full transcripts, no embedded copyrighted text, no piracy links.

```sql
CREATE TABLE media_titles (
  id                   TEXT PRIMARY KEY,
  kind                 TEXT NOT NULL CHECK (kind IN ('movie','series','book','podcast')),
  target_lang          TEXT NOT NULL,
  title                TEXT NOT NULL,
  original_title       TEXT,
  release_year         INTEGER,
  synopsis_native      TEXT,                 -- spoiler-free, short
  difficulty_band      TEXT CHECK (difficulty_band IN ('A1','A2','B1','B2','C1','C2')),
  difficulty_score     REAL CHECK (difficulty_score BETWEEN 0 AND 1), -- higher = harder
  coverage_json        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(coverage_json)), -- {"B1":0.92}
  editorial_quality    REAL NOT NULL DEFAULT 3 CHECK (editorial_quality BETWEEN 1 AND 5),
  language_variety     TEXT CHECK (language_variety IN ('us','uk','au','mixed')),
  subtitle_availability_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(subtitle_availability_json)),
  speech_rate_wpm      INTEGER,              -- audio media
  duration_minutes     INTEGER,              -- movie
  episode_count        INTEGER,              -- series
  episode_minutes      INTEGER,
  page_count           INTEGER,              -- book
  age_rating           TEXT,
  content_warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(content_warnings_json)),
  genres_json          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(genres_json)),
  themes_json          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(themes_json)),
  external_ids_json    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(external_ids_json)),
  cover_ref            TEXT,
  license_note         TEXT,
  review_status        TEXT NOT NULL DEFAULT 'draft'
                         CHECK (review_status IN ('draft','approved','rejected','retired')),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE media_title_tags (
  media_id TEXT NOT NULL REFERENCES media_titles(id),
  tag      TEXT NOT NULL,
  weight   REAL NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (media_id, tag)
);

CREATE TABLE media_availability (
  id              TEXT PRIMARY KEY,
  media_id        TEXT NOT NULL REFERENCES media_titles(id),
  region          TEXT NOT NULL,             -- ISO 3166-1 alpha-2
  provider        TEXT NOT NULL,
  access_type     TEXT NOT NULL CHECK (access_type IN ('subscription','rent','buy','free','library')),
  provider_url    TEXT,                      -- optional, legal provider only
  price_note      TEXT,
  last_checked_at TEXT NOT NULL,
  UNIQUE (media_id, region, provider, access_type)
);

CREATE TABLE media_guides (
  id             TEXT PRIMARY KEY,
  media_id       TEXT NOT NULL REFERENCES media_titles(id),
  profile_id     TEXT REFERENCES learner_profiles(id),
  cefr_level     TEXT NOT NULL,
  guide_json     TEXT NOT NULL CHECK (json_valid(guide_json)),
  prompt_id      TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  UNIQUE (media_id, profile_id, cefr_level, prompt_version)
);

CREATE TABLE media_phrases (
  id            TEXT PRIMARY KEY,
  media_id      TEXT NOT NULL REFERENCES media_titles(id),
  target_lang   TEXT NOT NULL,
  phrase        TEXT NOT NULL,               -- short user-provided quote or paraphrase
  normalized    TEXT NOT NULL,
  location_ref  TEXT,                        -- timestamp/page, optional
  note          TEXT,
  created_at    TEXT NOT NULL
);
```

## 4. Learner state and assessment

```sql
CREATE TABLE user_skill_state (
  user_id      TEXT NOT NULL REFERENCES users(id),
  skill_id     TEXT NOT NULL REFERENCES skills(id),
  theta        REAL NOT NULL DEFAULT 0.0,
  se           REAL NOT NULL DEFAULT 1.0 CHECK (se > 0),
  n_obs        INTEGER NOT NULL DEFAULT 0,
  mastery      REAL NOT NULL DEFAULT 0.0 CHECK (mastery BETWEEN 0 AND 1),
  last_seen_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE user_concept_state (
  user_id        TEXT NOT NULL REFERENCES users(id),
  concept_id     TEXT NOT NULL REFERENCES concepts(id),
  mastery        REAL NOT NULL DEFAULT 0.0 CHECK (mastery BETWEEN 0 AND 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  last_error_at  TEXT,
  last_seen_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, concept_id)
);

CREATE TABLE curriculum_plans (
  id                           TEXT PRIMARY KEY,
  user_id                      TEXT NOT NULL REFERENCES users(id),
  profile_id                   TEXT NOT NULL REFERENCES learner_profiles(id),
  target_lang                  TEXT NOT NULL,
  version                      INTEGER NOT NULL,
  start_date                   TEXT NOT NULL,
  end_date                     TEXT NOT NULL,
  plan_json                    TEXT NOT NULL CHECK (json_valid(plan_json)),
  generated_by_prompt_version  INTEGER,
  active                       INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  created_at                   TEXT NOT NULL,
  updated_at                   TEXT NOT NULL,
  deleted_at                   TEXT,
  UNIQUE (profile_id, version)
);

CREATE TABLE plan_days (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL REFERENCES curriculum_plans(id),
  day_date     TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('input','practice','production','assessment','immersive','rest')),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','skipped')),
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (plan_id, day_date)
);

CREATE TABLE assessments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  profile_id      TEXT NOT NULL REFERENCES learner_profiles(id),
  session_id      TEXT REFERENCES sessions(id),
  kind            TEXT NOT NULL CHECK (kind IN ('placement','recheck','media_check')),
  target_lang     TEXT NOT NULL,
  overall_level   TEXT,
  confidence      REAL CHECK (confidence BETWEEN 0 AND 1),
  prompt_id       TEXT,
  prompt_version  INTEGER,
  raw_json        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(raw_json)),
  created_at      TEXT NOT NULL
);

CREATE TABLE assessment_scores (
  id             TEXT PRIMARY KEY,
  assessment_id  TEXT NOT NULL REFERENCES assessments(id),
  dimension      TEXT NOT NULL CHECK (dimension IN (
                   'grammar','vocabulary','listening','speaking','reading','writing','pragmatics')),
  score          REAL NOT NULL CHECK (score BETWEEN 0 AND 1),
  confidence     REAL CHECK (confidence BETWEEN 0 AND 1),
  notes          TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (assessment_id, dimension)
);
CREATE TABLE level_events (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  profile_id  TEXT NOT NULL REFERENCES learner_profiles(id),
  skill_id    TEXT REFERENCES skills(id),
  from_level  TEXT,
  to_level    TEXT,
  reason      TEXT NOT NULL CHECK (reason IN (
                'placement','test_out','promotion','remediation','challenge_pass','challenge_fail')),
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  created_at  TEXT NOT NULL
);
```

## 5. Sessions, attempts, errors, saved phrases

```sql
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  profile_id   TEXT NOT NULL REFERENCES learner_profiles(id),
  target_lang  TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('lesson','review','conversation','assessment','micro','immersive')),
  scenario_id  TEXT REFERENCES scenarios(id),
  plan_day_id  TEXT REFERENCES plan_days(id),
  status       TEXT NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','in_progress','completed','abandoned')),
  started_at   TEXT,
  ended_at     TEXT,
  turns        INTEGER NOT NULL DEFAULT 0,
  tokens_in    INTEGER NOT NULL DEFAULT 0,
  tokens_out   INTEGER NOT NULL DEFAULT 0,
  cost_usd     REAL NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE TABLE session_items (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id),
  item_id       TEXT NOT NULL REFERENCES items(id),
  block         TEXT NOT NULL CHECK (block IN ('review','input','production','assessment','immersive')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  rationale_code TEXT NOT NULL,
  rationale_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rationale_json)),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','answered','skipped')),
  served_at     TEXT,
  answered_at   TEXT,
  created_at    TEXT NOT NULL,
  UNIQUE (session_id, item_id)
);

CREATE TABLE session_turns (
  id                   TEXT PRIMARY KEY,
  session_id           TEXT NOT NULL REFERENCES sessions(id),
  role                 TEXT NOT NULL CHECK (role IN ('user','tutor','system')),
  content              TEXT NOT NULL,
  audio_ref            TEXT,               -- temporary; cleared within retention window
  transcript_meta_json TEXT CHECK (transcript_meta_json IS NULL OR json_valid(transcript_meta_json)),
  created_at           TEXT NOT NULL
);

CREATE TABLE attempts (                    -- append-only
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  item_id         TEXT NOT NULL REFERENCES items(id),
  session_id      TEXT REFERENCES sessions(id),
  session_item_id TEXT REFERENCES session_items(id),
  correct         INTEGER NOT NULL CHECK (correct IN (0,1)),
  score           REAL CHECK (score IS NULL OR score BETWEEN 0 AND 1),
  latency_ms      INTEGER NOT NULL DEFAULT 0,
  hint_used       INTEGER NOT NULL DEFAULT 0 CHECK (hint_used IN (0,1)),
  response_json   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(response_json)),
  created_at      TEXT NOT NULL
);

CREATE TABLE error_events (                -- append-only
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  session_id    TEXT REFERENCES sessions(id),
  source        TEXT NOT NULL CHECK (source IN ('exercise','conversation','assessment','media','self_report')),
  span          TEXT NOT NULL,
  error_type    TEXT NOT NULL,
  rule_id       TEXT REFERENCES rule_bank(rule_id),
  severity      TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  confidence    REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  shown_to_user INTEGER NOT NULL DEFAULT 0 CHECK (shown_to_user IN (0,1)),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  resolved_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE saved_phrases (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  profile_id      TEXT NOT NULL REFERENCES learner_profiles(id),
  target_lang     TEXT NOT NULL,
  text            TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('exercise','conversation','media','manual')),
  source_ref      TEXT,
  note            TEXT,
  created_at      TEXT NOT NULL,
  deleted_at      TEXT,
  UNIQUE (profile_id, normalized_text)
);
```

## 6. Spaced repetition

```sql
CREATE TABLE srs_cards (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  profile_id      TEXT NOT NULL REFERENCES learner_profiles(id),
  card_type       TEXT NOT NULL CHECK (card_type IN ('recognition','production')),
  source_type     TEXT NOT NULL CHECK (source_type IN ('item','saved_phrase','media_phrase')),
  source_id       TEXT NOT NULL,             -- polymorphic; validated by source_type
  fsrs_json       TEXT NOT NULL CHECK (json_valid(fsrs_json)),
  due_at          TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('new','learning','review','relearning')),
  stability       REAL NOT NULL DEFAULT 0,
  difficulty      REAL NOT NULL DEFAULT 0,
  reps            INTEGER NOT NULL DEFAULT 0,
  lapses          INTEGER NOT NULL DEFAULT 0,
  suspended       INTEGER NOT NULL DEFAULT 0 CHECK (suspended IN (0,1)),
  leech           INTEGER NOT NULL DEFAULT 0 CHECK (leech IN (0,1)),
  last_review_at  TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  UNIQUE (user_id, source_type, source_id, card_type)
);

CREATE TABLE srs_reviews (                 -- append-only
  id             TEXT PRIMARY KEY,
  card_id        TEXT NOT NULL REFERENCES srs_cards(id),
  user_id        TEXT NOT NULL REFERENCES users(id),
  rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at    TEXT NOT NULL,
  elapsed_days   REAL NOT NULL DEFAULT 0,
  scheduled_days REAL NOT NULL DEFAULT 0,
  duration_ms    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);
```

## 7. Gamification

```sql
CREATE TABLE streak_state (
  user_id              TEXT PRIMARY KEY REFERENCES users(id),
  current_days         INTEGER NOT NULL DEFAULT 0,
  longest_days         INTEGER NOT NULL DEFAULT 0,
  last_production_date TEXT,
  grace_days_left      INTEGER NOT NULL DEFAULT 1,
  repairs_available    INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE activity_days (
  user_id        TEXT NOT NULL REFERENCES users(id),
  day_date       TEXT NOT NULL,
  production_sec INTEGER NOT NULL DEFAULT 0,
  review_count   INTEGER NOT NULL DEFAULT 0,
  xp             INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, day_date)
);

CREATE TABLE xp_events (                   -- append-only
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL CHECK (reason IN (
               'review','exercise','production','new_context_reuse','quest','mission','assessment','immersion')),
  ref_id     TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE quests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  code        TEXT NOT NULL,
  period      TEXT NOT NULL CHECK (period IN ('daily','weekly')),
  target      INTEGER NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','claimed')),
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  UNIQUE (user_id, code, period, expires_at)
);

CREATE TABLE badges (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,
  title_native       TEXT NOT NULL,
  description_native TEXT NOT NULL,
  criteria_json      TEXT NOT NULL CHECK (json_valid(criteria_json)),
  created_at         TEXT NOT NULL
);

CREATE TABLE user_badges (
  user_id    TEXT NOT NULL REFERENCES users(id),
  badge_id   TEXT NOT NULL REFERENCES badges(id),
  earned_at  TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE scheduled_notifications (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  kind         TEXT NOT NULL,
  fire_at      TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','cancelled')),
  sent_at      TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);
```

## 8. Feedback and media recommendations

```sql
CREATE TABLE user_feedback (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('exercise','correction','session','recommendation','media_guide')),
  target_id   TEXT NOT NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  reason_code TEXT,
  comment     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (user_id, target_type, target_id)
);

CREATE TABLE user_taste_profile (
  profile_id           TEXT PRIMARY KEY REFERENCES learner_profiles(id),
  formats_json         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(formats_json)),
  genres_json          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(genres_json)),
  themes_json          TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(themes_json)),
  disliked_json        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(disliked_json)),
  difficulty_tolerance TEXT NOT NULL DEFAULT 'balanced'
                         CHECK (difficulty_tolerance IN ('easy','balanced','challenging')),
  subtitle_pref        TEXT NOT NULL DEFAULT 'target'
                         CHECK (subtitle_pref IN ('target','native','both','none')),
  accents_json         TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(accents_json)),
  region               TEXT NOT NULL DEFAULT 'IT',
  weekly_minutes       INTEGER NOT NULL DEFAULT 120 CHECK (weekly_minutes BETWEEN 30 AND 900),
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE recommendations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  profile_id  TEXT NOT NULL REFERENCES learner_profiles(id),
  media_id    TEXT NOT NULL REFERENCES media_titles(id),
  score       REAL NOT NULL,
  score_json  TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(score_json)),
  reason_text TEXT,
  source      TEXT NOT NULL CHECK (source IN ('rule','llm')),
  status      TEXT NOT NULL DEFAULT 'shown'
                CHECK (status IN ('shown','accepted','rejected','started','finished','abandoned','expired')),
  created_at  TEXT NOT NULL,
  expires_at  TEXT
);

CREATE TABLE recommendation_feedback (
  id                  TEXT PRIMARY KEY,
  recommendation_id   TEXT NOT NULL REFERENCES recommendations(id),
  user_id             TEXT NOT NULL REFERENCES users(id),
  rating              INTEGER CHECK (rating BETWEEN 1 AND 5),
  reason_code         TEXT,
  difficulty_feedback TEXT CHECK (difficulty_feedback IN ('too_easy','ok','too_hard')),
  created_at          TEXT NOT NULL,
  UNIQUE (recommendation_id, user_id)
);

CREATE TABLE media_progress (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id),
  profile_id   TEXT NOT NULL REFERENCES learner_profiles(id),
  media_id     TEXT NOT NULL REFERENCES media_titles(id),
  status       TEXT NOT NULL DEFAULT 'planned'
                 CHECK (status IN ('planned','watching','reading','finished','abandoned')),
  progress_pct REAL NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  started_at   TEXT,
  finished_at  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (profile_id, media_id)
);
```

## 9. AI, cost, and evaluation

```sql
CREATE TABLE prompt_calls (                -- append-only
  id                  TEXT PRIMARY KEY,
  user_id             TEXT REFERENCES users(id),
  session_id          TEXT REFERENCES sessions(id),
  prompt_id           TEXT NOT NULL,
  prompt_version      INTEGER NOT NULL,
  provider            TEXT NOT NULL,
  model               TEXT NOT NULL,
  tier                TEXT NOT NULL CHECK (tier IN ('fast','balanced','reason','stt','tts')),
  input_hash          TEXT NOT NULL,
  cache_scope         TEXT NOT NULL DEFAULT 'global',
  tokens_in           INTEGER NOT NULL DEFAULT 0,
  tokens_out          INTEGER NOT NULL DEFAULT 0,
  cost_usd            REAL NOT NULL DEFAULT 0,
  latency_ms          INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL CHECK (status IN ('ok','schema_error','provider_error','budget_blocked','cached','moderated')),
  repairs             INTEGER NOT NULL DEFAULT 0,
  cached              INTEGER NOT NULL DEFAULT 0 CHECK (cached IN (0,1)),
  provider_request_id TEXT,
  error_code          TEXT,
  created_at          TEXT NOT NULL
);

CREATE TABLE prompt_versions (
  id                TEXT PRIMARY KEY,
  prompt_id         TEXT NOT NULL,
  version           INTEGER NOT NULL,
  content_hash      TEXT NOT NULL,
  model_tier        TEXT NOT NULL,
  model_config_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(model_config_json)),
  created_at        TEXT NOT NULL,
  UNIQUE (prompt_id, version)
);

CREATE TABLE eval_runs (
  id                TEXT PRIMARY KEY,
  prompt_id         TEXT NOT NULL,
  prompt_version    INTEGER NOT NULL,
  golden_set_id     TEXT NOT NULL,
  golden_set_version INTEGER NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('live','recorded')),
  metrics_json      TEXT NOT NULL CHECK (json_valid(metrics_json)),
  passed            INTEGER NOT NULL CHECK (passed IN (0,1)),
  created_at        TEXT NOT NULL
);

CREATE TABLE audio_cache (
  id          TEXT PRIMARY KEY,
  text_hash   TEXT NOT NULL,
  voice       TEXT NOT NULL,
  language    TEXT NOT NULL,
  path        TEXT NOT NULL,
  bytes       INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT,
  last_used_at TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE ai_usage_daily (
  user_id     TEXT NOT NULL REFERENCES users(id),
  day         TEXT NOT NULL,                -- local day derived from profile timezone
  cost_usd    REAL NOT NULL DEFAULT 0,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  calls       INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
```

## 10. Backup\n\n`sql\nCREATE TABLE backup_meta (\n  id              TEXT PRIMARY KEY,\n  user_id         TEXT NOT NULL REFERENCES users(id),\n  format_version  INTEGER NOT NULL,\n  schema_version  TEXT NOT NULL,\n  app_version     TEXT NOT NULL,\n  checksum        TEXT NOT NULL,\n  location        TEXT,\n  created_at      TEXT NOT NULL\n);\n`\n\n## 11. Indexes

```sql
CREATE INDEX idx_profiles_user           ON learner_profiles(user_id);
CREATE INDEX idx_devices_user            ON devices(user_id);
CREATE INDEX idx_level_events_profile    ON level_events(profile_id, created_at DESC);
CREATE INDEX idx_consents_user           ON consents(user_id, kind);
CREATE INDEX idx_attempts_user_time      ON attempts(user_id, created_at DESC);
CREATE INDEX idx_attempts_item           ON attempts(item_id);
CREATE INDEX idx_errors_user_time        ON error_events(user_id, created_at DESC);
CREATE INDEX idx_errors_rule             ON error_events(user_id, rule_id, created_at DESC);
CREATE INDEX idx_errors_open             ON error_events(user_id, status) WHERE status = 'open';
CREATE INDEX idx_srs_due                 ON srs_cards(user_id, due_at) WHERE deleted_at IS NULL AND suspended = 0;
CREATE INDEX idx_srs_source              ON srs_cards(user_id, source_type, source_id);
CREATE INDEX idx_srs_reviews_card        ON srs_reviews(card_id, reviewed_at DESC);
CREATE INDEX idx_sessions_user_time      ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_profile_status ON sessions(profile_id, status);
CREATE INDEX idx_session_items_session   ON session_items(session_id, sort_order);
CREATE INDEX idx_turns_session           ON session_turns(session_id, created_at);
CREATE INDEX idx_assessments_profile     ON assessments(profile_id, created_at DESC);
CREATE INDEX idx_items_skill_cefr        ON items(skill_id, cefr_level);
CREATE INDEX idx_items_lang              ON items(target_lang, cefr_level, difficulty_b) WHERE retired_at IS NULL;
CREATE INDEX idx_items_review            ON items(review_status, target_lang);
CREATE INDEX idx_items_owner             ON items(owner_user_id, expires_at) WHERE owner_user_id IS NOT NULL;
CREATE INDEX idx_content_requests_user   ON content_requests(user_id, created_at DESC);
CREATE INDEX idx_generation_jobs_status  ON generation_jobs(status, created_at);
CREATE INDEX idx_rules_lang              ON rule_bank(target_lang, native_lang);
CREATE INDEX idx_scenarios_lang          ON scenarios(target_lang, cefr_level);
CREATE INDEX idx_content_packs_lang      ON content_packs(target_lang, native_lang, version);
CREATE INDEX idx_saved_phrases_profile   ON saved_phrases(profile_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompt_calls_day        ON prompt_calls(user_id, created_at DESC);
CREATE INDEX idx_usage_day               ON ai_usage_daily(day);
CREATE INDEX idx_activity_user_day       ON activity_days(user_id, day_date);
CREATE INDEX idx_media_kind_lang         ON media_titles(kind, target_lang, difficulty_score);
CREATE INDEX idx_media_tags_tag          ON media_title_tags(tag);
CREATE INDEX idx_media_avail_region      ON media_availability(region, provider);
CREATE INDEX idx_recommendations_profile ON recommendations(profile_id, status, created_at DESC);
CREATE INDEX idx_media_progress_profile  ON media_progress(profile_id, status);
CREATE INDEX idx_feedback_target         ON user_feedback(target_type, target_id);
```

## 12. Invariants

1. `attempts`, `srs_reviews`, `error_events`, `xp_events`, `prompt_calls` are append-only.
2. `srs_cards` has exactly one row per `(user_id, source_type, source_id, card_type)`.
3. `error_events.rule_id` must exist in `rule_bank.rule_id` when not null.
4. `curriculum_plans.plan_json` must validate against the `CurriculumPlan` schema.
5. Exactly one `curriculum_plans.active = 1` per `profile_id`.
6. `sessions.cost_usd` equals the sum of `prompt_calls.cost_usd` for the session.
7. `srs_cards.due_at` and `state` are denormalized from `fsrs_json`; update in the same transaction.
8. All timestamps are UTC ISO-8601; local day boundaries use `learner_profiles.timezone`.
9. No persistent audio beyond the retention window; `session_turns.audio_ref` is cleared.
10. Content rows carry `target_lang`; transfer-sensitive rows also carry `native_lang`.
11. `rule_bank.rule_id` starts with `<target_lang>.` and is globally unique.
12. Only items with `review_status = 'approved'` (and not retired) are served: global items are
    human-approved; private generated items must have `auto_validated = 1` and be owner-scoped.
13. `concepts.skill_id` and `items.skill_id` must reference a skill with the same `target_lang`.
14. Media availability rows must reference legal providers; no piracy links, no full transcripts.
15. Recommendations shown to a learner must have availability in the learner's region and be
    age-appropriate; `reason_text` must be spoiler-free.
16. `user_taste_profile` has exactly one row per `learner_profiles.id`.
17. `user_feedback` is upserted per `(user_id, target_type, target_id)`.
18. `ai_processing` and `voice` consent must be granted before the first AI/voice call.
19. Exports carry `backup_meta.format_version` and a checksum; imports reject unknown versions.
20. `saved_phrases` is deduplicated per `(profile_id, normalized_text)`.
21. Postgres is the source of truth; the client has no local write queue.
22. Every user row has `user_id = auth.uid()` and an RLS policy.
23. A revoked device session is invalidated.
24. Placement, test-out, promotion, and remediation are recorded in `level_events`.
25. CEFR content scope is A1-C1; C2 rows are not created in phase 1.
26. Server-only tables are never exposed to clients; content is read-only.
27. Generated items are private (`owner_user_id`), validated (`auto_validated = 1`), and have
    `expires_at`; only the owner can read them.
28. Generated items are promoted to the global bank (`owner_user_id = null`) only after human
    review; private items are never served to another learner.
29. `content_requests` records purpose, spec, status, prompt version, and cost.
30. Selection is foundation-first: generated items are a fallback, not the default.
31. Content generation is capped per session/day; there is no offline queue.

## 12.1 Row Level Security (Postgres)

Every user table has RLS enabled. The policy is always the same shape:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_owner ON <table>
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Tables using `user_id`: `devices`, `learner_profiles`, `settings`, `consents`, `sessions`,
`attempts`, `error_events`, `user_skill_state`, `user_concept_state`, `curriculum_plans`,
`assessments`, `level_events`, `saved_phrases`, `srs_cards`, `srs_reviews`, `streak_state`,
`activity_days`, `xp_events`, `quests`, `user_badges`, `scheduled_notifications`, `user_feedback`,
`recommendations`, `recommendation_feedback`, `media_progress`, `backup_meta`,\n`content_requests`.

Child tables without `user_id` use an `EXISTS` policy against the parent:

- `session_items`, `session_turns` -> `sessions.user_id`.
- `plan_days` -> `curriculum_plans.user_id`.
- `assessment_scores` -> `assessments.user_id`.
- `user_taste_profile` -> `learner_profiles.user_id`.

Special cases:

- `users`: `id = auth.uid()`.
- Content (`content_packs`, `skills`, `concepts`, `concept_edges`, `rule_bank`,
  `item_concepts`, `scenarios`, `media_titles`, `media_title_tags`, `media_availability`,
  `media_phrases`): read-only for authenticated clients; writes only through the service role.
- `items`: readable if `owner_user_id IS NULL` (global bank) or `owner_user_id = auth.uid()`
  (private generated item); writes only through the service role.
- `item_reviews`, `generation_jobs`: server-only; service role.
- Server-only (`prompt_calls`, `prompt_versions`, `eval_runs`, `ai_usage_daily`,
  `audio_cache` metadata): no client access; service role only.
- `media_guides`: owner-only when `profile_id` is set; shared templates are read-only.

Test every policy with two users: user B must never read or write user A's rows.

## 13. Migrations

- Postgres is canonical: `pnpm db:generate` produces the migration; never hand-edit generated SQL.
- `pnpm supabase:reset` applies migrations + RLS + seed locally.
- A schema drift check runs in CI (regenerate and fail on diff, or `drizzle-kit check`).
- Test: apply all migrations to an empty DB and to a fixture of the previous version.
- Test RLS with two users: user B cannot read or write user A's rows.
- Migrations do not drop columns in use: add, backfill, remove in a later release.
- Before a destructive migration, create a `backup_meta` row and a server export.
- Content travels in versioned `content_packs`, not in migrations.

## 14. Example queries

Due cards (polymorphic source):

```sql
SELECT c.*,
       CASE c.source_type
         WHEN 'item' THEN i.prompt_json
         WHEN 'saved_phrase' THEN s.text
         WHEN 'media_phrase' THEN m.phrase
       END AS source_text
FROM srs_cards c
LEFT JOIN items i ON c.source_type = 'item' AND i.id = c.source_id
LEFT JOIN saved_phrases s ON c.source_type = 'saved_phrase' AND s.id = c.source_id
LEFT JOIN media_phrases m ON c.source_type = 'media_phrase' AND m.id = c.source_id
WHERE c.user_id = ?
  AND c.deleted_at IS NULL
  AND c.suspended = 0
  AND c.due_at <= ?
ORDER BY c.due_at ASC
LIMIT 30;
```

Recurring errors:

```sql
SELECT rule_id, error_type, COUNT(*) AS n
FROM error_events
WHERE user_id = ?
  AND created_at >= datetime('now', '-14 days')
  AND rule_id IS NOT NULL
GROUP BY rule_id, error_type
HAVING COUNT(*) >= 3
ORDER BY n DESC;
```

Candidate recommendations for a region:

```sql
SELECT mt.*, ma.provider, ma.access_type
FROM media_titles mt
JOIN media_availability ma ON ma.media_id = mt.id
WHERE mt.target_lang = ?
  AND mt.review_status = 'approved'
  AND ma.region = ?
  AND mt.id NOT IN (
    SELECT media_id FROM recommendations
    WHERE profile_id = ? AND status IN ('rejected','finished','abandoned')
  )
ORDER BY mt.difficulty_score ASC
LIMIT 50;
```

Daily AI cost:

```sql
SELECT COALESCE(cost_usd, 0) AS cost
FROM ai_usage_daily
WHERE user_id = ? AND day = ?;
```

Pending item reviews:

```sql
SELECT i.id, i.target_lang, i.cefr_level, i.type
FROM items i
WHERE i.review_status = 'pending'
ORDER BY i.created_at ASC
LIMIT 50;
```

## 15. Future: multiple target languages per user

`learner_profiles` already supports multiple profiles per user, one per target/native pair.
`sessions`, `curriculum_plans`, `assessments`, `saved_phrases`, and `srs_cards` reference
`profile_id`. Learner-state tables resolve the language through content foreign keys.
Gamification (`streak_state`, `activity_days`, `xp_events`) stays per user across languages;
if per-language streaks are needed, add `profile_id` there later.

Adding a second target language is a content and translation task, not a schema rewrite.
