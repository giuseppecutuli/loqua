---
name: adaptive-content
description: Use when working on the content planner, content.generate, personalized items, private items, TTL, remediation, foundation vs generated ratio, or offline generation queue. Triggers include adaptive content, content request, generated item, remediation, personalization, content.generate.
---

# Adaptive content

## Model

- Foundation bank first; deterministic selection.
- Generate only on trigger: missing fit, remediation, new can-do, "more like this", media guide,
  conversation scenario.
- 70-80% foundation/cached, 20-30% generated; 0% generated offline.
- Every request is a typed `ContentRequest` (purpose, level, concepts, context, count).

## Validation

1. Zod schema; repair max 2.
2. Unique answer; no ambiguity.
3. `ruleId` in the allowed rule-bank for the target language.
4. Dedupe by normalized stem + answer and `spec_json` hash.
5. Level, safety, copyright, no known concepts (mastery ≥ 0.85).
6. `auto_validated = 1`; private (`owner_user_id`), TTL 30-90 days.
7. 10% human sample; promotion to global only after review.

## Caps and fallback

- Per-session/day generation cap.
- Deterministic foundation fallback on cap/timeout/failure.
- Offline: queue requests; never block a session.

## Files

- Planner: `packages/core/src/content`.
- Prompt: `docs/prompts/adaptive-content.md`.
- Tables: `content_requests`, `generation_jobs`, private `items`.
- Ops: `docs/11-content-ops.md` §2.1.
- Eval: `adaptive-content.v1` golden set.
