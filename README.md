# Loqua

**English, every day.** A mobile-first app for learning English progressively, adaptively, and
conversationally.
It builds the path around the learner's real gaps (grammar, vocabulary, everyday
comprehension) instead of forcing everyone through the same linear course.

> **Status:** M1 in progress. The workspace has the Expo shell, pure domain packages, canonical Postgres schema + RLS, Hono API with JWT/JWKS, DeepSeek gateway, i18n catalogs, verification harness, and a self-hosted Docker stack (Supabase CLI, API, Caddy). Online-first by ADR-023: no PowerSync/offline queue. M2 assessment is next (see `docs/02-roadmap.md`).

## In one sentence

Adaptive assessment -> learner model -> generated and validated curriculum -> daily loop
(FSRS review + contextual exercises + AI conversation) -> gamification and notifications
-> metrics of real competence.

## Key decisions

| Area              | Choice                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Name              | **Loqua** — English, every day.                                                                                           |
| Client            | Expo (React Native) + expo-router + React Native Web + Tamagui, TypeScript                                                |
| Runtime           | Node 26 LTS, pnpm 12, TypeScript 6, Turborepo                                                                             |
| Database          | Postgres (Supabase) as source of truth; online-first, no SQLite mirror                                                    |
| Backend           | Self-hosted Supabase (Auth, Postgres, Storage, RLS) + Hono API                                                            |
| Text AI           | DeepSeek first (cheap), provider-agnostic gateway in Hono, versioned prompts, JWT-gated                                   |
| Speech            | AssemblyAI (starter credits) as primary STT, Web Speech as fallback                                                       |
| SRS               | FSRS-7 via `ts-fsrs` v6 (requires Node >= 24)                                                                             |
| Learner model     | Elo per micro-skill + evidence tracking, CEFR A1-C1 with test-out                                                         |
| UI / explanations | Italian UI in phase 1; explanations in simple target language (default) or native, configurable                           |
| Languages         | English target + Italian native + Italian UI in phase 1; UI locale and target/native language are configuration, not code |
| Recommendations   | Movies, series, and books with taste onboarding, A1-C1 level fit, feedback loop, legal availability                       |
| Content           | Foundation bank + deterministic selection + adaptive generation/personalization (not a fixed course)                      |
| Safety / privacy  | Untrusted AI input, moderation, consent gates, retention, server encryption                                               |
| Gamification      | Production streak, reuse-based XP, quests, badges. No hearts/energy                                                       |

## Documentation

| Document                           | Content                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/00-decisions.md`             | ADRs: decisions, rejected alternatives, revisit triggers                                         |
| `docs/01-prd.md`                   | PRD: vision, persona, functional and non-functional requirements, metrics                        |
| `docs/02-roadmap.md`               | Milestones M0-M7 with scope, exit criteria, and estimates                                        |
| `docs/03-architecture.md`          | Stack, layers, flows, security, costs                                                            |
| `docs/04-adaptive-engine.md`       | Assessment, learner model, curriculum, SRS, conversational tutor                                 |
| `docs/05-gamification.md`          | Mechanics, retention, notifications, ethical guardrails                                          |
| `docs/06-ai-harness.md`            | Prompt registry, schemas, evals, caching, budget, model routing                                  |
| `docs/07-ux.md`                    | Information architecture, screens, flows, UI guidelines                                          |
| `docs/08-data-schema.md`           | Postgres canonical schema, RLS, invariants                                                       |
| `docs/09-testing.md`               | Test strategy, quality gates, CI, release checklist                                              |
| `docs/10-backlog.md`               | Epics and stories with MoSCoW priority                                                           |
| `docs/11-content-ops.md`           | Item lifecycle, coverage, QA, audio, media catalog                                               |
| `docs/12-media-recommendations.md` | Taste onboarding, ranking, feedback, legal constraints                                           |
| `docs/13-safety-privacy.md`        | Threat model, prompt injection, GDPR/AI Act, retention, encryption                               |
| `docs/14-observability-ops.md`     | Events, SLOs, dashboards, release, runbooks                                                      |
| `docs/15-agent-workflow.md`        | Token efficiency, Caveman evaluation, autonomous testing, skills                                 |
| `docs/16-agent-context.md`         | Short context pack for coding agents                                                             |
| `docs/prompts/`                    | Versioned prompt specs (assessment, exercises, tutor, correction, plan, media, adaptive content) |
| `AGENTS.md`                        | Development harness: conventions, commands, definition of done                                   |

## Target monorepo layout

```
apps/
  app/          # Expo universal: Android, iOS, Web
  desktop/      # Tauri v2 wrapper (M7)
packages/
  core/         # pure domain: assessment, learner model, SRS, curriculum, gamification, recommendation
  db/\r?\n    postgres/   # canonical Drizzle schema + migrations (source of truth)\r?\n  ai/           # provider gateway, prompt registry, Zod schemas, cost logger
  ui/           # Tamagui wrappers, design tokens and i18n catalogs
  content/      # item bank, media catalog, CEFR descriptors, error rule-bank
supabase/
  migrations/   # Postgres migrations + RLS policies
  seed/         # content/media seed data
services/
  api/          # Hono API: AI gateway, export/delete, admin (Node 26)
infra/
  docker-compose.yml  # API, Caddy; optional monitoring profile\r?\ntools/
  eval/         # prompt evaluation harness (golden set, LLM-as-judge)
  verify/       # autonomous verification harness (compact output)
  seed/         # item bank generation and import
  db/           # reset, RLS, smoke tools
.opencode/
  skills/       # token efficiency, verify, sync, content, eval, media
docs/
```

## Commands available now

```bash
pnpm install
pnpm dev             # Expo dev server
pnpm android         # Android build/dev
pnpm web             # Web build/dev
pnpm api:dev         # Hono API (JWT/JWKS, export/delete, DeepSeek gateway)
pnpm test            # Vitest, all packages
pnpm test:ci         # Vitest run (CI reporter)
pnpm test:rls        # RLS two-user isolation (Docker Postgres)
pnpm typecheck
pnpm lint
pnpm db:generate     # Postgres Drizzle migrations
pnpm db:migrate      # apply migrations to DATABASE_URL
pnpm db:check        # schema drift check
pnpm seed
pnpm eval:recorded   # fixture-based eval for CI (no network, no cost)
node tools/verify/verify.mjs --level=fast|core|full
```

Self-hosted Docker:

```bash
pnpm supabase:start       # Supabase Postgres/Auth/Storage/Studio/Mailpit
pnpm supabase:local:reset # apply migrations to the full local stack
pnpm build:web            # static web for Caddy
pnpm infra:monitoring     # optional Uptime Kuma profile
pnpm infra:up             # API + Caddy
pnpm smoke:e2e            # local Supabase auth + RLS + API export
pnpm smoke:ai             # live DeepSeek correction (needs DEEPSEEK_API_KEY)
```

`pnpm supabase:reset` (without `:local`) is the fast test harness: a small Docker Postgres
(`loqua-postgres`, port `54329`) with an `auth.uid()` shim, used by `test:rls`. The full
local stack runs on `54321/54322` and is controlled by the Supabase CLI. See `infra/README.md`.

AI cost defaults to DeepSeek (`DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`). Gemini and OpenAI
keys are optional fallbacks, not required.

## Version policy

Use the latest compatible versions, not blind latest. Run `pnpm outdated -r` and
`docker compose pull` before releases.

- TypeScript is pinned to **6.0.3**: `typescript-eslint` 8.72 hard-fails on TS 7.0, so `tsc`
  and ESLint cannot use TS 7 in the same toolchain yet. Bump both together when
  typescript-eslint supports it.
- Our containers use `node:26-alpine`, `postgres:18-alpine`, `caddy:2-alpine`, and\n `uptime-kuma:2` (optional monitoring profile).
- The Supabase CLI controls its own images, currently Postgres 17. That major follows the
  Supabase-supported version, not ours.

Web is a standard Expo Router SPA. It does not need COOP/COEP headers or a SQLite WASM database.

## Guiding principles

1. **Production before recognition.** What counts is speaking and writing, not tapping answers.
2. **Errors are content.** Recurring mistakes generate micro-drills, not punishments.
3. **Costs under control.** Foundation bank, caching, adaptive generation with caps, cheap models.
4. **Server-backed, multi-device.** Postgres is the source of truth; devices share server state. Writes require connectivity.
5. **Measure competence, not streaks.** Streaks and XP are means, not the product.
6. **No fixed course.** A1-C1 placement, test-out, targeted remediation, and content that adapts to progress.

## License

To be defined (likely MIT for code, human-reviewed generated content).
