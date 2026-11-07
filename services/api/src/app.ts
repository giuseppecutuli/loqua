import type { AiGateway } from '@loqua/ai';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { authMiddleware, type AppEnv, type JwtVerifier } from './auth.js';
import { errorResponse } from './http.js';
import { createAccountRoutes } from './routes/account.js';
import type { StreamingTranscriberLike } from './services/conversation/streaming.js';
import type { TtsSynthesizer } from './services/tts.js';
import type { AccountRepository } from './repos/account.js';
import type { AssessmentStore } from './repos/assessment.js';
import type { NotificationStore } from './repos/notifications.js';
import type { ProductEventStore } from './repos/events.js';
import type { MediaStore } from './repos/media.js';
import type { SessionStore } from './repos/session.js';
import { createEventRoutes } from './routes/events.js';
import { createMediaRoutes } from './routes/media.js';
import { createNotificationRoutes } from './routes/notifications.js';
import { createPlacementRoutes } from './routes/placement.js';
import { createProgressRoutes } from './routes/progress.js';
import { createContentRoutes } from './routes/content.js';
import { createConversationRoutes } from './routes/conversation.js';
import { createCurriculumRoutes } from './routes/curriculum.js';
import { createFeedbackRoutes } from './routes/feedback.js';
import { createGamificationRoutes } from './routes/gamification.js';
import { createInsightsRoutes } from './routes/insights.js';
import { createSavedPhraseRoutes } from './routes/saved-phrases.js';
import { createSessionRoutes } from './routes/session.js';
import { createTtsRoutes } from './routes/tts.js';

export interface AppDeps {
  readonly ai: AiGateway;
  readonly auth: JwtVerifier;
  readonly account: AccountRepository;
  readonly assessments: AssessmentStore;
  readonly sessions: SessionStore;
  readonly media: MediaStore;
  readonly notifications: NotificationStore;
  readonly events: ProductEventStore;
  readonly transcribe?: (
    audio: Uint8Array,
    languageCode?: string,
  ) => Promise<{ text: string; durationSec: number; languageCode: string | null }>;
  readonly streamSecret?: string;
  readonly tts?: TtsSynthesizer;
  readonly createStreamingTranscriber?: (opts: {
    readonly languageCode: string;
    readonly sampleRate: number;
  }) => StreamingTranscriberLike;
  readonly now?: () => Date;
  readonly corsOrigins?: readonly string[];
}

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const now = deps.now ?? (() => new Date());

  if (deps.corsOrigins && deps.corsOrigins.length > 0) {
    const allowed = new Set(deps.corsOrigins);
    app.use(
      '*',
      cors({
        origin: (origin) => (allowed.has(origin) ? origin : null),
        allowHeaders: ['authorization', 'content-type', 'x-device-id'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }),
    );
  }

  app.get('/health', (c) => c.json({ status: 'ok', service: 'loqua-api', version: '0.1.0' }));

  const authenticate = authMiddleware(deps.auth);
  app.use('/v1/*', async (c, next) => {
    // Browser WebSocket clients cannot set an Authorization header; the stream
    // route authenticates with its short-lived signed ticket instead.
    if (/^\/v1\/conversations\/[^/]+\/stream$/.test(c.req.path)) {
      await next();
      return;
    }
    return await authenticate(c, next);
  });
  app.use('/v1/*', async (c, next) => {
    if (/^\/v1\/conversations\/[^/]+\/stream$/.test(c.req.path)) {
      await next();
      return;
    }
    const deviceId = c.req.header('x-device-id');
    if (deviceId) {
      const revoked = await deps.account.isDeviceRevoked(c.get('user').id, deviceId);
      if (revoked) {
        return c.json(errorResponse('device_revoked', 'Device session revoked'), 401);
      }
    }
    await next();
    return undefined;
  });

  app.route('/v1', createAccountRoutes({ account: deps.account, ai: deps.ai, now }));
  app.route(
    '/v1/assessments',
    createPlacementRoutes({
      ai: deps.ai,
      account: deps.account,
      assessments: deps.assessments,
      transcribe: deps.transcribe,
      now,
    }),
  );

  app.route(
    '/v1/progress',
    createProgressRoutes({ account: deps.account, assessments: deps.assessments }),
  );
  app.route(
    '/v1/conversations',
    createConversationRoutes({
      ai: deps.ai,
      account: deps.account,
      assessments: deps.assessments,
      sessions: deps.sessions,
      transcribe: deps.transcribe,
      streamSecret: deps.streamSecret,
      createStreamingTranscriber: deps.createStreamingTranscriber,
      now,
    }),
  );
  app.route(
    '/v1/sessions',
    createSessionRoutes({
      account: deps.account,
      assessments: deps.assessments,
      sessions: deps.sessions,
      now,
    }),
  );

  app.route(
    '/v1/media',
    createMediaRoutes({
      ai: deps.ai,
      account: deps.account,
      assessments: deps.assessments,
      sessions: deps.sessions,
      media: deps.media,
      now,
    }),
  );

  app.route('/v1/phrases', createSavedPhraseRoutes({ account: deps.account, now }));

  app.route('/v1/feedback', createFeedbackRoutes({ account: deps.account, now }));
  app.route(
    '/v1/gamification',
    createGamificationRoutes({ account: deps.account, sessions: deps.sessions, now }),
  );
  app.route(
    '/v1/insights',
    createInsightsRoutes({ account: deps.account, sessions: deps.sessions, now }),
  );
  app.route(
    '/v1/notifications',
    createNotificationRoutes({
      account: deps.account,
      sessions: deps.sessions,
      notifications: deps.notifications,
      media: deps.media,
      now,
    }),
  );
  app.route('/v1/events', createEventRoutes({ events: deps.events, now }));
  app.route('/v1/tts', createTtsRoutes({ tts: deps.tts, now }));
  app.route(
    '/v1/content',
    createContentRoutes({
      ai: deps.ai,
      account: deps.account,
      assessments: deps.assessments,
      sessions: deps.sessions,
      now,
    }),
  );

  app.route(
    '/v1/curriculum',
    createCurriculumRoutes({
      account: deps.account,
      assessments: deps.assessments,
      sessions: deps.sessions,
      now,
    }),
  );

  app.notFound((c) => c.json(errorResponse('not_found', 'Route not found'), 404));

  app.onError((error, c) => {
    if (process.env.API_DEBUG_ERRORS === '1') {
      process.stderr.write(
        `[api] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
      );
    }
    return c.json(errorResponse('internal', 'Internal error'), 500);
  });

  return app;
}
