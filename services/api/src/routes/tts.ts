import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../auth.js';
import { errorResponse } from '../http.js';
import {
  InMemoryTtsCache,
  synthesizeWithCache,
  type TtsSynthesizer,
} from '../services/tts.js';

export interface TtsRoutesDeps {
  readonly tts?: TtsSynthesizer;
  readonly now: () => Date;
}

const ttsInputSchema = z.object({
  text: z.string().trim().min(1).max(400),
  targetLang: z.string().trim().min(2).max(10),
  voice: z.string().trim().min(1).max(80).optional(),
});

export function createTtsRoutes(deps: TtsRoutesDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const cache = new InMemoryTtsCache();

  app.post('/', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ttsInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorResponse('invalid_request', 'Invalid TTS payload'), 400);
    }
    if (!deps.tts) {
      return c.json(errorResponse('tts_unavailable', 'Server TTS is not configured'), 503);
    }
    try {
      const result = await synthesizeWithCache({
        text: parsed.data.text,
        targetLang: parsed.data.targetLang,
        voice: parsed.data.voice ?? 'default',
        synthesizer: deps.tts,
        cache,
        now: deps.now(),
      });
      return c.json(result);
    } catch {
      return c.json(errorResponse('provider_error', 'TTS synthesis failed'), 502);
    }
  });

  return app;
}
