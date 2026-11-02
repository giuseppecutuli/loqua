# Loqua agent context pack

Short map for coding agents working on Loqua. Read this first; open full docs only when needed.
Authoritative details live in `docs/` and `AGENTS.md`.

## Status

- Phase 0, M1 and M2 complete (automated gates); M3/M4 foundations in progress.
  Open M2 risk: maintainer 10% human content spot-check and timing validation.
- Landed: pnpm/Turborepo workspace, `packages/core` domain (profile, consent, devices,
  export checksum), Postgres Drizzle schema + RLS migration, Hono API (JWKS,
  export/delete, consent gate), DeepSeek gateway + recorded eval, i18n catalogs, Expo
  shell with onboarding and 5 tabs.
- Online-first (ADR-023): no PowerSync, no SQLite mirror, no offline write queue.
- Self-hosted Docker: Supabase CLI stack, Hono API image, Caddy; Uptime Kuma is an
  optional monitoring profile. Local `.env.local` overrides `.env`.
- M2 landed: pure placement engine (Elo, stop rule, CEFR intervals), assessment tables + RLS,
  Hono placement routes, and an Expo placement/result flow. The blueprint covers 5 objective
  skills including listening; writing is evaluated live by `assessment.evaluate` and speaking
  is recorded, transcribed by AssemblyAI and evaluated with the same two-pass rubric. Both are
  consent-gated and skippable. Result/progress can measure all 7 skills.
- Progress tab reads `GET /v1/progress`: overall level, per-skill theta/confidence/mastery,
  recent level events and placement priorities. No offline cache.
- M2 content foundation: 76-concept knowledge graph, 28 can-dos, 33 rule-bank entries, and
  782 authored foundation items (800 approved items with the original placement bank; 600 practice
  + 200 assessment, 92 listening). `pnpm content:coverage:strict` and `pnpm content:review` are gates.
- M3 foundation: sessions/session_items/attempts/error_events/saved_phrases/srs_cards/srs_reviews,
  FSRS-7 wrapper, deterministic 40/30/30 session planner, attempt updates, and a Today -> session
  loop with resume. SRS cards are created/reviewed from session attempts. Wrong answers are
  written to the error bank; the 3rd occurrence in 14 days appends a same-skill drill item.
- M2 decisions: concept mastery, test-out, remediation and challenge level are persisted in
  `user_concept_state` and `level_events`; the result screen shows next steps.
- Next: M3 depth (8-type player, production SRS, generation, saved phrases) and M4 voice
  conversation. The current bank has no production items, so production blocks fall back to
  foundation items.
- Node 26 LTS (Volta pins pnpm to Node 26). pnpm 12. TypeScript 6. Turborepo.

## Product in one paragraph

Mobile-first English learning app, A1-C1 adaptive. Postgres is the source of truth; the
client is online-first and reads/writes through Hono; Supabase is only Auth and Postgres. Content is a
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
| API      | `services/api`             | Hono: all user data, AI, export/delete     |
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

## Learning experience

The private-beta coverage target is 2,400 practice + 600 assessment, 300 listening, 150
speaking and 100 writing tasks. Use `docs/18-content-blueprint.md` for themes, scenarios,
combination recipes and the metadata schema. The current bank is 800 approved items; use `pnpm content:coverage:target`
to see the gap. The baseline gate in `verify` remains the release guard until beta content lands.

See `docs/17-learning-experience.md` for the coverage model, level-by-level UX and content
batch plan. Coverage is measured by level x skill x can-do x concept, not by item count alone.

## Commands

```bash
pnpm supabase:start / supabase:local:reset / supabase:reset
pnpm infra:up / infra:down / infra:logs / infra:monitoring
pnpm api:dev
pnpm dev / android / web
pnpm test / test:ci / test:rls / typecheck / lint / content:review
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
