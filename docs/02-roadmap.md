# Development roadmap

Estimates for a solo developer working part-time (10-15 h/week). Estimates include tests and
documentation, not build wait time. Total to M7: ~23-27 weeks, including M5.5, the backend
work moved into M1, adaptive content, and the hardening work added after the gap audit. The
order is designed to get a usable loop as early as possible and to reduce technical risk.

## Sequencing principles

1. Backend + auth first: two devices must never diverge.
2. Server-backed loop next: Postgres is the source of truth; writes require connectivity.
3. Assessment before curriculum: A1-C1 placement drives what to skip.
4. Text before voice: STT is the piece with the most platform variability.
5. Gamification comes after the loop works: do not mask an empty product.

## M0 - Planning and harness (1 week) - DONE

**Goal.** Lock decisions, requirements, and conventions before writing code.

**Deliverables.**

- PRD, roadmap, backlog, architecture, adaptive engine, data schema.
- Content ops, media recommendations, safety/privacy, observability/ops.
- AI harness: prompt specs, golden set format, eval rules.
- Agent workflow: token efficiency, project skills, autonomous verify harness, context pack.
- `AGENTS.md` with workflow and definition of done.

**Exit criteria.**

- [ ] Decisions in `docs/00-decisions.md` are accepted.
- [ ] The P0 backlog is ordered and has no circular dependencies.
- [ ] A draft DB schema can be applied to an empty DB.
- [ ] A cost plan exists with a < €20/month scenario.
- [ ] `tools/verify` runs fast/core/full and reports SKIP honestly.

**Risk.** Over-planning. Timebox: if a document does not change a decision, shorten it.

---

## M1 � Backend, auth, and onboarding (4 weeks) - DONE

**Goal.** An installable app on Android and Web, with one account, multi-device server state, onboarding, and backup. Online-first by ADR-023.

**Scope.**

- pnpm + Turborepo monorepo: `apps/app`, `packages/{core,db/postgres,ui,content,ai}`,
  `supabase/{functions,migrations,seed}`, `tools/*`.
- Node 26 LTS pinned in `.nvmrc`/`engines`; Expo SDK 58 + expo-router + TypeScript strict.
- Root scripts including `verify` -> `tools/verify/verify.mjs`; CI uses `--level=core --strict`.
- Self-hosted Supabase stack: Postgres schema, Auth, RLS, Storage.
- VPS bootstrap: Docker Compose, Caddy/TLS, SMTP for magic links, backups, Uptime Kuma.
- Hono API (Node 26) with AI gateway stub, export/delete, JWT verification.
- Canonical Drizzle schema + migrations.
- Supabase Auth: anonymous first run, email magic link upgrade; `devices` and revoke.
- Language profile fields and i18n scaffold (locale catalogs, fallback `it -> en`).
- `learner_profiles` with timezone, onboarding state, goal, daily minutes, streak mode.
- Consent records for terms, privacy, voice, AI processing, analytics.
- Onboarding: goal, time/day, self-assessment, interests.
- Navigation shell: Today, Practice, Talk, Progress, Settings.
- Server-side export/delete and backup.
- CI: Supabase start/reset, migrations, RLS two-user tests, typecheck, lint, test, web build.

**Exit criteria.**

- [ ] `pnpm android` and `pnpm web` run the app on a real device and in the browser.
- [ ] Two devices signed into the same account see the same server state after refresh; writes require connectivity.
- [ ] RLS test: user B cannot read or write user A's rows.
- [ ] Anonymous session upgrades to email without losing data; devices can be revoked.
- [ ] Onboarding persists to Postgres and survives a restart.
- [ ] Export carries `format_version` and a checksum; unknown versions are rejected.
- [ ] Web works as a standard static SPA (no COOP/COEP requirement).
- [ ] VPS runbook: TLS, SMTP magic link, backup/restore, firewall, logs.
- [ ] Hono API rejects invalid JWT and logs AI cost server-side.
- [ ] CI is green on a test PR.

**Included spikes (1-day timebox each).**

- SPIKE-1: Node 26 LTS on Expo/EAS + `ts-fsrs` v6.
- SPIKE-2: Supabase local + RLS + anonymous-to-email upgrade.
- SPIKE-5: TTS `SpeechSynthesis` on Android WebView/browser.
- SPIKE-6: Hono API + Supabase JWT + SSE streaming.
- SPIKE-7: self-hosted Supabase memory fit on CX32/8 GB.

---

## M2 — Assessment and learner model (2-3 weeks) - IN PROGRESS

**Goal.** On first launch, the app estimates the level and produces a credible gap profile.

**Content scale.** The 600/200 figures below are the M2 baseline. The private-beta coverage
target is **2,400 practice + 600 assessment** plus 300 listening, 150 speaking and 100 writing
tasks (`docs/17-learning-experience.md`). The baseline gate protects the current bank; the beta
gate is tracked separately until the content catches up.

**Scope.**

- Knowledge graph: A1-C1 concepts with prerequisites; IT->EN error taxonomy.
- Can-do catalog, rubric anchors (A1-C1), and placement test blueprint (`docs/04` §3.6-3.7).
- Assessment persistence in `assessments` and `assessment_scores`.
- Item bank v0: ≥ 600 items across A1-B1 + starter B2, calibrated, scoped to `target_lang=en`.
- Assessment bank: 200 items across A1-C1, separate pool.
- Test-out and challenge logic: skip known concepts, challenge the next band, promotion on evidence.
- Item review pipeline: automated gates + 10% human sample (`docs/11-content-ops.md`).
- Item difficulty calibration job v1.
- Placement test: 18-24 adaptive items + 1 writing + 2 speaking (STT).
- Elo per micro-skill with `se`; CEFR mapping with intervals.
- Writing/speaking rubrics (prompt + Zod validation).
- Result screen: level per skill, strengths, 3 priorities.
- Domain tests: Elo convergence, stop rule, CEFR mapping.

**Exit criteria.**

- [ ] The test lasts 12-20 minutes and produces an A1-C1 level + interval for 7 skills.
- [ ] Estimates are reproducible with the same response set (deterministic test).
- [ ] At least 600 practice items and 200 assessment items validated against the schema.
- [ ] Only `approved` items are served; review status is enforced in queries.
- [ ] Every assessment persists per-dimension scores, confidence, and prompt version.
- [ ] Test-out skips known concepts and never serves "new" items for mastery ≥ 0.85.
- [ ] A lower-level gap triggers remediation, not demotion, and is logged in `level_events`.
- [ ] The calibration job updates difficulty on a fixture and retires extreme items.
- [ ] The initial profile generates 3 priorities the learner can understand.

**Risk.** Poor item bank and C1 quality. Mitigation: phased content, eval harness, human
spot-check on 30 items per level.

---

## M3 — Daily loop, FSRS, and error bank (3 weeks) - COMPLETE

**Goal.** A complete daily session, with review and adaptation.

**Scope.**

- Session selection: 40% SRS review, 30% new input, 30% production; skip known concepts.
- Content wave B1/B2: item bank expansion and can-do units.
- Adaptive content planner: foundation/cache first; `content.generate` only on a trigger.
- Private generated items (`owner_user_id`, TTL), validation, dedupe, promotion to global.
- Generation caps and deterministic fallback.
- `session_items` with order, block, rationale, and status; `sessions.status` for resume.
- FSRS-7 with `ts-fsrs`: separate recognition and production cards.
- SRS operational rules: leech/suspend, hint penalty, answer tolerance, review backlog cap.
- Saved phrases and user-generated cards (`saved_phrases` -> SRS).
- User feedback on exercises and corrections (`user_feedback`).
- Content packs with checksum, update, and rollback.
- Exercise player (8 types), feedback, explanations in simple target language.
- Error bank: dedupe, counts, micro-drill trigger after 3 occurrences in 14 days.
- Test-out, challenge items, promotion, and remediation blocks (`level_events`).
- Curriculum planner v1: 2-week plan validated against the knowledge graph.
- "Why this exercise?" (deterministic rationale).
- Online-first: the session requires connectivity; no offline queue.

**Exit criteria.**

- [ ] 20 simulated sessions produce no inconsistent state (property tests).
- [ ] Cards are scheduled with FSRS and reviews are append-only.
- [ ] A repeated error generates a drill within one session.
- [ ] Known concepts are skipped; no new item for mastery ≥ 0.85.
- [ ] 70-80% of session items come from foundation/cache; 20-30% generated/personalized.
- [ ] No generation for known concepts or without connectivity.
- [ ] Generated items are private, validated, deduped, and expire; promotion requires review.
- [ ] Generation caps and deterministic fallback are enforced.
- [ ] Lower-level gaps create remediation, not a level reset; events are logged.
- [ ] Session resume restores pending items, not just a blank screen.
- [ ] A hint lowers the rating and a backlog cap is enforced.
- [ ] Saved phrases and feedback are persisted and exported.
- [ ] A session started on one device appears on the other after refresh.
- [ ] Content pack update/rollback preserves attempts and SRS history.
- [ ] The loop works online; network loss is reported clearly.
- [ ] Core-loop AI cost = 0 (local item bank only).

---

## M4 — AI conversation and voice (3 weeks) - IN PROGRESS

**Goal.** Speak and write with a tutor that adapts, with useful feedback.

**Scope.**

- Conversation orchestrator: scenario, goal, turn, level (A1-C1).
- 10 scenarios across levels: bar, doctor, airport, small talk, standup, code review,
  interview, complaint, phone call, travel. Titles in the native language, dialogue in the
  target language.
- C1 content wave: complex texts, idioms, register, nuance, fast speech, accent variety.
- Text input + AssemblyAI streaming STT with Web Speech fallback; STT language code and TTS
  voice derived from the language profile.
- Audio pipeline: VAD/silence detection, bounded chunk size, latency budget per stage.
- Context window: last 6-8 turns + summarized older turns; hard token cap per turn.
- Prompt-injection defenses, moderation, and no-tool policy (`docs/13-safety-privacy.md`).
- Consent gates for AI processing and voice; Hono JWT auth, rate limits, quotas.
- Browser-first TTS for responses; audio cache for target phrases.
- Post-hoc corrector with constrained JSON, `span` check, and `rule_id`.
- End-of-session report: errors, useful phrases, 2 focus points.
- Confirmed errors -> SRS + drills.
- Per-call cost logging and daily budget.

**Exit criteria.**

- [ ] A 10-turn conversation stays within the target level (eval on 20 transcripts, A1-C1).
- [ ] No correction is shown without a valid `rule_id` (test).
- [ ] p95 time-to-first-token ≤ 2.5 s on 4G.
- [ ] Average cost of a 10-minute session ≤ €0.10.
- [ ] Fallback works if AssemblyAI is unavailable.
- [ ] Prompt-injection red-team cases pass; unsafe output is moderated.
- [ ] Conversation stays under the token budget with summarized context.
- [ ] AI and voice are blocked without the corresponding consent.
- [ ] Hono JWT auth and per-user quotas are tested.
- [ ] A conversation started on one device is visible on the other after refresh.

---

## M5 — Gamification, notifications, and progress (2 weeks) - COMPLETE

**Goal.** Make consistency desirable without punishing mistakes.

**Scope.**

- Production streak with grace day and repair through conversation.
- Anti-grinding XP; levels per skill.
- 3 daily quests + weekly mission.
- Badges/awards (real milestones).
- Event-based notifications: review ready, streak at risk, mission, media pick.
- Notification permission flow, deep links, timezone/DST handling.
- Progress: skill radar, CEFR trend, calendar, error heatmap.
- "Week" summary screen.
- Event taxonomy + basic dashboards/SLOs (`docs/14-observability-ops.md`).

**Exit criteria.**

- [x] Notifications respect max 2/day and quiet hours (scheduler test).
- [x] The streak does not break because of an error or an incomplete session.
- [x] XP does not increase from repeating the same item.
- [x] The radar reflects real data (fixture test).
- [x] Notification permission denied is handled without repeated prompts.
- [x] A timezone/DST change re-plans future notifications.
- [x] Core funnel events are emitted with no PII.

---

## M5.5 - Watch & Read recommendations (2 weeks) - COMPLETE

**Goal.** Recommend movies, series, and books that fit level and tastes, explain why, learn
from feedback, and turn consumption into practice.

**Scope.**

- Media catalog v0: 50 titles across A1-C1 (movies, series, books) with metadata, difficulty estimates,
  tags, age ratings, content warnings, and legal regional availability.
- Taste onboarding: formats, genres, themes, difficulty tolerance, subtitles, weekly time,
  region; editable and resettable.
- Deterministic ranking in `packages/core` (level fit, taste, quality, diversity, freshness)
  with exploration.
- `media.explain` reason and `media.guide` (before/during/after), spoiler-free.
- Feedback loop: accepted, rejected, too easy/hard, finished, abandoned; taste update.
- Media progress, weekly immersion plan, and "next step".
- Post-media reflection (60 s spoken / 80 words written), phrase saving, and SRS cards.
- Immersione UI inside Pratica; legal/age/region guards.
- Eval set: 50 titles, 10 taste profiles, 5 regions; no-piracy and no-spoiler checks.

**Exit criteria.**

- [x] Ranking is deterministic and level fit is 0.88-0.97 for ≥ 90% of top picks.
- [x] Every shown recommendation has legal availability in the learner's region.
- [x] Rejection and too-hard feedback visibly change the next recommendations.
- [x] No full transcripts, no piracy links, no spoilers in sampled guides.
- [x] Post-media reflection counts as production and saves phrases to SRS.
- [x] Recommendation cost < $0.01/day per active user.

**Risk.** Catalog quality and availability staleness. Mitigation: 50 carefully curated titles,
quarterly re-checks, and a human spot-check of 10% of guides.

---

## M6 — Hardening, iOS, and managed fallback (2-3 weeks)

**Goal.** Robustness across devices and networks, plus a managed fallback path.

**Scope.**

- Automatic local backup + versioned export/import.
- Auth hardening: device revoke, session invalidation, backups.
- Managed fallback: document/test migration to Supabase Cloud.
- iOS build (EAS) and TestFlight.
- E2E: Playwright (web), Maestro (Android); two-device server-state scenarios.
- Full eval harness in CI, budget guard, circuit breaker.
- Recorded eval in CI; sampled live eval before release.
- Encryption at rest, retention jobs, consent audit, DPIA/AI Act review, privacy policy/terms.
- Load/performance tests, backup/restore drill, migration rollback plan.
- Sentry, SLO dashboards, cost/quality alerts, runbooks (`docs/14-observability-ops.md`).
- i18n key parity, pseudo-locale build (`en-XA`), and locale-aware formatting tests.
- Accessibility and performance pass.

**Exit criteria.**

- [ ] Migration from empty DB and from the previous version tested.
- [ ] No sync conflict log is needed; server state is authoritative.
- [ ] Two devices see the same server state; SRS cards recomputed server-side.
- [ ] Device revoke invalidates the session.
- [ ] E2E green on web and Android, including two-device server-state scenarios.
- [ ] `pnpm eval` green and weekly cost within budget.
- [ ] `pnpm eval:recorded` is green in CI; live eval is sampled and capped.
- [ ] Encryption, retention jobs, and consent gates verified.
- [ ] Backup/restore and migration rollback tested.
- [ ] VPS runbook (Caddy, backups, upgrades, SMTP) tested on a clean server.
- [ ] Managed fallback migration documented and smoke-tested.
- [ ] SLO dashboards and alerts are live; Sentry reports crash-free sessions.

---

## M7 — Desktop, release, and polish (2 weeks)

**Goal.** Desktop distribution and final polish.

**Scope.**

- Tauri v2 wrapper around the web build; native notifications.
- Windows installer; macOS/Linux if required.
- Static web hosting.
- Refined onboarding, copy, empty states, error states.
- User documentation and privacy notes.
- Store readiness (Android; iOS if publishing).

**Exit criteria.**

- [ ] Working desktop installer on Windows.
- [ ] Web deployed with verified OPFS persistence.
- [ ] Release checklist in `docs/09-testing.md` completed.

---

## Dependencies and critical path

```
M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M5.5 -> M6 -> M7
                \-> (item bank) -/
                     M3 -> M4 (shared error bank)
                          M4 -> M5 (production streak)
                               M5 -> M5.5 (media habits)
                                    M6 -> M7 (web build for Tauri)
```

- M2 blocks M3 (no adaptive selection without a learner model).
- M3 blocks M4 (the error bank feeds conversation).
- M5.5 needs the content catalog and the learner/taste profile from M2-M5.
- Online-first by ADR-023; there is no sync layer to harden. M6 covers auth/device hardening and managed fallback.
- iOS can move earlier (M5) if a Mac is available.

## Things to defer without guilt

- Leaderboards and social features.
- Subscriptions and paywalls.
- Other users and roles.
- AI providers beyond the gateway.
- Phoneme-level pronunciation analysis.
- Widgets and Watch apps.

## Progress metrics

Each milestone closes with:

1. A recorded demo (web + Android).
2. `pnpm typecheck && pnpm test && pnpm lint` green.
3. `docs/` updated for changed contracts.
4. An AI cost estimate for the milestone.
