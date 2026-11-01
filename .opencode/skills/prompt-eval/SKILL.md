---
name: prompt-eval
description: Use when changing prompts, golden sets, model routing, eval thresholds, AI cost, or correction quality. Triggers include prompt, eval, golden set, LLM judge, model, cost, schema error, moderation.
---

# Prompt and eval workflow

## Change a prompt

1. Edit `docs/prompts/<id>.md` and `packages/ai/prompts/<id>.ts`.
2. Bump `version`.
3. Update the golden set if the contract changes.
4. Run `pnpm eval:recorded --prompt=<id>` (no network, CI).
5. Run `pnpm eval --prompt=<id>` (sampled, live) before release.
6. Report pass rate, key metrics, average cost in the commit/PR.

## Gates

| Metric | Target |
|---|---|
| Schema valid | ≥ 99% |
| Unique/grammar correct | ≥ 95% / ≥ 97% |
| Correction precision | ≥ 97% |
| Correction recall | ≥ 80% |
| CEFR/level fit | ≥ 90% |
| Media spoiler-free | 100% |
| No protected text | 100% |
| p95 latency | within budget |
| Cost/item | ≤ $0.002 |

## Rules

- Output always Zod-validated; no invalid data enters the DB.
- Max 2 repairs, then deterministic fallback.
- Corrections need exact `span`, valid `rule_id`, confidence ≥ 0.7.
- No secrets, prompts, or transcripts in logs.
- Prompt injection/moderation red-team cases must pass.
- Live eval only with `--live`; CI uses recorded fixtures.
- Keep prompts cache-friendly: stable prefix, variable suffix.
