import {
  SAVED_PHRASE_SOURCES,
  createSavedPhrase,
  generateUuidV7,
  savedPhraseSchema,
} from '@loqua/core';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import type { AccountRepository } from '../repos/account.js';

export interface SavedPhraseRoutesDeps {
  readonly account: AccountRepository;
  readonly now: () => Date;
}

const createSchema = z.object({
  text: z.string().trim().min(1).max(500),
  source: z.enum(SAVED_PHRASE_SOURCES).default('manual'),
  sourceRef: z.string().min(1).max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export function createSavedPhraseRoutes(deps: SavedPhraseRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get('/', async (c) => {
    const user = c.get('user');
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }
    const phrases = await deps.account.listSavedPhrases(user.id, snapshot.profile.id);
    return c.json({ phrases });
  });

  app.post('/', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid phrase payload'), 400);
    }
    const snapshot = await deps.account.getSnapshot(user.id);
    if (!snapshot.profile) {
      return c.json(errorResponse('profile_required', 'Complete onboarding first'), 409);
    }

    const phrase = createSavedPhrase({
      id: generateUuidV7(),
      userId: user.id,
      profileId: snapshot.profile.id,
      targetLang: snapshot.profile.targetLang,
      text: parsed.data.text,
      source: parsed.data.source,
      sourceRef: parsed.data.sourceRef ?? null,
      note: parsed.data.note ?? null,
      now: deps.now(),
    });
    const validated = savedPhraseSchema.safeParse(phrase);
    if (!validated.success) {
      return c.json(errorResponse('invalid_request', 'Invalid phrase payload'), 400);
    }
    const saved = await deps.account.upsertSavedPhrase(validated.data);
    return c.json({ phrase: saved }, 201);
  });

  app.delete('/:id', async (c) => {
    const user = c.get('user');
    const deleted = await deps.account.deleteSavedPhrase(
      user.id,
      c.req.param('id'),
      deps.now(),
    );
    if (!deleted) {
      return c.json(errorResponse('not_found', 'Saved phrase not found'), 404);
    }
    return c.json({ deleted: true });
  });

  return app;
}
