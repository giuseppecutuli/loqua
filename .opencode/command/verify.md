---
description: Run the autonomous verification harness and report a compact result.
agent: build
---

Run:

```bash
node tools/verify/verify.mjs --level=$ARGUMENTS
```

If `$ARGUMENTS` is empty, use `core`.

Use `fast` for a quick check, `core` before claiming done, `full` before a PR/release candidate.
If a step fails, fix the cause, rerun the failing step, then rerun the same level. Do not weaken
tests. Report only:

```
Tests: verify level=<level> pass=N fail=N skip=N
Fail: <step> — <first error line>
Next: <one line>
```

Do not paste full logs.
