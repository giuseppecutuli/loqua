# Gamification and retention

Goal: make daily practice desirable without punishing mistakes and without turning learning
into work. Mechanics are means to sustain the loop, not the product.

## 1. Principles

1. **Reward production, not tapping.** Speaking and writing count.
2. **Errors cost nothing.** No hearts, energy, or lives.
3. **Ethical loss aversion.** Protect the habit (grace day, repair), do not manipulate.
4. **Rewards tied to real progress.** Badges for verifiable milestones.
5. **No toxic competition.** No global leaderboards.
6. **One choice per day.** Today's plan is already decided.

## 2. Mechanics

| Mechanic | Rule | Purpose |
|---|---|---|
| Production streak | Day valid if ≥ 3 min spoken or ≥ 80 words written or ≥ 10 productive responses | Habit |
| Grace day | 1 grace day every 7 days, applied automatically | Reduce churn |
| Repair | Within 48h, a 5-minute conversation restores the streak | Active recovery |
| XP | Rewards for review, exercises, production, reuse in a new context | Visible progress |
| Per-skill levels | 10 levels per domain, based on mastery | Competence, not grinding |
| Daily quests | 3 small objectives, renewed daily | Direction |
| Weekly mission | 1 scenario to complete in 7 days | Purpose |
| Immersion quest | Watch/read a recommended title and save 3 phrases | Input + transfer |
| Badges / Awards | Verifiable milestones (first conversation, 50 errors fixed, etc.) | Recognition |
| Variable rewards | Extra content, surprise scenario, deeper feedback | Novelty |
| Activity calendar | Monthly view of productive days | Awareness |

### What is NOT there

- Hearts, energy, lives.
- Global leaderboard.
- Buying the streak with money.
- XP for mindless repeated answers.
- Guilt-inducing notifications.

## 3. Streak

### 3.1 Definition of a valid day

A day is valid if it meets **at least one**:

- 3 minutes of spoken production (STT active, not silence);
- 80 words written in production;
- 10 productive responses (not recognition).

Recognition and review alone keep the rhythm but not the streak: they maintain memory, they
do not "score the point".

The streak is account-level, not device-level: a valid day on Android or Web counts once.
Local notifications are scheduled per device from the account preferences.

### 3.2 Sustainable modes

The learner chooses during onboarding:

- **Daily**: 7/7 target.
- **Flexible**: 5/7 target (recommended default for working adults).
- **Weekend off**: 5/7 with Saturday and Sunday optional.

Flexible mode is not a "broken" streak: the counter measures valid days in the week.
It avoids the all-or-nothing effect.

### 3.3 Grace and repair

- Grace: 1 day every 7, automatic, does not consume XP.
- Repair: if the streak breaks, a 5-minute conversation within 48h restores it.
- No more than 1 repair per month can be accumulated.
- The app presents repair as an opportunity, not a debt.

## 4. XP

### 4.1 Base values

| Action | XP |
|---|---|
| Correct due review | 5 |
| Correct exercise | 8 |
| Correct exercise on first attempt | +2 |
| Written production (≥ 30 words) | 20 |
| Meaningful conversation turn | 6 |
| Session completed | 15 |
| Reuse of old vocabulary in a new context | 12 |
| Media reflection (60 s spoken / 80 words written) | 25 |
| Media finished | 40 |
| Phrase saved | 3 |
| Quest completed | 25 |
| Weekly mission | 100 |

### 4.2 Anti-grinding rules

- The same item repeated within 7 days is worth 0 XP (it still counts for SRS).
- Recognition answers are worth less than production.
- Watching/reading alone gives input XP (10) but never extends the production streak.
  The post-media reflection does.
- There is a daily soft cap of 300 XP: beyond it, XP does not count for quests and levels,
  but activity is still recorded.
- The "new context" bonus is awarded only if the vocabulary has not appeared in the last 3 days.

### 4.3 Per-skill levels

`level = floor(mastery * 10)`, with localized names from the UI catalog (Italian in phase 1:
Base, Solido, Sicuro, ...).
The level is per skill, not global: it avoids the illusion "I am level 12" while speaking
is stuck.

## 5. Quests

Deterministic generation from the core, with 3 daily slots:

| Slot | Type | Example |
|---|---|---|
| 1 | Review | "Review 15 due cards" |
| 2 | Production | "Write 60 words about what you did yesterday" |
| 3 | Error focus | "Use 3 time prepositions correctly" |

Weekly mission: one scenario (e.g. "Complete a simulated standup with 8 turns") or one
immersion quest ("Watch/read a recommended title and save 3 phrases").
Quests do not expire punitively: if not completed, they simply renew.

## 6. Badges and awards

Categories:

- **First steps**: complete onboarding, first assessment, first conversation.
- **Consistency**: 7, 30, 100 valid days (flexible mode counted correctly).
- **Competence**: consolidate 10 concepts, finish a unit.
- **Courage**: 10 minutes of conversation, first formal roleplay.
- **Comeback**: return after 7 days off and complete a session.

Badges have machine-verifiable criteria in `badges.criteria_json`. No badge for "opened the app".

## 7. Notifications

### 7.1 Types and triggers

| Type | Trigger | Window | Example copy (Italian UI) |
|---|---|---|---|
| Plan ready | morning, if the plan has not started | 07:30-09:00 | "Il piano di oggi è pronto: 18 minuti, con 2 frasi che ti erano sfuggite." |
| Due review | ≥ 10 cards due | 12:00-14:00 | "Hai 12 ripassi in scadenza. 5 minuti e sei a posto." |
| Streak at risk | evening, no production | 19:30-21:00 | "Ti mancano 3 minuti di conversazione per tenere il ritmo di oggi." |
| Weekly mission | Sunday, mission incomplete | 10:00-12:00 | "La missione 'standup' scade stasera. Ti va di provarla?" |
| Media pick | weekly, taste profile exists | 10:00-12:00 | "Questa settimana: un film da 90 minuti al tuo livello. Ti va?" |
| Re-engagement | 3 days inactive | 18:00-20:00, once | "Nessun problema per la pausa. Quando vuoi, ripartiamo da 5 minuti." |

### 7.2 Rules

Copy is rendered through the locale catalog keyed by `ui_locale`; the Italian strings above are
phase-1 examples.

- Maximum 2 notifications per day, never the same one twice.
- Quiet hours 22:00-07:00, configurable.
- Local timezone from the learner profile; scheduling respects DST. A timezone change re-plans
  future notifications.
- Ask for notification permission once, with context; if denied, show in-app banners and never
  re-prompt automatically.
- Deep links: plan -> Today, due review -> Practice, streak -> Talk, media -> media detail.
- Web: use in-app banners and, if the browser supports it, best-effort Web Push from the
  Home Screen. Native notifications ship with the Android release; do not promise background
  push on web.
- Every notification must lead to a concrete action in ≤ 2 taps.
- A/B test copy and timing only, never volume.

### 7.3 Copy tone

- Short, concrete sentences, no artificial urgency.
- Never "you lost", "don't disappoint", "last chance".
- Always an exit ("whenever you want").
- Real numbers, not invented ones.

## 8. Visible progress

- **Skill radar**: 5 axes, updated from real data.
- **CEFR trend**: line with a confidence band, not a bare number.
- **Error heatmap**: most frequent rules with examples and trend.
- **Calendar**: valid days, grace days, repair.
- **"What I learned"**: 3 concrete sentences at the end of the week.

Rule: every progress screen must answer "what do I do now?".

## 9. Ethical guardrails

- No mechanic that monetizes errors or fear of loss.
- No public ranking.
- Notifications can be disabled in one tap.
- Progress data is exportable.
- Time spent is not a success metric; production is.

## 10. Metrics

| Metric | Phase 1 target |
|---|---|
| Valid days/week | ≥ 5 (flexible mode) |
| Production/week | ≥ 30 min |
| Quests completed | ≥ 50% |
| Notification → action | ≥ 15% |
| Notification opt-out | ≤ 10% |
| Return after a break (7 days) | ≥ 30% |

## 11. Implementation

Pure functions in `packages/core/src/gamification` and `packages/core/src/notifications`:

```ts
export function computeStreak(input: StreakInput): StreakState;
export function xpForAttempt(input: XpAttemptInput): number;
export function buildGamificationSnapshot(input: GamificationInput): GamificationSnapshot;
export function planNotifications(input: NotificationPlanningInput): NotificationPlan;
```

No timers or `setTimeout`: logic depends on injected `now` and events. `planNotifications`
handles windows, quiet hours, max 2/day, sent dedupe, timezone/DST and permission state.
The app delivers native notifications where the platform exposes the Notification API and
falls back to in-app banners when permission is denied or unsupported. The server persists
planned rows in `scheduled_notifications` and the client reports sends through
`POST /v1/notifications/sent`.

## 12. Experimentation (after M5)

- Flexible vs daily streak: impact on valid days and churn.
- Evening vs morning notification: action rate.
- Production vs review quests: impact on spoken minutes.
- "Comeback" badge vs no badge: return after a break.

One experiment at a time, minimum 2 weeks, with a declared primary metric.
