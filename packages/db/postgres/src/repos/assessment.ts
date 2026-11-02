import {
  assessmentItemSchema,
  cefrLevelSchema,
  placementResultSchema,
  placementStateSchema,
  type AssessmentItem,
  type CefrLevel,
  type PlacementResult,
  type PlacementState,
  type SkillDomain,
} from '@loqua/core';
import type { Pool, PoolClient, QueryResultRow } from 'pg';

export interface PlacementRaw {
  readonly state: PlacementState;
  readonly items: Record<string, AssessmentItem>;
  readonly currentItemId: string | null;
  readonly result?: PlacementResult;
}

export type PlacementStatus = 'in_progress' | 'completed' | 'abandoned';

export interface PlacementRecord {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly targetLang: string;
  readonly status: PlacementStatus;
  readonly overallLevel: CefrLevel | null;
  readonly confidence: number | null;
  readonly raw: PlacementRaw;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

export interface AssessmentScoreRecord {
  readonly id: string;
  readonly assessmentId: string;
  readonly dimension: SkillDomain;
  readonly score: number;
  readonly confidence: number;
  readonly notes: string | null;
  readonly createdAt: string;
}

export interface LevelEventRecord {
  readonly id: string;
  readonly userId: string;
  readonly profileId: string;
  readonly skillId: string | null;
  readonly fromLevel: CefrLevel | null;
  readonly toLevel: CefrLevel | null;
  readonly reason:
    'placement' | 'test_out' | 'promotion' | 'remediation' | 'challenge_pass' | 'challenge_fail';
  readonly detail: Record<string, unknown>;
  readonly createdAt: string;
}

export interface SkillStateRecord {
  readonly userId: string;
  readonly skillId: string;
  readonly theta: number;
  readonly se: number;
  readonly nObs: number;
  readonly mastery: number;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConceptStateRecord {
  readonly userId: string;
  readonly conceptId: string;
  readonly mastery: number;
  readonly evidenceCount: number;
  readonly lastSeenAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CompleteAssessmentInput {
  readonly assessment: PlacementRecord;
  readonly scores: readonly AssessmentScoreRecord[];
  readonly levelEvents: readonly LevelEventRecord[];
  readonly skills: readonly SkillStateRecord[];
  readonly concepts: readonly ConceptStateRecord[];
}

export interface AssessmentStore {
  listApprovedItems(userId: string, targetLang: string): Promise<readonly AssessmentItem[]>;
  findActivePlacement(userId: string, profileId: string): Promise<PlacementRecord | null>;
  getAssessment(userId: string, id: string): Promise<PlacementRecord | null>;
  createAssessment(record: PlacementRecord): Promise<void>;
  updateAssessment(record: PlacementRecord): Promise<void>;
  completeAssessment(input: CompleteAssessmentInput): Promise<void>;
}

function parseStatus(value: string): PlacementStatus | null {
  switch (value) {
    case 'in_progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'abandoned':
      return 'abandoned';
    default:
      return null;
  }
}

interface ItemRow extends QueryResultRow {
  id: string;
  target_lang: string;
  type: string;
  skill_id: string;
  cefr_level: string;
  difficulty_b: number;
  prompt_json: unknown;
  answer_key_json: unknown;
  explanation_target: string | null;
  domain: string;
  concept_id: string;
}

interface AssessmentRow extends QueryResultRow {
  id: string;
  user_id: string;
  profile_id: string;
  target_lang: string;
  status: string;
  overall_level: string | null;
  confidence: number | null;
  raw_json: unknown;
  created_at: Date | string;
  completed_at: Date | string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function iso(value: Date | string | null): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

function requiredIso(value: Date | string): string {
  return iso(value) ?? new Date(0).toISOString();
}

function parsePrompt(
  value: unknown,
): { prompt: string; options: { id: string; text: string }[] } | null {
  if (!isRecord(value)) return null;
  const prompt = value.prompt;
  const options = value.options;
  if (typeof prompt !== 'string' || !Array.isArray(options)) return null;
  const parsedOptions: { id: string; text: string }[] = [];
  for (const option of options) {
    if (!isRecord(option)) return null;
    const id = option.id;
    const text = option.text;
    if (typeof id !== 'string' || typeof text !== 'string') return null;
    parsedOptions.push({ id, text });
  }
  return { prompt, options: parsedOptions };
}

function parseAnswerKey(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const correctOptionId = value.correctOptionId;
  return typeof correctOptionId === 'string' ? correctOptionId : null;
}

function mapItem(row: ItemRow): AssessmentItem | null {
  const prompt = parsePrompt(row.prompt_json);
  const correctOptionId = parseAnswerKey(row.answer_key_json);
  if (!prompt || !correctOptionId || !row.explanation_target) return null;
  const parsed = assessmentItemSchema.safeParse({
    id: row.id,
    targetLang: row.target_lang,
    type: row.type,
    skill: row.domain,
    skillId: row.skill_id,
    cefrLevel: row.cefr_level,
    conceptId: row.concept_id,
    difficultyB: row.difficulty_b,
    prompt: prompt.prompt,
    options: prompt.options,
    correctOptionId,
    explanation: row.explanation_target,
  });
  return parsed.success ? parsed.data : null;
}

function mapRaw(value: unknown): PlacementRaw | null {
  if (!isRecord(value)) return null;
  const state = placementStateSchema.safeParse(value.state);
  if (!state.success) return null;
  const rawItems = value.items;
  if (!isRecord(rawItems)) return null;

  const items: Record<string, AssessmentItem> = {};
  for (const [id, entry] of Object.entries(rawItems)) {
    const parsed = assessmentItemSchema.safeParse(entry);
    if (!parsed.success) return null;
    items[id] = parsed.data;
  }

  const currentItemId = value.currentItemId;
  if (currentItemId !== null && typeof currentItemId !== 'string') return null;

  const resultValue = value.result;
  let result: PlacementResult | undefined;
  if (resultValue !== undefined) {
    const parsed = placementResultSchema.safeParse(resultValue);
    if (!parsed.success) return null;
    result = parsed.data;
  }

  return result
    ? { state: state.data, items, currentItemId, result }
    : { state: state.data, items, currentItemId };
}

function mapAssessment(row: AssessmentRow): PlacementRecord | null {
  const status = parseStatus(row.status);
  const raw = mapRaw(row.raw_json);
  if (!status || !raw) return null;

  let overallLevel: CefrLevel | null = null;
  if (row.overall_level !== null) {
    const parsed = cefrLevelSchema.safeParse(row.overall_level);
    if (!parsed.success) return null;
    overallLevel = parsed.data;
  }

  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    targetLang: row.target_lang,
    status,
    overallLevel,
    confidence: row.confidence,
    raw,
    createdAt: requiredIso(row.created_at),
    completedAt: iso(row.completed_at),
  };
}

function rawJson(record: PlacementRecord): string {
  return JSON.stringify(record.raw);
}

export class PostgresAssessmentStore implements AssessmentStore {
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

  async listApprovedItems(userId: string, targetLang: string): Promise<readonly AssessmentItem[]> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<ItemRow>(
        `SELECT i.id, i.target_lang, i.type, i.skill_id, i.cefr_level, i.difficulty_b,
                i.prompt_json, i.answer_key_json, i.explanation_target,
                s.domain, ic.concept_id
         FROM public.items i
         JOIN public.skills s ON s.id = i.skill_id
         JOIN LATERAL (
           SELECT concept_id FROM public.item_concepts
           WHERE item_id = i.id
           ORDER BY weight DESC, concept_id
           LIMIT 1
         ) ic ON true
         WHERE i.target_lang = $1
           AND i.review_status = 'approved'
           AND i.retired_at IS NULL
         ORDER BY i.id`,
        [targetLang],
      );
      return result.rows.flatMap((row) => {
        const item = mapItem(row);
        return item ? [item] : [];
      });
    });
  }

  async findActivePlacement(userId: string, profileId: string): Promise<PlacementRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<AssessmentRow>(
        `SELECT * FROM public.assessments
         WHERE user_id = $1 AND profile_id = $2 AND kind = 'placement' AND status = 'in_progress'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId, profileId],
      );
      const row = result.rows[0];
      return row ? mapAssessment(row) : null;
    });
  }

  async getAssessment(userId: string, id: string): Promise<PlacementRecord | null> {
    return this.withUser(userId, async (client) => {
      const result = await client.query<AssessmentRow>(
        'SELECT * FROM public.assessments WHERE id = $1 AND user_id = $2',
        [id, userId],
      );
      const row = result.rows[0];
      return row ? mapAssessment(row) : null;
    });
  }

  async createAssessment(record: PlacementRecord): Promise<void> {
    await this.withUser(record.userId, async (client) => {
      await client.query(
        `INSERT INTO public.assessments
           (id, user_id, profile_id, session_id, kind, target_lang, overall_level, confidence,
            prompt_id, prompt_version, raw_json, status, created_at, completed_at)
         VALUES ($1, $2, $3, NULL, 'placement', $4, $5, $6, NULL, NULL, $7, $8, $9, $10)`,
        [
          record.id,
          record.userId,
          record.profileId,
          record.targetLang,
          record.overallLevel,
          record.confidence,
          rawJson(record),
          record.status,
          record.createdAt,
          record.completedAt,
        ],
      );
    });
  }

  async updateAssessment(record: PlacementRecord): Promise<void> {
    await this.withUser(record.userId, async (client) => {
      await client.query(
        `UPDATE public.assessments
         SET overall_level = $1, confidence = $2, raw_json = $3, status = $4, completed_at = $5
         WHERE id = $6 AND user_id = $7`,
        [
          record.overallLevel,
          record.confidence,
          rawJson(record),
          record.status,
          record.completedAt,
          record.id,
          record.userId,
        ],
      );
    });
  }

  async completeAssessment(input: CompleteAssessmentInput): Promise<void> {
    const { assessment, scores, levelEvents, skills, concepts } = input;
    await this.withUser(assessment.userId, async (client) => {
      await client.query(
        `UPDATE public.assessments
         SET overall_level = $1, confidence = $2, raw_json = $3, status = $4, completed_at = $5
         WHERE id = $6 AND user_id = $7`,
        [
          assessment.overallLevel,
          assessment.confidence,
          rawJson(assessment),
          assessment.status,
          assessment.completedAt,
          assessment.id,
          assessment.userId,
        ],
      );

      for (const score of scores) {
        await client.query(
          `INSERT INTO public.assessment_scores
             (id, assessment_id, dimension, score, confidence, notes, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (assessment_id, dimension) DO UPDATE
           SET score = EXCLUDED.score,
               confidence = EXCLUDED.confidence,
               notes = EXCLUDED.notes`,
          [
            score.id,
            score.assessmentId,
            score.dimension,
            score.score,
            score.confidence,
            score.notes,
            score.createdAt,
          ],
        );
      }

      for (const levelEvent of levelEvents) {
        await client.query(
          `INSERT INTO public.level_events
             (id, user_id, profile_id, skill_id, from_level, to_level, reason, detail_json, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            levelEvent.id,
            levelEvent.userId,
            levelEvent.profileId,
            levelEvent.skillId,
            levelEvent.fromLevel,
            levelEvent.toLevel,
            levelEvent.reason,
            JSON.stringify(levelEvent.detail),
            levelEvent.createdAt,
          ],
        );
      }

      for (const concept of concepts) {
        await client.query(
          `INSERT INTO public.user_concept_state
             (user_id, concept_id, mastery, evidence_count, last_seen_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, concept_id) DO UPDATE
           SET mastery = EXCLUDED.mastery,
               evidence_count = EXCLUDED.evidence_count,
               last_seen_at = EXCLUDED.last_seen_at,
               updated_at = EXCLUDED.updated_at`,
          [
            concept.userId,
            concept.conceptId,
            concept.mastery,
            concept.evidenceCount,
            concept.lastSeenAt,
            concept.createdAt,
            concept.updatedAt,
          ],
        );
      }

      for (const skill of skills) {
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
            skill.userId,
            skill.skillId,
            skill.theta,
            skill.se,
            skill.nObs,
            skill.mastery,
            skill.lastSeenAt,
            skill.createdAt,
            skill.updatedAt,
          ],
        );
      }
    });
  }
}
