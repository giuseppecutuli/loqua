# Technical architecture

## 1. Context

```
+-------------------------------------------------------------+
|                        Client (Expo)                        |
|  Web (RNW) / Android                                       |
|  UI (expo-router) + Tamagui + packages/core (pure TS)       |
|  Supabase client: Auth session only                         |
+-----------------------------+-------------------------------+
                              | HTTPS + Supabase JWT
   +--------------------------v-------------------------------+
   | Hono API (Node 26): all user data, AI gateway,           |
   | export/delete, admin, device revoke                      |
   +--------------------------+-------------------------------+
                              |
   +--------------------------v-------------------------------+
   | Supabase (EU): Auth | Postgres + RLS | Studio            |
   | LLM / STT / TTS providers (server-side keys only)        |
   +----------------------------------------------------------+
```

Phase 1 is **online-first** (ADR-023): Postgres is the source of truth and the client has no
local write queue or PowerSync layer. Hono is the only data API (ADR-024): profile, consents,
devices, export/delete and AI all go through it. The client uses Supabase only for Auth
(anonymous/magic link/session). AI provider keys never reach the client. If offline becomes a
requirement, a new ADR reintroduces a sync layer deliberately.

## 2. Monorepo and responsibilities

```
apps/app
  app/                    expo-router file-based routes
  src/features/<feature>  feature UI + hooks
  src/components          app-specific components
  src/lib                 platform adapters (audio, notifications, secure store)

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
packages/ai               provider gateway, prompts, Zod schemas, cache, cost log
packages/ui               Tamagui wrappers, design tokens, i18n catalogs
packages/content          item bank, media catalog, CEFR descriptors, rule-bank, scenarios
supabase/migrations       Postgres migrations + RLS policies
services/api              Hono API: AI gateway, export/delete, admin jobs (JWT-gated)
services/api/src/services feature services: placement, session, notifications, events; no Hono
tools/seed                item bank and content pack generation/import
tools/eval                golden set, eval runner, metrics, reports
docs                      specs and harness
```

### Dependency rules

```
apps/app -> packages/ui
apps/app -> packages/core
apps/app -> services/api (HTTP only)
apps/app -> Supabase Auth (session/JWT only)
packages/db/postgres -> packages/core (types and pure functions only)
packages/ai -> packages/core (types only)
services/api -> packages/ai + packages/core + packages/db/postgres (server-side)
packages/core -> (no runtime dependencies)
```

Forbidden: `core` importing React/Expo/Drizzle/fetch; `db` containing pedagogical rules;
`ai` importing UI; SQL inside components; provider keys or direct provider calls in the client.

## 3. Core contracts

### 3.1 AI gateway

```ts
export type ModelTier = 'fast' | 'balanced' | 'reason' | 'stt' | 'tts';

export interface AiRequest<TInput, TOutput> {
  promptId: string; // e.g. 'exercise.generate'
  promptVersion: number; // must exist in the registry
  tier: ModelTier;
  input: TInput;
  schema: ZodType<TOutput>;
  cacheKey?: string; // default: hash(promptId, version, input)
  maxRepairs?: number; // default 2
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
never reaches the DB; `meta` is stored in `prompt_calls` server-side. Feature routes own
their prompts; `/v1/ai/call` is not a general proxy: it allows only `correction.evaluate`,
forces the `fast` tier, caps input at 20 KB, and still requires AI consent. TTS is
browser-first; `POST /v1/tts` provides a provider-agnostic phrase audio cache when a
synthesizer is configured, otherwise the client uses browser speech.

### 3.2 Repositories

```ts
export interface SessionRepository {
  getOrCreateTodaySession(userId: string, now: Date): Promise<Session>;
  recordAttempt(input: RecordAttemptInput): Promise<AttemptResult>;
  completeSession(sessionId: string, now: Date): Promise<void>;
}
```

One implementation: `packages/db/postgres`. Hono calls it with the verified JWT claims so RLS
applies to every query and write. Append-only events (`attempts`, `srs_reviews`, `error_events`,
`xp_events`, `session_items`) are recorded server-side; derived state (`user_skill_state`,
`srs_cards`, `activity_days`, `streak_state`) is recomputed on the server.

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

This makes logic testable without a DB and keeps persistence at the API boundary.

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
- Use foundation/cached items; there is no separate offline queue.
- Caps: per-session and per-day generation budget; deterministic fallback on cap/timeout.
- Private items expire; reviewed items can be promoted to the global bank.

## 5. Online-first

The app requires connectivity. There is no local SQLite database, write queue, or offline
mode (ADR-023).

- First run, onboarding, session, review, conversation, correction, assessment, and media
  recommendations need the server.
- The client keeps only the Supabase session (AsyncStorage) and a stable device id.
- Network failures are explicit: a retry screen for hydration, a generic error for writes.
- Export and delete are server-side and work while online.
- Content, item bank, and media catalog are read-only and fetched from the server.

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

- Catalog metadata lives in Postgres (`media_titles`,
  `media_availability`, tags); no transcripts or copyrighted text.
- Ranking is deterministic in `packages/core/src/recommendation`; the LLM only writes the
  spoiler-free reason and the guide through the gateway.
- Feedback updates `user_taste_profile` and the difficulty target; rejected titles are
  excluded for 90 days.
- Watching/reading earns input XP; a 60-second spoken or 80-word written reflection counts as
  production and feeds correction + SRS.
- Availability is region-aware and legal-provider-only; the model never invents providers.

## 5.3 Multi-device model

- Web is the primary client; Android is the final target. Postgres is the source of truth.
- Devices share server state after a refresh/refetch; writes require connectivity.
- `devices` registers each device; revoking a device invalidates its session.
- Content, item bank, and media catalog are read-only; user data is per user and protected by RLS.

## 6. Sync

There is no sync layer. PowerSync, the SQLite mirror, the write queue, and the sync tables were
removed by ADR-023. Server state is authoritative; clients refetch after writes or auth changes.

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
- when exceeded: conversation/correction disabled with an explanation; deterministic exercises remain;
- alerts at 70% and 90%.

### 8.1 Events and SLOs

- Product events are pseudonymous and PII-free (`docs/14-observability-ops.md`).
- SLOs: crash-free sessions ? 99.5%, first token p95 ? 2.5 s, schema-valid AI ? 99%, daily cost p95 ? $0.50, export success ? 99.9%.
- Dashboards: learning funnel, AI quality, cost per feature, content health, media funnel.
- Alerts on cost, provider errors, eval regression, migration failure, and retention job failure.

## 9. Configuration

```bash
# Client (public)
EXPO_PUBLIC_SUPABASE_URL=https://...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
EXPO_PUBLIC_API_URL=https://api...

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
provider; no AI key is required for deterministic exercises.

The client receives only the public Supabase URL/publishable key and the API URL. Hono keeps\nprovider keys, the database URL, and the service-role key server-side.

## 10. Performance budget

| Metric                       | Target   |
| ---------------------------- | -------- |
| Android mid-range cold start | ≤ 2.5 s  |
| Daily plan selection         | ≤ 50 ms  |
| Conversation first token p95 | ≤ 2.5 s  |
| Initial web bundle (gzip)    | ≤ 900 KB |
| Android app size             | ≤ 80 MB  |
| Pull-to-fresh p95            | = 3 s    |

## 11. Deployment

- **Backend**: self-hosted Supabase on a VPS (Docker Compose): Postgres, Auth, Storage, RLS;
  migrations applied with the Supabase CLI. EU region. Local development uses the same
  Docker stack via `pnpm supabase:start`.
- **API**: Hono (Node 26) in `services/api`, behind Caddy, JWT/JWKS verification, AI gateway,
  export/delete, admin jobs. `services/api/Dockerfile` builds the container image.
- **Infra**: `infra/docker-compose.yml` runs the Hono API and Caddy (TLS + static web).\n Uptime Kuma is an optional monitoring profile. See `infra/README.md`.
- **Web**: static build `expo export -p web` on Cloudflare Pages (or Netlify) (no COOP/COEP requirement).
- **Android**: EAS Build (APK/AAB) + EAS Submit, after the web release.
- **Managed fallback**: the same schema/client can point to Supabase Cloud if VPS operations
  become a burden.
- **Out of scope**: iOS and desktop (ADR-025); no TestFlight, Tauri, macOS, or Windows
  installer work.
