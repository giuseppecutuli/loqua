#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  console.error('smoke: .env not found');
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishable || !secret) {
  console.error('smoke: SUPABASE URL, publishable key and secret key are required');
  process.exit(1);
}

function client() {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const created = [];
let failed = false;
let anonymousDisabledWarned = false;

async function signIn(supabaseClient) {
  const anonymous = await supabaseClient.auth.signInAnonymously();
  if (!anonymous.error && anonymous.data.user) {
    created.push(anonymous.data.user.id);
    return anonymous.data.user.id;
  }

  if (!/disabled/i.test(anonymous.error?.message ?? '')) {
    throw new Error(`anonymous sign-in failed: ${anonymous.error?.message ?? 'no user'}`);
  }

  const email = `smoke-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomUUID();
  const createdUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createdUser.error || !createdUser.data.user) {
    throw new Error(`admin createUser failed: ${createdUser.error?.message ?? 'no user'}`);
  }
  created.push(createdUser.data.user.id);

  const signedIn = await supabaseClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) {
    throw new Error(`password sign-in failed: ${signedIn.error?.message ?? 'no user'}`);
  }
  if (!anonymousDisabledWarned) {
    anonymousDisabledWarned = true;
    console.log('WARN anonymous sign-ins are disabled; used an email/password smoke user');
  }
  return signedIn.data.user.id;
}

try {
  const a = client();
  const userA = await signIn(a);

  const userRow = await a.from('users').select('id, ui_locale').eq('id', userA).maybeSingle();
  if (userRow.error || !userRow.data) {
    throw new Error(`users trigger missing: ${userRow.error?.message ?? 'no row'}`);
  }
  console.log('PASS auth + users trigger');

  const now = new Date().toISOString();
  const profileId = crypto.randomUUID();
  const insert = await a.from('learner_profiles').insert({
    id: profileId,
    user_id: userA,
    target_lang: 'en',
    native_lang: 'it',
    explanation_mode: 'target_simple',
    proficiency_framework: 'CEFR',
    goal: 'work',
    daily_minutes: 20,
    streak_mode: 'flexible',
    timezone: 'Europe/Rome',
    interests_json: ['work'],
    self_assessment_json: { grammar: 'B1' },
    onboarding_completed: true,
    created_at: now,
    updated_at: now,
  });
  if (insert.error) throw new Error(`profile insert failed: ${insert.error.message}`);

  const own = await a.from('learner_profiles').select('id').eq('id', profileId);
  if (own.error || own.data?.length !== 1) throw new Error('profile not readable by owner');
  console.log('PASS profile insert + owner read');

  if (process.env.SMOKE_API === '1') {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    const session = await a.auth.getSession();
    const token = session.data.session?.access_token;
    if (!apiUrl || !token) throw new Error('API smoke needs EXPO_PUBLIC_API_URL and a session');

    const response = await fetch(`${apiUrl}/v1/account/export`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`server export failed: HTTP ${response.status}`);
    const body = await response.json();
    if (body.formatVersion !== 1 || typeof body.checksum !== 'string') {
      throw new Error('server export payload is invalid');
    }
    if (body.profile?.id !== profileId) throw new Error('server export missing the profile');
    console.log('PASS API export with Supabase JWT');
  }

  const b = client();
  await signIn(b);

  const other = await b.from('learner_profiles').select('id').eq('id', profileId);
  if (other.error) throw new Error(`isolation query failed: ${other.error.message}`);
  if ((other.data?.length ?? 0) !== 0) throw new Error('RLS leak: user B read user A row');
  console.log('PASS RLS isolation on hosted project');
} catch (error) {
  failed = true;
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  for (const userId of created) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}

if (failed) process.exit(1);
console.log('smoke: hosted Supabase auth + RLS green');
