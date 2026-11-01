import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
  readonly role: string | null;
  readonly isAnonymous: boolean;
}

export interface AppEnv {
  Variables: {
    user: AuthUser;
  };
}

export type JwtVerifier = (token: string) => Promise<AuthUser>;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

type JwksResolver = JWTVerifyGetKey;

function toAuthUser(payload: Record<string, unknown>): AuthUser {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new AuthError('invalid_subject');
  }

  return {
    id: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    role: typeof payload.role === 'string' ? payload.role : null,
    isAnonymous: payload.is_anonymous === true,
  };
}

export function createSupabaseJwtVerifier(secret: string): JwtVerifier {
  const key = new TextEncoder().encode(secret);
  return async (token) => {
    try {
      const verified = await jwtVerify(token, key, { algorithms: ['HS256'] });
      return toAuthUser(verified.payload);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('invalid_token');
    }
  };
}

export interface SupabaseJwksOptions {
  readonly url: string;
  readonly audience?: string;
  readonly jwks?: JwksResolver;
}

export function createSupabaseJwksVerifier(options: SupabaseJwksOptions): JwtVerifier {
  const baseUrl = options.url.replace(/\/$/, '');
  const issuer = `${baseUrl}/auth/v1`;
  const audience = options.audience ?? 'authenticated';
  const jwks =
    options.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    try {
      const verified = await jwtVerify(token, jwks, { issuer, audience });
      return toAuthUser(verified.payload);
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('invalid_token');
    }
  };
}

export function getBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export function authMiddleware(
  verify: JwtVerifier,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = getBearerToken(c.req.header('authorization'));
    if (!token) {
      return c.json({ error: { code: 'unauthorized', message: 'Missing bearer token' } }, 401);
    }

    try {
      c.set('user', await verify(token));
    } catch {
      return c.json({ error: { code: 'unauthorized', message: 'Invalid token' } }, 401);
    }

    await next();
    return undefined;
  };
}
