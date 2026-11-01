import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!apiUrl || !supabase) return null;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return null;
  return { authorization: `Bearer ${token}` };
}

export async function hasRemoteSession(): Promise<boolean> {
  return (await authHeaders()) !== null;
}

export async function fetchServerExport(): Promise<string | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  try {
    const response = await fetch(`${apiUrl}/v1/account/export`, { headers });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function requestServerDelete(): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;

  try {
    const response = await fetch(`${apiUrl}/v1/account`, {
      method: 'DELETE',
      headers,
    });
    return response.ok;
  } catch {
    return false;
  }
}
