import type { AssessmentItem } from '@loqua/core';
import type {
  AssessmentScoreRecord,
  AssessmentStore,
  CompleteAssessmentInput,
  LevelEventRecord,
  PlacementRecord,
  SkillStateRecord,
} from '@loqua/db-postgres';

export type {
  AssessmentScoreRecord,
  AssessmentStore,
  CompleteAssessmentInput,
  LevelEventRecord,
  PlacementRaw,
  PlacementRecord,
  PlacementStatus,
  SkillStateRecord,
} from '@loqua/db-postgres';

export class InMemoryAssessmentRepository implements AssessmentStore {
  private readonly items: readonly AssessmentItem[];
  private readonly records = new Map<string, PlacementRecord>();
  readonly scores: AssessmentScoreRecord[] = [];
  readonly levelEvents: LevelEventRecord[] = [];
  readonly skillStates: SkillStateRecord[] = [];

  constructor(items: readonly AssessmentItem[] = []) {
    this.items = items;
  }

  async listApprovedItems(_userId: string, targetLang: string): Promise<readonly AssessmentItem[]> {
    return this.items.filter((item) => item.targetLang === targetLang);
  }

  async findActivePlacement(userId: string, profileId: string): Promise<PlacementRecord | null> {
    const matches = [...this.records.values()]
      .filter(
        (record) =>
          record.userId === userId &&
          record.profileId === profileId &&
          record.status === 'in_progress',
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  }

  async getAssessment(userId: string, id: string): Promise<PlacementRecord | null> {
    const record = this.records.get(id);
    return record && record.userId === userId ? record : null;
  }

  async createAssessment(record: PlacementRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async updateAssessment(record: PlacementRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async completeAssessment(input: CompleteAssessmentInput): Promise<void> {
    this.records.set(input.assessment.id, input.assessment);
    this.scores.push(...input.scores);
    this.levelEvents.push(input.levelEvent);
    this.skillStates.push(...input.skills);
  }
}
