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
- *PWA-only*: on iOS, push works only from the Home Screen, background audio is unreliable,
  and storage is subject to eviction. Does not meet requirements.
- *Tauri v2 mobile as the base*: excellent desktop, but remote push, background audio, and
  plugins require native work on mobile; ecosystem too young for the core.
- *Capacitor*: valid for web-only teams, but WebView UX and plugin quality vary.
- *Flutter*: strong on mobile, weak on web (bundle size, SEO, text selection); mobile is
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
- *RxDB/WatermelonDB*: custom sync and a document model less suited to analytical queries.
- *IndexedDB only*: not shared with native, poor queries, fragile migrations.
- *Server-only DB*: violates offline-first and adds cost/latency.

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
- *Key in the web client*: exposed to anyone with devtools.
- *Dedicated backend (VPS/Fly.io)*: unjustified cost and maintenance in phase 1.
- *Local key on every device*: no cost control, no shared cache.

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
- *Firebase*: lock-in, unpredictable costs, no SQL/pgvector.
- *PocketBase*: great for a single-node MVP, pre-1.0, does not scale horizontally.
- *ElectricSQL*: read-path only, requires separate write APIs.
- *Custom backend*: too much maintenance for one developer.

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

**Decision.** No hearts or energy. The streak is about *production* (having spoken/written),
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
- *LLM-only ranking*: expensive, inconsistent, hard to test.
- *Scraped catalog with transcripts*: legal risk and storage cost.
- *Streaming-service integration*: scope and licensing complexity; deferred.
- *User-maintained list only*: poor cold start and no difficulty model.

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
- *No local encryption*: simpler, but unacceptable for transcripts on a lost device.
- *Local-only data*: cannot serve two devices (ADR-016).
- *No analytics*: less insight; privacy-safe events are enough.

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
- *Trust the model*: fails on adversarial input and hallucinated rules.
- *Full tool access*: unnecessary risk for phase 1.
- *No moderation*: unacceptable for a consumer app.

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
- *Local-only*: cannot serve two devices.
- *Supabase-only without cache*: breaks offline and adds latency.
- *Custom sync*: too much complexity for a solo developer.
- *Firebase*: no SQL/pgvector, lock-in.
- *Managed-first (Supabase Cloud + PowerSync Cloud)*: less control and recurring SaaS cost;
  kept only as a fallback, not the default.
- *Custom auth*: security surface too large; Supabase Auth + RLS is safer.

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
- *Fixed A2-B1 scope*: too narrow for the user and for "anyone".
- *Linear unlock*: redundant and demotivating.
- *Full demotion*: punitive and wasteful.
- *Let the learner self-declare the level*: unreliable; used only as a weak prior.

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
- *Fully pre-set course*: does not adapt; rejected by the owner.
- *Generate every item live*: too expensive, slow, and inconsistent.
- *No human review*: quality and safety risk.
- *Personalization via free-text PII*: privacy risk; use typed interests/context only.

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
- *Copy Caveman wholesale*: gimmick, telemetry, proxy, and routing are not needed.
- *No harness*: agents guess and paste full logs.
- *Compress specs/source*: precision loss; only logs/context are compressed.

**Consequences.** Less context and output per task; a single verification command; missing
scripts are reported as SKIP, not faked. The repo stays self-hosted and telemetry-free.

**Revisit trigger.** If the verify harness becomes slow or noisy, split levels further; if a
skill is unused, remove it.

---

## Technical choices summary

| Layer | Technology | Reason |
|---|---|---|
| UI | Expo + RNW + own design system | one codebase, push, audio, real web |
| Client state | Zustand + repository queries | simple, testable, no over-engineering |
| DB | Postgres (Supabase) source of truth + local SQLite cache | multi-device + offline |
| Backend | Self-hosted Supabase (Auth/Postgres/Storage/RLS) + PowerSync + Hono API | direct control, no SaaS |
| Domain | Pure TypeScript + Vitest | deterministic, no network |
| AI | Own gateway + Zod in Hono API, JWT-gated | provider-agnostic, cost and fallback |
| STT | AssemblyAI -> Web Speech | credits + low cost + free fallback |
| TTS | SpeechSynthesis -> OpenAI tts-1 (cache) | free by default, quality on demand |
| SRS | ts-fsrs v6 (FSRS-7) | standard, maintained; Node 26 LTS |
| Sync | PowerSync from phase 1 | two devices, offline queue, partial sync |
| Adaptive scope | CEFR A1-C1 with test-out and remediation | no redundant content |
| Content | Foundation bank + deterministic selection + on-demand generation/personalization | adaptive, affordable, offline |
| Languages | `ui_locale` + `target_lang`/`native_lang` as data; en/it in phase 1 | new locale is a translation task, not a refactor |
| Media recommendations | Metadata-only catalog + deterministic ranking + LLM reason/guide | legal, testable, cheap |
| Safety | Untrusted input, schema-bound output, moderation, no tools | resists prompt injection |
| Privacy | Consent gates, retention, server + local encryption, PII-free logs | EU-ready baseline |
| Agent workflow | Caveman principles + verify harness + project skills | fewer tokens, autonomous tests |

## Research sources

- Duolingo: streak, energy, path, friend streak, leaderboard, notifications.
  `blog.duolingo.com`, `research.duolingo.com`, Q1 FY2024 shareholder letter.
- Duolingo growth: Lenny's Newsletter, "How Duolingo reignited user growth".
- Pedagogy: CEFR Companion Volume 2020; Settles & Meeder 2016 (Half-Life Regression).
- FSRS: `github.com/open-spaced-repetition/ts-fsrs`, Anki docs.
- Stack: Expo docs (SDK 58), Tauri v2, PowerSync, Supabase, Drizzle.
- AI pricing: OpenAI, Google, DeepSeek, Groq, AssemblyAI price lists (November 2026).
- LLM-as-judge: arXiv 2306.05685; Whisper: arXiv 2212.04356.
