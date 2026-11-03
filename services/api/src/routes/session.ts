import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { recordSessionAttempt } from '../services/session/attempt.js';
import { ensureSession, loadItems, type SessionDeps } from '../services/session/planning.js';
import { currentView } from '../services/session/view.js';

export type SessionRoutesDeps = SessionDeps;

const attemptSchema = z
  .object({
    sessionItemId: z.string().min(1).max(120),
    optionId: z.string().min(1).max(40).optional(),
    text: z.string().trim().min(1).max(2000).optional(),
    latencyMs: z.number().int().nonnegative().max(600_000).optional(),
    hintUsed: z.boolean().optional(),
  })
  .refine((value) => value.optionId !== undefined || value.text !== undefined, {
    message: 'optionId or text is required',
  });

export function createSessionRoutes(deps: SessionRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const loaded = await ensureSession(
      deps,
      user.id,
      snapshot.profile.id,
      snapshot.profile.targetLang,
      snapshot.profile.dailyMinutes,
    );
    if (!loaded) {
      return c.json(errorResponse('content_unavailable', 'No approved session items'), 503);
    }
    return c.json({ session: currentView(loaded.session, loaded.items, loaded.itemsById) }, 201);
  });

  app.get('/current', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const active = await deps.sessions.findActiveSession(user.id, snapshot.profile.id);
    if (!active) {
      return c.json({ session: null });
    }
    const items = await deps.sessions.listSessionItems(user.id, active.id);
    const itemsById = await loadItems(deps, user.id, active.targetLang);
    return c.json({ session: currentView(active, items, itemsById) });
  });

  app.post('/:id/attempts', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = attemptSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid attempt payload'), 400);
    }

    const result = await recordSessionAttempt(deps, user.id, c.req.param('id'), parsed.data);
    if (!result.ok) {
      return c.json(errorResponse(result.code, result.message), result.status);
    }
    return c.json(result.response);
  });

  return app;
}
