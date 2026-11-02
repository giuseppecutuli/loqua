# Technical architecture

## 1. Context

```
+-------------------------------------------------------------+
|                        Client (Expo)                        |
|  Android / iOS / Web (RNW)                                  |
|  +---------------------+  +-------------------------------+  |
|  | UI (expo-router)    |  | Local cache (SQLite/WASM)     |  |
|  +----------+----------+  +---------------+---------------+  |
|             |                             ^                  |
|  +----------v-------------------------------------------+   |
|  | packages/core: assessment, learner model, FSRS,    |   |
|  | curriculum, gamification, recommendation (pure TS) |   |
|  +----------+-------------------------------------------+   |
|             |                                               |
|  +----------v-------------------------------------------+   |
|  | packages/db/sqlite: offline mirror + PowerSync      |   |
|  +----------+-------------------------------------------+   |
|             |                                               |
|  +----------v-------------------------------------------+   |
|  | packages/ai: gateway, prompt registry, Zod, cost   |   |
|  +----------+-------------------------------------------+   |
+-------------|-----------------------------------------------+
              | sync + AI (HTTPS/WSS)
   +----------v-----------------------------------------------+
   | Supabase (EU): Auth | Postgres + RLS | Storage |        |
   | Hono API (Node 26): AI gateway, export/delete, admin     |
   +----------+-----------------------------------------------+
              | PowerSync
   +----------v-----------------------------------------------+
   | PowerSync service: SQLite <-> Postgres, per-user rules   |
   +----------+-----------------------------------------------+
              |
   +----------v-----------------------------------------------+
   | LLM / STT / TTS providers                                |
   | Gemini, OpenAI, Groq, AssemblyAI, ...                    |
   +----------------------------------------------------------+
```

Phase 1: **Postgres is the source of truth**. Local SQLite is a cache and a write queue.
PowerSync keeps Android and Web aligned. AI calls go through a JWT-gated Hono API (Node 26);
provider keys never reach the client. The core loop still works offline from the cache, and
writes sync on reconnect.

## 2. Monorepo and responsibilities

```
apps/app
  app/                    expo-router file-based routes
  src/features/<feature>  feature UI + hooks
  src/components          app-specific components
  src/lib                 platform adapters (audio, notifications, secure store)
apps/desktop              Tauri v2 wrapper (M7), no domain logic

packages/core             pure, deterministic domain, tested with Vitest
  src/assessment/         item selection, Elo, stop rule, CEFR estimation
  src/learner/            per-skill and per-concept state updates
  src/curriculum/         session selection, planner, plan validation
  src/content/            content planner, typed request, selection vs generation
  src/srs/                ts-fsrs wrapper, rating policies, card dedupe
  src/gamification/       streak, XP, quests, badges
  src/errors/             taxonomy, dedupe, drill trigger
  src/recommendation/     media ranking, taste updates
  src/shared/             types, results, pure utilities

packages/db/postgres      canonical Drizzle schema, migrations, repositories
packages/db/sqlite       local mirror, PowerSync client schema, offline repositories
packages/ai               provider gateway, prompts, Zod schemas, cache, cost log
packages/ui               design system (tokens, components, i18n catalogs)
packages/content          item bank, media catalog, CEFR descriptors, rule-bank, scenarios
supabase/migrations       Postgres migrations + RLS policies
services/api              Hono API: AI gateway, export/delete, admin jobs (JWT-gated)
tools/seed                item bank and content pack generation/import
tools/eval                golden set, eval runner, metrics, reports
docs                      specs and harness
```

### Dependency rules

```
apps/app -> packages/ui
apps/app -> packages/core
apps/app -> packages/db/sqlite
apps/app -> packages/ai (contracts and schemas only)
packages/db/postgres -> packages/core (types and pure functions only)
packages/db/sqlite -> packages/core (types and pure functions only)
packages/ai -> packages/core (types only)
services/api -> packages/ai + packages/core (server-side)
packages/core -> (no runtime dependencies)
```

Forbidden: `core` importing React/Expo/Drizzle/fetch; `db` containing pedagogical rules;
`ai` importing UI; SQL inside components; provider keys or direct provider calls in the client.

## 3. Core contracts

### 3.1 AI gateway

```ts
export type ModelTier = 'fast' | 'balanced' | 'reason' | 'stt' | 'tts';

export interface AiRequest<TInput, TOutput> {
  promptId: string;          // e.g. 'exercise.generate'
  promptVersion: number;     // must exist in the registry
  tier: ModelTier;
  input: TInput;
  schema: ZodType<TOutput>;
  cacheKey?: string;         // default: hash(promptId, version, input)
  maxRepairs?: number;       // default 2
  signal?: AbortSignal;
}

export interface AiResult<TOutput> {
  data: TOutput;
  meta: {
    provider: string;
    model: string;
    promptId: string;
    promptVersion: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencyMs: number;
    cached: boolean;
    repairs: number;
  };
}
```

Rules: every call goes through this gateway, executed in `services/api` and invoked by
the client with a Supabase JWT; no provider `fetch` or provider key in app code; invalid output
never reaches the DB; `meta` is stored in `prompt_calls` server-side.

### 3.2 Repositories

```ts
export interface SessionRepository {
  getOrCreateTodaySession(userId: string, now: Date): Promise<Session>;
  recordAttempt(input: RecordAttemptInput): Promise<AttemptResult>;
  completeSession(sessionId: string, now: Date): Promise<void>;
}
```

Two implementations: `packages/db/postgres` (server, source of truth) and
`packages/db/sqlite` (local cache and write queue). Append-only events (`attempts`,
`srs_reviews`, `error_events`, `xp_events`, `session_items`) are the sync unit. Derived state
(`user_skill_state`, `srs_cards`, `activity_days`, `streak_state`) is recomputed server-side;
local values are optimistic and replaced after sync.

### 3.3 Domain events

The core emits pure events that the DB layer applies:

```ts
type DomainEvent =
  | { type: 'attempt.recorded'; payload: AttemptRecorded }
  | { type: 'srs.reviewed'; payload: SrsReviewed }
  | { type: 'error.detected'; payload: ErrorDetected }
  | { type: 'session.completed'; payload: SessionCompleted }
  | { type: 'streak.extended'; payload: StreakExtended };
```

This makes logic testable without a DB and, later, feeds sync.

## 4. Flows

### 4.1 Generating today's plan

```
now, userId
  -> read profile + skill state + due cards + recent errors
  -> core.curriculum.selectDailySession(input)
       - quota: 40% review, 30% new, 30% production
       - respect knowledge-graph prerequisites
       - respect available time and level
  -> output: SessionPlan { blocks[], rationale }
  -> UI shows 1 CTA + rationale
```

No AI call: selection is deterministic. AI only intervenes if the plan needs repair
(new recurring error or level change).

### 4.2 Answering an exercise

```
user response
  -> core.gradeAttempt(item, response)  // deterministic, explicit tolerances
  -> core.learner.update(state, item, correct)
  -> core.srs.schedule(card, rating)
  -> core.errors.extract(...) for free production
  -> repository.recordAttempt(...) in a transaction
  -> UI feedback + explanation (already stored with the item)
```

### 4.3 Conversation turn

```
user text or audio
  -> [if audio] STT -> transcript
  -> core.conversation.buildTurnContext(...)  // scenario, level, recent errors
  -> ai.call('conversation.turn') -> response (streaming) + optional recast
  -> ai.call('correction.evaluate') -> error JSON (post-hoc, does not block the response)
  -> UI: response, then corrections panel
  -> confirmed errors -> error_events + cards
```

Correction must not block the response: it appears afterwards, with a non-judgmental tone.

### 4.4 End of session

```
-> core.gamification.computeRewards(...)
-> summary: what was done, errors, 2 focus points, next action
-> update streak/XP/quests in a transaction
-> schedule the next review notification (local, not server-side)
```

### 4.5 Adaptive content composition

```
snapshot + session plan
  -> core.content.plan(snapshot, plan)
       - filter by level, mastery, due reviews, can-do, prerequisites
       - prefer foundation bank + cached personal items
       - personalization signals: typed interests, work/daily context, recent errors
  -> if a slot has no fit:
       ContentRequest { purpose, level, concepts, contextTags, count, constraints }
       -> Hono API /ai (content.generate)
       -> Zod + rule-bank + dedupe + level/safety gates
       -> save private item (owner_user_id, TTL) + cache by spec hash
  -> session_items point to foundation, cached, or newly generated items
```

Rules:

- Selection is deterministic; generation is the exception.
- Generation is triggered only for: missing fit, recurring-error remediation, new can-do,
  "more like this", media guide, conversation scenario.
- Offline: use foundation/cached items; queue requests; never block a session.
- Caps: per-session and per-day generation budget; deterministic fallback on cap/timeout.
- Private items expire; reviewed items can be promoted to the global bank.

## 5. Offline-first

| Feature | Offline |
|---|---|
| First run / anonymous auth | no (network required once) |
| Onboarding after first sync | yes |
| SRS review | yes |
| Item-bank exercises | yes |
| Cached personal items | yes |
| On-demand generation | no (queued, fulfilled on reconnect) |
| Daily plan | yes (deterministic, from cache) |
| AI conversation | no (needs network) |
| Free-production correction | no |
| Speaking evaluation | no |
| Placement assessment | no (needs AI); can be deferred |
| Media recommendations | cached list and guides; availability may be stale |
| Export/backup | yes (local snapshot) + server export |
| Sync | queues locally, resumes on reconnect |

Strategy: the first run needs network for anonymous auth. After the first sync, the item bank,
SRS cards, plans, and media guides are cached; AI calls fail explicitly with "network required"
and the app offers the offline loop. Writes queue locally and upload on reconnect.

**Web**: `expo-sqlite` uses wa-sqlite/WASM on OPFS. It requires:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers the web DB does not work: configure them on Cloudflare Pages/Netlify/Vercel.
Show a clear error if `crossOriginIsolated === false`.

## 5.1 Language and locale

- The user account stores `ui_locale`; the learner profile stores `target_lang`,
  `native_lang`, `explanation_mode`, `proficiency_framework`, `goal`, `timezone`, and
  onboarding state.
- Content tables are scoped by `target_lang` (and `native_lang` for L1 transfer rules).
  Queries always filter by the active pair.
- AI prompts receive `targetLang`, `nativeLang`, `explanationMode`, and
  `proficiencyFramework`; system prompts never name a language.
- UI copy comes from locale catalogs keyed by `ui_locale`; no literal copy in components.
- STT/TTS adapters map `target_lang` to a language code and a voice/locale.
- `cefr_level` is a normalized internal band A1-C1; the user-facing label follows
  `proficiency_framework` (CEFR in phase 1).
- Phase 1 ships `en` target, `it` native, `it` UI. A second language is a content/translation
  task, not a code rewrite.

## 5.2 Media recommendations

- Catalog metadata lives in Postgres and is cached in local SQLite (`media_titles`,
  `media_availability`, tags); no transcripts or copyrighted text.
- Ranking is deterministic in `packages/core/src/recommendation`; the LLM only writes the
  spoiler-free reason and the guide through the gateway.
- Feedback updates `user_taste_profile` and the difficulty target; rejected titles are
  excluded for 90 days.
- Watching/reading earns input XP; a 60-second spoken or 80-word written reflection counts as
  production and feeds correction + SRS.
- Availability is region-aware and legal-provider-only; the model never invents providers.

## 5.3 Multi-device model

- Android and Web are peers. Postgres is the source of truth; local SQLite is a cache and a
  write queue.
- Sync starts in M1. Offline writes queue locally and upload on reconnect.
- `devices` registers each device; revoking a device invalidates its session and stops sync.
- The UI shows last sync time, pending changes, and rare conflicts.
- Content, item bank, and media catalog are read-only; user data is per user and protected by RLS.

## 6. Sync (phase 1)

- **Transport**: self-hosted PowerSync between local SQLite and self-hosted Supabase Postgres.
- **Model**: local SQLite is the offline working cache; Postgres is the shared source of truth.
- **Writes**: local SQLite changes upload through PowerSync; no custom outbox.
- **Append-only merge**: `attempts`, `srs_reviews`, `error_events`, `xp_events` merge by id.
- **SRS**: cards are recomputed from `srs_reviews` history on the server; local values are
  optimistic.
- **Derived state**: `user_skill_state`, `activity_days`, `streak_state` recomputed from events.
- **Plans/settings**: field-level last-write-wins for profile/settings; plans last-write-wins by
  version; every conflict is logged in `sync_conflict_log`.
- **Media progress**: keep the highest progress and the latest status.
- **Auth/RLS**: Supabase JWT; `user_id = auth.uid()` on every table.
- **Content vs private items**: global content is read-only; generated items with
  `owner_user_id` sync only to the owner's devices and expire.
- **Migrations**: server migrations in Postgres; the SQLite mirror schema is generated for
  PowerSync and tested against the server schema.

## 7. Security and privacy

- Keys: Hono service secrets; never in the client, `EXPO_PUBLIC_*`, or logs.
- Every AI call is JWT-gated and checked against RLS/quotas; the gateway validates the model
  allowlist and does not log prompts or user text (only hash, tokens, cost, latency, status).
- Audio: temporary upload to Supabase Storage, transcription, deletion within 24-48h; no audio
  in backups.
- User data: server-side export, delete with soft-delete + scheduled hard-delete, propagated to
  all devices.
- EU region for Supabase and STT/TTS where available.
- App and server logs without PII; Sentry with `sendDefaultPii: false`.
- Rate limits per user and device; cost circuit breaker; RLS on every user table.
- `users.id = auth.uid()`; service-role key only in server-side functions.

### 7.1 AI safety

- Learner text and audio are untrusted data; instruction hierarchy and delimiters.
- No tools, browsing, file access, or secrets in prompts.
- Schema-bound output for corrections, plans, exercises, and media guides.
- Moderation before display; deterministic fallback on a hit.
- Prompt-injection red-team suite in CI (`docs/13-safety-privacy.md`).

### 7.2 Encryption and retention

- Postgres encrypted at rest by Supabase; EU region.
- Native SQLite cache encrypted at rest (SQLCipher or equivalent); key in secure storage.
- Web OPFS is not app-encrypted; rely on device/browser security and document the risk.
- Audio 24-48h, transcripts 90 days, prompt metadata 90 days, server backups 30 days.
- Encrypted local backups; export carries `format_version` and checksum.
- Consent gates before AI/voice; deletion cascade tested end to end on server and devices.

## 8. Observability and costs

Minimum event per AI call (`prompt_calls`):
`prompt_id`, `prompt_version`, `model`, `tokens_in/out`, `cost_usd`, `latency_ms`, `status`,
`repairs`, `cached`.

Dashboard (even as SQL queries):
- cost/day and cost/session;
- p95 latency per prompt;
- invalid output rate;
- cache hit rate;
- error distribution by `rule_id`.

Guardrails:
- configurable daily and monthly budget;
- when exceeded: offline loop only + conversation disabled with an explanation;
- alerts at 70% and 90%.

### 8.1 Events and SLOs

- Product events are pseudonymous and PII-free (`docs/14-observability-ops.md`).
- SLOs: crash-free sessions ≥ 99.5%, first token p95 ≤ 2.5 s, schema-valid AI ≥ 99%,
  daily cost p95 ≤ $0.50, export success ≥ 99.9%, sync lag p95 ≤ 60 s.
- Dashboards: learning funnel, AI quality, cost per feature, content health, media funnel,
  sync lag and conflict rate.
- Alerts on cost, provider errors, eval regression, migration failure, retention job failure,
  sync failure.

## 9. Configuration

```bash
# Client (public)
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_API_URL=https://api...
EXPO_PUBLIC_POWERSYNC_URL=https://sync...

# Server / Hono secrets (never in the client)
SUPABASE_URL=https://...
SUPABASE_JWKS_URL=https://.../auth/v1/.well-known/jwks.json
SUPABASE_SECRET_KEY=...
SUPABASE_JWT_SECRET=...            # legacy/local HS256 only
DATABASE_URL=postgres://...
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
GEMINI_API_KEY=...                 # optional fallback
OPENAI_API_KEY=...                 # optional fallback
ASSEMBLYAI_API_KEY=...
AI_DAILY_BUDGET_USD=0.50
CORS_ORIGIN=http://localhost:8081
```

`.env.local` overrides `.env` for the local Docker stack. DeepSeek is the default text
provider; no AI key is required for the offline core loop.

PowerSync has its own service config (database URL, JWT verification, sync rules) on the VPS.
The client only receives public Supabase/PowerSync URLs and the anon key. Hono keeps provider
keys, the database URL, and the service-role key server-side.

## 10. Performance budget

| Metric | Target |
|---|---|
| Android mid-range cold start | ≤ 2.5 s |
| Session open from local DB | ≤ 150 ms |
| Daily plan selection | ≤ 50 ms |
| Conversation first token p95 | ≤ 2.5 s |
| Initial web bundle (gzip) | ≤ 900 KB |
| Android app size | ≤ 80 MB |
| Local DB (items + attempts + cards) | ≤ 300 MB |
| Local audio cache | ≤ 50 MB, LRU eviction |
| Pending uploads after reconnect p95 | ≤ 5 s |
| Pull-to-fresh p95 | ≤ 3 s |

## 11. Deployment

- **Backend**: self-hosted Supabase on a VPS (Docker Compose): Postgres, Auth, Storage, RLS;
  migrations applied with the Supabase CLI. EU region. Local development uses the same
  Docker stack via `pnpm supabase:start`.
- **API**: Hono (Node 26) in `services/api`, behind Caddy, JWT/JWKS verification, AI gateway,
  export/delete, admin jobs. `services/api/Dockerfile` builds the container image.
- **Sync**: self-hosted PowerSync Open Edition via `infra/docker-compose.yml`, with its own
  Postgres bucket store and the `powersync` publication; sync rules per user.
- **Infra**: `infra/docker-compose.yml` runs API, Caddy (TLS/COOP/COEP + static web),
  PowerSync, PowerSync storage, and Uptime Kuma. See `infra/README.md`.
- **Web**: static build `expo export -p web` on Cloudflare Pages (or Netlify) with COOP/COEP headers.
- **Android**: EAS Build (APK/AAB) + EAS Submit.
- **iOS**: EAS Build + TestFlight (requires an Apple account).
- **Desktop**: `apps/desktop` Tauri v2 loading the web build; MSI/NSIS installer.
- **Managed fallback**: the same schema/client can point to Supabase Cloud + PowerSync Cloud
  if VPS operations become a burden.
