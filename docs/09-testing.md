# Testing and quality

> **Online-first (ADR-023).** Offline/SQLite/PowerSync references in this document are
> superseded: the app requires connectivity and has no local write queue.

Primary agent entry point: `node tools/verify/verify.mjs --level=fast|core|full`.
See `docs/15-agent-workflow.md` for the autonomous loop and `tools/verify/README.md` for levels.

## 1. Test pyramid

```
        /\
       /e2e\        Playwright (web), Maestro (Android)
      /------\
     /  ui    \     React Native Testing Library
    /----------\
   /  domain   \   Vitest (packages/core) — the core
  /--------------\
 / prompt eval    \ tools/eval — AI quality and cost
/------------------\
```

The domain is the most tested part: it is deterministic, fast, and contains the rules that
determine pedagogical quality.

## 2. Tests per layer

### 2.1 `packages/core` (Vitest)

- **Elo**: convergence, symmetric update, effect of `K`.
- **Stop rule**: item and standard-error limits.
- **CEFR**: monotonicity, intervals, boundary cases.
- **Curriculum**: session quotas, prerequisites, micro-loop, incremental patches.
- **FSRS**: ratings, intervals, card dedupe, recognition/production separation.
- **Errors**: taxonomy, three-occurrence threshold, dedupe.
- **Gamification**: valid day, grace, repair, anti-grinding, quests.
- **Conversation**: level calibration, recast policy, correction filter.
- **Property tests** with `fast-check`: no inconsistent state after N random events.

Property example: "after any sequence of 200 valid attempts, `se` is in (0,1] and `theta`
is finite".

### 2.2 `packages/db`

- Migrations from an empty DB.
- Migrations from a fixture of the previous version.
- Invariants: one card per `(user, item, card_type)`; append-only respected.
- Transactions: a mid-way error leaves no partial state.
- Query performance on 10k attempts (declared threshold).

### 2.3 `packages/ai`

- Zod validation of every output.
- Repair loop: 0, 1, 2 attempts and fallback.
- Cache: hit/miss, correct key, TTL.
- Cost calculator with a price table pinned in tests.
- Budget guard: blocks at the limit and records `budget_blocked`.
- No keys in logs (serializer test).

### 2.4 UI

- React Native Testing Library for key components and screens.
- States: loading, empty, error, permission denied, network unavailable.
- Accessibility: labels present, ≥ 44px targets where measurable.
- Snapshots only for stable layouts, never as the only test.

### 2.5 E2E

- **Playwright (web)**: onboarding -> short assessment -> session -> export.
- **Maestro (Android)**: launch, session, microphone permission denied.
- E2E with mocked AI (fixtures), plus a manual test against a real provider.

### 2.6 Language and locale

- No hardcoded language names in prompts or system templates (static test).
- Every prompt receives `targetLang`, `nativeLang`, and `explanationMode`; content queries
  filter by the active `target_lang`.
- `rule_id` values are namespaced and validated against the active `target_lang`.
- STT adapters receive the language code derived from `target_lang`; TTS receives the
  locale/voice from the profile.
- i18n: key parity between locales, missing-key failure, pseudo-locale build, ICU plurals,
  and `Intl` date/number formatting.
- Pair isolation: content for `en` never leaks into another target language.
- Phase 1 runs the suite with `en` target, `it` native, `it` UI; the same suite is reusable
  for a second pair.

### 2.7 Media recommendations

- Ranking is deterministic with an injected seed; the same inputs produce the same order.
- Level fit: top picks have coverage 0.88-0.97 (fixture titles).
- Diversity: top 5 has at least 4 distinct genres when the taste profile is broad.
- Rejected/finished titles are excluded for 90 days.
- Only titles with legal availability in the learner's region are shown.
- No piracy links, no full transcripts, no subtitle dumps in catalog or guides.
- Spoiler heuristic passes on sampled reasons/guides; human spot-check on 10%.
- Feedback updates taste weights and difficulty target; too-hard lowers coverage target.
- Post-media reflection counts as production and creates SRS cards from saved phrases.
- Dedup: the same phrase does not create two cards.

### 2.8 AI safety

- Prompt-injection suite: ignore instructions, reveal system prompt, fake rule ids, HTML/JS,
  piracy request, spoiler request, medical advice, language switch.
- No tools, no browsing, no file access in prompts or adapters.
- Schema gates reject malformed corrections/plans/guides.
- Moderation fallback returns a safe deterministic message and logs `moderated`.
- No secret or key appears in prompts, logs, or fixtures.
- Unsafe output is never shown; the raw output is not persisted.
- Rate-limit and circuit-breaker behavior tested.

### 2.9 Privacy, consent, content

- AI calls and microphone are blocked without `ai_processing`/`voice` consent.
- Retention jobs delete audio and expired transcripts; logs contain no PII.
- Export/delete run end to end, including taste and recommendation history.
- Encryption at rest smoke test on native (file not readable without the key).
- Only `approved` items are served; retired items are not selected.
- Content packs reject items missing license/review status.

### 2.10 Performance and operations

- Load test: 10k attempts, 2k SRS cards, 1k saved phrases; session open within budget.
- Cold start and web bundle size within budget.
- Backup/restore drill and migration rollback on a clean device.
- Event schema validation; no PII in event payloads.
- Alerts fire on simulated cost, provider, eval, and migration failures.

### 2.11 Auth, sign-in, and RLS

- Anonymous session upgrades to email without losing local or server data.
- A fresh session signs in with email and restores the server profile and progress.
- Sign out, then sign in again: the same data returns.
- Two users: user B cannot read or write user A's rows (RLS on every table).
- Device revoke invalidates the session on that device.
- Hono API rejects missing/expired JWT and enforces per-user quotas.
- Network loss during a write produces a clear error and no partial local state.

### 2.12 Adaptive A1-C1

- Placement can return any band A1-C1 with an interval.
- Known concepts (mastery ≥ 0.85, se ≤ 0.25) are skipped; no "new" item is served.
- "Too easy" triggers a challenge, not automatic promotion.
- Promotion requires evidence; failure keeps the current level and adds a review.
- Lower-level gaps trigger remediation, not demotion; `level_events` records both.
- C1 items/passages are validated for level, register, and absence of protected text.
- A learner placed at B2 is not shown A1/A2 teaching items unless remediation is triggered.

### 2.13 Adaptive content

- Planner prefers foundation/cache; generation only on a defined trigger.
- No generation for known concepts (mastery ? 0.85) or without network.
- Generated items pass schema, rule-bank, uniqueness, level, safety, and copyright gates.
- Private items are owner-scoped, expire, and are not served to other users.
- Dedupe by spec hash; repeated requests hit cache.
- Caps and deterministic fallback are enforced; a failed generation never blocks a session.
- Human sample/promotion path works; promoted items enter the global bank.
- Adaptive ratio and generation cost stay within target.

## 3. Prompt evals

See `docs/06-ai-harness.md`. In short:

- Versioned golden set with cases and criteria, keyed by `(targetLang, nativeLang)`.
- `pnpm eval --prompt=<id>` produces a JSON report (live, sampled, needs keys).
- `pnpm eval:recorded --prompt=<id>` replays fixtures; used in CI with no network or cost.
- Both are keyed by `(targetLang, nativeLang)` and run for `en-it` in phase 1.
- Adaptive content golden set: 30 `ContentRequest`s with level, rule-bank, uniqueness, and
  safety expectations.
- CI gate: pass rate below threshold = PR blocked.
- Periodic calibration against human judgment on a sample.
- Every correction shown to the learner must pass: valid `span`, valid `rule_id`,
  `confidence ≥ 0.7`.

## 4. CI

PR pipeline (also in `.github/workflows/verify.yml`):

0. `node tools/verify/verify.mjs --level=core --strict` (or run the steps below individually)
1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test:ci` (unit + coverage)
4. `pnpm supabase:start && pnpm supabase:reset` (migrations + RLS + seed)
5. `pnpm db:migration-test` (previous-version upgrade keeps fixtures)
   and `pnpm db:backup-drill` (local dump/restore into a throwaway database)
6. RLS two-user isolation tests
8. `pnpm db:check` (Postgres schema drift)
9. `pnpm eval:recorded` (fixtures, no network, no cost) for prompt/content changes
10. Prompt-injection red-team suite
11. Web build
12. (nightly) `pnpm eval` live sampled, Playwright, Maestro, load tests

Rules:

- Minimum coverage: `core` ≥ 85%, `db` ≥ 70%, `ai` ≥ 70%. Not a goal in itself, but below
  these thresholds the safety net is missing.
- No test calls the network in CI.
- Fixtures contain no PII and no keys.

## 5. Manual tests

### 5.1 Session checklist

- [ ] First launch without network: clear message, no broken state.
- [ ] Anonymous session upgrades to email without losing data.
- [ ] Fresh session: sign in with email and get the profile and progress back.
- [ ] Device revoke invalidates the session.
- [ ] RLS: user B cannot read or write user A's rows.
- [ ] Full assessment in 12-18 minutes, plausible result.
- [ ] Session with 2 errors: clear feedback, no punishment.
- [ ] Exit and resume mid-session.
- [ ] Conversation with microphone denied: text alternative.
- [ ] Conversation with no network: message and fallback.
- [ ] AI budget exhausted: conversation disabled, deterministic exercises remain.
- [ ] Export and import: identical data.
- [ ] Timezone change: dates and streak consistent.

### 5.2 Release checklist

- [ ] `typecheck`, `lint`, `test` green on Node 26 LTS.
- [ ] Migrations from scratch and from the previous version.
- [ ] RLS two-user isolation green.
- [ ] Sign-in restores the server profile after a fresh session.
- [ ] Web and Android E2E green.
- [ ] `pnpm eval` green with report.
- [ ] `pnpm eval:recorded` green in CI; live eval sampled and capped.
- [ ] Prompt-injection red-team and moderation tests green.
- [ ] Consent, retention (`pnpm ops:retention` dry-run plus `--apply` on staging), export,
      import, and delete verified end to end.
- [ ] Media: legal availability, no piracy, no spoilers, no full transcripts.
- [ ] Backup/restore and migration rollback tested.
- [ ] Load/performance and event schema checks green.
- [ ] Average cost/day measured and within budget.
- [ ] No secret in the repo, logs, or fixtures.
- [ ] Privacy: audio deleted, export available, delete works.
- [ ] Language profile applied (target/native/UI/explanation mode); no hardcoded copy.
- [ ] Accessibility: contrast, targets, screen reader on key actions.
- [ ] Performance: cold start and session open within budget.
- [ ] Documentation updated (schemas, prompts, behaviors).

## 6. Cost regression tests

- Fixture of 20 representative conversations.
- Cost calculation with the current price table.
- Gate: average cost per conversation ≤ €0.10 and per item ≤ $0.002.
- If a prompt or model change exceeds the gate, the PR must declare and justify it.

## 7. Security tests

- Secret scanning in CI.
- Test that the web bundle contains no keys (`grep` on the build).
- Test that the Worker rejects models not in the allowlist.
- Test that logs contain no user text (only hashes).
- Rate-limit and circuit-breaker tests.

## 8. Accessibility tests

- AA contrast on all text tokens.
- Keyboard navigation on web (visible focus, logical order).
- Screen reader on Today, player, chat, progress.
- Reduced motion respected.

## 9. Test data

- Synthetic user fixtures with A1, A2, B1, B2, C1 profiles.
- Reduced test item bank (30 items), versioned.
- Synthetic transcripts for conversation and correction.
- No real data, no real audio in fixtures.

## 10. Flaky test handling

- A flaky test is fixed or removed within 48h, not retried forever.
- Unstable E2E: isolate the cause (timing, network, animations) before increasing timeouts.
- Eval tests are not 100% deterministic: use thresholds and multiple samples, not equality.
