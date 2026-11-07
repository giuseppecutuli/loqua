# Agent workflow: token efficiency, skills, and autonomous testing

How coding agents work in this repo. Complements `AGENTS.md` and `docs/09-testing.md`.

## 1. Caveman evaluation

[Caveman](https://github.com/JuliusBrussee/caveman) is a token-reduction skill/proxy. We adopt
its principles, not its gimmick or telemetry.

| Component | Verdict | Why |
|---|---|---|
| Answer-first, short output | **Adopt** | Less output, same decisions. |
| Payload verbatim (code, commands, paths, errors) | **Adopt** | Compression must never corrupt code. |
| Read less (logs, JSON, test output) | **Adopt** | Use the verify harness and compact commands. |
| Blocks / code mode (reusable scripts) | **Adopt** | `tools/verify`, summary scripts. |
| Prompt cache-friendly structure | **Adopt** | Stable prefix, variable suffix, no reordering. |
| Context/memory compression | **Adopt, limited** | `docs/16-agent-context.md`; never compress specs blindly. |
| `/megacave`, 文言文, "me think" | **Reject** | Clarity and safety beat token theater. |
| Auto model routing | **Reject for dev** | Our app has its own tiers; coding agent routing is out of scope. |
| Proxy / telemetry / cloud | **Reject** | Self-hosted, no third-party telemetry. |
| Browse compression | **Optional** | Useful for research; not part of the build loop. |

Rules adopted:

- Answer first: `[thing] [action] [reason]. [next step].`
- One idea per sentence; no greetings, no recap of the prompt.
- Keep code, commands, paths, and errors character-for-character.
- If brevity would remove a security warning or an irreversible action, use full sentences.
- Never compress prompts or source files that the model must reason about precisely.

## 2. Token-efficiency rules

Before reading:

- Start from `docs/16-agent-context.md`; open full docs only when the task needs them.
- Locate with `grep`/`glob`; read the smallest useful window.
- Do not read generated artifacts, lockfiles, or build output.
- Use `git diff --stat` first; open only changed files.

While working:

- Batch independent reads/tool calls in one message.
- Run targeted tests first (`pnpm test:ci -- path`), then the full level.
- Prefer compact reporters (`vitest --reporter=dot`, `playwright --reporter=line`).
- Use `node tools/verify/verify.mjs` for the final signal; paste its summary, not raw logs.
- Never paste a whole log; use the failure excerpt.
- Keep prompts cache-friendly: system/instructions first, stable context next, variable task last.
- Do not repeat code in prose; reference `file:line`.
- No emojis, no filler, no "let me".
- `opencode.json` caps tool output (300 lines / 12 KB) and enables compaction; restart opencode
  after config changes.

## 3. Speed rules

- Targeted tests first; full suite only at the verify level.
- Use Turborepo cache and `pnpm --filter` for the touched package.
- Coverage only in CI, not in the local fast loop.
- No web build/mobile build in `fast`; build is `full`/nightly.
- Keep `fast` under ~60 s; if it grows, split steps.
- Batch independent tool calls; avoid re-reading unchanged files.
- Use the strongest model for architecture/debugging and a fast model for mechanical edits;
  do not use Caveman Auto routing in this repo.
- Reuse scripts (`tools/verify`, test summaries) instead of retyping shell one-liners.

## 4. Autonomous verification

Harness: `tools/verify/verify.mjs` (see `tools/verify/README.md`).

```bash
node tools/verify/verify.mjs --level=fast     # after every edit
node tools/verify/verify.mjs --level=core     # before "done"
node tools/verify/verify.mjs --level=full     # before PR/release candidate
node tools/verify/verify.mjs --level=nightly --live  # scheduled/release
```

Rules:

- `fast` after edits; `core` before claiming done; `full` before a PR; `nightly` before release.
- If `core` fails or a required script is missing, do not claim done: report it.
- Missing scripts are `SKIP` unless `--strict`; never invent a pass.
- No network by default. Live AI eval only with `--live` and keys.
- Use local Supabase; never test against production data.
- Stop on the first failure, fix, rerun. Do not weaken a test to make it pass.
- Report: `verify level=core pass=8 fail=1 skip=0`, then the failure excerpt.
- CI: `.github/workflows/verify.yml` runs `core --strict` once `package.json` exists.
- Logs, artifacts, and reports go under `.verify/` (ignored by git).

## 5. Project skills

Project skills live in `.opencode/skills/<name>/SKILL.md`.

| Skill | Trigger |
|---|---|
| `token-efficient-dev` | any coding task; keep output/reads lean |
| `autonomous-verify` | implement/fix/test; run the verification loop |
| `supabase-sync` | auth, RLS, PowerSync, conflicts, devices |
| `adaptive-content` | content planner, generation, private items, TTL |
| `prompt-eval` | prompt changes, golden sets, eval runs |
| `media-recs` | recommendations, taste profile, availability |

Load a skill when the task matches; do not load all of them.

## 6. AI development rules

1. Read the spec in `docs/`; use `docs/16-agent-context.md` as the map.
2. Write/update domain tests before implementation.
3. Implement in the correct layer (`core`, `db/postgres`, `ai`, `api`, `ui`).
4. Add RLS and a server path for user data; test two-user isolation.
5. Run `verify` levels; update docs/contracts.
6. Report compactly: what changed, tests, risks, next step.

## 7. Autonomy boundaries

Agents may, without asking:

- read files, run local tests/builds, reset the local Supabase, generate fixtures;
- run `pnpm typecheck/lint/test`, `verify`, `db:check`, recorded eval;
- create/modify code and docs within the task.

Agents must ask before:

- deploying to the VPS, changing DNS/TLS, rotating secrets;
- running live AI eval that spends money beyond the configured cap;
- deleting user data, running migrations on production, restoring backups;
- changing auth/RLS policies in a way that widens access;
- adding a new third-party service or telemetry.

## 8. Reporting template

```
Changed: <files/layers>
Tests: verify level=core pass=... fail=... skip=...
Risk: <one line>
Next: <one line>
```

No restating the prompt. No full logs. No code dumps.
