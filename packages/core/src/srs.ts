import { z } from 'zod';
import {
  Rating,
  dateChrono,
  defaultLearningSteps,
  defaultRelearningSteps,
  defineScheduler,
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
  type Grade,
} from 'ts-fsrs';
import { FSRS7Model, migrateFSRS7Parameters } from 'ts-fsrs/models/fsrs-7';

export const SRS_CARD_TYPES = ['recognition', 'production'] as const;

export type SrsCardType = (typeof SRS_CARD_TYPES)[number];

export const SRS_RATINGS = [1, 2, 3, 4] as const;

export type SrsRating = (typeof SRS_RATINGS)[number];

export const SRS_STATES = ['new', 'learning', 'review', 'relearning'] as const;

export type SrsState = (typeof SRS_STATES)[number];

export type SrsScheduleStatus = 'new' | 'learning' | 'review';

export const SRS_DESIRED_RETENTION = 0.9;
export const SRS_MAX_INTERVAL_DAYS = 180;
export const LEECH_LAPSE_THRESHOLD = 4;
export const SUSPEND_LAPSE_THRESHOLD = 8;
export const SRS_BACKLOG_HARD_CAP = 60;

const CONTRACTION_EXPANSIONS: Readonly<Record<string, string>> = {
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "wouldn't": 'would not',
  "won't": 'will not',
  "i'm": 'i am',
  "i've": 'i have',
  "i'll": 'i will',
  "it's": 'it is',
  "we're": 'we are',
  "they're": 'they are',
};

export function normalizeAnswerText(value: string): string {
  let normalized = value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLocaleLowerCase('en');
  for (const [contraction, expansion] of Object.entries(CONTRACTION_EXPANSIONS)) {
    const pattern = new RegExp('\\b' + contraction.replace("'", "['\u2019]") + '\\b', 'g');
    normalized = normalized.replace(pattern, expansion);
  }
  return normalized
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ');
}

function withoutApostrophes(value: string): string {
  return value.replace(/'/g, '');
}

export function isAnswerAccepted(expected: string, actual: string): boolean {
  const normalizedExpected = normalizeAnswerText(expected);
  const normalizedActual = normalizeAnswerText(actual);
  if (normalizedExpected.length === 0 || normalizedActual.length === 0) return false;
  if (normalizedExpected === normalizedActual) return true;
  if (withoutApostrophes(normalizedExpected) === withoutApostrophes(normalizedActual)) {
    return true;
  }
  if (
    normalizedExpected.length >= 4 &&
    normalizedExpected.length <= 6 &&
    normalizedActual.length === normalizedExpected.length &&
    normalizedExpected[0] === normalizedActual[0]
  ) {
    let differences = 0;
    for (let index = 0; index < normalizedExpected.length; index += 1) {
      if (normalizedExpected[index] !== normalizedActual[index]) differences += 1;
    }
    if (differences <= 1) return true;
  }
  return false;
}

export function dailyBacklogCap(dailyMinutes: number): number {
  return Math.min(SRS_BACKLOG_HARD_CAP, Math.max(1, Math.round(2 * dailyMinutes)));
}

export interface AttemptRatingInput {
  readonly correct: boolean;
  readonly hintUsed: boolean;
  readonly latencyMs: number;
  readonly p90LatencyMs?: number;
}

export function ratingForAttempt(input: AttemptRatingInput): SrsRating {
  if (!input.correct) return 1;
  let rating: SrsRating = 4;
  const slow = input.p90LatencyMs !== undefined && input.latencyMs > input.p90LatencyMs;
  if (slow) rating = 3;
  if (input.hintUsed) rating = rating === 4 ? 3 : 2;
  return rating;
}

const RATING_BY_SRS: Record<SrsRating, Grade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy,
};

const STATE_BY_NUMBER: Record<number, SrsState> = {
  0: 'new',
  1: 'learning',
  2: 'review',
  3: 'relearning',
};

const NUMBER_BY_STATE: Record<SrsState, 0 | 1 | 2 | 3> = {
  new: 0,
  learning: 1,
  review: 2,
  relearning: 3,
};

export const srsCardSchema = z.object({
  id: z.string().min(1),
  cardType: z.enum(SRS_CARD_TYPES),
  dueAt: z.iso.datetime({ offset: false }),
  state: z.enum(SRS_STATES),
  scheduleStatus: z.enum(['new', 'learning', 'review']),
  stability: z.number().nonnegative(),
  stabilityFast: z.number().nonnegative(),
  difficulty: z.number().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  scheduledDays: z.number().nonnegative(),
  learningStep: z.number().int().nonnegative(),
  lastReviewAt: z.iso.datetime({ offset: false }).nullable(),
  suspended: z.boolean(),
  leech: z.boolean(),
});

export interface SrsCard {
  readonly id: string;
  readonly cardType: SrsCardType;
  readonly dueAt: string;
  readonly state: SrsState;
  readonly scheduleStatus: SrsScheduleStatus;
  readonly stability: number;
  readonly stabilityFast: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly scheduledDays: number;
  readonly learningStep: number;
  readonly lastReviewAt: string | null;
  readonly suspended: boolean;
  readonly leech: boolean;
}

export interface CreateSrsCardInput {
  readonly cardType: SrsCardType;
  readonly now: Date;
  readonly id?: string;
}

export interface ReviewSrsCardInput {
  readonly card: SrsCard;
  readonly rating: SrsRating;
  readonly now: Date;
}

export interface SrsReview {
  readonly cardId: string;
  readonly rating: SrsRating;
  readonly reviewedAt: string;
  readonly previousState: SrsState;
  readonly previousDueAt: string;
  readonly elapsedDays: number;
  readonly scheduledDays: number;
}

export interface SrsReviewResult {
  readonly card: SrsCard;
  readonly review: SrsReview;
}

// DefaultScheduler() is async; build the same FSRS-7 preset synchronously so the
// domain stays pure and callers can inject the clock.
function buildScheduler() {
  const definition = defineScheduler({ model: FSRS7Model, chrono: dateChrono }).use(
    schedulerDesiredRetentionMiddleware,
    schedulerFuzzingMiddleware,
    schedulerStatsMiddleware,
    schedulerScheduledDaysMiddleware,
    schedulerLearningStepsMiddleware,
    schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware,
  );
  return definition.create({
    config: {
      fractionalDays: true,
      weights: migrateFSRS7Parameters(),
      enableShortTerm: true,
      desiredRetention: SRS_DESIRED_RETENTION,
      learningSteps: [...defaultLearningSteps],
      relearningSteps: [...defaultRelearningSteps],
      allowModelOverride: true,
      enableFuzz: false,
      maximumInterval: SRS_MAX_INTERVAL_DAYS,
    },
  });
}

type Scheduler = ReturnType<typeof buildScheduler>;
type SchedulerCard = ReturnType<Scheduler['newCard']>;

const SCHEDULERS: Record<SrsCardType, Scheduler> = {
  recognition: buildScheduler(),
  production: buildScheduler(),
};

function elapsedDaysSince(card: SrsCard, now: Date): number {
  if (card.lastReviewAt === null) return 0;
  const previous = Date.parse(card.lastReviewAt);
  if (!Number.isFinite(previous)) return 0;
  return Math.max(0, (now.getTime() - previous) / 86_400_000);
}

function stateFromNumber(state: number): SrsState {
  return STATE_BY_NUMBER[state] ?? 'new';
}

function toSchedulerCard(card: SrsCard): SchedulerCard {
  return {
    cardId: card.id,
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt === null ? null : new Date(card.lastReviewAt),
    state: NUMBER_BY_STATE[card.state],
    scheduleStatus: card.scheduleStatus,
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
  };
}

function fromSchedulerCard(
  card: SchedulerCard,
  cardType: SrsCardType,
  id: string,
  suspended: boolean,
): SrsCard {
  return {
    id,
    cardType,
    dueAt: card.dueAt.toISOString(),
    state: stateFromNumber(card.state),
    scheduleStatus: card.scheduleStatus,
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    scheduledDays: card.scheduledDays,
    learningStep: card.learningStep,
    lastReviewAt: card.lastReviewAt === null ? null : card.lastReviewAt.toISOString(),
    suspended,
    leech: card.lapses >= LEECH_LAPSE_THRESHOLD,
  };
}

function suspensionAfterReview(card: SrsCard, lapses: number): boolean {
  return card.suspended || lapses >= SUSPEND_LAPSE_THRESHOLD;
}

export function createSrsCard(input: CreateSrsCardInput): SrsCard {
  const scheduler = SCHEDULERS[input.cardType];
  const card = scheduler.newCard({ now: input.now });
  return fromSchedulerCard(card, input.cardType, input.id ?? String(card.cardId), false);
}

export function reviewSrsCard(input: ReviewSrsCardInput): SrsReviewResult {
  const scheduler = SCHEDULERS[input.card.cardType];
  const result = scheduler.review({
    card: toSchedulerCard(input.card),
    grade: RATING_BY_SRS[input.rating],
    now: input.now,
  });
  const suspended = suspensionAfterReview(input.card, result.card.lapses);

  return {
    card: fromSchedulerCard(result.card, input.card.cardType, input.card.id, suspended),
    review: {
      cardId: input.card.id,
      rating: input.rating,
      reviewedAt: input.now.toISOString(),
      previousState: input.card.state,
      previousDueAt: input.card.dueAt,
      elapsedDays: elapsedDaysSince(input.card, input.now),
      scheduledDays: result.revlog.scheduledDays,
    },
  };
}

export function isSrsCardDue(card: SrsCard, now: Date): boolean {
  return Date.parse(card.dueAt) <= now.getTime();
}

export function suspendSrsCard(card: SrsCard): SrsCard {
  return { ...card, suspended: true };
}

export function unsuspendSrsCard(card: SrsCard): SrsCard {
  return { ...card, suspended: false };
}
