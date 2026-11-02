import type { Pool, PoolClient, QueryResultRow } from 'pg';

import type { ConceptStateRecord, SkillStateRecord } from './assessment.js';

export type SessionKind =
  'lesson' | 'review' | 'conversation' | 'assessment' | 'micro' | 'immersive';

export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'abandoned';

export type SessionBlock = 'review' | 'input' | 'production' | 'assessment' | 'immersive';

export type SessionItemStatus = 'pending' | 'answered' | 'skipped';

export type SessionTurnRole = 'user' | 'tutor' | 'system';

export type SrsCardType = 'recognition' | 'production';

export type SrsSourceType = 'item' | 'saved_phrase' | 'media_phrase';

export type SrsState = 'new' | 'learning' | 'review' | 'relearning';

export type ErrorSource = 'exercise' | 'conversation' | 'assessment' | 'media' | 'self_report';

export type ErrorSeverity = 'low' | 'medium' | 'high';

export type ErrorStatus = 'open' | 'resolved' | 'ignored';

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly targetLang: string;
  readonly kind: SessionKind;
  readonly status: SessionStatus;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly turns: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly costUsd: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface SessionItemRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly itemId: string;
  readonly block: SessionBlock;
  readonly sortOrder: number;
  readonly rationaleCode: string;
  readonly rationale: Record<string, unknown>;
  readonly status: SessionItemStatus;
  readonly servedAt: string | null;
  readonly answeredAt: string | null;
  readonly createdAt: string;
}

export interface SessionTurnRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly role: SessionTurnRole;
  readonly content: string;
  readonly audioRef: string | null;
  readonly transcriptMeta: Record<string, unknown> | null;
  readonly createdAt: string;
}

export interface AttemptRecord {
  readonly id: string;
  readonly userId: string;
  readonly itemId: string;
  readonly sessionId: string | null;
  readonly sessionItemId: string | null;
  readonly correct: boolean;
  readonly score: number | null;
  readonly latencyMs: number;
  readonly hintUsed: boolean;
  readonly response: Record<string, unknown>;
  readonly createdAt: string;
}

export interface ErrorEventRecord {
  readonly id: string;
  readonly userId: string;
  readonly sessionId: string | null;
  readonly source: ErrorSource;
  readonly span: string;
  readonly errorType: string;
  readonly ruleId: string | null;
  readonly severity: ErrorSeverity;
  readonly confidence: number;
  readonly shownToUser: boolean;
  readonly status: ErrorStatus;
  readonly resolvedAt: string | null;
  readonly createdAt: string;
}

export interface SrsCardRecord {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly cardType: SrsCardType;
  readonly sourceType: SrsSourceType;
  readonly sourceId: string;
  readonly fsrs: Record<string, unknown>;
  readonly dueAt: string;
  readonly state: SrsState;
  readonly stability: number;
  readonly difficulty: number;
  readonly reps: number;
  readonly lapses: number;
  readonly suspended: boolean;
  readonly leech: boolean;
  readonly lastReviewAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface SrsReviewRecord {
  readonly id: string;
  readonly cardId: string;
  readonly userId: string;
  readonly rating: 1 | 2 | 3 | 4;
  readonly reviewedAt: string;
  readonly elapsedDays: number;
  readonly scheduledDays: number;
  readonly durationMs: number;
  readonly createdAt: string;
}

export type ConceptStateUpdate = ConceptStateRecord & {
  readonly lastErrorAt?: string | null;
};

export interface RecordAttemptInput {
  readonly attempt: AttemptRecord;
  readonly sessionItemId?: string | null;
  readonly sessionItemStatus?: SessionItemStatus;
  readonly sessionItemAnsweredAt?: string | null;
  readonly skillState?: SkillStateRecord | null;
  readonly conceptState?: ConceptStateUpdate | null;
  readonly errorEvent?: ErrorEventRecord | null;
  readonly srsCard?: SrsCardRecord | null;
  readonly srsReview?: SrsReviewRecord | null;
}

export interface SessionStore {
  createSession(record: SessionRecord): Promise<void>;
  findActiveSession(userId: string, profileId: string): Promise<SessionRecord | null>;
  getSession(userId: string, id: string): Promise<SessionRecord | null>;
  getConversationSession?(userId: string, id: string): Promise<SessionRecord | null>;
  updateSession(record: SessionRecord): Promise<void>;
  listSessionTurns?(
    userId: string,
    sessionId: string,
    limit?: number,
  ): Promise<readonly SessionTurnRecord[]>;
  addSessionTurn?(userId: string, turn: SessionTurnRecord): Promise<SessionTurnRecord>;
  listSessionItems(userId: string, sessionId: string): Promise<readonly SessionItemRecord[]>;
  addSessionItems(
    userId: string,
    sessionId: string,
    items: readonly SessionItemRecord[],
  ): Promise<readonly SessionItemRecord[]>;
  recordAttempt(input: RecordAttemptInput): Promise<void>;
  getSkillState(userId: string, skillId: string): Promise<SkillStateRecord | null>;
  getConceptState(userId: string, conceptId: string): Promise<ConceptStateRecord | null>;
  listConceptStates(userId: string): Promise<readonly ConceptStateRecord[]>;
  countErrorEvents(userId: string, errorType: string, since: string): Promise<number>;
  findSrsCard(
    userId: string,
    profileId: string,
    sourceType: SrsSourceType,
    sourceId: string,
    cardType: SrsCardType,
  ): Promise<SrsCardRecord | null>;
  listDueSrsCards(
    userId: string,
    profileId: string,
    now: string | Date,
    limit: number,
  ): Promise<readonly SrsCardRecord[]>;
  upsertSrsCard(record: SrsCardRecord): Promise<SrsCardRecord>;
  recordSrsReview(record: SrsReviewRecord): Promise<void>;
}

function iso(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function parseSessionKind(value: string): SessionKind | null {
  switch (value) {
    case 'lesson':
    case 'review':
    case 'conversation':
    case 'assessment':
    case 'micro':
    case 'immersive':
      return value;
    default:
      return null;
  }
}

function parseSessionStatus(value: string): SessionStatus | null {
  switch (value) {
    case 'planned':
    case 'in_progress':
    case 'completed':
    case 'abandoned':
      return value;
    default:
      return null;
  }
}

function parseSessionBlock(value: string): SessionBlock | null {
  switch (value) {
    case 'review':
    case 'input':
    case 'production':
    case 'assessment':
    case 'immersive':
      return value;
    default:
      return null;
  }
}

function parseSessionTurnRole(value: string): SessionTurnRole | null {
  switch (value) {
    case 'user':
    case 'tutor':
    case 'system':
      return value;
    default:
      return null;
  }
}

function parseSessionItemStatus(value: string): SessionItemStatus | null {
  switch (value) {
    case 'pending':
    case 'answered':
    case 'skipped':
      return value;
    default:
      return null;
  }
}

function parseSrsCardType(value: string): SrsCardType | null {
  switch (value) {
    case 'recognition':
    case 'production':
      return value;
    default:
      return null;
  }
}

function parseSrsSourceType(value: string): SrsSourceType | null {
  switch (value) {
    case 'item':
    case 'saved_phrase':
    case 'media_phrase':
      return value;
    default:
      return null;
  }
}

function parseSrsState(value: string): SrsState | null {
  switch (value) {
    case 'new':
    case 'learning':
    case 'review':
    case 'relearning':
      return value;
    default:
      return null;
  }
}

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  target_lang: string;
  kind: string;
  status: string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  turns: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

interface SessionItemRow extends QueryResultRow {
  id: string;
  session_id: string;
  item_id: string;
  block: string;
  sort_order: number;
  rationale_code: string;
  rationale_json: unknown;
  status: string;
  served_at: Date | string | null;
  answered_at: Date | string | null;
  created_at: Date | string;
}

interface SessionTurnRow extends QueryResultRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  audio_ref: string | null;
  transcript_meta_json: unknown;
  created_at: Date | string;
}

interface SrsCardRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  card_type: string;
  source_type: string;
  source_id: string;
  fsrs_json: unknown;
  due_at: Date | string;
  state: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  suspended: boolean;
  leech: boolean;
  last_review_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

function mapSession(row: SessionRow): SessionRecord | null {
  const kind = parseSessionKind(row.kind);
  const status = parseSessionStatus(row.status);
  if (!kind || !status) return null;
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    targetLang: row.target_lang,
    kind,
    status,
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    turns: row.turns,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    deletedAt: iso(row.deleted_at),
  };
}

function mapSessionItem(row: SessionItemRow): SessionItemRecord | null {
  const block = parseSessionBlock(row.block);
  const status = parseSessionItemStatus(row.status);
  if (!block || !status) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    itemId: row.item_id,
    block,
    sortOrder: row.sort_order,
    rationaleCode: row.rationale_code,
    rationale: jsonRecord(row.rationale_json),
    status,
    servedAt: iso(row.served_at),
    answeredAt: iso(row.answered_at),
    createdAt: requiredIso(row.created_at),
  };
}

function mapSessionTurn(row: SessionTurnRow): SessionTurnRecord | null {
  const role = parseSessionTurnRole(row.role);
  if (!role) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    role,
    content: row.content,
    audioRef: row.audio_ref,
    transcriptMeta: isRecord(row.transcript_meta_json) ? row.transcript_meta_json : null,
    createdAt: requiredIso(row.created_at),
  };
}

function mapSrsCard(row: SrsCardRow): SrsCardRecord | null {
  const cardType = parseSrsCardType(row.card_type);
  const sourceType = parseSrsSourceType(row.source_type);
  const state = parseSrsState(row.state);
  if (!cardType || !sourceType || !state) return null;
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    cardType,
    sourceType,
    sourceId: row.source_id,
    fsrs: jsonRecord(row.fsrs_json),
    dueAt: requiredIso(row.due_at),
    state,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    suspended: row.suspended,
    leech: row.leech,
    lastReviewAt: iso(row.last_review_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
    deletedAt: iso(row.deleted_at),
  };
}

async function insertAttempt(client: PoolClient, attempt: AttemptRecord): Promise<void> {
  await client.query(
    `INSERT INTO public.attempts
       (id, user_id, item_id, session_id, session_item_id, correct, score, latency_ms,
        hint_used, response_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      attempt.id,
      attempt.userId,
      attempt.itemId,
      attempt.sessionId,
      attempt.sessionItemId,
      attempt.correct,
      attempt.score,
      attempt.latencyMs,
      attempt.hintUsed,
      JSON.stringify(attempt.response),
      attempt.createdAt,
    ],
  );
}

async function upsertSkillState(client: PoolClient, state: SkillStateRecord): Promise<void> {
  await client.query(
    `INSERT INTO public.user_skill_state
       (user_id, skill_id, theta, se, n_obs, mastery, last_seen_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, skill_id) DO UPDATE
     SET theta = EXCLUDED.theta,
         se = EXCLUDED.se,
         n_obs = EXCLUDED.n_obs,
         mastery = EXCLUDED.mastery,
         last_seen_at = EXCLUDED.last_seen_at,
         updated_at = EXCLUDED.updated_at`,
    [
      state.userId,
      state.skillId,
      state.theta,
      state.se,
      state.nObs,
      state.mastery,
      state.lastSeenAt,
      state.createdAt,
      state.updatedAt,
    ],
  );
}

async function upsertConceptState(client: PoolClient, state: ConceptStateUpdate): Promise<void> {
  await client.query(
    `INSERT INTO public.user_concept_state
       (user_id, concept_id, mastery, evidence_count, last_error_at, last_seen_at, created_at,
        updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, concept_id) DO UPDATE
     SET mastery = EXCLUDED.mastery,
         evidence_count = EXCLUDED.evidence_count,
         last_error_at = COALESCE(EXCLUDED.last_error_at, user_concept_state.last_error_at),
         last_seen_at = EXCLUDED.last_seen_at,
         updated_at = EXCLUDED.updated_at`,
    [
      state.userId,
      state.conceptId,
      state.mastery,
      state.evidenceCount,
      state.lastErrorAt ?? null,
      state.lastSeenAt,
      state.createdAt,
      state.updatedAt,
    ],
  );
}

async function upsertSrsCardRow(client: PoolClient, record: SrsCardRecord): Promise<SrsCardRecord> {
  const result = await client.query<SrsCardRow>(
    `INSERT INTO public.srs_cards
       (id, user_id, profile_id, card_type, source_type, source_id, fsrs_json, due_at, state,
        stability, difficulty, reps, lapses, suspended, leech, last_review_at, created_at,
        updated_at, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
             $18, $19)
     ON CONFLICT (user_id, source_type, source_id, card_type) DO UPDATE
     SET profile_id = EXCLUDED.profile_id,
         fsrs_json = EXCLUDED.fsrs_json,
         due_at = EXCLUDED.due_at,
         state = EXCLUDED.state,
         stability = EXCLUDED.stability,
         difficulty = EXCLUDED.difficulty,
         reps = EXCLUDED.reps,
         lapses = EXCLUDED.lapses,
         suspended = EXCLUDED.suspended,
         leech = EXCLUDED.leech,
         last_review_at = EXCLUDED.last_review_at,
         updated_at = EXCLUDED.updated_at,
         deleted_at = EXCLUDED.deleted_at
     RETURNING *`,
    [
      record.id,
      record.userId,
      record.profileId,
      record.cardType,
      record.sourceType,
      record.sourceId,
      JSON.stringify(record.fsrs),
      record.dueAt,
      record.state,
      record.stability,
      record.difficulty,
      record.reps,
      record.lapses,
      record.suspended,
      record.leech,
      record.lastReviewAt,
      record.createdAt,
      record.updatedAt,
      record.deletedAt,
    ],
  );
  const row = result.rows[0];
  const mapped = row ? mapSrsCard(row) : null;
  if (!mapped) throw new Error('srs_card_upsert_failed');
  return mapped;
}

function mapSkillState(
  row: QueryResultRow & {
    user_id: string;
    skill_id: string;
    theta: number;
    se: number;
    n_obs: number;
    mastery: number;
    last_seen_at: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
  },
): SkillStateRecord {
  return {
    userId: row.user_id,
    skillId: row.skill_id,
    theta: row.theta,
    se: row.se,
    nObs: row.n_obs,
    mastery: row.mastery,
    lastSeenAt: requiredIso(row.last_seen_at ?? row.updated_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  };
}

function mapConceptState(
  row: QueryResultRow & {
    user_id: string;
    concept_id: string;
    mastery: number;
    evidence_count: number;
    last_seen_at: Date | string | null;
    created_at: Date | string;
    updated_at: Date | string;
  },
): ConceptStateRecord {
  return {
    userId: row.user_id,
    conceptId: row.concept_id,
    mastery: row.mastery,
    evidenceCount: row.evidence_count,
    lastSeenAt: requiredIso(row.last_seen_at ?? row.updated_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  };
}

export class PostgresSessionStore implements SessionStore {
  constructor(private readonly pool: Pool) {}

  private async withUser<T>(userId: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.withUser(record.userId, async (client) => {
      await client.query(
        `INSERT INTO public.sessions
           (id, user_id, profile_id, target_lang, kind, status, started_at, ended_at, turns,
            tokens_in, tokens_out, cost_usd, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          record.id,
          record.userId,
          record.profileId,
          record.targetLang,
          record.kind,
          record.status,
          record.startedAt,
          record.endedAt,
          record.turns,
          record.tokensIn,
          record.tokensOut,
          record.costUsd,
          record.createdAt,
          record.updatedAt,
          record.deletedAt,
        ],
      );
    });
  }

  async findActiveSession(userId: string, profileId: string): Promise<SessionRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SessionRow>(
        `SELECT * FROM public.sessions
         WHERE user_id = $1 AND profile_id = $2
           AND status IN ('planned', 'in_progress')
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, profileId],
      );
      const row = result.rows[0];
      return row ? mapSession(row) : null;
    });
  }

  async getSession(userId: string, id: string): Promise<SessionRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SessionRow>(
        'SELECT * FROM public.sessions WHERE id = $1 AND user_id = $2',
        [id, userId],
      );
      const row = result.rows[0];
      return row ? mapSession(row) : null;
    });
  }

  async getConversationSession(userId: string, id: string): Promise<SessionRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SessionRow>(
        `SELECT * FROM public.sessions
         WHERE id = $1 AND user_id = $2 AND kind = 'conversation'`,
        [id, userId],
      );
      const row = result.rows[0];
      return row ? mapSession(row) : null;
    });
  }

  async updateSession(record: SessionRecord): Promise<void> {
    await this.withUser(record.userId, async (client) => {
      await client.query(
        `UPDATE public.sessions
         SET target_lang = $1, kind = $2, status = $3, started_at = $4, ended_at = $5,
             turns = $6, tokens_in = $7, tokens_out = $8, cost_usd = $9, updated_at = $10,
             deleted_at = $11
         WHERE id = $12 AND user_id = $13`,
        [
          record.targetLang,
          record.kind,
          record.status,
          record.startedAt,
          record.endedAt,
          record.turns,
          record.tokensIn,
          record.tokensOut,
          record.costUsd,
          record.updatedAt,
          record.deletedAt,
          record.id,
          record.userId,
        ],
      );
    });
  }

  async listSessionItems(userId: string, sessionId: string): Promise<readonly SessionItemRecord[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SessionItemRow>(
        `SELECT si.* FROM public.session_items si
         JOIN public.sessions s ON s.id = si.session_id
         WHERE si.session_id = $1 AND s.user_id = $2
         ORDER BY si.sort_order, si.id`,
        [sessionId, userId],
      );
      return result.rows.flatMap((row) => {
        const item = mapSessionItem(row);
        return item ? [item] : [];
      });
    });
  }

  async addSessionItems(
    userId: string,
    sessionId: string,
    items: readonly SessionItemRecord[],
  ): Promise<readonly SessionItemRecord[]> {
    if (items.length === 0) return [];
    return this.withUser(userId, async (client) => {
      const owned = await client.query(
        'SELECT 1 FROM public.sessions WHERE id = $1 AND user_id = $2',
        [sessionId, userId],
      );
      if (owned.rowCount === 0) throw new Error('session_not_found');

      const inserted: SessionItemRecord[] = [];
      for (const item of items) {
        const result = await client.query<SessionItemRow>(
          `INSERT INTO public.session_items
             (id, session_id, item_id, block, sort_order, rationale_code, rationale_json,
              status, served_at, answered_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (session_id, item_id) DO NOTHING
           RETURNING *`,
          [
            item.id,
            sessionId,
            item.itemId,
            item.block,
            item.sortOrder,
            item.rationaleCode,
            JSON.stringify(item.rationale),
            item.status,
            item.servedAt,
            item.answeredAt,
            item.createdAt,
          ],
        );
        const row = result.rows[0];
        const mapped = row ? mapSessionItem(row) : null;
        if (mapped) inserted.push(mapped);
      }
      return inserted;
    });
  }

  async listSessionTurns(
    userId: string,
    sessionId: string,
    limit = 50,
  ): Promise<readonly SessionTurnRecord[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SessionTurnRow>(
        `SELECT t.* FROM public.session_turns t
         JOIN public.sessions s ON s.id = t.session_id
         WHERE t.session_id = $1 AND s.user_id = $2
         ORDER BY t.created_at, t.id
         LIMIT $3`,
        [sessionId, userId, limit],
      );
      return result.rows.flatMap((row) => {
        const turn = mapSessionTurn(row);
        return turn ? [turn] : [];
      });
    });
  }

  async addSessionTurn(userId: string, turn: SessionTurnRecord): Promise<SessionTurnRecord> {
    return this.withUser(userId, async (client) => {
      const owned = await client.query(
        'SELECT 1 FROM public.sessions WHERE id = $1 AND user_id = $2',
        [turn.sessionId, userId],
      );
      if (owned.rowCount === 0) throw new Error('session_not_found');

      const result = await client.query<SessionTurnRow>(
        `INSERT INTO public.session_turns
           (id, session_id, role, content, audio_ref, transcript_meta_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          turn.id,
          turn.sessionId,
          turn.role,
          turn.content,
          turn.audioRef,
          turn.transcriptMeta === null ? null : JSON.stringify(turn.transcriptMeta),
          turn.createdAt,
        ],
      );
      const row = result.rows[0];
      const mapped = row ? mapSessionTurn(row) : null;
      if (!mapped) throw new Error('session_turn_insert_failed');
      return mapped;
    });
  }

  async recordAttempt(input: RecordAttemptInput): Promise<void> {
    const { attempt } = input;
    await this.withUser(attempt.userId, async (client) => {
      await insertAttempt(client, attempt);

      const sessionItemId = input.sessionItemId ?? attempt.sessionItemId;
      if (sessionItemId && input.sessionItemStatus) {
        await client.query(
          `UPDATE public.session_items si
           SET status = $1, answered_at = $2
           FROM public.sessions s
           WHERE si.id = $3 AND si.session_id = s.id AND s.user_id = $4`,
          [
            input.sessionItemStatus,
            input.sessionItemAnsweredAt ?? attempt.createdAt,
            sessionItemId,
            attempt.userId,
          ],
        );
      }

      if (input.skillState) {
        await upsertSkillState(client, input.skillState);
      }
      if (input.conceptState) {
        await upsertConceptState(client, input.conceptState);
      }
      if (input.errorEvent) {
        await this.insertErrorEventWith(client, input.errorEvent);
      }
      if (input.srsCard) {
        await upsertSrsCardRow(client, input.srsCard);
      }
      if (input.srsReview) {
        await this.insertSrsReviewWith(client, input.srsReview);
      }
    });
  }

  async getSkillState(userId: string, skillId: string): Promise<SkillStateRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.user_skill_state WHERE user_id = $1 AND skill_id = $2',
        [userId, skillId],
      );
      const row = result.rows[0];
      return row ? mapSkillState(row) : null;
    });
  }

  async getConceptState(userId: string, conceptId: string): Promise<ConceptStateRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.user_concept_state WHERE user_id = $1 AND concept_id = $2',
        [userId, conceptId],
      );
      const row = result.rows[0];
      return row ? mapConceptState(row) : null;
    });
  }

  async listConceptStates(userId: string): Promise<readonly ConceptStateRecord[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query(
        'SELECT * FROM public.user_concept_state WHERE user_id = $1 ORDER BY concept_id',
        [userId],
      );
      return result.rows.map(mapConceptState);
    });
  }

  async countErrorEvents(userId: string, errorType: string, since: string): Promise<number> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.error_events
         WHERE user_id = $1 AND error_type = $2 AND created_at >= $3`,
        [userId, errorType, since],
      );
      return result.rows[0]?.count ?? 0;
    });
  }

  async findSrsCard(
    userId: string,
    profileId: string,
    sourceType: SrsSourceType,
    sourceId: string,
    cardType: SrsCardType,
  ): Promise<SrsCardRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<SrsCardRow>(
        `SELECT * FROM public.srs_cards
         WHERE user_id = $1 AND profile_id = $2 AND source_type = $3 AND source_id = $4
           AND card_type = $5 AND deleted_at IS NULL
         LIMIT 1`,
        [userId, profileId, sourceType, sourceId, cardType],
      );
      const row = result.rows[0];
      return row ? mapSrsCard(row) : null;
    });
  }

  async listDueSrsCards(
    userId: string,
    profileId: string,
    now: string | Date,
    limit: number,
  ): Promise<readonly SrsCardRecord[]> {
    const at = now instanceof Date ? now.toISOString() : now;
    return this.withUser(userId, async (client) => {
      const result = await client.query<SrsCardRow>(
        `SELECT * FROM public.srs_cards
         WHERE user_id = $1 AND profile_id = $2
           AND deleted_at IS NULL AND suspended = false AND due_at <= $3
         ORDER BY due_at
         LIMIT $4`,
        [userId, profileId, at, limit],
      );
      return result.rows.flatMap((row) => {
        const card = mapSrsCard(row);
        return card ? [card] : [];
      });
    });
  }

  async upsertSrsCard(record: SrsCardRecord): Promise<SrsCardRecord> {
    return this.withUser(record.userId, (client) => upsertSrsCardRow(client, record));
  }

  async recordSrsReview(record: SrsReviewRecord): Promise<void> {
    await this.withUser(record.userId, (client) => this.insertSrsReviewWith(client, record));
  }

  private async insertErrorEventWith(client: PoolClient, event: ErrorEventRecord): Promise<void> {
    await client.query(
      `INSERT INTO public.error_events
         (id, user_id, session_id, source, span, error_type, rule_id, severity, confidence,
          shown_to_user, status, resolved_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.userId,
        event.sessionId,
        event.source,
        event.span,
        event.errorType,
        event.ruleId,
        event.severity,
        event.confidence,
        event.shownToUser,
        event.status,
        event.resolvedAt,
        event.createdAt,
      ],
    );
  }

  private async insertSrsReviewWith(client: PoolClient, review: SrsReviewRecord): Promise<void> {
    await client.query(
      `INSERT INTO public.srs_reviews
         (id, card_id, user_id, rating, reviewed_at, elapsed_days, scheduled_days, duration_ms,
          created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        review.id,
        review.cardId,
        review.userId,
        review.rating,
        review.reviewedAt,
        review.elapsedDays,
        review.scheduledDays,
        review.durationMs,
        review.createdAt,
      ],
    );
  }
}
