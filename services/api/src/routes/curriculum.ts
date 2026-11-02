import { CAN_DO_STATEMENTS, CONCEPTS } from '@loqua/content';
import { buildCurriculumPlan, type CefrLevel, type SkillDomain } from '@loqua/core';
import { Hono } from 'hono';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';
import type { AssessmentStore } from '../repos/assessment.js';
import type { SessionStore } from '../repos/session.js';

export interface CurriculumRoutesDeps {
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly now: () => Date;
}

export function createCurriculumRoutes(deps: CurriculumRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }

    const progress = await deps.assessments.getProgress(user.id, snapshot.profile.id);
    const states = await deps.sessions.listConceptStates(user.id);
    const weakSkills = progress.skills
      .slice()
      .sort((left, right) => left.mastery - right.mastery || left.skill.localeCompare(right.skill))
      .slice(0, 3)
      .map((skill) => skill.skill);

    const plan = buildCurriculumPlan({
      targetLevel: (progress.latest?.overallLevel ??
        snapshot.profile.proficiencyEstimate ??
        'B1') as CefrLevel,
      dailyMinutes: snapshot.profile.dailyMinutes,
      concepts: CONCEPTS.map((concept) => ({
        id: concept.id,
        domain: concept.domain as SkillDomain,
        level: concept.level,
      })),
      canDos: CAN_DO_STATEMENTS.map((canDo) => ({
        id: canDo.id,
        skill: canDo.skill,
        level: canDo.level,
        conceptIds: canDo.conceptIds,
      })),
      weakSkills,
      knownConceptIds: states
        .filter((state) => state.mastery >= 0.85)
        .map((state) => state.conceptId),
      now: deps.now(),
    });

    return c.json({ plan });
  });

  return app;
}
