# Loqua

**English, every day.** A mobile-first app for learning English progressively, adaptively, and
conversationally.
It builds the path around the learner's real gaps (grammar, vocabulary, everyday
comprehension) instead of forcing everyone through the same linear course.

> **Status:** Phase 0 — planning. The repository contains documentation only.
> Code starts at milestone M1 (see `docs/02-roadmap.md`).

## In one sentence

Adaptive assessment -> learner model -> generated and validated curriculum -> daily loop
(FSRS review + contextual exercises + AI conversation) -> gamification and notifications
-> metrics of real competence.

## Key decisions

| Area | Choice |
|---|---|
| Name | **Loqua** — English, every day. |
| Client | Expo (React Native) + expo-router + React Native Web, TypeScript |
| Runtime | Node 26 LTS (latest LTS, Nov 2026), pnpm 10, Turborepo |
| Database | Postgres (Supabase) as source of truth + local SQLite cache (offline) |
| Backend | Self-hosted Supabase (Auth, Postgres, Storage, RLS) + PowerSync + Hono API |
| Text AI | Provider-agnostic gateway in Hono, mini/flash models, versioned prompts, JWT-gated |
| Speech | AssemblyAI (starter credits) as primary STT, Web Speech as fallback |
| SRS | FSRS-7 via `ts-fsrs` v6 (requires Node >= 24) |
| Learner model | Elo per micro-skill + evidence tracking, CEFR A1-C1 with test-out |
| UI / explanations | Italian UI in phase 1; explanations in simple target language (default) or native, configurable |
| Languages | English target + Italian native + Italian UI in phase 1; UI locale and target/native language are configuration, not code |
| Recommendations | Movies, series, and books with taste onboarding, A1-C1 level fit, feedback loop, legal availability |
| Content | Foundation bank + deterministic selection + adaptive generation/personalization (not a fixed course) |
| Safety / privacy | Untrusted AI input, moderation, consent gates, retention, server + local encryption |
| Gamification | Production streak, reuse-based XP, quests, badges. No hearts/energy |

## Documentation

| Document | Content |
|---|---|
| `docs/00-decisions.md` | ADRs: decisions, rejected alternatives, revisit triggers |
| `docs/01-prd.md` | PRD: vision, persona, functional and non-functional requirements, metrics |
| `docs/02-roadmap.md` | Milestones M0-M7 with scope, exit criteria, and estimates |
| `docs/03-architecture.md` | Stack, layers, flows, offline/sync, security, costs |
| `docs/04-adaptive-engine.md` | Assessment, learner model, curriculum, SRS, conversational tutor |
| `docs/05-gamification.md` | Mechanics, retention, notifications, ethical guardrails |
| `docs/06-ai-harness.md` | Prompt registry, schemas, evals, caching, budget, model routing |
| `docs/07-ux.md` | Information architecture, screens, flows, UI guidelines |
| `docs/08-data-schema.md` | Postgres canonical schema, SQLite mirror, RLS, invariants |
| `docs/09-testing.md` | Test strategy, quality gates, CI, release checklist |
| `docs/10-backlog.md` | Epics and stories with MoSCoW priority |
| `docs/11-content-ops.md` | Item lifecycle, coverage, QA, audio, media catalog |
| `docs/12-media-recommendations.md` | Taste onboarding, ranking, feedback, legal constraints |
| `docs/13-safety-privacy.md` | Threat model, prompt injection, GDPR/AI Act, retention, encryption |
| `docs/14-observability-ops.md` | Events, SLOs, dashboards, release, runbooks |
| `docs/15-agent-workflow.md` | Token efficiency, Caveman evaluation, autonomous testing, skills |
| `docs/16-agent-context.md` | Short context pack for coding agents |
| `docs/prompts/` | Versioned prompt specs (assessment, exercises, tutor, correction, plan, media, adaptive content) |
| `AGENTS.md` | Development harness: conventions, commands, definition of done |

## Target monorepo layout

```
apps/
  app/          # Expo universal: Android, iOS, Web
  desktop/      # Tauri v2 wrapper (M7)
packages/
  core/         # pure domain: assessment, learner model, SRS, curriculum, gamification, recommendation
  db/
    postgres/   # canonical Drizzle schema + migrations (source of truth)
    sqlite/     # local mirror for offline cache / PowerSync client
  ai/           # provider gateway, prompt registry, Zod schemas, cost logger
  ui/           # design system and i18n catalogs
  content/      # item bank, media catalog, CEFR descriptors, error rule-bank
supabase/
  migrations/   # Postgres migrations + RLS policies
  seed/         # content/media seed data
services/
  api/          # Hono API: AI gateway, export/delete, admin (Node 26)
tools/
  eval/         # prompt evaluation harness (golden set, LLM-as-judge)
  verify/       # autonomous verification harness (compact output)
  seed/         # item bank generation and import
.opencode/
  skills/       # token efficiency, verify, sync, content, eval, media
docs/
```

## Target commands (available from M1)

```bash
pnpm install
pnpm supabase:start  # local Supabase (Postgres, Auth, Storage)
pnpm supabase:reset  # apply migrations + seed
pnpm api:dev         # Hono API (AI gateway, export/delete)
pnpm dev             # Expo dev server
pnpm android        # Android build/dev
pnpm web            # Web build/dev
pnpm test           # Vitest (packages/core)
pnpm typecheck
pnpm lint
pnpm db:generate    # Postgres Drizzle migrations
pnpm db:migrate
pnpm db:check       # schema drift check
pnpm sync:generate  # PowerSync client schema
pnpm seed           # import item bank
pnpm eval           # live prompt eval (sampled, needs keys)
pnpm eval:recorded  # fixture-based eval for CI (no network, no cost)
node tools/verify/verify.mjs --level=fast|core|full
```

## Guiding principles

1. **Production before recognition.** What counts is speaking and writing, not tapping answers.
2. **Errors are content.** Recurring mistakes generate micro-drills, not punishments.
3. **Costs under control.** Foundation bank, caching, adaptive generation with caps, cheap models.
4. **Offline-capable, multi-device.** Local cache keeps the loop working; Postgres + sync keep devices aligned.
5. **Measure competence, not streaks.** Streaks and XP are means, not the product.
6. **No fixed course.** A1-C1 placement, test-out, targeted remediation, and content that adapts to progress.

## License

To be defined (likely MIT for code, human-reviewed generated content).
