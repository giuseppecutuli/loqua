# Architecture and product decisions (ADRs)

Decision log. Each ADR states: context, decision, alternatives, consequences, and revisit
trigger. New decisions are appended; history is not rewritten.

Status: **accepted** unless stated otherwise. Reference date: November 2026.

---

## ADR-001 — Single Expo client (React Native + React Native Web)

**Context.** The app needs Android, iOS, Web, and Desktop with one codebase, push
notifications, microphone access, audio, and fast iteration for a solo developer.

**Decision.** Expo SDK 58 (RN 0.88, React 19.3) with expo-router and React Native Web.
Single app in `apps/app`. Desktop as a Tauri v2 wrapper (M7). Web-specific components are
isolated in `.web.tsx` files; no DOM dependency in shared code.

**Rejected alternatives.**

- _PWA-only_: on iOS, push works only from the Home Screen, background audio is unreliable,
  and storage is subject to eviction. Does not meet requirements.
- _Tauri v2 mobile as the base_: excellent desktop, but remote push, background audio, and
  plugins require native work on mobile; ecosystem too young for the core.
- _Capacitor_: valid for web-only teams, but WebView UX and plugin quality vary.
- _Flutter_: strong on mobile, weak on web (bundle size, SEO, text selection); mobile is
  not the only platform.

**Consequences.**

- Realistic shared-code coverage is 85-95%; the rest are platform adapters.
- Web requires COOP/COEP headers for SQLite WASM (configured on the host).
- Native builds via EAS; iOS still needs a Mac or EAS Build.

**Revisit trigger.** If web becomes the primary platform, or native features are not
supported by Expo, consider a separate web frontend.

---

## ADR-002 — Local SQLite + Drizzle as the source of truth (phase 1)

**Status:** superseded by ADR-016 (multi-device from day one). Kept for history.

**Context.** The app must work offline, be fast, and not require a backend during the
personal phase. The DB is the source of truth for user state.

**Decision.** `expo-sqlite` + Drizzle ORM, migrations with drizzle-kit, repositories in
`packages/db`. On web: wa-sqlite/WASM with OPFS. `attempts` and `srs_reviews` are
append-only. Derived state (theta, mastery, cards) is updated transactionally.

**Rejected alternatives.**

- _RxDB/WatermelonDB_: custom sync and a document model less suited to analytical queries.
- _IndexedDB only_: not shared with native, poor queries, fragile migrations.
- _Server-only DB_: violates offline-first and adds cost/latency.

**Consequences.** Phase 1 needs JSON backup/export. Sync (ADR-004) is added without changing
the data model, via an outbox and `updated_at`.

**Revisit trigger.** If Android performance degrades with an item bank > 10k, evaluate
`op-sqlite` (JSI) while keeping Drizzle.

---

## ADR-003 — No backend in phase 1; BYOK + Cloudflare Worker proxy

**Status:** superseded by ADR-016 (server-authoritative backend + Hono API). Kept for history.

**Context.** Single user, AI budget < 20 €/month, no desire to manage a server. API keys
must not live in the bundle or in plain text in the browser.

**Decision.**

- Phase 1: user keys stored in `expo-secure-store` on native.
- On web, and to unify logging/caching/rate limiting: `services/proxy` (Cloudflare Worker,
  free tier) holds keys as secrets, exposes typed endpoints, and logs costs.
- The client never calls providers directly when going through the proxy.

**Rejected alternatives.**

- _Key in the web client_: exposed to anyone with devtools.
- _Dedicated backend (VPS/Fly.io)_: unjustified cost and maintenance in phase 1.
- _Local key on every device_: no cost control, no shared cache.

**Consequences.** The proxy is the only component to protect; it is versioned and deployed
with `wrangler`. It must enforce daily limits, timeouts, a model allowlist, and PII-free logs.

**Revisit trigger.** When multiple users or subscriptions arrive, replace the proxy with
Supabase Edge Functions and real auth (ADR-004).

---

## ADR-004 — Self-hosted Supabase + PowerSync for the multi-user phase

**Status:** superseded by ADR-016 (self-hosted Supabase + PowerSync + Hono from M1).

**Context.** Eventually the app needs multi-device sync, accounts, and per-user AI quotas
without building a backend from scratch.

**Decision.** Postgres + Auth + Storage + Edge Functions on self-hosted Supabase; PowerSync
for bidirectional SQLite <-> Postgres sync with per-user sync rules. Embeddings in pgvector;
audio in Storage with signed URLs and short retention.

**Rejected alternatives.**

- _Firebase_: lock-in, unpredictable costs, no SQL/pgvector.
- _PocketBase_: great for a single-node MVP, pre-1.0, does not scale horizontally.
- _ElectricSQL_: read-path only, requires separate write APIs.
- _Custom backend_: too much maintenance for one developer.

**Consequences.** Superseded by ADR-016: sync is M1, PowerSync manages the local write queue,
and no custom `sync_outbox` is needed.

**Revisit trigger.** If multi-user never happens, Supabase is unnecessary: JSON export/import
and local backup are enough.

---

## ADR-005 — FSRS-7 via `ts-fsrs` v6 for spaced repetition

**Context.** We need efficient scheduling for vocabulary, phrases, and communicative
functions without inventing an algorithm.

**Decision.** `ts-fsrs` v6 with FSRS-7, `desired_retention` 0.90 (configurable). Separate
cards for recognition and production. Free production is not a card: it only creates cards
from confirmed errors, with deduplication.

**Rejected alternatives.** SM-2 (ease hell, no personalization), Leitner (too coarse),
proprietary algorithms (not verifiable).

**Consequences.** Hundreds of reviews are needed to optimize parameters; defaults are used
until then. Log every review with rating, elapsed, and scheduled days.

---

## ADR-006 — Elo-based learner model per micro-skill, not deep learning

**Context.** Scarce initial data, a single user, and the need for explainability and
deterministic tests.

**Decision.** Independent Elo trackers per micro-skill (`theta`, `se`, `n_obs`, `last_seen`)
with shrinkage toward the user mean. A knowledge graph of concepts and prerequisites for the
planner. Transactional updates from append-only `attempts`. No trained model to serve.

**Rejected alternatives.** DKT (requires lots of data and training), IRTree (complex),
simple score averages (ignore item difficulty).

**Consequences.** Quality depends on item difficulty calibration. The initial item bank is
calibrated with 30-50 pilot responses, then updated from real attempts.

---

## ADR-007 — Pre-generated item bank offline; real-time AI only where needed

**Status:** amended by ADR-018. The foundation bank remains, but content composition and
personalization are adaptive and may generate items on demand.

**Context.** Generating exercises every session is expensive, slow, and inconsistent.

**Decision.** Offline batches (`tools/seed`, `pnpm seed`) produce validated, versioned item
packages in `packages/content`. At runtime, AI is used only for conversation, free-production
correction, evaluation, and plan repair. Everything else is deterministic selection from the DB.

**Rejected alternatives.** Live generation per exercise (cost and variance), static content
with no adaptivity (no personalization).

**Consequences.** The app works offline for the core loop. Item bank quality is a product
requirement, not a detail.

---

## ADR-008 — Localized UI, explanations in simple target language

**Context.** The learner is Italian, wants an immediate interface but gradual immersion.

**Decision.** UI chrome in Italian (`ui_locale=it`). Didactic explanations (rules, feedback,
corrections) in the simple target language by default (`explanation_mode=target_simple`),
with a native-language toggle (`explanation_mode=native`) in settings and an automatic
fallback when the learner signals misunderstanding.

**Consequences.** Prompts carry `targetLang`, `nativeLang`, and `explanationMode`. Generated
text is checked for readability. UI strings live in locale catalogs keyed by `ui_locale`
(ADR-012); no literal copy in components.

---

## ADR-009 — Gamification without hearts/energy

**Context.** Literature and Duolingo's redesign show that punishing errors reduces completion,
especially for beginners. The goal is consistency, not monetizing mistakes.

**Decision.** No hearts or energy. The streak is about _production_ (having spoken/written),
not tapping. XP rewards reuse in new contexts. Quests and badges are informative.
No global leaderboard: at most a cohort or friends, opt-in, in phase 2.

**Consequences.** Other retention levers are needed (event-based notifications, quests,
visible progress). The design must make real progress visible, not just XP.

---

## ADR-010 — AssemblyAI primary STT, Web Speech fallback, browser-first TTS

**Context.** Low budget; AssemblyAI offers $50 in starter credits; reliable transcription is
needed for conversation and evaluation.

**Decision.**

- STT: AssemblyAI Universal-Streaming English ($0.15/hr) or Universal-3.5 Pro async
  ($0.21/hr) for files; fallback Web Speech API (free) and Groq Whisper for batches.
- TTS: browser `SpeechSynthesis` as default; OpenAI `tts-1` ($15/1M characters) for
  high-quality audio, with per-text-hash caching; AssemblyAI TTS as an option.
- User audio: transcribed and deleted within 24-48h; no persistent audio.

**Consequences.** Pronunciation assessment is qualitative (STT + LLM), not reliable at the
phoneme level. If phonetic scoring is needed, evaluate Azure Pronunciation Assessment in M5.

---

## ADR-011 — No protected content; original, verifiable item bank

**Decision.** No phrases or audio copied from Duolingo or others. Items are AI-generated and
verified by the rule-bank and human spot-checks. Sources (texts, audio) must have a
compatible license.

**Consequences.** The golden set and rule-bank become proprietary project assets.

---

## ADR-012 — Localization and language configuration (English first)

**Context.** The immediate concern is the language of the **UI**, not an "AI language"
setting: the tutor always speaks the target language. The UI may need another locale in the
future, and the target language may change too. Hardcoding UI copy or language names in
prompts/content would turn either change into a rewrite.

**Decision.**

- UI locale is data: `ui_locale` on the user account, default `it`.
- Target/native language are data: `target_lang` (`en`), `native_lang` (`it`),
  `explanation_mode` (`target_simple` | `native`), `proficiency_framework` (`CEFR`).
- All user-facing strings live in locale catalogs (`packages/ui/i18n/<locale>.json`), loaded
  by `ui_locale`; components never contain literal copy.
- The tutor speaks `target_lang`; explanations follow `explanation_mode`; UI chrome follows
  `ui_locale`. There is no separate "AI language" setting.
- Content is namespaced by `target_lang` (and `native_lang` where L1 transfer matters).
- `rule_id` is namespaced by target language: `en.gram.tense.present_perfect`.
- Speech adapters take a language code (STT) and a locale/voice (TTS).
- Formatting (dates, numbers, plurals) uses `ui_locale`, never hardcoded patterns.
- Layout is RTL-ready (logical properties) even if no RTL locale ships now.

**Phase 1 scope.** Ship only `target=en`, `native=it`, `ui=it`. The onboarding shows the fixed
English course; no language picker is exposed yet. The plumbing exists and is tested.

**Consequences.** Slight schema overhead; content packs and golden sets are keyed by language
pair; pseudo-localization and locale tests are required; adding a UI language is a translation
task, not a refactor.

**Revisit trigger.** When a second UI locale or a second target language is added.

---

## ADR-013 — Media recommendations with taste onboarding and feedback

**Context.** The app should recommend movies, series, and books that improve English, based on
level, gaps, tastes, and feedback. The learner must be able to act on recommendations without
the app hosting copyrighted content.

**Decision.**

- Maintain a metadata-only catalog (`media_titles`, `media_availability`) with legal providers,
  region availability, difficulty estimates, tags, age ratings, and content warnings.
- Onboard tastes (formats, genres, themes, difficulty tolerance, subtitles, weekly time,
  region) and store them in `user_taste_profile`.
- Rank deterministically in `packages/core` (level fit + taste + quality + diversity +
  freshness), with epsilon-greedy exploration. The LLM writes the reason and the guide, not
  the ranking.
- Learn from feedback (accepted, rejected, too easy/hard, finished, abandoned) and update taste
  weights and the difficulty target.
- Watching/reading counts as input XP, not as production streak. A 60-second spoken or 80-word
  written reflection after the session counts as production.
- No full transcripts, no subtitle dumps, no piracy links, no spoilers. Short user-entered
  quotes are allowed for study and SRS.

**Rejected alternatives.**

- _LLM-only ranking_: expensive, inconsistent, hard to test.
- _Scraped catalog with transcripts_: legal risk and storage cost.
- _Streaming-service integration_: scope and licensing complexity; deferred.
- _User-maintained list only_: poor cold start and no difficulty model.

**Consequences.** Catalog curation and availability checks become ongoing content operations.
New schemas and an eval set are required. Recommendation cost stays near zero because ranking
is local and explanations are cached.

**Revisit trigger.** When the catalog exceeds ~500 titles or when embeddings/vector search
become cheaper than tag matching.

---

## ADR-014 — Privacy, retention, and encryption

**Context.** The app handles voice, transcripts, learning history, and taste data. Voice and
free text are sensitive; the learner is in the EU. Data now lives on the server and on devices.

**Decision.**

- Explicit consent for terms, privacy, voice, AI processing, and analytics; stored in
  `consents` with versions and revocation.
- Retention: audio 24-48h, transcripts 90 days by default, prompt metadata 90 days, analytics
  12 months, backups 30 days. The user can delete immediately.
- Server encryption at rest (Supabase Postgres/Storage); EU region.
- Local cache encryption at rest on native (SQLCipher or equivalent; key in secure storage).
  Web relies on device/browser security and is documented as a residual risk.
- Encrypted backups (server + local); full JSON export with `format_version` and checksum;
  cascade deletion propagated to devices.
- RLS on every user table; `users.id = auth.uid()`.
- No PII or content in logs; hashes only. Provider DPAs and EU regions where available.
- DPIA before public launch; AI Act transparency review.

**Rejected alternatives.**

- _No local encryption_: simpler, but unacceptable for transcripts on a lost device.
- _Local-only data_: cannot serve two devices (ADR-016).
- _No analytics_: less insight; privacy-safe events are enough.

**Consequences.** Retention jobs, consent gates, RLS tests, key management, and a deletion
runbook are release blockers. Encryption adds a small performance cost.

**Revisit trigger.** When self-hosting, adding a new region, or adding a new data class.

---

## ADR-015 — AI safety: untrusted input, bounded output

**Context.** Learner text and audio can contain prompt injection, unsafe requests, or attempts
to extract answers. The model must never be trusted to enforce product rules.

**Decision.**

- Treat all learner content as untrusted data, never instructions; explicit delimiters and
  instruction hierarchy.
- No tools, no file/API access, no secrets in prompts.
- Schema-bound output for corrections, plans, exercises, and media guides; free text only for
  the conversation turn.
- Post-generation gates: `span` check, `rule_id` allowlist, confidence threshold, moderation.
- Red-team suite and prompt-injection regression tests in CI.
- Budget caps, per-feature quotas, JWT-gated Hono API, rate limits, circuit breaker.

**Rejected alternatives.**

- _Trust the model_: fails on adversarial input and hallucinated rules.
- _Full tool access_: unnecessary risk for phase 1.
- _No moderation_: unacceptable for a consumer app.

**Consequences.** Some valid outputs are rejected by strict gates; fallback paths must be
first-class. Safety logs are metadata-only.

**Revisit trigger.** When tools, browsing, or user-generated public content are added.

---

## ADR-016 — Multi-device from day one: self-hosted Postgres + local cache + sync

**Context.** The learner may use Android and Web. Local-only state would diverge and lose
progress across devices. Offline use is still required. The owner prefers self-hosted,
direct control over SaaS.

**Decision.**

- **Postgres is the source of truth** for user state. Local SQLite is an offline cache and a
  write queue, not the authoritative store.
- **Self-hosted Supabase** (open source, EU VPS): Postgres, Auth, Storage, RLS, pgvector.
  Run with Docker Compose behind Caddy.
- **Auth**: Supabase Auth, anonymous session first, then email magic link (SMTP provider) to
  upgrade and enable cross-device sync. `users.id = auth.uid()`; RLS on every user table.
- **Sync**: self-hosted PowerSync for bidirectional SQLite <-> Postgres, with per-user sync
  rules and partial sync. Verify the self-host license/terms.
- **AI**: a small **Hono API** (Node 26) on the same VPS is the gateway for AI, export/delete,
  and admin jobs. It verifies the Supabase JWT, holds provider keys, enforces quotas, and logs
  cost server-side. No Edge Functions, no BYOK in the client.
- **Conflict policy**: append-only events merge by id; SRS cards are recomputed from
  `srs_reviews` history; derived state is recomputed or last-write-wins with a conflict log;
  profile/settings use field-level last-write-wins; content is read-only.
- **Offline**: the core loop reads from cache; AI features require network; writes sync on
  reconnect.
- **Node**: 26.x LTS (latest LTS at November 2026); `ts-fsrs` v6 requires Node >= 24.
- **Export/delete** are server-side and propagate to all devices.
- **Deployment**: one VPS (Hetzner CX32 or equivalent: 4 vCPU/8 GB), Docker Compose, Caddy
  for TLS, `pgBackRest`/`pg_dump` backups to object storage, Uptime Kuma + Sentry.
- **Migration path**: the same schema and client code can point to managed Supabase +
  PowerSync if self-hosting becomes a burden.

**Rejected alternatives.**

- _Local-only_: cannot serve two devices.
- _Supabase-only without cache_: breaks offline and adds latency.
- _Custom sync_: too much complexity for a solo developer.
- _Firebase_: no SQL/pgvector, lock-in.
- _Managed-first (Supabase Cloud + PowerSync Cloud)_: less control and recurring SaaS cost;
  kept only as a fallback, not the default.
- _Custom auth_: security surface too large; Supabase Auth + RLS is safer.

**Consequences.** Auth, RLS, sync tests, VPS hardening, backups, SMTP, and upgrades become M1
work. Infrastructure cost is roughly 10-15 €/month, separate from the AI budget. The offline
loop and local cache remain, so the product still works on a train.

**Revisit trigger.** If VPS ops become a burden, migrate to managed Supabase + PowerSync with
the same schema and client code.

---

## ADR-017 — Adaptive A1-C1 with test-out and just-in-time remediation

**Context.** The learner can be anywhere from A1 to C1. A linear course wastes time on what is
already known; gaps from lower levels can surface later during speaking or exercises.

**Decision.**

- **Placement covers A1-C1** with an adaptive item pool and per-skill estimates with intervals.
- **Test-out / skip known.** A concept or skill is "known" when mastery ≥ 0.85 and `se` ≤ 0.25
  with ≥ 5 evidence points, or when a challenge item at the next band is passed. Known content
  is not taught again: it only gets maintenance reviews and production.
- **Level promotion.** When the `theta` interval is fully above the next cut-score for two
  consecutive sessions and mastery ≥ 0.85, the planner moves to the next level and marks the
  lower level as consolidated.
- **No full demotion.** Gaps at lower levels trigger a targeted remediation block (3-5 items +
  1 production task over 3 days) while the current level is kept. The UI says "ripasso mirato",
  not "sei tornato indietro".
- **"Too easy" is a challenge, not a free pass.** The learner gets a harder item; passing it
  promotes, failing it keeps the current level.
- **Goal fit.** The planner skips can-do units whose success criteria are already met and
  inserts "stretch" items from the next level near promotion.
- **Content scope.** Item bank, assessment bank, and media catalog cover A1-C1. Content is
  produced in phases, but the model and UI support the full range from the start.
- **Explainability.** Level changes and skips are recorded in `level_events`.

**Rejected alternatives.**

- _Fixed A2-B1 scope_: too narrow for the user and for "anyone".
- _Linear unlock_: redundant and demotivating.
- _Full demotion_: punitive and wasteful.
- _Let the learner self-declare the level_: unreliable; used only as a weak prior.

**Consequences.** The content bank grows (roughly 1,600-2,100 practice items across A1-C1, plus
assessment items). C1 content needs careful review. Skip/test-out/remediation paths need tests.

**Revisit trigger.** If C1 content quality is not ready, delay the C1 content wave, but keep the
engine, assessment, and UI A1-C1. Do not narrow the product scope.

---

## ADR-018 — Adaptive content composition, not a fixed course

**Context.** The learner must not receive a pre-set course. Content must adapt to progress,
gaps, interests, and context, while staying affordable, offline-capable, and high quality.

**Decision.**

- **Two content layers.** A curated/pre-generated foundation bank (offline, quality, cost) and
  an adaptive layer that selects, personalizes, or generates content on demand.
- **Composition is deterministic.** Every session is composed from due reviews, mastery
  constraints, can-do goals, recent errors, interests, available time, and cached personal
  items. Selection runs in `packages/core/src/content`.
- **Generation is the exception, not the default.** A `content.generate` request is made only
  when: no suitable foundation item exists, a recurring error needs remediation, a new can-do
  needs practice, the learner asks for "more like this", or a media/conversation scenario needs
  a tailored prompt.
- **Content spec.** Every request has a typed `ContentRequest` (purpose, level, concepts,
  context tags, interests, count, constraints). It is validated before generation.
- **Validation and provenance.** Generated items pass schema, rule-bank, uniqueness, level,
  safety, and copyright gates; they are stored with `prompt_id`/`prompt_version`,
  `generation_reason`, and `owner_user_id` (private by default).
- **Caching and dedupe.** Cache by spec hash; reuse before generating; private items expire
  after 30-90 days; good items can be promoted to the global bank after human review.
- **Offline.** Use foundation + cached personal items; queue generation requests and fulfill on
  reconnect. Never block a session on generation.
- **Cost and latency caps.** On-demand generation has per-session and per-day quotas; a
  deterministic fallback item is used when the cap or latency budget is hit.
- **Adaptive ratio.** Target 70-80% foundation/cached content and 20-30% generated/personalized
  content in a normal session; 0% generated when offline.
- **Review.** 100% automated validation, 10% human sample, promotion to global only after
  review.

**Rejected alternatives.**

- _Fully pre-set course_: does not adapt; rejected by the owner.
- _Generate every item live_: too expensive, slow, and inconsistent.
- _No human review_: quality and safety risk.
- _Personalization via free-text PII_: privacy risk; use typed interests/context only.

**Consequences.** New schema (`content_requests`, private item fields), a new prompt
(`content.generate`), a content planner, cost caps, and adaptive-content tests. The session
remains usable offline and within budget.

**Revisit trigger.** If generation becomes cheap and fast enough, raise the adaptive ratio; if
quality drops, lower it.

---

## ADR-019 — Token-efficient agents and autonomous verification

**Context.** Coding agents burn tokens on long outputs, redundant reads, and full logs. The
owner wants faster, cheaper development and a repeatable way for agents to test themselves.

**Decision.**

- Adopt Caveman's useful principles: answer-first brevity, payload verbatim (code/commands/
  paths/errors), compact log/test output, reusable scripts, cache-friendly prompts, context pack.
- Reject the gimmick and third-party paths: no `/megacave`, no broken grammar, no proxy,
  no telemetry, no auto model routing for development.
- Add project skills under `.opencode/skills/`: `token-efficient-dev`, `autonomous-verify`,
  `supabase-sync`, `adaptive-content`, `prompt-eval`, `media-recs`.
- Add `tools/verify/verify.mjs` with `fast|core|full|nightly` levels, compact pass/fail/skip
  output, failure excerpts, no network by default, and no fake passes.
- Add `docs/16-agent-context.md` as the short context map; full docs are opened only on demand.
- Cap tool output (`opencode.json` `tool_output`) and enable compaction.

**Rejected alternatives.**

- _Copy Caveman wholesale_: gimmick, telemetry, proxy, and routing are not needed.
- _No harness_: agents guess and paste full logs.
- _Compress specs/source_: precision loss; only logs/context are compressed.

**Consequences.** Less context and output per task; a single verification command; missing
scripts are reported as SKIP, not faked. The repo stays self-hosted and telemetry-free.

**Revisit trigger.** If the verify harness becomes slow or noisy, split levels further; if a
skill is unused, remove it.

---

## ADR-020 — DeepSeek-first affordable text routing

**Context.** The product is cost-sensitive: a solo-funded app with per-user AI budgets under
€20/month. The owner wants the cheapest credible text models, not premium defaults.

**Decision.**

- Primary text provider is DeepSeek via its OpenAI-compatible API, behind `packages/ai`.
- `fast` and `balanced` tiers use `deepseek-chat`; `reason` uses `deepseek-reasoner`.
- JSON mode is enabled for `deepseek-chat`; the reasoner keeps prose and is schema-repaired.
- Gemini and OpenAI remain optional fallbacks, not defaults. No provider key reaches the
  client; all calls stay JWT-gated in Hono.
- Pricing in `packages/ai/src/cost.ts` is conservative and used only for budget guards.
- The model table is configurable in `settings.model_prefs_json`; tiers stay abstract.

**Rejected alternatives.**

- _Gemini/OpenAI default_: quality is sufficient, but cost is 2-10x higher at our volume.
- _Local small model_: quality/JSON reliability and VPS memory do not fit M1.
- _Model-per-feature hardcoding_: breaks the gateway abstraction and cost controls.

**Consequences.** Lower per-turn cost and a single provider to start; quality must be watched
by eval, especially for corrections and planning. A provider outage falls back to the
deterministic path or an optional fallback model.

**Revisit trigger.** If eval quality drops below thresholds, promote a stronger model for
`reason` only; if DeepSeek pricing or availability changes, switch tiers in one table.

---

## ADR-021 — Self-hosted Docker baseline, managed fallback

**Context.** The product needs Postgres, Auth, Storage, sync, API, TLS, and observability
without SaaS lock-in or recurring platform fees during development.

**Decision.**

- Local development uses the Supabase CLI Docker stack (`pnpm supabase:start`) for Postgres,
  Auth, Storage, Studio, and Mailpit.
- `infra/docker-compose.yml` runs the Hono API (Node 26 image), Caddy (TLS/COOP/COEP and
  static web), PowerSync Open Edition, its Postgres bucket store, and Uptime Kuma.
- PowerSync uses Supabase JWKS for client auth and a dedicated `powersync` publication.
- Configuration is environment-driven (`.env.local` overrides `.env`); secrets stay out of
  git and out of the client bundle.
- The managed path (Supabase Cloud + PowerSync Cloud) remains documented as a fallback.

**Rejected alternatives.**

- _Managed-only_: fast to start, but recurring cost and less control over EU data.
- _VPS-only from day one_: slows the learning loop and adds ops risk before product fit.
- _Custom sync service_: duplicates PowerSync's offline queue, buckets, and partial sync.

**Consequences.** A reproducible local stack and a deployable compose file; more Docker
memory use and a PowerSync image to operate. The API image currently runs `tsx`; a compiled
production image is a later optimization.

**Revisit trigger.** If the VPS cannot fit the stack on 8 GB, split PowerSync storage or move
to managed sync; if the API image size/latency matters, add a tsc build stage.

---

## ADR-022 — Tamagui as the universal UI layer

**Context.** The app needs one UI layer for Android, iOS, and web without maintaining three
implementations. The custom primitives work, but every new screen would rebuild layout,
input, press, and theme behavior by hand.

**Decision.**

- Adopt Tamagui 3 (`tamagui`, `@tamagui/config/v6`, `@tamagui/core`, `@tamagui/web`) as the
  component and styling layer for Expo and React Native Web.
- Run the Tamagui Metro/compiler plugin; keep `TamaguiProvider` at the root.
- The shared `Button`, `Card`, `Chip`, `Field`, and `Screen` wrappers now render Tamagui
  components, so screens get the same behavior and accessibility on web and native.
- Keep the existing design tokens and Italian/English catalogs: components receive strings
  from `packages/ui` and never contain literal copy.
- Use `style` for the few layout cases where the v3 "flat" style API needs explicit RN
  layout values; new components should prefer Tamagui props and theme tokens.

**Rejected alternatives.**

- _Gluestack + NativeWind_: solid, but adds a Tailwind pipeline on top of Metro and another
  style runtime.
- _React Native Paper_: quickest setup, but Material look and less control over the design
  system.
- _Keep custom primitives only_: more code per screen and duplicated web/native behavior.

**Consequences.** Faster screen work and consistent behavior across web/native; a larger
initial JS bundle and one more compiler step. Tamagui stays behind our wrappers so a future
swap is contained.

**Revisit trigger.** If the Tamagui bundle or compiler blocks web performance targets, move
styling to a lighter layer while keeping the shared component API.

---

## ADR-023 — Online-first: remove PowerSync and the offline write queue

**Context.** The product does not need offline operation. The offline-first design added a
PowerSync service, a second Postgres for bucket storage, replication publications, a SQLite
mirror, a write queue, sync rules/conflict policy, and client schema generation. That is a
large operational and cognitive cost for a capability the product will not use.

**Decision.**

- Postgres (Supabase) is the only source of truth. The client reads and writes through
  Supabase (RLS) for profile/consent/device data and through Hono for AI, export, and delete.
- Remove PowerSync, the SQLite mirror, the offline write queue, and `sync_state` /
  `sync_conflict_log`. Writes require connectivity; there is no offline mode.
- Multi-device still works: devices see the same server state after a refresh/refetch.
  `devices` and revoke remain for session/device management.
- Export and delete remain server-side and always work while online.
- Supabase local Docker, the Hono API, Caddy, and the optional monitoring profile remain.

**Rejected alternatives.**

- _Keep PowerSync for future offline_: paying the complexity now for an unconfirmed need.
- _Custom outbox + Supabase Realtime_: more code than PowerSync and still conflict-prone.
- _Managed PowerSync_: removes some ops, but keeps the extra service and sync model.

**Consequences.** Fewer services, packages, tables, and tests; no WASM/SQLite/COOP/COEP
requirements. The app needs network for reads/writes. If offline becomes a requirement, add
a new ADR and reintroduce sync deliberately.

**Revisit trigger.** A product requirement for offline study on planes/commutes, or a
measured cohort that cannot use the online loop.

---

## ADR-024 � Hono is the only data API; Supabase stays Auth + Postgres + Studio

**Context.** After removing PowerSync, the client still used two data paths: Supabase PostgREST
(`supabase.from(...)`) for profile/consents/devices and Hono for AI/export/delete. Two contracts,
two validation layers, and two places to change authorization.

**Decision.**

- Hono is the only API the client uses for user data: `/v1/profile`, `/v1/consents`,
  `/v1/devices`, `/v1/account/export`, `/v1/account`, `/v1/ai/call`.
- The client uses Supabase **only for Auth**: anonymous sign-in, email upgrade, session/JWT.
- Supabase remains the Postgres host, RLS enforcer, and Studio. PostgREST stays available for
  admin/debug, but application code does not call it.
- Hono validates every body with Zod, derives `user_id` from the verified JWT (never trusts the
  client), and executes DB writes with `SET LOCAL ROLE authenticated` + JWT claims so RLS stays
  in force as defense in depth.
- No Edge Functions: they would duplicate Hono's routing, validation, JWT and AI logic.

**Rejected alternatives.**

- _Keep direct PostgREST for CRUD_: faster to write, but two contracts and inconsistent validation.
- _Move everything to Supabase Edge Functions_: a second runtime, Deno-only tooling, duplicate AI code.
- _Remove Supabase and write auth in Hono_: more security-critical code (sessions, magic links,
  token rotation, device revoke) for little gain at this stage.

**Consequences.** One API contract and one place for validation/authorization; the client is
easier to reason about and can move to another auth provider later. Hono becomes the data
bottleneck, acceptable for the current scale. RLS still protects against direct access bugs.

**Revisit trigger.** If Hono latency or operation becomes a bottleneck, or if we add PowerSync/
offline later (new ADR), revisit the data path.

---

## Technical choices summary

| Layer                 | Technology                                                                       | Reason                                           |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------ |
| UI                    | Expo + RNW + Tamagui + own tokens                                                | one codebase, push, audio, real web              |
| Client state          | React context + Supabase repositories                                            | server-backed, no local write queue              |
| DB                    | Postgres (Supabase) source of truth                                              | online-first; no SQLite mirror                   |
| Backend               | Self-hosted Supabase (Auth/Postgres/Storage/RLS) + Hono API                      | direct control, no SaaS                          |
| Domain                | Pure TypeScript + Vitest                                                         | deterministic, no network                        |
| AI                    | Own gateway + Zod in Hono API, JWT-gated; DeepSeek primary                       | cheapest credible text tier, provider-agnostic   |
| STT                   | AssemblyAI -> Web Speech                                                         | credits + low cost + free fallback               |
| TTS                   | SpeechSynthesis (browser)                                                        | free by default, no extra provider               |
| Infra                 | Docker Compose: Supabase CLI, Hono, Caddy; optional Uptime Kuma                  | self-hosted, managed fallback                    |
| SRS                   | ts-fsrs v6 (FSRS-7)                                                              | standard, maintained; Node 26 LTS                |
| Sync                  | None; online-first                                                               | PowerSync/offline queue removed by ADR-023       |
| Adaptive scope        | CEFR A1-C1 with test-out and remediation                                         | no redundant content                             |
| Content               | Foundation bank + deterministic selection + on-demand generation/personalization | adaptive, affordable                             |
| Languages             | `ui_locale` + `target_lang`/`native_lang` as data; en/it in phase 1              | new locale is a translation task, not a refactor |
| Media recommendations | Metadata-only catalog + deterministic ranking + LLM reason/guide                 | legal, testable, cheap                           |
| Safety                | Untrusted input, schema-bound output, moderation, no tools                       | resists prompt injection                         |
| Privacy               | Consent gates, retention, server + local encryption, PII-free logs               | EU-ready baseline                                |
| Agent workflow        | Caveman principles + verify harness + project skills                             | fewer tokens, autonomous tests                   |

## Research sources

- Duolingo: streak, energy, path, friend streak, leaderboard, notifications.
  `blog.duolingo.com`, `research.duolingo.com`, Q1 FY2024 shareholder letter.
- Duolingo growth: Lenny's Newsletter, "How Duolingo reignited user growth".
- Pedagogy: CEFR Companion Volume 2020; Settles & Meeder 2016 (Half-Life Regression).
- FSRS: `github.com/open-spaced-repetition/ts-fsrs`, Anki docs.
- Stack: Expo docs (SDK 58), Tauri v2, PowerSync, Supabase, Drizzle.
- AI pricing: OpenAI, Google, DeepSeek, Groq, AssemblyAI price lists (November 2026).
- LLM-as-judge: arXiv 2306.05685; Whisper: arXiv 2212.04356.
