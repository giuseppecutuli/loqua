import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
} from 'jose';
import { describe, expect, it } from 'vitest';

import {
  AuthError,
  createSupabaseJwksVerifier,
  createSupabaseJwtVerifier,
  getBearerToken,
} from './auth.js';

const secret = 'test-secret-at-least-32-bytes-long!!';
const key = new TextEncoder().encode(secret);

async function sign(subject: string, extra: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ email: 'learner@example.test', role: 'authenticated', ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

describe('JWT auth', () => {
  it('parses bearer tokens', () => {
    expect(getBearerToken('Bearer abc')).toBe('abc');
    expect(getBearerToken('bearer abc')).toBe('abc');
    expect(getBearerToken('Basic abc')).toBeNull();
    expect(getBearerToken(undefined)).toBeNull();
  });

  it('verifies Supabase-style tokens', async () => {
    const verifier = createSupabaseJwtVerifier(secret);
    const token = await sign('user-1', { is_anonymous: false });
    await expect(verifier(token)).resolves.toEqual({
      id: 'user-1',
      email: 'learner@example.test',
      role: 'authenticated',
      isAnonymous: false,
    });
  });

  it('marks anonymous sessions', async () => {
    const verifier = createSupabaseJwtVerifier(secret);
    const token = await sign('user-2', { is_anonymous: true });
    await expect(verifier(token)).resolves.toMatchObject({ isAnonymous: true });
  });

  it('rejects tampered tokens', async () => {
    const verifier = createSupabaseJwtVerifier(secret);
    const token = await sign('user-1');
    await expect(verifier(`${token.slice(0, -2)}xx`)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects tokens without a subject', async () => {
    const verifier = createSupabaseJwtVerifier(secret);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);
    await expect(verifier(token)).rejects.toBeInstanceOf(AuthError);
  });

  it('verifies asymmetric Supabase access tokens through JWKS', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const publicJwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };
    const verifier = createSupabaseJwksVerifier({
      url: 'https://project.supabase.co',
      jwks: createLocalJWKSet({ keys: [publicJwk] }),
    });

    const token = await new SignJWT({
      email: 'learner@example.test',
      role: 'authenticated',
      is_anonymous: true,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer('https://project.supabase.co/auth/v1')
      .setAudience('authenticated')
      .setSubject('user-3')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier(token)).resolves.toMatchObject({
      id: 'user-3',
      isAnonymous: true,
    });
  });

  it('rejects asymmetric tokens with the wrong issuer', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256');
    const publicJwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256' };
    const verifier = createSupabaseJwksVerifier({
      url: 'https://project.supabase.co',
      jwks: createLocalJWKSet({ keys: [publicJwk] }),
    });

    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer('https://other.supabase.co/auth/v1')
      .setAudience('authenticated')
      .setSubject('user-3')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(verifier(token)).rejects.toBeInstanceOf(AuthError);
  });
});
