# Adaptive engine

> **Online-first (ADR-023).** Offline/SQLite/PowerSync references in this document are
> superseded: the app requires connectivity and has no local write queue.

Specification of the app's "brain". Everything described here lives in `packages/core` as
pure, deterministic functions tested without network. Thresholds are defaults to be tuned on
real data, not universal truths.

## 1. Principles

1. **One estimate per micro-skill, not a single level.** A learner can be B1 in reading and
   A2 in speaking: this is normal.
2. **Explicit uncertainty.** Every estimate has a standard error and an observation count.
3. **Evidence before opinions.** The LLM proposes; the rule-bank and data decide.
4. **Incremental adaptation.** The plan is not regenerated from scratch: patches are applied.
5. **Explainability.** Every proposed exercise has a coded reason.
6. **Language is an input, not an assumption.** Skills, concepts, rules, scenarios, and
   prompts are scoped by `target_lang`; L1 transfer is scoped by `native_lang`.

## 2. Knowledge graph and taxonomy

### 2.1 Nodes

- **Skill** (domain): grammar, vocabulary, listening, speaking, reading, writing, pragmatics.
- **Concept / KC** (micro-skill): e.g. `present_perfect_experience`,
  `prepositions_time`, `false_friend_actually`, `phrasal_verb_look_after`.
- **Item**: exercise linked to 1-3 concepts and 1 skill.
- **Prerequisites**: directed edges with weight 0-1 (`concept_edges`).

Skill and concept codes are scoped by `target_lang`; the same code may exist for different
target languages but never twice within one language. Rule IDs are namespaced
(`en.gram...`) and lookups always include the active `target_lang`.

Example chain:

```
past_participle_irregular
   -> present_perfect_form
        -> present_perfect_experience
             -> present_perfect_vs_past_simple
```

The planner does not propose a node if prerequisites with weight ≥ 0.7 are not at least
"learning" (mastery ≥ 0.5).

### 2.2 Skill arithmetic

```ts
type SkillState = {
  theta: number; // latent ability, logit scale
  se: number; // standard error
  nObs: number;
  lastSeen: string; // ISO UTC
  mastery: number; // P(correct) on a target-difficulty item
};
```

## 3. Initial assessment

### 3.1 Structure

| Part                             | Content                              | Weight |
| -------------------------------- | ------------------------------------ | ------ |
| Objective (12-18 adaptive items) | cloze, transformation, comprehension | 0.55   |
| Writing (1 task, 60-120 words)   | guided production                    | 0.15   |
| Speaking (2 tasks, 60-90 s)      | description + question response      | 0.30   |

Target duration: 12-20 minutes. The item pool spans A1-C1; a first visible win must arrive
within 5 minutes. Start near the self-assessment estimate and branch adaptively.

### 3.2 Adaptive selection (1PL Elo)

For each skill:

```
P(correct) = 1 / (1 + exp(-(theta - b) / s))
```

- `theta`: estimated learner ability for the skill.
- `b`: item difficulty.
- `s`: discrimination scale, default 1.2.

Update after each response:

```
theta' = theta + K * (outcome - P)
K = max(0.12, 0.40 / (1 + nObs / 10))
```

Next item selection: maximum information near `theta`, with constraints:

- no more than 2 consecutive items on the same concept;
- minimum coverage: 3 domains;
- target difficulty `b ≈ theta` (window ±0.6).

Stop rule (first one met):

- `se(theta) < 0.35` for all measured skills;
- 25 total items;
- 8 consecutive correct or incorrect responses (sign of poor calibration or guessing).

Error estimate:

```
se = max(0.15, 1 / sqrt(nObs + 1))
```

then adjusted by a decay factor if the last observation is old.

### 3.3 Item calibration

1. The LLM assigns an initial difficulty on a 1-5 scale; mapped to initial `b`.
2. 30-50 pilot responses per item (including the author's) update `b`.
3. After 100 responses: if `p-value` (percent correct) > 0.95 or < 0.15, retire or rewrite the
   item; if correlation with the total is negative, flag it.
4. Retired items stay in the DB with `retired_at`, not deleted.

### 3.4 CEFR mapping

Default cut scores on the `theta` scale (recalibrate over time):

| CEFR | theta        |
| ---- | ------------ |
| A1   | < -1.5       |
| A2   | -1.5 .. -0.5 |
| B1   | -0.5 .. 0.7  |
| B2   | 0.7 .. 1.8   |
| C1   | > 1.8        |

The displayed level is an interval: `[theta - se, theta + se]` mapped to cut scores.
If the interval crosses two levels, the UI shows "A2/B1".

CEFR is designed for European languages. For a non-CEFR target, the same `theta` scale maps
to another `proficiency_framework` (e.g. JLPT, HSK) without changing the learner-model math.

### 3.5 Writing and speaking

**Writing**: analytic rubric with 5 dimensions (task achievement, coherence, range, accuracy,
register), 0-5 with CEFR descriptors. Two independent passes at temperature 0; if they differ
by > 1 point, a third pass or an "uncertain" flag.

**Speaking**: STT -> transcript -> rubric on 4 dimensions (task, fluency, range, accuracy)

- a qualitative intelligibility note. Phoneme-level pronunciation is not reliable with STT
  alone: present it as an estimate, not a grade.

### 3.6 Can-do catalog and test blueprint

The curriculum is anchored to CEFR can-do statements, not to grammar topics alone. Example
for B1:

| Can-do                                            | Micro-skills                                 | Evidence                        |
| ------------------------------------------------- | -------------------------------------------- | ------------------------------- |
| Describe past experiences and their relevance now | `present_perfect_experience`, `time_markers` | cloze + 60-word writing         |
| Handle a routine phone call                       | `requests`, `clarification`, `numbers`       | roleplay + listening MCQ        |
| Explain a technical problem in a standup          | `sequencing`, `cause_effect`, `work_lexicon` | 90-second speaking + correction |
| Disagree politely                                 | `hedging`, `register`                        | roleplay                        |

This is a B1 sample; A1, A2, and C1 use the same structure with their CEFR descriptors.

Placement blueprint (phase 1, 18-24 items across A1-C1):

| Skill      | Items   | Minimum evidence |
| ---------- | ------- | ---------------- |
| Grammar    | 6-8     | 3 items          |
| Vocabulary | 4-6     | 3 items          |
| Listening  | 3-4     | 2 items          |
| Reading    | 2-3     | 2 items          |
| Writing    | 1 task  | 1 task           |
| Speaking   | 2 tasks | 2 tasks          |
| Pragmatics | 2-3     | 2 items          |

If a skill has fewer than the minimum evidence, report "not measured" instead of a fake level.

### 3.7 Rubric anchors

Writing/speaking use 0-5 analytic scores. Anchors (abridged):

| Score | Descriptor                                                                  |
| ----- | --------------------------------------------------------------------------- |
| 0     | No assessable language, or off-topic                                        |
| 1     | A1: isolated words, frequent breakdowns                                     |
| 2     | A2: simple sentences, limited range, errors often impede                    |
| 3     | B1: connected ideas, enough range for familiar topics, errors rarely impede |
| 4     | B2: clear, detailed, flexible; occasional errors                            |
| 5     | C1: fluent, well-organized, precise; errors are slips                       |

Dimensions: task achievement, coherence, range, accuracy, fluency (speaking). The final report
shows the median of two passes and a level range, never a bare score.

### 3.8 Assessment persistence

Every assessment writes to `assessments` and `assessment_scores` with the prompt version, raw
JSON, confidence, and per-dimension scores. The in-progress state (served items, current item,
responses) lives in `assessments.raw_json` so a placement can resume after a reload. This enables:

- history and trend charts;
- recalibration after 2 weeks;
- prompt regression analysis;
- explaining why a level changed.

**M2 slice.** The first implementation measures grammar, vocabulary, reading and pragmatics with
18 objective items. Listening, writing and speaking are reported as "not measured" until their
item banks and rubrics exist; the UI never invents a level for them.

### 4.3 Test-out, remediation and challenge (M2)

- Concept mastery uses an EMA with `alpha = 0.3`, seeded at `0.5`. A concept is testable-out
  only with `mastery >= 0.85` and at least 2 observations; one lucky answer is never enough.
- A measured skill is flagged for remediation when it sits at least one CEFR band below the
  overall placement level. The response lists the concepts in that skill with `mastery < 0.5`.
- The next band is suggested only when placement confidence is `>= 0.6` and no remediation is
  open. Remediation always wins over challenge.
- Decisions are stored in `assessments.raw_json`, `user_concept_state`, and `level_events`
  (`test_out`, `remediation`). The first placement usually has no test-outs because the starter
  bank has one item per concept; the rule is built for accumulating evidence.

## 4. Learner model

### 4.1 Update

On every attempt:

```
posterior = updateElo(state[skill], item.difficulty, correct)
concept.mastery = EMA(concept.mastery, outcome, alpha=0.3)
concept.evidence += 1
```

`user_skill_state` is updated in the same transaction as the attempt. `attempts` stays
append-only: state is always reconstructible. Because `skill_id` is scoped by `target_lang`,
the same table automatically separates progress across target languages.

### 4.2 Shrinkage

With little data, a skill must not look "strong" or "weak" by chance:

```
theta_adj = lambda * theta + (1 - lambda) * theta_user_mean
lambda = nObs / (nObs + 5)
```

### 4.3 Decay

Uncertainty grows with time since the last observation; the estimate does not drop without
evidence:

```
se' = sqrt(se^2 + (0.02 * daysSinceLastSeen)^2)
```

If `se' > 0.5`, the skill becomes "to verify" and the planner inserts a control item.

### 4.4 Mastery and consolidation

```
mastery = P(correct | theta, b_target)
```

- `mastery ≥ 0.75` and `se ≤ 0.30` -> **consolidated**
- `0.55 ≤ mastery < 0.75` -> **learning**
- `< 0.55` -> **to introduce/reinforce**

### 4.5 Calibration job

The item difficulty is updated offline, never by the client:

1. Join `attempts` with `items` and `user_skill_state`.
2. For each item with ≥ 30 responses, update `difficulty_b` with a small learning rate
   (`b += K_i * (P - outcome)`, `K_i` decreasing with n).
3. Compute p-value and discrimination; flag items outside 0.2-0.9 or below 0.2.
4. Retire or rewrite flagged items; keep history.
5. Version the calibration output in the next content pack.
6. Re-run after every 100 new responses per item or monthly, whichever comes first.

Bootstrap: start from the LLM difficulty estimate, then 30-50 pilot responses, then the job.
Do not show "calibrated" precision before enough data exists.

## 5. Curriculum

### 5.1 Derivation chain

```
CEFR -> can-do statement -> micro-skill -> exercise type -> item
```

Example: B1 "talk about experiences" -> `present_perfect_experience` +
`irregular_past_participles` + `time_markers` -> cloze, transformation, guided production.

### 5.2 Daily session

Default quotas (configurable):

| Block      | Quota | Content                                            |
| ---------- | ----- | -------------------------------------------------- |
| Review     | 40%   | due SRS cards, ordered by urgency                  |
| New input  | 30%   | 1-2 new or learning concepts, skipping known ones  |
| Production | 30%   | writing/speaking, minimum 3 minutes or 4 responses |

Rules:

- At most 1 new "hard" concept per session.
- At least one production item every 5 recognition items.
- If available time is ≤ 8 minutes, the session becomes a "micro-loop":
  review only + 1 short production.
- Known concepts (mastery ≥ 0.85) are excluded from "new input"; they appear only as reviews.
- Near promotion, add 1-2 "stretch" items from the next band.

### 5.3 Two-week plan

The LLM (`reason` tier) generates JSON with a strict schema:

```ts
type CurriculumPlan = {
  version: number;
  horizonDays: 14;
  goal: string;
  units: Array<{
    day: number;
    type: 'input' | 'practice' | 'production' | 'assessment';
    skillCodes: string[];
    conceptCodes: string[];
    activityTemplates: string[];
    successCriteria: string;
    estimatedMinutes: number;
  }>;
};
```

Deterministic validation before saving:

- every `skillCode`/`conceptCode` exists in the knowledge graph;
- prerequisites are covered or marked as review;
- `estimatedMinutes` between 10 and 30 per day;
- at least 2 production blocks per week;
- no new concept without prerequisites.

If validation fails: 1 repair attempt with the exact error; then fall back to a deterministic
template for the level.

### 5.4 Incremental patch

Triggers:

- same `error_type` + `rule_id` ≥ 3 times in 14 days;
- skill mastery drops below 0.55 after being consolidated;
- the learner reports "too easy"/"too hard" for 2 sessions.

Action: insert 3-5 corrective items and 1 production task over the next 3 days.
Do not regenerate the whole plan.

### 5.5 Exercise rationale

Every item in a `SessionPlan` carries a `rationale`:

```ts
type Rationale =
  | { code: 'due_review'; detail: string }
  | { code: 'prerequisite_gap'; detail: string }
  | { code: 'recurring_error'; ruleId: string }
  | { code: 'new_concept'; detail: string }
  | { code: 'production_quota' }
  | { code: 'weak_skill'; skill: string };
```

The UI translates it into a sentence: "Review: this sentence slipped 3 times."

### 5.6 Test-out, promotion, and remediation

**Known / test-out**

A concept or skill is known when:

- mastery ≥ 0.85 and `se` ≤ 0.25 with ≥ 5 evidence points, or
- a challenge item at the next band is passed.

Known concepts are not taught again. They keep maintenance reviews and production. The planner
never serves a "new" item for a known concept.

**Challenge ("too easy")**

- The learner can tap "too easy" on any item.
- The app serves 2-3 harder items from the next band.
- Pass -> promote; fail -> keep the level and add a short review. No automatic mastery bump.

**Promotion**

- `theta` interval fully above the next cut-score for two consecutive sessions, and
  mastery ≥ 0.85.
- On promotion, the lower band is marked consolidated; the planner starts the next band.
- Log `level_events` with `reason = 'promotion'`.

**Remediation (no demotion)**

- An error maps to a concept and its band.
- If a lower-band concept is not consolidated, add 3-5 items + 1 production task over 3 days.
- If 3+ lower-band errors in 14 days, add a "foundation review" block.
- Keep the current level; log `level_events` with `reason = 'remediation'`.
- The UI says "ripasso mirato", never "sei tornato indietro".

**Placement confidence**

- If the placement interval is wide, start conservative and schedule a recheck after 5 sessions.
- A learner can be B2 in reading and A2 in speaking; promotion is per skill.

### 5.7 Adaptive content composition

Every session is composed, not pre-set:

```
ContentPlanner(snapshot, sessionPlan, candidates)
  -> prefer foundation bank + cached personal items
  -> filter by level, mastery, due reviews, can-do, prerequisites
  -> personalize with typed interests, work/daily context, recent errors
  -> if a slot has no fit -> ContentRequest -> generate -> validate -> cache -> serve
```

Generation triggers:

- no suitable item for the concept/level/context;
- recurring error needing remediation;
- a new can-do with no practice items;
- "more like this" request;
- media guide or conversation scenario needing a tailored prompt.

Rules:

- Target 70-80% foundation/cached, 20-30% generated/personalized; 0% generated offline.
- Never generate for known concepts (mastery ≥ 0.85) except remediation/review.
- Validate with schema, rule-bank, dedupe, level, safety, copyright; reject on failure.
- Private by default (`owner_user_id`), TTL 30-90 days, promotion to global only after review.
- Per-session/day caps; deterministic fallback on cap or timeout.
- Offline: queue requests, keep the session usable with cached items.

## 6. Spaced repetition (FSRS-7)

### 6.1 Rules

- `ts-fsrs` v6, FSRS-7, `desiredRetention = 0.90` (range 0.85-0.92).
- Two card types: `recognition` and `production`, separate parameters.
- Maximum interval 180 days.
- Free production is not a card: if it contains confirmed errors, create a `production` card
  for the corrected phrase, with deduplication.

### 6.2 Rating

| Rating      | When                                                        | Example                 |
| ----------- | ----------------------------------------------------------- | ----------------------- |
| `again` (1) | wrong, or correct with a heavy hint                         | wrong tense             |
| `hard` (2)  | correct but slow (above the 90th percentile) or with a hint | hesitates 8 s           |
| `good` (3)  | correct and on time                                         | normal response         |
| `easy` (4)  | correct, fast, no hesitation (rare)                         | immediate and confident |

Grant `easy` sparingly: it inflates intervals and reduces useful review.

### 6.3 Dedupe

Key: `(user_id, source_type, source_id, card_type)`. Saved phrases are deduplicated at creation
by `(profile_id, normalized_text)` before a card exists. If a card with the same key exists,
update `due_at` instead of creating a new one.

### 6.4 Operational rules

**Rating mapping by exercise type**

| Exercise                     | `again`                   | `hard`                              | `good`       | `easy`                   |
| ---------------------------- | ------------------------- | ----------------------------------- | ------------ | ------------------------ |
| Cloze / transformation / MCQ | wrong                     | correct with hint or > p90 latency  | correct      | correct fast, no hint    |
| Word order / dictation       | wrong order/missing words | correct with hint                   | correct      | correct fast             |
| Free writing / roleplay      | rubric < 2                | rubric 2-3 or high correction count | rubric 3-4   | rubric 5, no corrections |
| Shadowing                    | unintelligible            | intelligible with effort            | intelligible | clear and fluent         |

**Answer tolerance**

- Normalize case, punctuation, whitespace, and curly apostrophes.
- Accept contractions and their expansions.
- Allow edit distance 1 for answers ≤ 6 characters; 0 above, unless the type allows typos.
- Numeric answers accept digits or words.
- Free production is rubric-scored, not string-matched.
- Tolerances are explicit per exercise type and covered by tests.

**Scheduling**

- Use `ts-fsrs` defaults for learning steps; do not invent intervals.
- Apply ±5% interval fuzz, deterministic with an injected seed in tests.
- At most 1 same-day re-review per card.
- Maximum interval 180 days; `desired_retention` 0.90 (0.85-0.92 configurable).

**Leeches, suspension, backlog**

- After 4 lapses: flag `leech = 1` and add a simpler production card.
- After 8 lapses: suspend the card and create a remediation drill.
- The learner can suspend/bury any card; siblings are buried for the day.
- Daily backlog cap: `min(2 * daily_goal, 60)` due cards. Above the cap, prioritize
  due + weak skills and pause new cards; never punish the learner for a backlog.
- A hint always lowers the rating (`easy` -> `good`, `good` -> `hard`).

## 7. L1 -> L2 transfer taxonomy (initial profile: IT -> EN)

The taxonomy is language-pair data, not code. Phase 1 ships the Italian -> English profile;
the same structure supports other native/target pairs. Rule IDs are namespaced by target
language (`en.gram...`).

| Code                            | Example                              | Typical rule                    |
| ------------------------------- | ------------------------------------ | ------------------------------- |
| `false_friend`                  | "actually" used for "currently"      | `en.lex.false_friend.actually`  |
| `preposition_dependent`         | "depend of"                          | `en.gram.preposition.depend_on` |
| `preposition_time`              | "in Monday"                          | `en.gram.preposition.time`      |
| `article_zero`                  | "the life is beautiful"              | `en.gram.article.zero`          |
| `tense_present_perfect`         | "I saw him yesterday" for experience | `en.gram.tense.present_perfect` |
| `tense_continuous`              | "I am agree"                         | `en.gram.tense.stative`         |
| `phrasal_verb`                  | "look after" vs "look for"           | `en.lex.phrasal.look_after`     |
| `collocation_make_do`           | "do a mistake"                       | `en.lex.collocation.make_do`    |
| `word_order`                    | "I very like it"                     | `en.gram.word_order.adverb`     |
| `subject_omission`              | "Is important to..."                 | `en.gram.syntax.subject`        |
| `register_direct`               | request without "could/please"       | `en.prag.requests`              |
| `pronunciation_intelligibility` | word not recognized by STT           | `en.phon.*`                     |

Rules:

- Every shown error must have a `rule_id` present in the rule-bank.
- `span` must exist literally in the learner's text.
- `confidence ≥ 0.7`; below that, log as suspicious and do not show.
- At most 2 focus points per session: correcting everything is noisy and demotivating.

## 8. Conversational tutor

### 8.1 State

```ts
type ConversationState = {
  scenarioId: string;
  goal: string;
  turn: number;
  maxTurns: number;
  targetLevel: CefrLevel;
  targetPhrases: string[];
  recurringErrors: string[]; // rule_id
  comprehensionSignal: 'ok' | 'confused';
};
```

### 8.2 i+1 calibration

- 90-95% of vocabulary known at the target level.
- At most 1 new structure per turn.
- Sentence length: A1 ≤ 8 words, A2 ≤ 12, B1 ≤ 18, B2 ≤ 24, C1 ≤ 30.
- One open question per turn; never end with a yes/no question.
- The level drops automatically if the learner writes "simpler", "I don't understand", or if
  the rate of incoherent responses exceeds 50% in the last 3 turns.

### 8.3 Recast

Preferred: reformulate the correct sentence inside the response, without meta-commentary.

```
Learner: I go to Rome last week.
Tutor: Nice! You went to Rome last week — what did you see there?
```

Explicit correction only if:

- the error is fossilized (≥ 3 occurrences), or
- the learner asks, or
- the error prevents comprehension.

### 8.4 Post-hoc correction (constrained JSON)

```ts
type CorrectionResult = {
  errors: Array<{
    span: string;
    errorType: ErrorType;
    ruleId: string;
    suggestion: string;
    explanationText: string;
    severity: 'low' | 'medium' | 'high';
    confidence: number; // 0-1
  }>;
  praise: string; // 1 thing done well
  nextFocus: string[];
};
```

Pipeline: generate -> Zod validation -> verify `span` in the text -> verify `ruleId` in the
rule-bank -> filter `confidence < 0.7` -> dedupe against known errors -> save.

If validation fails twice: show no correction, only deterministic `praise`, and log the event.

### 8.5 Scenarios

```ts
type Scenario = {
  id: string;
  titleNative: string;
  goal: string;
  cefr: CefrLevel;
  setting: string;
  targetPhrases: string[];
  successCriteria: string[];
  maxTurns: number;
  register: 'casual' | 'neutral' | 'formal';
};
```

First 10: bar, doctor, airport, small talk, standup, code review, interview, complaint,
phone call, travel.

### 8.6 Context window and turn budget

- Keep the scenario goal, target phrases, recurring errors, and the last 6-8 turns.
- Summarize older turns into 2-3 bullet facts; never send the full transcript.
- Token budget per turn: ~800 input / ~220 output; hard cap at 1,200 input.
- End the session when `max_turns` is reached, the success criteria are met, or the learner
  stops for 2 turns.
- On STT error or empty transcript: ask for a repeat, do not invent a learner turn.
- Streaming must be cancellable; a cancelled turn is not stored as an answer.

### 8.7 Audio pipeline

- Capture mono 16 kHz; 20-30 ms frames; voice activity detection with a 600-800 ms silence
  threshold.
- Stream 100-200 ms chunks; close the socket immediately when the turn ends (billing is per
  session duration).
- Latency budget: VAD < 50 ms, partial transcript < 300 ms, first tutor token < 2.5 s.
- Normalize the transcript (case, punctuation, filler) and let the learner edit before sending.
- On STT error or empty transcript: ask for a repeat, offer text mode; never invent a turn.
- TTS is browser-first with a server cache; no background audio in phase 1.
- Store only the transcript and metadata; delete audio within 24-48h.

## 9. Production evaluation

### 9.1 Rubrics

5 dimensions × 0-5, with descriptors anchored to CEFR. The final score is the median of two
passes; show the interval, not a bare number.

### 9.2 Bias controls

- Length: normalize by expected words.
- Verbosity: penalize repetition and filler.
- Position: randomize option order in judge prompts.
- Self-preference: do not use the same model as generator and judge when possible.

### 9.3 Pronunciation

With STT only: evaluate intelligibility and unrecognized words. Do not produce a phoneme-level
"pronunciation score". If needed, integrate Azure Pronunciation Assessment in M5 and state the
limits (accent, microphone, prosody only for en-US).

### 9.4 Media recommendations and reflection

Media recommendations are ranked deterministically in `packages/core/src/recommendation`
(see `docs/12-media-recommendations.md`). The learner model feeds the ranking with level,
taste, weak concepts, and recent error types; the ranking does not mutate mastery.

After a media session:

- a 60-second spoken or 80-word written reflection is evaluated with the writing/speaking
  rubric and counts as production;
- confirmed errors become `error_events` and SRS cards;
- saved short phrases become `saved_phrases` and `srs_cards` (`source_type = 'saved_phrase'`
  or `'media_phrase'`);
- watching/reading alone earns input XP, not a production streak.

## 10. Core contracts

```ts
export function selectNextItem(
  state: LearnerSnapshot,
  candidates: Item[],
  constraints: SelectionConstraints,
): Item;

export function gradeAttempt(item: Item, response: UserResponse): Grade;

export function updateLearner(
  state: LearnerSnapshot,
  item: Item,
  grade: Grade,
  now: Date,
): LearnerUpdate;

export function scheduleReview(card: SrsCard, rating: Rating, now: Date): SrsReviewResult;

export function buildDailySession(
  snapshot: LearnerSnapshot,
  plan: CurriculumPlan,
  availableMinutes: number,
  now: Date,
): SessionPlan;

export function planContent(
  snapshot: LearnerSnapshot,
  plan: SessionPlan,
  candidates: ContentCandidate[],
): ContentComposition;

export function rankMedia(
  candidates: MediaCandidate[],
  request: RecommendationRequest,
): ScoredRecommendation[];

export function updateTaste(tastes: TasteProfile, feedback: RecommendationFeedback): TasteProfile;
```

All functions: pure, no I/O, `now` injected, typed results.

## 11. Calibration and tuning

1. **First week**: collect 100-200 attempts; check difficulty distribution.
2. **Every 2 weeks**: review CEFR cut scores with data; adjust `s` and `K`.
3. **Every month**: check items with extreme p-values; retire/rewrite.
4. **Every prompt change**: rerun the golden set and compare accuracy/quality.
5. **Always**: log `prompt_version` and `model` for every shown correction.

## 12. Minimum engine tests

- Elo converges: with 50 coherent responses, `theta` approaches average difficulty.
- Stop rule: never exceeds 25 items and never drops below 12.
- CEFR mapping: monotonic and with intervals.
- FSRS: `again` reduces the interval; `good` increases it; `easy` increases it more.
- Dedupe: the same phrase does not create two cards.
- Planner: never proposes concepts without prerequisites (property test).
- Correction: no invented `rule_id` passes the filter.
- Decay: `se` grows with time, `theta` does not.
- Calibration: `difficulty_b` converges; extreme p-values are retired.
- SRS ops: leech flag at 4 lapses, suspend at 8, hint lowers rating, backlog cap respected.
- Answer tolerance: case/punctuation/contractions accepted; ambiguous typos rejected.
- Assessment: every result persists with per-dimension scores and confidence.
- Conversation: context summarization keeps the goal and last turns under the token budget.
- Media: level fit in 0.88-0.97, top-5 diversity, rejected titles excluded, no piracy.
- Taste: accepted/finished increase weights, rejected decrease them, too-hard lowers target.
- Test-out: known concepts are skipped; no new item for mastery ≥ 0.85.
- Challenge: "too easy" serves harder items; pass promotes, fail keeps the level.
- Promotion: requires evidence for two sessions; logs a `level_event`.
- Remediation: lower-band gaps add a targeted block without demotion.
- C1: passages/items validated for level, register, and no protected text.
- Content: foundation/cache first; generation only on a defined trigger; no known concepts.
- Generation: private items, TTL, dedupe, validation gates, cap, deterministic fallback.
- Offline: no generation; session uses cache/foundation and queues requests.
