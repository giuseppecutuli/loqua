# Autonomous verification harness

One command for agents to test the repo without guessing. Compact output, no network by
default, and a clear pass/fail/skip contract.

## Commands

```bash
node tools/verify/verify.mjs --list
node tools/verify/verify.mjs --level=fast
node tools/verify/verify.mjs --level=core
node tools/verify/verify.mjs --level=full --report=.verify/report.json
node tools/verify/verify.mjs --level=nightly --live
node tools/verify/verify.mjs --only=typecheck,lint --json
```

`pnpm verify` calls `node tools/verify/verify.mjs --level=fast`; `pnpm verify:core`
runs the `core` level.

## Levels

| Level     | Runs                                                                                 | Use                           |
| --------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| `fast`    | typecheck, lint, unit, schema drift                                                  | after every edit              |
| `core`    | fast + Supabase reset, RLS two-user, Postgres account/placement smoke, recorded eval | before claiming done          |
| `full`    | core + web build + web E2E                                                           | before a PR/release candidate |
| `nightly` | full + mobile E2E + sampled live eval                                                | scheduled / before release    |

## Output contract

- One line per step: `PASS/FAIL/SKIP <label> (<seconds>)`.
- Failures print a compact excerpt (important lines + last 25, capped at 40 lines).
- Final summary: `pass=N fail=N skip=N in Xs`.
- `--json` prints a machine-readable report.
- Missing scripts are `SKIP` unless `--strict` or the level requires them.
- Exit code 1 if any step fails; 0 otherwise.

This is the only output an agent should paste back. Do not dump full logs.

## Test matrix

| Area     | Test                                                                      |
| -------- | ------------------------------------------------------------------------- |
| Domain   | Elo convergence, FSRS, planner, SRS ops, content planner, recommendations |
| DB       | Postgres migrations, account/placement store, invariants                  |
| RLS      | user B cannot read/write user A, content review gating                    |
| Sync     | offline write merge, SRS replay, conflict log, device revoke              |
| AI       | Zod, repair, cache, budget, prompt injection, moderation                  |
| Content  | foundation-first, generation triggers, private TTL, caps, promotion       |
| Adaptive | placement A1-C1 selection, stop rule, CEFR intervals                      |
| Media    | level fit, diversity, no piracy, no spoilers, feedback                    |
| i18n     | key parity, pseudo-locale, Intl formatting                                |
| E2E      | onboarding, session, export, two-device, mic denied                       |
| Ops      | backup/restore, migration rollback, event schema                          |

## Fixtures

- Synthetic users A1-C1; two users for RLS.
- Foundation item bank fixture; generated-item fixtures.
- Two-device Playwright contexts.
- Recorded AI responses for CI; no network.
- Deterministic seeds and injected clocks.

## Rules

- Never claim done if `core` failed or was skipped for a missing required script.
- Run targeted tests first, then `core`, then `full` before release.
- Do not use live AI eval in CI; use `eval:recorded`.
- Do not paste full logs; paste the harness summary and the failure excerpt.
- If a command is missing, report it; do not invent a passing result.
