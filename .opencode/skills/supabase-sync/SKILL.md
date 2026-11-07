---
name: supabase-sync
description: Use when working on Supabase Auth, RLS, devices, or migrations. Triggers include RLS, device, login, auth, migration, Supabase. The app is online-first; there is no PowerSync/offline queue.
---

# Supabase auth, RLS, and server state

## Architecture

- Postgres (self-hosted Supabase) is the source of truth.
- The client is online-first: no local SQLite, no write queue, no PowerSync (ADR-023).
- Hono API verifies Supabase JWT/JWKS; provider keys only server-side.
- `users.id = auth.uid()`; RLS on every user table.

## Invariants

- Append-only: `attempts`, `srs_reviews`, `error_events`, `xp_events`, `prompt_calls`.
- One active plan per profile; one card per `(user, source_type, source_id, card_type)`.
- SRS cards recomputed from `srs_reviews` on the server.
- Derived state is recomputed server-side; there is no conflict log.
- Content read-only; private generated items are owner-scoped.
- A revoked device session is invalidated.

## RLS checklist

- Owner policy: `user_id = auth.uid()` with check.
- Child tables: `EXISTS` against parent (`session_items`, `session_turns`, `plan_days`,
  `assessment_scores`, `user_taste_profile`).
- `users`: `id = auth.uid()`.
- Content: read-only for clients; writes service-role only.
- Test with two users: B cannot read/write A.
- Never put the service-role key in the client.

## Migrations

- Canonical Postgres migration via `pnpm db:generate`; never hand-edit generated SQL.
- Test from empty DB and previous version; backup before destructive changes.
- Apply locally with `pnpm supabase:reset` (fast harness) or `pnpm supabase:local:reset`
  (full stack).
- No SQLite mirror or `sync:generate`.

## Account sign-in and device check

1. A fresh session (no local token) can sign in with the email magic link.
2. After sign-in the server profile and progress are restored.
3. Sign out, then sign in again: the same data returns.
4. Revoke the device; its session is invalidated and it must sign in again.
5. RLS still prevents cross-user reads/writes.
