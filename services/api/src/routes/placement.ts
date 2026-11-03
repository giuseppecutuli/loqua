import { Hono, type Context } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import { answerPlacement } from '../services/placement/answer.js';
import type { PlacementRoutesDeps } from '../services/placement/deps.js';
import type { PlacementOutcome } from '../services/placement/result.js';
import { skipSpeaking, submitSpeaking } from '../services/placement/speaking.js';
import { startPlacement } from '../services/placement/start.js';
import { skipWriting, submitWriting } from '../services/placement/writing.js';

export type { PlacementRoutesDeps };

const answerSchema = z.object({
  itemId: z.string().min(1).max(120),
  optionId: z.string().min(1).max(40),
});

const writingSchema = z.object({
  text: z.string().min(1).max(6000),
});

const speakingSchema = z.object({
  taskId: z.string().min(1).max(120),
  audioBase64: z.string().min(1).max(8_000_000),
  durationSec: z.number().positive().max(120),
});

function respond<T>(c: Context<AppEnv>, outcome: PlacementOutcome<T>) {
  if (!outcome.ok) {
    return c.json(errorResponse(outcome.code, outcome.message), outcome.status);
  }
  return c.json(outcome.body, outcome.status);
}

export function createPlacementRoutes(deps: PlacementRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post('/placement/start', async (c) => {
    return respond(c, await startPlacement(deps, c.get('user').id));
  });

  app.post('/:id/answer', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid answer payload'), 400);
    }
    return respond(
      c,
      await answerPlacement(
        deps,
        c.get('user').id,
        c.req.param('id'),
        parsed.data.itemId,
        parsed.data.optionId,
      ),
    );
  });

  app.post('/:id/writing', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = writingSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid writing payload'), 400);
    }
    return respond(
      c,
      await submitWriting(deps, c.get('user').id, c.req.param('id'), parsed.data.text),
    );
  });

  app.post('/:id/writing/skip', async (c) => {
    return respond(c, await skipWriting(deps, c.get('user').id, c.req.param('id')));
  });

  app.post('/:id/speaking', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = speakingSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid speaking payload'), 400);
    }
    return respond(
      c,
      await submitSpeaking(
        deps,
        c.get('user').id,
        c.req.param('id'),
        parsed.data.taskId,
        parsed.data.audioBase64,
        parsed.data.durationSec,
      ),
    );
  });

  app.post('/:id/speaking/skip', async (c) => {
    return respond(c, await skipSpeaking(deps, c.get('user').id, c.req.param('id')));
  });

  return app;
}
