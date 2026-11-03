# Product backlog

> **Online-first (ADR-023).** Offline/SQLite/PowerSync references in this document are
> superseded: the app requires connectivity and has no local write queue.

Priority legend: **M** = Must (MVP), **S** = Should, **C** = Could, **W** = Won't (for now).
Estimate: **S** ≤ 1 day, **M** 2-3 days, **L** 1 week, **XL** > 1 week.

## E1 — Foundations and platform

| ID    | Story                                                                            | Prio | Est. | Depends |
| ----- | -------------------------------------------------------------------------------- | ---- | ---- | ------- |
| E1-01 | pnpm/Turborepo monorepo with Expo, Postgres package, Supabase                    | M    | M    | ?       |
| E1-02 | Design tokens and base components (Button, Card, Progress, Sheet)                | M    | M    | E1-01   |
| E1-03 | Canonical Postgres schema + initial migration                                    | M    | M    | E1-01   |
| E1-04 | Repository pattern (server + local cache) and transactions                       | M    | M    | E1-03   |
| E1-05 | 5-tab navigation shell                                                           | M    | S    | E1-02   |
| E1-06 | Full JSON export/import                                                          | M    | M    | E1-04   |
| E1-07 | Hono AI gateway with JWT, rate limits, cost logs                                 | M    | M    | —       |
| E1-08 | CI (typecheck, lint, test, web build)                                            | M    | S    | E1-01   |
| E1-09 | Static web hosting (SPA)                                                         | S    | M    | E1-01   |
| E1-10 | Dark theme and text size                                                         | C    | S    | E1-02   |
| E1-11 | Language profile fields + i18n scaffold (it only, fallback en)                   | M    | M    | E1-01   |
| E1-12 | `learner_profiles`: goal, daily minutes, streak mode, timezone, onboarding state | M    | M    | E1-03   |
| E1-13 | Consent records and gates (terms, privacy, voice, AI, analytics)                 | M    | M    | E1-03   |
| E1-14 | Versioned export/backup with checksum and import validation                      | M    | M    | E1-06   |
| E1-15 | Self-hosted Supabase stack + canonical Postgres schema + migrations              | M    | L    | E1-03   |
| E1-16 | Auth: anonymous first, email magic link upgrade                                  | M    | M    | E1-15   |
| E1-17 | RLS policies + two-user isolation tests                                          | M    | M    | E1-15   |
| E1-18 | ~~PowerSync/sync rules~~ removed by ADR-023                                      | W    | �    | �       |
| E1-19 | ~~SQLite mirror~~ removed by ADR-023                                             | W    | �    | �       |
| E1-20 | Devices table, list, revoke, session invalidation                                | M    | M    | E1-16   |
| E1-21 | ~~Sync status/conflict UI~~ removed by ADR-023                                   | W    | �    | �       |
| E1-22 | Server-side export/delete + local cache clear                                    | M    | M    | E1-15   |
| E1-23 | Hono API stub: AI gateway, export/delete, JWT                                    | M    | M    | E1-15   |
| E1-24 | Two-device server-state E2E                                                      | M    | M    | E1-23   |
| E1-25 | VPS bootstrap: Docker Compose, Caddy/TLS, firewall, logs                         | M    | M    | E1-15   |
| E1-26 | SMTP magic link (Brevo/Resend) + SPF/DKIM                                        | M    | S    | E1-16   |
| E1-27 | Postgres backup/restore runbook + scheduled backup                               | M    | M    | E1-15   |
| E1-28 | Hono API SSE streaming + cost log                                                | M    | M    | E1-23   |

## E2 — Onboarding and assessment

| ID    | Story                                                    | Prio | Est. | Depends |
| ----- | -------------------------------------------------------- | ---- | ---- | ------- |
| E2-01 | 4-step onboarding, no sign-up                            | M    | M    | E1-05   |
| E2-02 | Adaptive placement test (Elo, stop rule)                 | M    | L    | E1-03   |
| E2-03 | Initial item bank ≥ 300 items                            | M    | L    | E3-01   |
| E2-04 | Writing task with rubric and validation                  | M    | M    | E1-07   |
| E2-05 | Speaking task with STT and rubric                        | M    | L    | E4-03   |
| E2-06 | CEFR mapping with confidence intervals                   | M    | M    | E2-02   |
| E2-07 | Initial profile screen with 3 priorities                 | M    | M    | E2-06   |
| E2-08 | Recalibration after 2 weeks                              | S    | M    | E2-06   |
| E2-09 | Quick "5-minute" level check                             | C    | S    | E2-02   |
| E2-10 | Persist assessments and per-dimension scores             | M    | M    | E2-02   |
| E2-11 | Can-do catalog, rubric anchors, placement test blueprint | M    | M    | E2-06   |
| E2-12 | Test-out, challenge items, promotion rules               | M    | L    | E2-10   |
| E2-13 | Level history (`level_events`) and remediation triggers  | M    | M    | E2-12   |

## E3 — Content and curriculum

| ID    | Story                                                            | Prio | Est. | Depends |
| ----- | ---------------------------------------------------------------- | ---- | ---- | ------- |
| E3-01 | A1-C1 knowledge graph with prerequisites                         | M    | L    | —       |
| E3-02 | Grammar rule-bank with `rule_id`                                 | M    | L    | —       |
| E3-03 | IT->EN error taxonomy                                            | M    | M    | E3-02   |
| E3-04 | Batch item generator + validation                                | M    | L    | E3-01   |
| E3-05 | Two-week planner with deterministic validation                   | M    | L    | E3-01   |
| E3-06 | Incremental plan patch from recurring errors                     | M    | M    | E3-03   |
| E3-07 | Item bank: professional scenarios                                | S    | L    | E3-04   |
| E3-08 | Item bank: everyday life and small talk                          | S    | L    | E3-04   |
| E3-09 | Downloadable/updatable content packs                             | C    | M    | E3-04   |
| E3-10 | Content packs and item queries keyed by language pair            | M    | M    | E3-04   |
| E3-11 | Item difficulty calibration job + retirement rules               | M    | L    | E3-04   |
| E3-12 | Coverage report: items per concept/level/skill                   | M    | M    | E3-04   |
| E3-13 | Media catalog v0 (250 titles) with difficulty, tags, availability | M    | L    | E3-01   |
| E3-14 | A1 depth and B2-C1 content waves                                 | M    | XL   | E3-04   |
| E3-15 | A1-C1 coverage report and gaps                                   | M    | M    | E3-14   |

## E4 — Daily loop and AI

| ID    | Story                                                         | Prio | Est. | Depends |
| ----- | ------------------------------------------------------------- | ---- | ---- | ------- |
| E4-01 | "Today's plan" home with a single CTA                         | M    | M    | E3-05   |
| E4-02 | Exercise player with 8 types                                  | M    | XL   | E3-04   |
| E4-03 | AI gateway with providers, Zod, retries, cost logs            | M    | L    | E1-07   |
| E4-04 | Feedback and explanations in simple target language           | M    | M    | E4-02   |
| E4-05 | FSRS-7: recognition/production cards                          | M    | L    | E1-04   |
| E4-06 | Error bank and micro-drills                                   | M    | M    | E3-03   |
| E4-07 | "Why this exercise?"                                          | S    | S    | E3-05   |
| E4-08 | 5-minute short session                                        | S    | M    | E4-01   |
| E4-09 | Resume interrupted session                                    | S    | S    | E4-02   |
| E4-10 | Save encountered phrases -> cards                             | C    | M    | E4-05   |
| E4-11 | Language-aware prompt inputs (target/native/explanation mode) | M    | M    | E4-03   |
| E4-12 | `session_items`, session status, and resume                   | M    | M    | E4-02   |
| E4-13 | SRS ops: leech/suspend, hint penalty, tolerance, backlog cap  | M    | M    | E4-05   |
| E4-14 | Saved phrases + user feedback on exercises/corrections        | M    | M    | E4-06   |
| E4-15 | Content pack checksum, update, and rollback                   | M    | M    | E3-04   |

## E5 — Conversation and voice

| ID    | Story                                                             | Prio | Est. | Depends |
| ----- | ----------------------------------------------------------------- | ---- | ---- | ------- |
| E5-01 | Stateful conversation orchestrator                                | M    | L    | E4-03   |
| E5-02 | 10 scenarios with goals and target phrases                        | M    | L    | E5-01   |
| E5-03 | Chat UI with streaming and turns                                  | M    | M    | E5-01   |
| E5-04 | AssemblyAI streaming STT + Web Speech fallback                    | M    | L    | E1-01   |
| E5-05 | Browser TTS + server cache                                        | M    | M    | E1-01   |
| E5-06 | Post-hoc corrector with span check                                | M    | L    | E3-02   |
| E5-07 | End-of-session report with 2 focus points                         | M    | M    | E5-06   |
| E5-08 | Errors -> SRS and drills                                          | M    | M    | E4-05   |
| E5-09 | Speaking evaluation with rubric                                   | S    | L    | E5-04   |
| E5-10 | Phoneme-level pronunciation (Azure/other)                         | C    | L    | E5-09   |
| E5-11 | Conversation context window: summary + token cap + end conditions | M    | M    | E5-01   |
| E5-12 | Audio pipeline: VAD, chunking, latency budget, captions           | M    | M    | E5-04   |
| E5-13 | Prompt-injection defenses + output moderation                     | M    | M    | E4-03   |
| E5-14 | Hono JWT auth, rate limits, per-feature quotas                    | M    | M    | E1-23   |

## E6 — Gamification and retention

| ID    | Story                                             | Prio | Est. | Depends |
| ----- | ------------------------------------------------- | ---- | ---- | ------- |
| E6-01 | Production streak with grace day                  | M    | M    | E4-02   |
| E6-02 | Anti-grinding XP and per-skill levels             | M    | M    | E4-02   |
| E6-03 | Daily quests and weekly mission                   | M    | M    | E6-02   |
| E6-04 | Event-based notifications with quiet hours        | M    | M    | E6-01   |
| E6-05 | Badges and awards                                 | S    | M    | E6-02   |
| E6-06 | Activity calendar and error heatmap               | S    | M    | E4-06   |
| E6-07 | Streak repair through conversation                | S    | S    | E6-01   |
| E6-08 | Accountability buddy                              | C    | L    | E6-01   |
| E6-09 | Notification permission, deep links, timezone/DST | M    | M    | E6-04   |
| E6-10 | Media quests, badges, and immersion XP            | S    | M    | E6-02   |

## E7 — Progress and analytics

| ID    | Story                              | Prio | Est. | Depends |
| ----- | ---------------------------------- | ---- | ---- | ------- |
| E7-01 | Skill radar                        | M    | M    | E2-06   |
| E7-02 | CEFR trend with confidence         | M    | S    | E2-06   |
| E7-03 | Recurring error list with examples | M    | M    | E4-06   |
| E7-04 | Week in review                     | S    | M    | E7-01   |
| E7-05 | Readable report export (PDF/image) | C    | M    | E7-04   |

## E8 — Quality, security, release

| ID    | Story                                                                   | Prio | Est. | Depends |
| ----- | ----------------------------------------------------------------------- | ---- | ---- | ------- |
| E8-01 | Eval harness (golden set, LLM-as-judge)                                 | M    | L    | E4-03   |
| E8-02 | Playwright web E2E                                                      | M    | M    | E1-09   |
| E8-03 | Maestro Android E2E                                                     | S    | M    | E4-02   |
| E8-04 | Migration tests from scratch and previous version                       | M    | S    | E1-03   |
| E8-05 | AI budget guard and circuit breaker                                     | M    | M    | E4-03   |
| E8-06 | Privacy and audio retention audit                                       | M    | S    | E5-04   |
| E8-07 | Accessibility and performance pass                                      | S    | M    | E6-06   |
| E8-08 | Android store readiness                                                 | S    | M    | E8-03   |
| E8-09 | Language/locale tests: no hardcoded copy, pair isolation, pseudo-locale | M    | M    | E8-01   |
| E8-10 | Load/performance tests and DB size budget                               | M    | M    | E8-02   |
| E8-11 | Backup/restore drill and migration rollback                             | M    | M    | E8-04   |
| E8-12 | Recorded eval mode for CI (no network, no cost)                         | M    | M    | E8-01   |
| E8-13 | Sentry, SLO dashboards, cost/quality alerts                             | M    | M    | E8-02   |
| E8-14 | Encryption at rest + retention jobs                                     | M    | M    | E8-06   |
| E8-15 | Two-device server-state E2E                                             | M    | M    | E1-24   |
| E8-16 | RLS two-user test suite in CI                                           | M    | M    | E1-17   |

## E9 — Desktop and managed fallback

| ID    | Story                                       | Prio | Est. | Depends |
| ----- | ------------------------------------------- | ---- | ---- | ------- |
| E9-01 | Tauri v2 wrapper around the web build       | S    | M    | E1-09   |
| E9-02 | Windows installer                           | S    | S    | E9-01   |
| E9-03 | Managed fallback: migrate to Supabase Cloud | C    | L    | E1-15   |
| E9-04 | Managed fallback runbook and cost check     | C    | M    | E9-03   |
| E9-05 | iOS build and TestFlight                    | S    | M    | E1-24   |

## E10 — Debt and maintenance (continuous)

| ID     | Story                                        | Prio |
| ------ | -------------------------------------------- | ---- |
| E10-01 | Update the golden set on every prompt change | M    |
| E10-02 | Recalibrate item difficulty with real data   | S    |
| E10-03 | Review CEFR thresholds every 3 months        | S    |
| E10-04 | Update models/prices in the gateway          | S    |
| E10-05 | Log and backup cleanup                       | S    |

## E11 — Content operations

| ID     | Story                                              | Prio | Est. | Depends |
| ------ | -------------------------------------------------- | ---- | ---- | ------- |
| E11-01 | Item review queue + human sample workflow          | M    | M    | E3-04   |
| E11-02 | Audio asset pipeline + captions for listening      | M    | M    | E3-04   |
| E11-03 | Media catalog curation + availability re-check     | M    | L    | E3-13   |
| E11-04 | License tracking for items, audio, and media       | M    | S    | E3-04   |
| E11-05 | Content pack rollback drill                        | S    | S    | E4-15   |
| E11-06 | Coverage dashboard (items per concept/level/skill) | M    | M    | E3-12   |

## E12 — Media recommendations

| ID     | Story                                                                           | Prio | Est. | Depends |
| ------ | ------------------------------------------------------------------------------- | ---- | ---- | ------- |
| E12-01 | Taste onboarding (formats, genres, themes, difficulty, subtitles, time, region) | M    | M    | E1-12   |
| E12-02 | Deterministic ranking engine with level fit + diversity                         | M    | L    | E3-13   |
| E12-03 | `media.explain` spoiler-free reason                                             | M    | M    | E4-03   |
| E12-04 | `media.guide` before/during/after                                               | M    | M    | E12-03  |
| E12-05 | Feedback loop + taste update                                                    | M    | M    | E12-02  |
| E12-06 | Immersione UI (cards, detail, actions)                                          | M    | M    | E12-01  |
| E12-07 | Reflection -> production + phrase -> SRS                                        | M    | M    | E5-06   |
| E12-08 | Media progress + weekly immersion plan                                          | P1   | M    | E12-06  |
| E12-09 | Eval set: 250 titles, 10 profiles, 5 regions                                     | M    | M    | E12-02  |
| E12-10 | Legal/no-piracy/no-spoiler checks                                               | M    | M    | E12-04  |
| E12-11 | Catalog expansion to 200 titles                                                 | S    | L    | E11-03  |

## E13 — Safety, privacy, compliance

| ID     | Story                                               | Prio | Est. | Depends |
| ------ | --------------------------------------------------- | ---- | ---- | ------- |
| E13-01 | Threat model + prompt-injection defenses            | M    | M    | E4-03   |
| E13-02 | Output moderation + fallback                        | M    | M    | E13-01  |
| E13-03 | Consent gates for AI/voice/analytics                | M    | M    | E1-13   |
| E13-04 | Retention jobs (audio, transcripts, logs)           | M    | M    | E1-03   |
| E13-05 | Server encryption at rest + encrypted backups       | M    | M    | E1-04   |
| E13-06 | DPIA, AI Act review, privacy policy, terms          | M    | M    | E13-03  |
| E13-07 | Red-team suite (jailbreak, injection, exfiltration) | M    | M    | E13-01  |
| E13-08 | End-to-end delete + export verification             | M    | M    | E13-04  |
| E13-09 | RLS policy audit + service-role isolation           | M    | M    | E1-17   |

## E14 — Observability and operations

| ID     | Story                                                | Prio | Est. | Depends |
| ------ | ---------------------------------------------------- | ---- | ---- | ------- |
| E14-01 | Event taxonomy + client buffering                    | M    | M    | E1-05   |
| E14-02 | Dashboards: funnel, AI quality, cost, content, media | M    | M    | E14-01  |
| E14-03 | SLOs + alerts (cost, errors, provider, eval)         | M    | M    | E14-02  |
| E14-04 | Sentry integration with PII scrubbing                | M    | S    | E1-01   |
| E14-05 | Release/rollback runbook + EAS Update policy         | M    | M    | E8-11   |
| E14-06 | Backup/restore runbook + quarterly drill             | M    | M    | E8-11   |
| E14-07 | Cost operations: per-feature quotas + caps           | M    | M    | E5-14   |
| E14-08 | Incident runbooks + kill switches                    | M    | M    | E14-03  |
| E14-09 | Server latency/error dashboard + alerts              | M    | M    | E1-24   |

## E15 — Adaptive content

| ID     | Story                                                        | Prio | Est. | Depends |
| ------ | ------------------------------------------------------------ | ---- | ---- | ------- |
| E15-01 | `ContentRequest` schema + `content_requests` table           | M    | M    | E3-01   |
| E15-02 | Content planner: foundation/cache first, generation triggers | M    | L    | E4-05   |
| E15-03 | `content.generate` prompt + validation pipeline              | M    | L    | E4-03   |
| E15-04 | Dedupe/cache by spec hash                                    | M    | M    | E15-03  |
| E15-05 | Private generated items (`owner_user_id`, TTL, RLS)          | M    | M    | E1-17   |
| E15-06 | Human sample + promotion to global bank                      | M    | M    | E11-01  |
| E15-07 | Foundation fallback on network errors                        | M    | M    | E15-03  |
| E15-08 | Per-session/day caps + deterministic fallback                | M    | M    | E15-03  |
| E15-09 | Adaptive-content golden set + tests                          | M    | M    | E15-03  |
| E15-10 | "More like this" + "why this item"                           | S    | M    | E15-02  |

## Recommended order for the first 10 stories

1. E1-01, E1-02, E1-03, E1-04 (foundations)
2. E1-15, E1-16, E1-17 (backend, auth, RLS)
3. E1-20, E1-22, E1-23, E1-24 (devices, export, Hono API, two-device server state)
4. E2-01 (onboarding)
5. E3-01, E3-02, E3-03 (knowledge graph and rule-bank)
6. E2-02, E2-10, E2-12 (assessment and test-out)
7. E3-04, E2-03 (item bank)
8. E4-05, E4-02 (SRS and player)
9. E4-01 (home)
10. E4-03, E4-04 (gateway and feedback)
11. E5-01, E5-04, E5-06 (conversation)
12. E6-01, E6-04 (streak and notifications)

**Backend wave (M1):** E1-12, E1-13, E1-14, E1-15, E1-16, E1-17, E1-20,
E1-22, E1-23, E1-24, E1-25, E1-26, E1-27, E1-28.

**Adaptive wave (M2-M3):** E2-10, E2-12, E2-13, E4-12, E4-13, E4-14, E5-13.

**Adaptive content wave (M3):** E15-01, E15-02, E15-03, E15-04, E15-05, E15-06, E15-07,
E15-08, E15-09, E15-10.

**Hardening wave (M6):** E8-12, E13-01, E13-03, E14-01, E9-03, E9-04.

**Media wave (M5.5):** E12-01, E12-02, E12-03, E12-04, E12-05, E12-06, E12-07, E12-09, E12-10.

## Definition of Ready

A story is ready if: it has a verifiable acceptance criterion, it is in the correct layer,
it does not require a new ADR, it has the necessary data/schemas, and it has a test plan.

## Definition of Done

See `AGENTS.md`. In short: tests, typecheck, lint, migration, UI states, updated docs,
no secrets, AI cost logged.
