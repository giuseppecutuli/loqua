import { mediaFeedbackSchema, tasteProfileSchema } from '@loqua/core';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { explainMedia } from '../services/media/explain.js';
import { recordFeedback } from '../services/media/feedback.js';
import { startGuide } from '../services/media/guide.js';
import { getMediaPlan } from '../services/media/plan.js';
import { listProgress, saveProgress } from '../services/media/progress.js';
import { listRecommendations } from '../services/media/recommendations.js';
import { reflectOnMedia } from '../services/media/reflection.js';
import { deleteTaste, getTaste, saveTaste } from '../services/media/taste.js';
import { MediaError, type MediaServiceDeps } from '../services/media/context.js';

export type MediaRoutesDeps = Omit<MediaServiceDeps, 'now'> & {
  readonly now: () => Date;
};

const tasteInputSchema = z.object({ taste: tasteProfileSchema });

const recommendationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

const feedbackInputSchema = mediaFeedbackSchema.extend({
  recommendationId: z.string().min(1).max(120).optional(),
});

const progressInputSchema = z.object({
  status: z.enum(['watching', 'reading', 'finished', 'abandoned']),
  progressPct: z.number().min(0).max(100),
});

const reflectionInputSchema = z.object({
  text: z.string().trim().min(1).max(6000),
  durationSec: z.number().int().min(1).max(3600).optional(),
  phrases: z.array(z.string().trim().min(1).max(200)).max(5).optional(),
});

export function createMediaRoutes(deps: MediaRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/taste', async (c) => {
    const user = c.get('user');
    return handle(c, () => getTaste(deps, user.id));
  });

  app.put('/taste', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = tasteInputSchema.safeParse(body);
    if (!parsed.success) return invalid(c);
    return handle(c, () => saveTaste(deps, user.id, parsed.data.taste));
  });

  app.delete('/taste', async (c) => {
    const user = c.get('user');
    return handle(c, () => deleteTaste(deps, user.id));
  });

  app.get('/recommendations', async (c) => {
    const user = c.get('user');
    const parsed = recommendationQuerySchema.safeParse({ limit: c.req.query('limit') });
    if (!parsed.success) return invalid(c);
    return handle(c, () => listRecommendations(deps, user.id, parsed.data.limit));
  });

  app.get('/progress', async (c) => {
    const user = c.get('user');
    return handle(c, () => listProgress(deps, user.id));
  });

  app.get('/plan', async (c) => {
    const user = c.get('user');
    return handle(c, () => getMediaPlan(deps, user.id));
  });

  app.post('/:id/explain', async (c) => {
    const user = c.get('user');
    return handle(c, () => explainMedia(deps, user.id, c.req.param('id')));
  });

  app.post('/:id/guide', async (c) => {
    const user = c.get('user');
    return handle(c, () => startGuide(deps, user.id, c.req.param('id')));
  });

  app.post('/:id/feedback', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = feedbackInputSchema.safeParse(body);
    if (!parsed.success) return invalid(c);
    return handle(c, () => recordFeedback(deps, user.id, c.req.param('id'), parsed.data));
  });

  app.post('/:id/progress', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = progressInputSchema.safeParse(body);
    if (!parsed.success) return invalid(c);
    return handle(c, () => saveProgress(deps, user.id, c.req.param('id'), parsed.data));
  });

  app.post('/:id/reflection', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = reflectionInputSchema.safeParse(body);
    if (!parsed.success) return invalid(c);
    return handle(c, () => reflectOnMedia(deps, user.id, c.req.param('id'), parsed.data));
  });

  return app;
}

async function handle<T>(c: Context<AppEnv>, work: () => Promise<T>) {
  try {
    return c.json(await work());
  } catch (error) {
    if (error instanceof MediaError) {
      return c.json(errorResponse(error.code, error.message), error.status);
    }
    throw error;
  }
}

function invalid(c: Context<AppEnv>) {
  return c.json(errorResponse('invalid_request', 'Invalid media payload'), 400);
}
