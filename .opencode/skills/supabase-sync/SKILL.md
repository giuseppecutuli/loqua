---
name: supabase-sync
description: Use when working on Supabase Auth, RLS, PowerSync, devices, offline queue, sync conflicts, migrations, or multi-device tests. Triggers include RLS, sync, PowerSync, device, conflict, auth, migration, offline.
---

# Supabase auth, RLS, and sync

## Architecture

- Postgres (self-hosted Supabase) is the source of truth.
- Local SQLite is a cache/write queue, synced by self-hosted PowerSync.
- Hono API verifies Supabase JWT; provider keys only server-side.
- `users.id = auth.uid()`; RLS on every user table.

## Invariants

- Append-only: `attempts`, `srs_reviews`, `error_events`, `xp_events`, `prompt_calls`.
- One active plan per profile; one card per `(user, source_type, source_id, card_type)`.
- SRS cards recomputed from `srs_reviews` on conflict.
- Derived state recomputed or last-write-wins with `sync_conflict_log`.
- Content read-only; private generated items sync only to their owner.
- Revoked devices cannot pull/push.

## RLS checklist

- Owner policy: `user_id = auth.uid()` with check.
- Child tables: `EXISTS` against parent (`session_items`, `session_turns`, `plan_days`,
  `assessment_scores`, `user_taste_profile`).
- `users`: `id = auth.uid()`.
- Content: read-only for clients; writes service-role only.
- Test with two users: B cannot read/write A.
- Never put the service-role key in the client or sync rules.

## Migrations

- Canonical Postgres migration via `pnpm db:generate`; never hand-edit.
- SQLite mirror via `pnpm sync:generate`; drift check in CI.
- Test from empty DB and previous version; backup before destructive changes.
- Apply locally with `pnpm supabase:reset`.

## Two-device test

1. Device A offline: record attempts/reviews.
2. Device B online: different writes.
3. Reconnect A; both converge.
4. SRS cards recomputed; conflict log empty for append-only rows.
5. Revoke A; it can no longer sync.
