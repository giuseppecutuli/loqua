import {
  buildCefrTrend,
  buildSkillRadar,
  cefrFromTheta,
  cefrRangeLabel,
  skillLevelFromMastery,
  type ProgressSummary,
  type SkillProgress,
} from '@loqua/core';
import { Hono } from 'hono';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type { AssessmentStore } from '../repos/assessment.js';

export interface ProgressRoutesDeps {
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createProgressRoutes(deps: ProgressRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }

    const snapshotProgress = await deps.assessments.getProgress(user.id, snapshot.profile.id);
    const skills: SkillProgress[] = snapshotProgress.skills.map((skill) => ({
      skill: skill.skill,
      level: cefrFromTheta(skill.theta),
      range: cefrRangeLabel(skill.theta - skill.se, skill.theta + skill.se),
      confidence: round(clamp(1 - skill.se, 0, 1)),
      theta: round(skill.theta),
      se: round(skill.se),
      mastery: round(clamp(skill.mastery, 0, 1)),
      gameLevel: skillLevelFromMastery(skill.mastery),
      nObs: skill.nObs,
      lastSeenAt: skill.lastSeenAt,
    }));

    const progress: ProgressSummary = {
      overallLevel: snapshotProgress.latest?.overallLevel ?? null,
      overallRange: snapshotProgress.latest?.overallRange ?? null,
      confidence: round(snapshotProgress.latest?.confidence ?? 0),
      latestAssessmentAt: snapshotProgress.latest?.completedAt ?? null,
      skills,
      skillRadar: buildSkillRadar(
        skills.map((skill) => ({
          skill: skill.skill,
          level: skill.level,
          mastery: skill.mastery,
          confidence: skill.confidence,
        })),
      ),
      cefrTrend: buildCefrTrend(snapshotProgress.history),
      events: [...snapshotProgress.events],
      priorities: [...(snapshotProgress.latest?.priorities ?? [])],
    };

    return c.json({ progress });
  });

  return app;
}
