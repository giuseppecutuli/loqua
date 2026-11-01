# Loqua agent context pack

Short map for coding agents working on Loqua. Read this first; open full docs only when needed.
Authoritative details live in `docs/` and `AGENTS.md`.

## Status

- Phase 0 complete; M1 in progress.
- Landed: pnpm/Turborepo workspace, `packages/core` domain (profile, consent, devices,
  export checksum, sync merge), Postgres Drizzle schema + RLS migration, SQLite mirror +
  PowerSync table schema, Hono API (JWT, export/delete, AI stub), AI gateway contract with
  recorded eval, i18n catalogs, Expo shell with onboarding and 5 tabs.
- Next: self-hosted Supabase Auth magic links, PowerSync client wiring, device revoke UI,
  two-device E2E, then M2 assessment.
- Node 26 LTS (Volta pins pnpm to Node 26). pnpm 11. Turborepo.

## Product in one paragraph

Mobile-first English learning app, A1-C1 adaptive. Postgres is the source of truth; local
SQLite is an offline cache; PowerSync keeps Android and Web aligned. Content is a foundation
bank + deterministic selection + on-demand generation (`content.generate`), never a fixed
course. AI runs through a JWT-gated Hono API. UI Italian, explanations in simple target
language. Gamification without hearts/energy. Media recommendations are metadata-only, legal,
spoiler-free, with taste feedback.

## Architecture

| Layer | Where | Rule |
|---|---|---|
| UI | `apps/app` | expo-router, RNW; no literal copy |
| Domain | `packages/core` | pure TS, no React/Expo/network |
| Postgres | `packages/db/postgres` | canonical schema, migrations, RLS |
| SQLite | `packages/db/sqlite` | offline mirror, PowerSync client |
| AI | `packages/ai` | gateway, prompts, Zod, cost |
| API | `services/api` | Hono, JWT, AI gateway, export/delete |
| Content | `packages/content` | item bank, media catalog, rule-bank |
| Infra | `supabase/`, Docker, Caddy | self-hosted VPS, EU |

## Key decisions

- ADR-016: multi-device, self-hosted Supabase + PowerSync + Hono.
- ADR-017: A1-C1, test-out, promotion, remediation without demotion.
- ADR-018: adaptive content, foundation-first, generation only on trigger.
- Language is data (`target_lang`, `native_lang`, `ui_locale`, `explanation_mode`).
- RLS on every user table; `users.id = auth.uid()`.
- Media: metadata only, legal availability, no piracy, no spoilers.

## Commands

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm api:dev
pnpm dev / android / web
pnpm test / test:ci / typecheck / lint
pnpm db:generate / db:migrate / db:check
pnpm sync:generate
pnpm seed
pnpm eval / eval:recorded
node tools/verify/verify.mjs --level=fast|core|full
```

## Read this when…

| Task | Read |
|---|---|
| Product scope | `docs/01-prd.md` |
| Plan/estimates | `docs/02-roadmap.md`, `docs/10-backlog.md` |
| System design | `docs/03-architecture.md` |
| Learner model/CEFR/SRS | `docs/04-adaptive-engine.md` |
| Content generation | `docs/11-content-ops.md`, `docs/prompts/adaptive-content.md` |
| Prompts/evals | `docs/06-ai-harness.md`, `docs/prompts/` |
| Data/RLS | `docs/08-data-schema.md` |
| Sync/auth | `docs/03-architecture.md` §6, ADR-016 |
| Safety/privacy | `docs/13-safety-privacy.md` |
| Ops/observability | `docs/14-observability-ops.md` |
| Agent workflow | `docs/15-agent-workflow.md`, `.opencode/skills/` |
| Media recs | `docs/12-media-recommendations.md` |

## Invariants to never break

- Postgres authoritative; local SQLite never authoritative.
- `attempts`, `srs_reviews`, `error_events`, `xp_events`, `prompt_calls` append-only.
- One active plan per profile; one card per `(user, source, type)`.
- Only approved items served; generated items private + validated + TTL.
- Corrections need a valid `rule_id`, exact `span`, confidence ≥ 0.7.
- Consent before AI/voice; audio deleted within 24-48h; no PII in logs.
- No secrets in client/bundle/logs. Provider keys only in Hono.
- No fixed course; no full transcripts; no piracy links.

## Token discipline

- Answer first; no recap.
- Read smallest window; grep/glob first.
- Targeted tests, then `verify`.
- Paste verify summary + failure excerpt, never full logs.
- Code/commands/paths verbatim.
- No emojis unless asked.
