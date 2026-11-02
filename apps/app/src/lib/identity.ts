import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUuidV7 } from '@loqua/core';

import { supabase } from './supabase';

export interface Identity {
  readonly userId: string;
  readonly isAnonymous: boolean;
  readonly email: string | null;
}

const DEVICE_KEY = 'loqua.device_id';

function toIdentity(user: {
  readonly id: string;
  readonly is_anonymous?: boolean;
  readonly email?: string | null;
}): Identity {
  return {
    userId: user.id,
    isAnonymous: user.is_anonymous ?? false,
    email: user.email ?? null,
  };
}

export async function loadOrCreateIdentity(): Promise<Identity> {
  if (!supabase) throw new Error('Supabase is not configured');

  const session = await supabase.auth.getSession();
  if (session.data.session?.user) return toIdentity(session.data.session.user);

  const anonymous = await supabase.auth.signInAnonymously();
  if (anonymous.error || !anonymous.data.user) {
    throw new Error(anonymous.error?.message ?? 'anonymous_sign_in_failed');
  }
  return toIdentity(anonymous.data.user);
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = generateUuidV7();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}
