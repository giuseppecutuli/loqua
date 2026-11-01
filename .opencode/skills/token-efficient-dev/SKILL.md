---
name: token-efficient-dev
description: Use for any coding task when output, reads, logs, or context must stay lean. Triggers include token, tokens, caveman, concise, read less, logs, context, compact, performance, speed.
---

# Token-efficient development

Adopt the useful parts of Caveman; reject the gimmick.

## Rules

- Answer first: `[thing] [action] [reason]. [next step].`
- No greeting, no recap of the prompt, no restating code.
- Keep code, commands, paths, errors, and numbers character-for-character.
- One idea per sentence. No emojis.
- If brevity would hide a security warning or an irreversible action, use full sentences.
- Never compress source, specs, prompts, or config that must be exact.

## Reads

1. Start from `docs/16-agent-context.md`.
2. Locate with `grep`/`glob`; read the smallest useful window.
3. `git diff --stat` before `git diff`; open only changed files.
4. Do not read lockfiles, build output, coverage, or generated artifacts.
5. Batch independent reads/tool calls.

## Commands

- Targeted tests first: `pnpm test:ci -- <path>`.
- Compact reporters: Vitest `--reporter=dot`, Playwright `line`.
- Final signal: `node tools/verify/verify.mjs --level=fast|core`.
- Summarize failures; never paste full logs.
- Use `--json` only when a machine needs it.

## Prompt cache

- Stable system/instructions first, stable context next, variable task last.
- Do not reorder or rewrite the prefix between turns.
- Reuse prompt versions; bump intentionally.

## Report

```
Changed: <files/layers>
Tests: verify level=core pass=... fail=... skip=...
Risk: <one line>
Next: <one line>
```

## Caveman verdict

Adopt: answer-first, payload verbatim, read less, reusable scripts, cache-friendly prompts.
Reject: `/megacave`, broken grammar, telemetry/proxy, auto routing.
