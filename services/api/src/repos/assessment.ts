import type { AssessmentItem, SkillDomain } from '@loqua/core';
import type {
  AssessmentScoreRecord,
  AssessmentStore,
  CompleteAssessmentInput,
  ConceptStateRecord,
  LevelEventRecord,
  PlacementRecord,
  ProgressSnapshot,
  SkillStateRecord,
  SkillProgressRecord,
} from '@loqua/db-postgres';

export type {
  AssessmentScoreRecord,
  ConceptStateRecord,
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
  readonly conceptStates: ConceptStateRecord[] = [];

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
    this.levelEvents.push(...input.levelEvents);
    this.skillStates.push(...input.skills);
    this.conceptStates.push(...input.concepts);
  }

  async getSkillState(userId: string, skillId: string): Promise<SkillStateRecord | null> {
    return (
      this.skillStates.find((state) => state.userId === userId && state.skillId === skillId) ?? null
    );
  }

  async getConceptState(userId: string, conceptId: string): Promise<ConceptStateRecord | null> {
    return (
      this.conceptStates.find(
        (state) => state.userId === userId && state.conceptId === conceptId,
      ) ?? null
    );
  }

  async listConceptStates(userId: string): Promise<readonly ConceptStateRecord[]> {
    return this.conceptStates.filter((state) => state.userId === userId);
  }

  async getProgress(userId: string, profileId: string): Promise<ProgressSnapshot> {
    const domainBySkillId = new Map<string, SkillDomain>();
    for (const record of this.records.values()) {
      if (record.userId !== userId) continue;
      for (const item of Object.values(record.raw.items)) {
        domainBySkillId.set(item.skillId, item.skill);
      }
      if (record.raw.writingTask) {
        domainBySkillId.set(record.raw.writingTask.skillId, 'writing');
      }
      if (record.raw.speakingTask) {
        domainBySkillId.set(record.raw.speakingTask.skillId, 'speaking');
      }
    }

    const completed = [...this.records.values()]
      .filter(
        (record) =>
          record.userId === userId &&
          record.profileId === profileId &&
          record.status === 'completed' &&
          record.completedAt !== null,
      )
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    const latest = completed[0];
    const latestResult = latest?.raw.result;

    const latestBySkill = new Map<string, SkillStateRecord>();
    for (const state of this.skillStates) {
      if (state.userId !== userId) continue;
      const current = latestBySkill.get(state.skillId);
      if (!current || state.lastSeenAt > current.lastSeenAt) {
        latestBySkill.set(state.skillId, state);
      }
    }
    const skills: SkillProgressRecord[] = [...latestBySkill.values()].flatMap((state) => {
      const skill = domainBySkillId.get(state.skillId);
      if (!skill) return [];
      return [
        {
          skill,
          theta: state.theta,
          se: state.se,
          nObs: state.nObs,
          mastery: state.mastery,
          lastSeenAt: state.lastSeenAt,
        },
      ];
    });

    return {
      latest:
        latest && latestResult && latest.completedAt
          ? {
              overallLevel: latest.overallLevel,
              overallRange: latestResult.overallRange,
              confidence: latest.confidence ?? 0,
              completedAt: latest.completedAt,
              priorities: latestResult.priorities,
            }
          : null,
      skills,
      events: this.levelEvents
        .filter((event) => event.userId === userId && event.profileId === profileId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map((event) => ({
          id: event.id,
          reason: event.reason,
          fromLevel: event.fromLevel,
          toLevel: event.toLevel,
          skill: event.skillId ? (domainBySkillId.get(event.skillId) ?? null) : null,
          createdAt: event.createdAt,
        })),
    };
  }
}
