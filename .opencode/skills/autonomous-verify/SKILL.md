---
name: autonomous-verify
description: Use when implementing, fixing, or claiming a task done; run the verification harness and report compact pass/fail/skip. Triggers include test, tests, verify, CI, build, typecheck, lint, RLS, sync, eval.
---

# Autonomous verification

## Commands

```bash
node tools/verify/verify.mjs --level=fast
node tools/verify/verify.mjs --level=core
node tools/verify/verify.mjs --level=full
node tools/verify/verify.mjs --level=nightly --live
node tools/verify/verify.mjs --only=typecheck,lint --json
```

## Loop

1. Read the spec and the smallest relevant code.
2. Write/update tests first.
3. Run targeted tests.
4. Run `--level=fast` after edits.
5. Run `--level=core` before claiming done.
6. Run `--level=full` before a PR/release candidate.
7. On failure: fix, rerun the failing step, then the full level.

## Rules

- Never claim done if `core` failed or a required script is missing.
- Missing script = SKIP unless `--strict`; never invent a pass.
- Do not weaken or delete a test to make it pass without a documented reason.
- No network by default; live AI eval only with `--live` and keys.
- Use local Supabase; never production data.
- Two users for RLS.
- Artifacts/reports go to `.verify/` (gitignored).
- Paste only the harness summary and the failure excerpt.

## Report

```
Tests: verify level=core pass=8 fail=1 skip=0
Fail: unit tests — <first error line>
Next: fix <file:line>, rerun core
```
