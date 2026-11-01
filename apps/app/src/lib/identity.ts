import { generateUuidV7 } from '@loqua/core';

import { readJson, writeJson } from './local-db';
import { supabase } from './supabase';

export interface Identity {
  readonly userId: string;
  readonly isAnonymous: boolean;
  readonly email: string | null;
}

const IDENTITY_KEY = 'identity';
const DEVICE_KEY = 'device_id';

export async function loadOrCreateIdentity(): Promise<Identity> {
  if (supabase) {
    const session = await supabase.auth.getSession();
    if (session.data.session?.user) {
      const user = session.data.session.user;
      return {
        userId: user.id,
        isAnonymous: user.is_anonymous ?? false,
        email: user.email ?? null,
      };
    }

    const anonymous = await supabase.auth.signInAnonymously();
    if (!anonymous.error && anonymous.data.user) {
      const user = anonymous.data.user;
      return {
        userId: user.id,
        isAnonymous: user.is_anonymous ?? true,
        email: user.email ?? null,
      };
    }
  }

  const stored = readJson(IDENTITY_KEY);
  if (isIdentity(stored)) return stored;

  const created: Identity = {
    userId: generateUuidV7(),
    isAnonymous: true,
    email: null,
  };
  writeJson(IDENTITY_KEY, created);
  return created;
}

function isIdentity(value: unknown): value is Identity {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.userId === 'string' &&
    typeof record.isAnonymous === 'boolean' &&
    (record.email === null || typeof record.email === 'string')
  );
}

export function getOrCreateDeviceId(): string {
  const existing = readJson(DEVICE_KEY);
  if (typeof existing === 'string' && existing.length > 0) return existing;
  const created = generateUuidV7();
  writeJson(DEVICE_KEY, created);
  return created;
}

export function saveIdentity(identity: Identity): void {
  writeJson(IDENTITY_KEY, identity);
}
