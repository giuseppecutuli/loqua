# Self-hosted infrastructure

Everything runs in Docker. There are two layers:

1. **Supabase** via the Supabase CLI (`pnpm supabase:start`): Postgres, Auth/GoTrue,
   PostgREST, Storage, Realtime, Studio, Mailpit.
2. **Loqua services** via `infra/docker-compose.yml`: Hono API, Caddy, PowerSync Open
   Edition, PowerSync bucket storage (Postgres), Uptime Kuma.

## Ports and URLs

| Service | URL / port | Notes |
|---|---|---|
| Supabase API | http://127.0.0.1:54321 | `EXPO_PUBLIC_SUPABASE_URL` |
| Supabase DB | `postgres://postgres:postgres@127.0.0.1:54322/postgres` | local only |
| Supabase Studio | http://127.0.0.1:54323 | schema and RLS |
| Mailpit | http://127.0.0.1:54324 | magic-link emails |
| Hono API | http://localhost:8787 | `/health`, `/v1/*` |
| Web + API via Caddy | http://localhost | COOP/COEP + SPA fallback |
| PowerSync | http://localhost:8080 | `/probes/liveness` |
| Uptime Kuma | http://localhost:3001 | first-run admin setup |
| Fast test Postgres | `127.0.0.1:54329` | `pnpm supabase:reset`, not the full stack |

## First run

```bash
# 1. Environment: .env.local overrides .env.
cp .env.example .env
# edit .env/.env.local; local Supabase values are in `pnpm supabase:status`
# add DEEPSEEK_API_KEY to enable AI calls

# 2. Start Supabase (Docker).
pnpm supabase:start
pnpm supabase:local:reset     # migrations + seed on 54322

# 3. Create PowerSync role + publication on the local DB.
pnpm powersync:setup

# 4. Build the web app, then start the Loqua stack.
pnpm build:web
pnpm infra:up

# 5. Verify.
pnpm smoke:e2e
```

PowerSync creates its own replication slot and starts replicating the M1 tables. Check:

```bash
docker compose -f infra/docker-compose.yml logs -f powersync
docker compose -f infra/docker-compose.yml ps
```

## Environment

`.env.local` wins over `.env` in every script (Expo, API, tools). To use hosted Supabase,
remove/rename `.env.local` or override the relevant keys.

API container overrides:

- `API_SUPABASE_ISSUER` must match the JWT `iss` claim. Locally it stays
  `http://127.0.0.1:54321`; the container fetches JWKS from
  `API_SUPABASE_JWKS_URL=http://host.docker.internal:54321/...`.
- `API_DATABASE_URL` points at `host.docker.internal:54322`.
- `API_DEBUG_ERRORS=1` prints API stack traces in the container logs; keep it `0` in
  production.

PowerSync overrides live in `infra/.env.example`. The `PS_*` names are the only variables the
PowerSync service substitutes.

## VPS deployment

1. Point DNS at the VPS and set `SITE_ADDRESS=loqua.example.com`; Caddy obtains TLS
   automatically. For local HTTP keep `SITE_ADDRESS=:80`.
2. Run the Supabase CLI stack on the VPS (or the official self-hosted Supabase compose),
   then set `API_SUPABASE_ISSUER`, `API_SUPABASE_JWKS_URL`, `API_DATABASE_URL`, and
   `PS_DATA_SOURCE_URI` to the internal service/DNS names.
3. Set `PS_SSL_MODE=verify-full` (or `verify-ca` with `PS_PG_CA_CERT`) for a public network.
4. Set `CORS_ORIGIN` to the deployed web origin.
5. Configure SMTP for magic links in `supabase/config.toml` (or the Supabase compose env).
6. Firewall: expose `80/443` only; keep `54321/54322/54323/8080/3001` private.
7. Backups: schedule `pg_dump` for the Supabase database and the PowerSync storage database;
   test a restore before launch.
8. Uptime Kuma: add monitors for `/health`, PowerSync liveness, and the web root.

The compose file runs the API with `tsx` for M1. A compiled image is a later optimization.

## Troubleshooting

- **`The server does not support SSL connections`**: local Postgres has no TLS; the API
  treats `host.docker.internal`/localhost as local. Do not enable `sslmode` locally.
- **PowerSync unhealthy**: run `pnpm powersync:setup`, then check `PS_DATA_SOURCE_URI` and
  `PS_JWKS_URI` from inside the container.
- **Caddy serves 404**: run `pnpm build:web`; Caddy mounts `apps/app/dist`.
- **No AI calls**: `DEEPSEEK_API_KEY` is empty. The offline loop still works.
- **Port 80 busy**: change the Caddy port mapping or `SITE_ADDRESS`; on Windows check IIS.
