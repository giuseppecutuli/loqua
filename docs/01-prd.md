# PRD — Loqua

Version 1.0 · November 2026 · Status: draft for validation

## 1. Vision

A personal app that builds a tailored English path from A1 to C1, starting from an honest
picture of the learner's skills and gaps, and every day offers a short, practical,
non-punitive loop: **review what you are forgetting, learn what you need, produce real
language, receive understandable feedback**. Web is the primary client and Android is the
final client; both share the same account, and the app is online-first. iOS and desktop are
out of scope (ADR-025).

It is not a linear course. It is a system that adapts: if you already know a level, it tests
you out and moves on; if you get prepositions wrong, it brings them back in new contexts; if
gaps from lower levels surface during speaking, it schedules targeted remediation without
resetting your level.

## 2. Target user

**Primary persona — "The Italian developer".**

- 25-45 years old, native Italian, decent technical English (reads documentation).
- Rusty school grammar, poor everyday vocabulary, struggles with idioms and spontaneous
  conversation.
- Has 15-30 minutes per day, does not want a heavy course, wants to see concrete progress.
- Uses Android and Web; values self-hosted tools and cost control.

**Secondary persona (phase 2).** Other Italian professionals with the same profile.

## 3. Job stories

1. When I open the app, I want to know in 5 seconds what to do today, without choosing among 20 options.
2. When I make a mistake, I want to understand _why_ simply, without feeling judged.
3. When I speak, I want a patient interlocutor who adapts to my level.
4. When I don't understand an everyday sentence, I want to save it and find it in context.
5. When I skip a day, I want to resume without losing everything and without guilt.
6. When I improve, I want to see it credibly (skills, not just XP).
7. When my connection drops, I want a clear message and a retry, not a broken state.
8. When AI costs rise, I want to know how much I am spending and be able to limit it.
9. When I finish work, I want a film, series, or book that fits my level and tastes, not a generic list.
10. When a recommendation is too hard or too easy, I want to say so and get better ones.
11. When I watch or read, I want to turn it into practice: phrases to keep, a short summary, and feedback.
12. When I get a recommendation, I want legal availability in my region and no spoilers.
13. When I already know something, I want to test out and move on, not sit through it again.
14. When a gap from a lower level shows up, I want a targeted review, not a full reset.
15. When I switch from phone to web, I want to continue exactly where I left off.
16. When my connection drops, I want to resume cleanly when I reconnect.
17. When I need practice on my work or daily life, I want content generated around that context, not a fixed lesson.

## 4. Goals and non-goals

### Goals (12 months)

- Start wherever the placement says (A1-C1) and promote by at least one band when the
  evidence supports it; over time, reach a solid C1 in the target skills.
- Sustain a daily practice of 15-30 minutes for at least 12 weeks.
- Keep average AI cost below €15/month per active user.
- Go from A1 to C1 adaptively: test out of known content, promote only on evidence, and
  remediate lower-level gaps without demotion.
- Keep Android and Web aligned with one account through the server source of truth.
- Make content adapt: foundation bank + deterministic selection + on-demand generation and
  personalization, never a fixed course.
- Make progress visible and explainable ("why this exercise today?").
- Turn films, series, and books into comprehensible input with measurable follow-up:
  ≥ 25% recommendation acceptance, ≥ 40% completion, ≥ 30% reflection completion.

### Non-goals

- Official certifications (IELTS/TOEFL) and academic courses.
- Social network, feed, global leaderboard.
- Other target languages or UI locales in phase 1. The architecture is language- and
  locale-agnostic, but the first release ships English only with an Italian UI.
- Hosting, streaming, or transcribing copyrighted media. Recommendations are metadata +
  legal availability only; no piracy links, no full transcripts, no subtitle dumps.
- Replacing a human teacher for absolute beginners.
- Third-party protected content.

## 5. Functional requirements

Priority: **P0** = MVP, **P1** = after the first complete loop, **P2** = future.

### 5.1 Onboarding and assessment

| ID    | Requirement                                                                                                                     | Prio |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---- |
| FR-01 | Onboarding: goal, available time, interests, self-assessment                                                                    | P0   |
| FR-02 | Hybrid adaptive placement test (MCQ/cloze + writing + speaking)                                                                 | P0   |
| FR-03 | A1-C1 estimate overall and per skill with confidence intervals, persisted as history                                            | P0   |
| FR-04 | First value session within 5 minutes; anonymous auth requires network once, email optional                                      | P0   |
| FR-05 | Initial gap profile (typical IT->EN errors)                                                                                     | P0   |
| FR-06 | Level recalibration after 2 weeks of data                                                                                       | P1   |
| FR-07 | Language profile (target, native, UI locale, explanation mode, proficiency framework) stored and applied by content, AI, and UI | P0   |
| FR-08 | UI copy from locale catalogs with locale-aware plurals, dates, and numbers; no hardcoded strings                                | P0   |
| FR-09 | Taste onboarding (formats, genres, themes, difficulty tolerance, subtitles, weekly time, region)                                | P0   |

### 5.2 Daily loop

| ID    | Requirement                                                                          | Prio |
| ----- | ------------------------------------------------------------------------------------ | ---- |
| FR-10 | Home with a single, clear "today's plan"                                             | P0   |
| FR-11 | Session composed of SRS review + new input + production                              | P0   |
| FR-12 | At least 8 contextualized exercise types (see §5.3)                                  | P0   |
| FR-13 | Immediate feedback with explanation in simple target language                        | P0   |
| FR-14 | Error bank: recurring errors generate micro-drills                                   | P0   |
| FR-15 | Save encountered phrases -> review cards                                             | P1   |
| FR-16 | 5-minute "micro-loop" sessions for busy days                                         | P1   |
| FR-17 | Resume an interrupted session                                                        | P1   |
| FR-18 | Review backlog cap and missed-day policy (no punitive pile-up)                       | P1   |
| FR-19 | Test-out: skip known concepts and challenge the next level; promote only on evidence | P0   |

### 5.3 Exercise types (bounded set)

1. Contextualized cloze (real sentence, single blank).
2. Guided transformation (e.g. present perfect vs past simple).
3. Word reordering (word order).
4. Short dictation (listening -> writing).
5. Listening with a comprehension question.
6. Reading with a comprehension question.
7. Guided written production (1-3 sentences).
8. Text roleplay (short conversation).
9. Shadowing/audio repetition (speaking).
10. Lexicon reuse in a new context.
11. Active correction of a wrong sentence (error spotting).

Every exercise has: `type`, `skill`, `concept`, `cefr`, `answer_key`, `difficulty`,
`explanation`, `rule_id` (if grammatical).

### 5.4 AI conversation

| ID    | Requirement                                                           | Prio |
| ----- | --------------------------------------------------------------------- | ---- |
| FR-20 | Everyday and professional scenarios (bar, doctor, standup, interview) | P0   |
| FR-21 | Turn-based text conversation with calibrated level (i+1)              | P0   |
| FR-22 | Voice input (STT) with Web Speech fallback                            | P0   |
| FR-23 | Non-invasive correction during the turn + end-of-session report       | P0   |
| FR-24 | Confirmed errors -> SRS cards and drills                              | P0   |
| FR-25 | Speaking evaluation with rubric and interval                          | P1   |
| FR-26 | Continuous "call" mode                                                | P2   |

### 5.5 Gamification and retention

| ID    | Requirement                                                   | Prio |
| ----- | ------------------------------------------------------------- | ---- |
| FR-30 | Production streak (spoken/written), with grace day and repair | P0   |
| FR-31 | XP for reuse and production, not grinding                     | P0   |
| FR-32 | 3 daily quests + 1 weekly mission                             | P0   |
| FR-33 | Badges/awards for real milestones                             | P1   |
| FR-34 | Event-based notifications, max 2/day, quiet hours             | P0   |
| FR-35 | Activity calendar and error heatmap                           | P1   |
| FR-36 | Opt-in accountability buddy                                   | P2   |

### 5.6 Progress and data

| ID    | Requirement                                                                           | Prio |
| ----- | ------------------------------------------------------------------------------------- | ---- |
| FR-40 | Skill radar (grammar, vocab, listening, speaking, reading, writing, pragmatics) A1-C1 | P0   |
| FR-41 | CEFR A1-C1 estimate with trend and confidence                                         | P0   |
| FR-42 | Explainable "why this exercise?"                                                      | P1   |
| FR-43 | Full data export in JSON                                                              | P0   |
| FR-44 | Import/restore from backup                                                            | P0   |
| FR-45 | Data and audio deletion                                                               | P0   |
| FR-46 | Consent management (terms, privacy, voice, AI processing, analytics) with revocation  | P0   |
| FR-47 | Retention policy and scheduled deletion for audio, transcripts, and logs              | P0   |
| FR-48 | Versioned export with checksum; import rejects unknown versions                       | P0   |
| FR-49 | Only approved/reviewed content is served; license and source recorded                 | P0   |

### 5.7 Settings

| ID    | Requirement                                                                  | Prio |
| ----- | ---------------------------------------------------------------------------- | ---- |
| FR-50 | No user-supplied API keys; AI provider keys live in server-side Hono secrets | P0   |
| FR-51 | Configurable AI model and daily budget                                       | P0   |
| FR-52 | Explanation mode (target_simple / native)                                    | P0   |
| FR-53 | Notification management and windows                                          | P0   |
| FR-54 | Light/dark theme, text size                                                  | P1   |

### 5.8 Media recommendations (watch & read)

| ID    | Requirement                                                                              | Prio |
| ----- | ---------------------------------------------------------------------------------------- | ---- |
| FR-60 | Taste profile stored, editable, resettable, and used by recommendations                  | P0   |
| FR-61 | Personalized movie/series/book recommendations at 90-95% estimated known vocabulary      | P0   |
| FR-62 | Spoiler-free reason, level note, and a practical watch/read guide                        | P0   |
| FR-63 | Feedback loop: accepted, rejected, too easy/hard, finished, abandoned; updates the model | P0   |
| FR-64 | Media progress and weekly immersion plan                                                 | P1   |
| FR-65 | Save short phrases to SRS; 60-second spoken or 80-word written reflection after media    | P0   |
| FR-66 | Legal, region-aware availability only; no piracy links, no full transcripts, no spoilers | P0   |
| FR-67 | Recommendation history visible and deletable; rejected titles excluded for 90 days       | P0   |

### 5.9 Account and devices

| ID    | Requirement                                                                   | Prio |
| ----- | ----------------------------------------------------------------------------- | ---- |
| FR-70 | Anonymous session on first run; optional email magic link to upgrade          | P0   |
| FR-71 | Multi-device server state: Android and Web share the same account and state   | P0   |
| FR-72 | Device list with last seen and revoke                                         | P0   |
| FR-73 | Device list, last seen, and revoke                                            | P0   |
| FR-74 | Server-side export and delete, propagated to all devices                      | P0   |
| FR-75 | RLS: a user cannot read or write another user's rows                          | P0   |
| FR-76 | Level events (placement, test-out, promotion, remediation) visible in history | P1   |

### 5.10 Adaptive content

| ID    | Requirement                                                                                                   | Prio |
| ----- | ------------------------------------------------------------------------------------------------------------- | ---- |
| FR-80 | Every session is composed from the learner state, not a fixed sequence                                        | P0   |
| FR-81 | On-demand generation only when no suitable foundation/cached item exists                                      | P0   |
| FR-82 | Personalization from typed interests, work/daily context, recent errors, and target can-do (no free-text PII) | P0   |
| FR-83 | Generated items: schema/rule-bank/dedupe/cache validation, private by default, TTL, promotion after review    | P0   |
| FR-84 | Network unavailable: explicit error and retry; no offline queue or generation                                 | P0   |
| FR-85 | Per-session/per-day generation caps and deterministic fallback when the cap is hit                            | P0   |
| FR-86 | "More like this" and "why this item" for generated content                                                    | P1   |

## 6. Non-functional requirements

| ID     | Requirement                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Cold start ? 2.5 s on a mid-range Android; session starts from the server                                                  |
| NFR-02 | Reads and writes require network; there is no offline cache                                                                |
| NFR-03 | No keys or secrets in the bundle or logs                                                                                   |
| NFR-04 | Audio deleted within 48h; transcripts deletable                                                                            |
| NFR-05 | Average AI cost ≤ €0.50/day per active user                                                                                |
| NFR-06 | Accessibility: AA contrast, ≥ 44px targets, screen reader on key actions                                                   |
| NFR-07 | Italian UI in phase 1; all UI copy comes from locale catalogs keyed by `ui_locale`; explanations follow `explanation_mode` |
| NFR-08 | DB migrations applicable from scratch and from the previous version, with backup before destructive changes                |
| NFR-09 | AI errors handled: 2 retries, then deterministic fallback, never crash                                                     |
| NFR-10 | Privacy-conscious telemetry: product events without PII                                                                    |
| NFR-11 | Language-agnostic core: no hardcoded target/native language in prompts, content queries, or domain logic                   |
| NFR-12 | Prompt injection and unsafe-output defenses tested; no tools; schema-bound outputs                                         |
| NFR-13 | Consent gates and retention enforced; export and delete always work                                                        |
| NFR-14 | Server encrypted at rest (Supabase); backups encrypted                                                                     |
| NFR-15 | Observability: event taxonomy, SLOs, cost/quality dashboards, no PII in logs                                               |
| NFR-16 | Media data is metadata only; availability from legal providers; spoiler-free reasons                                       |
| NFR-17 | Server consistency: same account sees the same data after refresh; pull-to-fresh p95 ? 3 s                                 |
| NFR-18 | RLS enforced on every user table; two-user isolation tests mandatory                                                       |
| NFR-19 | All sessions require network; there is no offline mode                                                                     |
| NFR-20 | Backend and AI processing in the EU region where available; service-role key never in the client                           |
| NFR-21 | On-demand generation p95 ≤ 3 s for a small batch; deterministic fallback if slower                                         |
| NFR-22 | Adaptive ratio 70-80% foundation/cached, 20-30% generated/personalized; generation requires network                        |
| NFR-23 | Generated content passes 100% automated gates and 10% human sample before promotion                                        |

## 7. Success metrics

**Product (personal):**

- Active days/week ≥ 5.
- Production minutes/week ≥ 30.
- Recurring errors down 30% in 8 weeks.
- CEFR level step in ≤ 12 weeks (per target skill).

**Technical:**

- AI cost/day ≤ €0.50.
- p95 time-to-first-token in conversation ≤ 2.5 s.
- Invalid AI output rate ≤ 2% after repair.
- No grammar correction without a `rule_id`.

**Retention (phase 2):**

- D7 ≥ 40%, D30 ≥ 15% (consumer benchmark, not Duolingo).
- Time to first real conversation ≤ 3 days.

**Media (immersion):**

- Recommendation acceptance ≥ 25%.
- Completion ≥ 40% of started titles.
- Post-media reflection completion ≥ 30%.
- ≥ 3 phrases saved per finished title.
- "Too hard" feedback ≤ 20%.

**Adaptive A1-C1:**

- ≥ 80% of already-known concepts are skipped after placement or test-out.
- No "new" item served for a concept with mastery ≥ 0.85 unless it is a due review.
- Lower-level remediation closes within 7 days in ≥ 80% of cases.
- Promotion only with evidence (mastery ≥ 0.85 and interval above the next cut-score).

**Adaptive content:**

- 70-80% of session items from foundation/cache; 20-30% generated/personalized.
- Generation cache hit ≥ 60%; acceptance ≥ 80%; no unvalidated item served.
- Generation cost ≤ €0.01 per session on average.

**Multi-device:**

- Server reads/writes success ? 99.9%.
- Session resumed on a second device after an online refresh.
- Zero cross-user reads/writes in RLS tests.

## 8. Constraints

- AI budget < €20/month; backend infrastructure is a separate budget (~10-15 €/month).
- Solo developer: self-hosted Supabase + Hono on one VPS; managed fallback documented.
- Privacy: sensitive voice data, EU hosting where applicable.
- No copied content.
- Media recommendations are metadata + legal availability only.
- Multi-device from day one: Postgres source of truth; no local cache or sync layer.
- Content is never a fixed course: foundation bank + deterministic selection + adaptive generation.
- All sessions require network; there is no offline mode.
- Web-first delivery; Android is the final supported client. iOS and desktop are out of
  scope (ADR-025).

## 9. Risks and mitigations

| Risk                                           | Impact       | Mitigation                                                                                     |
| ---------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Hallucinated grammar correction                | High (trust) | rule-bank + span check + confidence + spot-check                                               |
| Runaway AI costs                               | High         | server quotas, cache, batch, mini models                                                       |
| Learner quits out of boredom                   | High         | short loop, personal scenarios, visible progress                                               |
| Too much recognition, too little production    | Medium       | minimum production quota per session                                                           |
| Unreliable CEFR evaluation                     | Medium       | intervals, recalibration, calibrated items                                                     |
| Over-reliance on AI                            | Medium       | scaffold fading, AI-free tasks                                                                 |
| Server state drift across devices              | Medium       | Postgres authoritative; refetch after writes and auth changes                                  |
| Backend ops or cost surprise                   | Medium       | self-hosted with runbooks, budgets, managed fallback                                           |
| RLS misconfiguration / cross-user leak         | High         | two-user tests, policy review, no service key client                                           |
| Server errors or stale cache                   | Medium       | explicit errors, retry, server refetch                                                         |
| A1-C1 content volume delays launch             | High         | phased content waves; keep engine and UI A1-C1; delay only the C1 wave if quality is not ready |
| On-demand generation cost blowup               | High         | caps, cache, dedupe, foundation-first, deterministic fallback                                  |
| Generated content quality drift                | High         | schema + rule-bank + human sample + promotion gate                                             |
| Generation latency blocks a session            | Medium       | cached/foundation fallback; queue in background                                                |
| Personalization leaks PII                      | High         | typed interests/context only; no free-text PII; consent and retention                          |
| Piracy or copyrighted media in recommendations | High (legal) | metadata only, legal providers, review                                                         |
| Spoilers in recommendation reasons/guides      | Medium       | prompt constraints + heuristic + spot-check                                                    |
| Stale availability data                        | Medium       | quarterly re-check, expiration                                                                 |
| Prompt injection via learner text              | High         | instruction hierarchy, no tools, schema gates, red-team                                        |
| Voice/transcript data breach                   | High         | encryption, consent, retention, EU regions                                                     |

## 10. Open questions

1. What is the verifiable "can-do" that defines success at 12 weeks?
2. How much weight should speaking vs writing have in the daily loop?
3. When, if ever, to revisit offline support?
4. Which STT provider after the AssemblyAI credits run out?
5. Domain, package name, and trademark availability for Loqua.
6. Which legal metadata sources and regions for the media catalog at launch?
7. How to estimate lexical coverage for books without storing text? (sampling + frequency lists)
8. Should media reflection count as a full production day or a partial one?
9. How much C1 content ships in the first content wave vs later?
10. When to prompt the anonymous-to-email upgrade without hurting onboarding?
11. What adaptive ratio (foundation vs generated) is sustainable after cost/quality data?
12. How much human review capacity is available for generated-item promotion?

## 11. Glossary

- **CEFR**: European framework A1-C2. Default proficiency framework.
- **Target language (`target_lang`)**: the language being learned. Phase 1: `en`.
- **Native language (`native_lang`)**: the learner's L1, used for transfer rules and
  explanations. Phase 1: `it`.
- **UI locale (`ui_locale`)**: the language of the interface, independent of the target
  language. Phase 1: `it`.
- **Explanation mode**: `target_simple` (simple target language) or `native`.
- **Proficiency framework**: the scale used to label progress (`CEFR` by default; other
  frameworks can be mapped without changing the learner-model math).
- **Micro-skill / KC**: atomic knowledge unit (e.g. `present_perfect_experience`).
- **Learner model**: estimate of competence state per skill.
- **SRS**: spaced repetition; **FSRS**: scheduling algorithm.
- **Recast**: correct reformulation without interrupting the flow.
- **Foundation item bank**: pre-generated, validated exercise set used first; not the whole product.
- **Rule-bank**: catalog of citable grammar rules with `rule_id`.
- **Golden set**: reference set for evaluating prompts.
- **Comprehensible input**: media where 90-95% of words are known at the learner's level.
- **Taste profile**: formats, genres, themes, difficulty tolerance, subtitles, time, region.
- **Media recommendation**: metadata-only suggestion with legal availability and a spoiler-free reason.
- **Consent**: explicit, versioned permission (terms, privacy, voice, AI processing, analytics).
- **Retention**: how long audio, transcripts, logs, and backups are kept before deletion.
- **Prompt injection**: instructions hidden in learner text that try to override the system prompt.
- **Leech**: an SRS card repeatedly failed and flagged for extra attention.
- **Review backlog cap**: limit on due cards per day to avoid a punitive pile-up after a break.
- **Source of truth**: Postgres. There is no local cache or write queue.
- **Online-first**: no local database or offline mode (ADR-023).
- **Fetch**: the client refetches server state after writes and auth changes.
- **RLS**: Postgres row-level security; `user_id = auth.uid()`.
- **Device**: a registered client; can be revoked.
- **Test-out**: proving a level/concept is already known and skipping it.
- **Promotion**: moving to the next CEFR band after sustained evidence.
- **Remediation**: targeted review of a lower-level gap without demoting the learner.
- **Content request**: typed spec (purpose, level, concepts, context) for on-demand generation.
- **Adaptive content**: composition from foundation/cached items plus generated/personalized items.
- **Private item**: generated for one learner (`owner_user_id`), expires, never shared automatically.
- **Promotion**: moving a reviewed private item into the global foundation bank.
