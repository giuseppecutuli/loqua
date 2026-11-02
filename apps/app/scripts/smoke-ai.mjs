#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(path.join(root, file));
  } catch {
    // Optional env files.
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishable =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

if (!url || !publishable || !secret) {
  console.error('smoke:ai needs Supabase URL, publishable key and secret key');
  process.exit(1);
}

const client = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let userId = null;
let failed = false;

try {
  const signIn = await client.auth.signInAnonymously();
  if (signIn.error || !signIn.data.user) {
    throw new Error(`anonymous sign-in failed: ${signIn.error?.message ?? 'no user'}`);
  }
  userId = signIn.data.user.id;

  const now = new Date().toISOString();
  const consents = ['terms', 'privacy', 'ai_processing'].map((kind) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    kind,
    version: '1',
    granted_at: now,
    revoked_at: null,
    created_at: now,
  }));

  const consentWrite = await client.from('consents').upsert(consents);
  if (consentWrite.error) throw new Error(`consent write failed: ${consentWrite.error.message}`);

  const session = await client.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('no access token');

  const response = await fetch(`${apiUrl}/v1/ai/call`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      promptId: 'correction.evaluate',
      promptVersion: 2,
      tier: 'fast',
      input: {
        targetLang: 'en',
        nativeLang: 'it',
        explanationMode: 'target_simple',
        proficiencyFramework: 'CEFR',
        cefrLevel: 'B1',
        learnerText: 'I have went to the store yesterday.',
      },
    }),
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`AI call HTTP ${response.status}: ${JSON.stringify(body.error ?? body)}`);
  }

  const corrections = body.data?.corrections;
  if (!Array.isArray(corrections)) throw new Error('AI response has no corrections array');
  if (corrections.length === 0) throw new Error('AI returned no correction for the known error');

  console.log('PASS DeepSeek live correction');
  console.log(
    JSON.stringify({
      model: body.meta?.model,
      provider: body.meta?.provider,
      corrections: corrections.length,
      ruleIds: corrections.map((entry) => entry.ruleId),
      costUsd: body.meta?.costUsd,
      tokensIn: body.meta?.tokensIn,
      tokensOut: body.meta?.tokensOut,
      repairs: body.meta?.repairs,
      cached: body.meta?.cached,
    }),
  );
} catch (error) {
  failed = true;
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}

if (failed) process.exit(1);
console.log('smoke: DeepSeek live call green');

