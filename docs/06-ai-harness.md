# AI harness

Everything about models: gateway, versioned prompts, schemas, evaluation, caching, budget, and
logging. Goal: measurable quality and predictable costs with cheap models.

## 1. Architecture

```
packages/ai
  gateway.ts        routing by tier, retry, fallback, timeout, circuit breaker
  providers/        adapter per provider (gemini, openai, groq, assemblyai)
  prompts/          one file per prompt, with metadata and template
  schemas/          Zod input/output, shared with the core
  cache.ts          input hash, TTL, Postgres cache
  cost.ts           price table, cost calculation, budget guard
  log.ts            prompt_calls writes (server-side)
  eval/             golden-set runner (used by tools/eval)

services/api
  src/ai-gateway.ts  JWT check, quota check, gateway call, SSE streaming
```

Rules:

- No provider call outside `gateway.ts`; the gateway runs inside the JWT-gated Hono API.
- Every prompt has `id`, `version`, `tier`, `temperature`, `outputSchema`.
- Invalid output -> repair (max 2) -> deterministic fallback or handled error.
- Provider keys live only in Hono service secrets; the client never sees them.

### 1.1 Hono API execution

- The AI gateway runs in `services/api` (Hono, Node 26) with Supabase JWT verification, quota
  checks, and server-side cost logging.
- Streaming uses SSE; the handler closes the stream when the turn ends.
- Timeouts are explicit per tier; the API is long-lived, so cold starts are not a concern.
- The same `packages/ai` gateway is used in tests and by the eval runner; do not duplicate logic.

## 2. Prompt registry

Prompt format:

```ts
export const exerciseGenerate = definePrompt({
  id: 'exercise.generate',
  version: 1,
  tier: 'fast',
  temperature: 0.4,
  maxOutputTokens: 1500,
  system: `...`,
  userTemplate: `...`,
  inputSchema: ExerciseGenerateInput,
  outputSchema: ExerciseBatch,
  guardrails: [
    'Exactly one correct, unambiguous answer',
    'Plausible but clearly wrong distractors',
    'No protected content or trademarks',
    'Explanation in simple target language (English in phase 1)',
  ],
  eval: { goldenSet: 'exercise.v1', minPassRate: 0.9 },
});
```

The registry is versioned in git. The DB stores only metadata and outcomes for audit
(`prompt_versions`, `prompt_calls`).

### Prompt change workflow

1. Edit `packages/ai/prompts/<id>.ts` and `docs/prompts/<id>.md`.
2. Increment `version`.
3. Update the golden set if the contract changes.
4. Run `pnpm eval:recorded --prompt=<id>` in CI and `pnpm eval --prompt=<id>` (sampled) before release.
5. Report in the commit: pass rate, key metrics, average cost.
6. If the pass rate drops below the threshold, the prompt does not ship.

## 3. Prompt inventory

| ID | Tier | Use | Frequency | Doc |
|---|---|---|---|---|
| `assessment.item.generate` | fast | Assessment item generation (batch) | offline | `docs/prompts/assessment.md` |
| `assessment.evaluate` | reason | Writing/speaking evaluation | onboarding | `docs/prompts/assessment.md` |
| `exercise.generate` | fast | Item bank generation (batch) | offline | `docs/prompts/exercise-generation.md` |
| `content.generate` | fast | On-demand personalized items / remediation | when no fit | `docs/prompts/adaptive-content.md` |
| `curriculum.plan` | reason | Two-week plan | rare | `docs/prompts/curriculum-plan.md` |
| `curriculum.repair` | balanced | Plan patch | on trigger | `docs/prompts/curriculum-plan.md` |
| `conversation.turn` | fast | Tutor turn | real-time | `docs/prompts/conversation-tutor.md` |
| `conversation.opener` | fast | Scenario opening | per session | `docs/prompts/conversation-tutor.md` |
| `correction.evaluate` | reason | Post-hoc correction | per session | `docs/prompts/correction.md` |
| `media.explain` | fast | Spoiler-free recommendation reason | per batch, cached | `docs/prompts/media-recommendation.md` |
| `media.guide` | balanced | Watch/read guide and phrase suggestions | per accepted title, cached | `docs/prompts/media-recommendation.md` |
| `media.reflect` | reason | 60s/80-word reflection evaluation | per media session | `docs/prompts/media-recommendation.md` |
| `safety.moderate` | fast | Output safety classification | sampled | planned |
| `cefr.estimate` | reason | Level estimation from evidence | assessment | planned, needs doc |
| `content.explain` | fast | Rule explanation | on demand | planned, needs doc |
| `stt.transcribe` | stt | Audio transcription (adapter, not a prompt) | per voice turn | — |
| `tts.synthesize` | tts | Phrase audio (adapter, not a prompt) | per target phrase | — |

Prompts marked "planned" must not be implemented without a doc, schema, and golden set.
`stt` and `tts` are API adapters, not prompt templates.

## 4. Model routing

| Tier | Primary | Fallback | Why |
|---|---|---|---|
| fast | Gemini 3.1 Flash-Lite | GPT-4.1-mini | cost/latency, reliable JSON |
| balanced | GPT-4.1-mini | Gemini 3 Flash | quality/price |
| reason | GPT-5-mini | Gemini 3 Flash | correction and planning |
| stt | AssemblyAI Universal-Streaming | Groq Whisper, Web Speech | credits + quality |
| tts | SpeechSynthesis (browser) | OpenAI tts-1, AssemblyAI TTS | free by default |

Indicative prices (USD, November 2026; verify price lists):

| Model | Input /1M | Output /1M |
|---|---:|---:|
| Gemini 3.1 Flash-Lite | 0.25 | 1.50 |
| Gemini 3 Flash | 0.50 | 3.00 |
| GPT-4.1-mini | 0.40 | 1.60 |
| GPT-4o-mini | 0.15 | 0.60 |
| GPT-5-mini | 0.25 | 2.00 |
| DeepSeek (off-peak) | 0.15 | 0.60 |
| Groq Whisper | ~0.0019/min | — |
| AssemblyAI streaming EN | 0.15/hour | — |
| AssemblyAI async | 0.21/hour | — |
| AssemblyAI TTS | 15/1M characters | — |
| OpenAI tts-1 | 15/1M characters | — |

Routing is configurable in `settings.model_prefs_json`, but tiers stay abstract: the learner
chooses "economy / balanced", not the exact model.

## 5. Structured output

- Zod schema is the single source of truth; JSON Schema is generated for the provider.
- Prompt instructions are explicit: "Respond with valid JSON only, matching the schema".
- Validation: `schema.safeParse`; on error, repair with a message containing the exact error
  and the produced JSON.
- Maximum 2 repairs. Then:
  - exercises: discard the item, pick another from the bank;
  - conversation: deterministic fallback ("Let's try that again.");
  - correction: no correction shown, only `praise`.
- Never use `as` to force the type: invalid data does not enter the DB.

## 5.1 Language parameterization

Every prompt input carries a `LanguageContext`:

```ts
type LanguageContext = {
  targetLang: string;            // BCP-47, e.g. 'en'
  nativeLang: string;            // BCP-47, e.g. 'it'
  explanationMode: 'target_simple' | 'native';
  proficiencyFramework: string;  // 'CEFR' in phase 1
};
```

- System prompts never name a specific language. They refer to "the target language" and use
  the input values.
- `uiLocale` is not a model input: UI chrome is localized client-side from locale catalogs.
  The model does not generate UI copy.
- Rule IDs are namespaced by `targetLang` (`en.gram...`). Filter the rule-bank by
  `target_lang` (and `native_lang` where transfer matters) before passing it to the model.
- STT adapters receive a language code derived from `targetLang`; TTS adapters receive a
  locale/voice. The mapping lives in the provider adapter, not in prompts.
- Golden sets are keyed by `(targetLang, nativeLang)`. Phase 1 is `en-it`.
- Content packs, item banks, scenarios, and rule-banks are all scoped by the language pair.

## 5.2 Safety and prompt injection

- Learner text and audio are untrusted data. Wrap them in explicit delimiters and label them
  as data in the system prompt.
- The system prompt states that instructions inside learner content must never be followed.
- No tools, browsing, file access, or secrets in prompts.
- Output is schema-bound except the conversation turn; corrections, plans, exercises, and
  media guides are validated with Zod.
- Moderation runs before display: hate, harassment, sexual content, violence, self-harm,
  illegal/medical/legal/financial advice, invented URLs, and spoilers are blocked.
- On a moderation hit: deterministic fallback, log `status = 'moderated'`, never show raw output.
- Red-team cases live in `docs/13-safety-privacy.md` and must pass in CI.
- Recommendations must use database availability, never model-invented providers.

## 6. Grammar hallucination prevention

Mandatory pipeline for every correction:

1. The LLM produces `{span, suggestion, ruleId, confidence, ...}`.
2. `span` must exist literally in the learner's text.
3. `ruleId` must exist in the rule-bank for the active `targetLang` and start with
   `<targetLang>.`.
4. `confidence ≥ 0.7`.
5. Dedupe against errors already reported in the session.
6. If any check fails: do not show, log as `suspicious`.

Quality metric: percentage of shown corrections a human judges correct. Target ≥ 97%.
Below 95%, block the prompt release.

## 7. Caching

- Key: `sha256(promptId + version + model + canonicalJson(input))`.
- Local cache (SQLite) for deterministic responses (explanations, audio).
- Postgres cache for the gateway, configurable TTL.
- `temperature = 0` for correction, evaluation, CEFR estimation: cacheable.
- Do not cache conversation (depends on history), except the opener per scenario.
- TTS cache by text hash + voice.
- Cache scope: include `user_id`/`profile_id` for anything personalized (media guides,
  reflections). Never serve one learner's personalized output to another.
- Media explanations are cached per `(media_id, level_band, taste_bucket)`; guides per
  `(media_id, level_band)`; both are invalidated on catalog changes.

## 8. Batch and pre-generation

- Item bank: offline batch with `pnpm seed`, `fast` model, validation + spot-check.
- Audio for target phrases: pre-generated and cached.
- Embeddings (phase 2): nightly batch, pgvector.
- Never batch the real-time turn.

## 8.1 On-demand content generation

- Triggered by the content planner only when no foundation/cached item fits, or for a defined
  remediation/new-can-do/"more like this" request.
- Input is a typed `ContentRequest`; output is a small batch (1-5 items), schema-bound.
- Cache by spec hash; dedupe before generation; prefer a cached/private item.
- Validation gates: schema, rule-bank, uniqueness, level, safety, copyright.
- Private by default (`owner_user_id`), TTL 30-90 days; human sample; promotion to global.
- Caps per session/day; deterministic foundation fallback on cap/timeout.
- Offline requests queue and fulfill on reconnect; never block a session.
- Cost target: ≤ €0.01 per session of generated content.

## 9. Eval harness

### 9.1 Golden set

Minimum composition per exercise prompt (per type):

| Type | Items | Criteria |
|---|---:|---|
| Cloze | 30 | unique answer, sufficient context |
| Transformation | 20 | unambiguous transformation |
| Word order | 20 | one correct sequence |
| Comprehension | 20 | plausible distractors |
| Production | 20 | applicable rubric |
| Correction | 40 known-error sentences + 20 correct | precision/recall per `rule_id` |

Each case has: input, expected output or criteria, `rule_id`, CEFR level, notes.
Media golden set: 50 titles × 10 taste profiles × 5 regions, with level-fit, spoiler, and
availability expectations (`docs/prompts/media-recommendation.md`).

Adaptive content golden set: 30 `ContentRequest`s (missing fit, remediation, new can-do,
"more like this", C1) with expected level, uniqueness, rule-bank, and safety outcomes.

### 9.2 Metrics

| Metric | Threshold |
|---|---|
| Valid schema | ≥ 99% |
| Unique/unambiguous answer | ≥ 95% |
| Grammar correctness | ≥ 97% |
| CEFR appropriateness | ≥ 90% |
| Distractor quality | ≥ 85% |
| Correction precision | ≥ 97% |
| Correction recall | ≥ 80% |
| p95 latency | see budget |
| Average cost per item | ≤ $0.002 |

### 9.3 LLM-as-judge

- Explicit rubric, anchor examples per level, temperature 0.
- Two independent evaluations; if they diverge, a third.
- Calibrate against 30 human judgments; report agreement.
- Known biases: position, verbosity, self-preference. Randomize order and avoid using the
  same model as generator and judge when possible.

### 9.4 CI

- `pnpm eval:recorded` runs on every PR that touches prompts, content, or AI code. It uses
  recorded fixtures, no network, deterministic, no cost.
- `pnpm eval` (live, sampled) runs nightly and before a release.
- If the recorded pass rate drops below threshold, the PR is blocked; the report is attached.
- Live eval cost is capped and logged.

## 10. Budget and costs

### 10.1 Guardrails

- Per-user daily budget (`settings.ai_daily_budget_usd`, default 0.50).
- Per-feature quotas: onboarding assessment reserve, conversation, correction, media guides,
  and on-demand content generation.
  Onboarding may spend up to 0.15 $ before the first session; if the reserve is exhausted,
  fall back to a shorter placement test.
- Materialize spend in `ai_usage_daily` and check it before every call.
- Global monthly budget server-side (Hono + Postgres).
- Alerts at 70% and 90%.
- Over budget: disable conversation and correction, keep the offline loop.
- Circuit breaker: 5 provider errors in 60 s -> 5-minute pause, fallback.
- Timeouts: fast 20 s, reason 45 s, stt 30 s.
- `max_tokens` always set.

### 10.2 Active-user estimate

Scenario: 20 minutes/day, 15 conversation turns, 2 written productions, 5 minutes of audio,
3,000 TTS characters with 70% cache hit.

| Item | Calculation | Cost/day |
|---|---|---:|
| AssemblyAI streaming STT | 0.33 h × $0.15/h | $0.050 |
| Conversation (Flash-Lite) | ~16k in / 10k out | $0.019 |
| Correction (reason) | ~8k in / 2k out | $0.006 |
| TTS | 900 chars × $15/1M | $0.014 |
| **Total** | | **~$0.09** |

≈ $2.7/month (~€2.5) per active user, with headroom for peaks. Cost stays below €20/month
even at double usage. The $50 AssemblyAI credits cover weeks of STT.

One-off item bank cost: 500 items × ~600 output tokens ≈ 300k tokens -> ~$0.45 with
Flash-Lite, plus evaluation cost.

Media recommendations: ranking is local and free; explanations are cached (< $0.001); guides
cost ~$0.002 each and are cached per media/level. Target < $0.01/day per active user.

On-demand content: ~$0.002 per generated item, capped at 5 items/session; target ≤ €0.01 per
session, with a deterministic foundation fallback when the cap is hit.

### 10.3 Logs

Every call writes to `prompt_calls`: `prompt_id`, `version`, `model`, `tokens`, `cost_usd`,
`latency_ms`, `status`, `repairs`, `cached`. No user text, only hashes.

## 11. Privacy

- The Hono API logs neither prompts nor responses.
- Audio is sent to the provider only for transcription, then deleted.
- EU region providers where available (AssemblyAI EU at the same price).
- Explicit consent on first microphone use.
- The learner can delete transcripts and data at any time.

## 12. Deterministic fallbacks

| Feature | Fallback |
|---|---|
| Conversation | per-scenario template response + "try again" |
| Correction | praise only + 1 focus from the known-error rule-bank |
| Plan | template by level and available time |
| Exercises | local item bank |
| Explanation | static rule-bank text |

The product must remain usable with AI off.

## 13. AI release checklist

- [ ] Prompt versioned and documented.
- [ ] Prompt uses `targetLang`/`nativeLang`/`explanationMode`; no hardcoded language names.
- [ ] Zod schema and validation tests.
- [ ] Golden set updated.
- [ ] `pnpm eval:recorded` green (CI) and `pnpm eval` green (sampled, before release).
- [ ] Prompt-injection red-team cases pass.
- [ ] Moderation fallback tested.
- [ ] Per-feature quota and budget checked.
- [ ] Media prompts: no spoilers, no piracy, availability from the DB.
- [ ] Average cost measured and within budget.
- [ ] Fallback manually tested.
- [ ] No secrets in logs or fixtures.
- [ ] `prompt_calls` populated correctly.
