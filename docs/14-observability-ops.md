# Observability and operations

> **Online-first (ADR-023).** Offline/SQLite/PowerSync references in this document are
> superseded: the app requires connectivity and has no local write queue.

How we know the app works, what it costs, and how we release and recover it.

## 1. Event taxonomy

All product events are pseudonymous, schema-versioned, and free of PII. Names are
`snake_case`, versioned with `schema_version`.

| Event                                           | Key properties                               | Purpose              |
| ----------------------------------------------- | -------------------------------------------- | -------------------- |
| `app_open`                                      | platform, app_version                        | funnel start         |
| `onboarding_started`                            | source                                       | funnel               |
| `onboarding_completed`                          | goal, daily_minutes, streak_mode, formats    | activation           |
| `taste_profile_saved`                           | formats, genres_count                        | recommendations      |
| `assessment_started`                            | kind                                         | funnel               |
| `assessment_completed`                          | level_band, confidence, duration_sec         | placement quality    |
| `session_started`                               | kind, planned_minutes, blocks                | loop usage           |
| `session_completed`                             | kind, duration_sec, items, production_sec    | loop quality         |
| `session_abandoned`                             | kind, progress_pct                           | friction             |
| `item_served`                                   | item_type, skill, level_band, coverage       | content exposure     |
| `item_answered`                                 | correct, latency_ms, hint_used               | learning signal      |
| `correction_shown`                              | rule_id, severity, confidence_bucket         | correction quality   |
| `feedback_given`                                | target_type, rating, reason_code             | AI/content quality   |
| `conversation_turn`                             | turn_index, latency_ms, stt_used, level_band | conversation quality |
| `phrase_saved`                                  | source, has_note                             | transfer             |
| `recommendation_shown`                          | kind, score_bucket, format                   | media funnel         |
| `recommendation_accepted`                       | media_id_hash, rank                          | media relevance      |
| `recommendation_rejected`                       | reason_code                                  | taste model          |
| `media_started`                                 | kind, difficulty_band                        | behavior             |
| `media_finished`                                | kind, progress_pct, weeks                    | completion           |
| `media_reflection_completed`                    | kind, production_sec                         | transfer             |
| `notification_sent`                             | kind, window                                 | retention            |
| `notification_opened`                           | kind                                         | retention            |
| `consent_granted` / `consent_revoked`           | kind, version                                | compliance           |
| `auth_started`                                  | method                                       | funnel               |
| `auth_upgraded`                                 | method                                       | multi-device         |
| `device_registered` / `device_revoked`          | platform                                     | security             |
| `rls_denied`                                    | table, operation                             | security             |
| `level_changed`                                 | from, to, reason                             | adaptive quality     |
| `test_out` / `challenge_started`                | concept, level_band, passed                  | adaptive quality     |
| `remediation_started` / `remediation_completed` | concept, level_band                          | adaptive quality     |
| `content_requested`                             | purpose, count                               | adaptive content     |
| `content_generated`                             | purpose, count, cache_hit, cost_bucket       | adaptive content     |
| `content_failed` / `content_capped`             | purpose, reason                              | fallback health      |
| `content_promoted`                              | item_id, review_status                       | content quality      |
| `export_completed` / `import_completed`         | format_version, rows                         | data portability     |
| `error_shown`                                   | surface, code                                | reliability          |

Rules:

- No email, name, free text, transcript, or media title in event properties. Use hashes or ids.
- No full IP addresses; truncate or drop.
- Sampling: 100% for core funnel events, 10-20% for high-volume UI events.
- Events are buffered and flushed in batches while online; no PII.
- `POST /v1/events` accepts up to 50 events per batch, validates the taxonomy in
  `packages/core/src/events.ts`, drops forbidden keys, and writes `product_events` (RLS:
  owner-only, append-only).
- Local dashboard: `pnpm ops:events` prints the last 7 days grouped by event and day
  (`EVENT_REPORT_DAYS` changes the window). It reads only `product_events`, never prompts or
  learner text.

## 2. SLOs

| SLO                                | Target    |
| ---------------------------------- | --------- |
| Crash-free sessions                | ≥ 99.5%   |
| Cold start p95 (Android mid-range) | ≤ 2.5 s   |
| Session open from local DB p95     | ≤ 150 ms  |
| Conversation first token p95       | ≤ 2.5 s   |
| AI schema-valid output             | ≥ 99%     |
| Correction precision (eval)        | ≥ 97%     |
| Daily AI cost p95 per active user  | ≤ $0.50   |
| Export success                     | ≥ 99.9%   |
| Retention job success              | 100%      |
| API latency                        | = 3 s p95 |
| API success                        | = 99.9%   |
| On-demand generation p95           | ≤ 3 s     |
| Generation cache hit               | ≥ 60%     |
| Adaptive content share             | 20-30%    |

Error budget: if an SLO is missed for 7 days, freeze new features and fix reliability.

## 3. Dashboards

Minimum set:

1. **Learning funnel**: onboarding -> assessment -> first session -> D7 -> production minutes.
2. **AI quality**: schema errors, repairs, cache hit, eval pass rate, correction precision.
3. **AI cost**: per feature, per user, per prompt, per day; onboarding and media costs split.
4. **Content health**: approved/pending items, coverage per concept, p-values, retirement,
   user-reported errors.
   4b. **Adaptive content**: requests, cache hit, cost, failures/caps, promotion rate, ratio.
5. **Media**: recommendations shown/accepted/finished, too-hard rate, reflection completion.
6. **Reliability**: crashes, p95 latency, provider errors, Hono API 4xx/5xx, rate-limit hits.
7. **Auth and API**: error rate, latency, device revokes, auth upgrades, RLS denials.
8. **Privacy**: consent coverage, deletion jobs, retention job status.

Dashboards can start as SQL queries; a BI tool is optional.

## 4. Logging

- Structured JSON; levels `debug`, `info`, `warn`, `error`.
- Include `request_id`, `user_id_hash`, `session_id`, `prompt_id`, `model`, `latency_ms`.
- Never log prompt text, responses, transcripts, audio, keys, or full IPs.
- Retention: 30 days for debug, 90 days for info/error.
- Client logs are local and only uploaded with explicit consent.

## 5. Crash reporting

- Sentry (or equivalent) on native and web.
- `sendDefaultPii: false`; scrub request bodies and headers.
- Release tags: app version, build, platform, commit SHA.
- Source maps uploaded for web/native.
- Alerts for new crash signatures and crash-free rate drops.

## 6. Alerting

| Alert                      | Threshold                        |
| -------------------------- | -------------------------------- |
| AI spend                   | 70% and 90% of monthly cap       |
| Provider error rate        | > 5% in 10 min                   |
| Schema error rate          | > 2% in 1h                       |
| Eval regression            | pass rate below prompt threshold |
| Crash-free sessions        | < 99% over 24h                   |
| Migration failure          | any                              |
| Retention job failure      | any                              |
| API 5xx rate               | > 1% in 15 min                   |
| API latency                | > 3 s p95                        |
| RLS denials                | spike above baseline             |
| Content generation failure | > 5% in 15 min                   |
| Generation cap hit         | > 20% of sessions in 1h          |
| Auth failures              | > 5% in 15 min                   |
| Device revoke spike        | > 3 in 1h                        |
| p95 latency                | above SLO for 15 min             |

Alerts go to email/chat; each has an owner and a runbook link.

## 7. Release and operations

### Versioning

- App: semver (`major.minor.patch`).
- Schema: Drizzle migration version.
- Content: `content_packs.version`.
- Prompts: `prompt_id` + integer version.
- Export: `backup_meta.format_version`.

### Release flow

1. CI: typecheck, lint, unit, integration, eval (recorded), build.
2. Migration test from empty and previous version.
3. Staging build; smoke test web + Android.
4. Canary/rollout: internal first, then 10%, then 100% (phase 2).
5. EAS Update for JS-only fixes; native changes require a new build.
6. Rollback: previous build + previous content pack; prompts revert in git.
7. Changelog and store notes.

### Store and web

- Android: EAS Build/Submit, AAB, store listing, content rating, privacy policy.
- iOS: EAS Build/TestFlight (when iOS starts).
- Web: static export on Cloudflare Pages/Netlify; no COOP/COEP requirement.
- Desktop: Tauri v2, signed installer, auto-update policy.
- Support: a monitored email/issue tracker; in-app "report a problem" later.

## 8. Backup and restore

- Local export: JSON with `format_version` and checksum; user-initiated.
- Automatic local cache snapshot: daily, last 7 kept.
- Server Postgres daily backup from M1, 30-day retention, restore tested monthly.
- Migration runbook: backup -> migrate -> verify -> rollback plan.
- Restore drill: quarterly; verify two-device server state after restore.

## 9. Cost operations

- Per-feature quotas: onboarding assessment, conversation, correction, media guides.
- Daily and monthly caps; hard stop with deterministic exercises.
- Cache hit rate monitored; TTS and explanation caches.
- Price table versioned in `packages/ai/cost.ts`; update on provider changes.
- Model deprecation watch: a quarterly check of provider catalogs.
- Cost regression test in CI with a fixture of 20 conversations and 20 recommendations.

## 10. Feature flags and experiments

- Flags stored locally or in Hono config; no remote config dependency in phase 1.
- One experiment at a time, declared primary metric, minimum 2 weeks.
- Never experiment on safety, privacy, or cost caps.
- Kill switch for AI features, media recommendations, and notifications.

## 11. Runbooks

- **Provider outage**: circuit breaker opens, deterministic exercises, user message, status note.
- **Budget exhausted**: disable conversation/correction/media guides, keep deterministic exercises.
- **Migration failure**: restore backup, revert app version, fix migration, retest.
- **Data loss**: restore last backup, verify `attempts`/`srs_cards`, inform user.
- **Key leak**: revoke, rotate Hono secret, redeploy API, audit spend.
- **API failure**: check Hono logs, provider status, and server health; the client retries.
- **Unexpected 5xx spike**: inspect recent migrations, DB health, and Hono logs; roll back if needed.
- **RLS denial spike**: verify JWT/role, check policies, block release until explained.
- **VPS/Docker**: check disk, memory, container restarts, Caddy TLS, Postgres connections.
- **Supabase upgrade**: pin versions, backup, staging test, then production; rollback image tag.
- **SMTP failure**: check provider status/SPF/DKIM; magic links fail closed with a message.
- **Content generation failure**: serve foundation/cache, queue the request, check provider/prompt
  version, keep the cap active.
- **Prompt regression**: revert prompt version, rerun eval, block release.
- **Content error report**: unpublish item, add regression case, regenerate.

## 12. Release checklist

- [ ] SLOs green for the last 7 days.
- [ ] Eval recorded and live (sampled) green.
- [ ] Cost within budget; quotas and alerts active.
- [ ] Crash-free sessions above target.
- [ ] Dashboards show the new feature.
- [ ] Migration tested from empty and previous version.
- [ ] RLS two-user isolation and two-device server state tested.
- [ ] Backup/restore tested.
- [ ] VPS hardening, Caddy TLS, SMTP magic links, Docker image pins verified.
- [ ] Privacy/consent/retention checks passed.
- [ ] Rollback plan documented.
- [ ] Changelog and support note ready.
