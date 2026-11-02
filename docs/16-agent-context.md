# Loqua agent context pack

Short map for coding agents working on Loqua. Read this first; open full docs only when needed.
Authoritative details live in `docs/` and `AGENTS.md`.

## Status

- Phase 0 complete; M1 in progress.
- Landed: pnpm/Turborepo workspace, `packages/core` domain (profile, consent, devices,
  export checksum), Postgres Drizzle schema + RLS migration, Hono API (JWKS,
  export/delete, consent gate), DeepSeek gateway + recorded eval, i18n catalogs, Expo
  shell with onboarding and 5 tabs.
- Online-first (ADR-023): no PowerSync, no SQLite mirror, no offline write queue.
- Self-hosted Docker: Supabase CLI stack, Hono API image, Caddy; Uptime Kuma is an
  optional monitoring profile. Local `.env.local` overrides `.env`.
- Next: email magic-link deep links, two-device server-state test, then M2.
- Node 26 LTS (Volta pins pnpm to Node 26). pnpm 12. TypeScript 6. Turborepo.

## Product in one paragraph

Mobile-first English learning app, A1-C1 adaptive. Postgres is the source of truth; the
client is online-first and reads/writes through Supabase and Hono. Content is a foundation
bank + deterministic selection + on-demand generation (`content.generate`), never a fixed
course. AI runs through a JWT-gated Hono API. UI Italian, explanations in simple target
language. Gamification without hearts/energy. Media recommendations are metadata-only, legal,
spoiler-free, with taste feedback.

## Architecture

| Layer    | Where                      | Rule                                       |
| -------- | -------------------------- | ------------------------------------------ |
| UI       | `apps/app`                 | expo-router, RNW, Tamagui; no literal copy |
| Domain   | `packages/core`            | pure TS, no React/Expo/network             |
| Postgres | `packages/db/postgres`     | canonical schema, migrations, RLS          |
| AI       | `packages/ai`              | gateway, prompts, Zod, cost                |
| API      | `services/api`             | Hono, JWT, AI gateway, export/delete       |
| Content  | `packages/content`         | item bank, media catalog, rule-bank        |
| Infra    | `supabase/`, Docker, Caddy | self-hosted VPS, EU                        |

## Key decisions

- ADR-016: multi-device, self-hosted Supabase + Hono. ADR-023 removes PowerSync/offline.
- ADR-017: A1-C1, test-out, promotion, remediation without demotion.
- ADR-018: adaptive content, foundation-first, generation only on trigger.
- ADR-020: DeepSeek-first cheap text routing; Gemini/OpenAI optional.
- ADR-021: self-hosted Docker baseline; managed fallback documented.
- Language is data (`target_lang`, `native_lang`, `ui_locale`, `explanation_mode`).
- RLS on every user table; `users.id = auth.uid()`.
- Media: metadata only, legal availability, no piracy, no spoilers.

## Commands

```bash
pnpm supabase:start / supabase:local:reset / supabase:reset
pnpm infra:up / infra:down / infra:logs / infra:monitoring
pnpm api:dev
pnpm dev / android / web
pnpm test / test:ci / test:rls / typecheck / lint
pnpm db:generate / db:migrate / db:check
pnpm seed
pnpm eval / eval:recorded
pnpm smoke:account / smoke:supabase / smoke:e2e / smoke:ai
node tools/verify/verify.mjs --level=fast|core|full
```

## Read this when…

| Task                   | Read                                                         |
| ---------------------- | ------------------------------------------------------------ |
| Product scope          | `docs/01-prd.md`                                             |
| Plan/estimates         | `docs/02-roadmap.md`, `docs/10-backlog.md`                   |
| System design          | `docs/03-architecture.md`                                    |
| Learner model/CEFR/SRS | `docs/04-adaptive-engine.md`                                 |
| Content generation     | `docs/11-content-ops.md`, `docs/prompts/adaptive-content.md` |
| Prompts/evals          | `docs/06-ai-harness.md`, `docs/prompts/`                     |
| Data/RLS               | `docs/08-data-schema.md`                                     |
| Auth/RLS               | `docs/03-architecture.md`, ADR-016                           |
| Safety/privacy         | `docs/13-safety-privacy.md`                                  |
| Ops/observability      | `docs/14-observability-ops.md`                               |
| Agent workflow         | `docs/15-agent-workflow.md`, `.opencode/skills/`             |
| Media recs             | `docs/12-media-recommendations.md`                           |

## Invariants to never break

- Postgres authoritative; the client has no local write queue.
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
