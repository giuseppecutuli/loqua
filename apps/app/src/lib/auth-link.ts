import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export function emailRedirectUrl(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return Linking.createURL('/login');
}

function readParams(url: string): URLSearchParams {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) return new URLSearchParams(url.slice(hashIndex + 1));
  const queryIndex = url.indexOf('?');
  if (queryIndex >= 0) return new URLSearchParams(url.slice(queryIndex + 1));
  return new URLSearchParams();
}

export async function completeAuthRedirect(url: string): Promise<boolean> {
  if (!supabase) return false;
  const params = readParams(url);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return !error;
  }
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}
