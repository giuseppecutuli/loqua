import { getOrCreateDeviceId } from './identity';
import { supabase } from './supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface SafeParser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export function apiBaseUrl(): string | null {
  return apiUrl ?? null;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  if (!apiUrl || !supabase) return null;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return null;
  const deviceId = await getOrCreateDeviceId().catch(() => null);
  return {
    authorization: `Bearer ${token}`,
    ...(deviceId ? { 'x-device-id': deviceId } : {}),
  };
}

export async function hasAuthSession(): Promise<boolean> {
  return (await authHeaders()) !== null;
}

export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders();
  if (!headers) throw new ApiError(401, 'unauthorized');

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, 'network');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code = stringField(field(body, 'error'), 'code') ?? `http_${response.status}`;
    throw new ApiError(response.status, code);
  }
  return response;
}

export async function requestText(path: string, init: RequestInit = {}): Promise<string> {
  return (await request(path, init)).text();
}

export function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, key) : undefined;
}

export function stringField(value: unknown, key: string): string | null {
  const candidate = field(value, key);
  return typeof candidate === 'string' ? candidate : null;
}

export function numberField(value: unknown, key: string): number | null {
  const candidate = field(value, key);
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

export function booleanField(value: unknown, key: string): boolean | null {
  const candidate = field(value, key);
  return typeof candidate === 'boolean' ? candidate : null;
}

export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function parseEnvelope<T>(
  body: unknown,
  key: string,
  schema: SafeParser<T>,
  error: string,
): T {
  const parsed = schema.safeParse(field(body, key));
  if (!parsed.success) throw new Error(error);
  return parsed.data;
}

export function parseNullableEnvelope<T>(
  body: unknown,
  key: string,
  schema: SafeParser<T>,
  error: string,
): T | null {
  const value = field(body, key);
  if (value === null || value === undefined) return null;
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(error);
  return parsed.data;
}

export function parseCollection<T>(
  body: unknown,
  key: string,
  schema: SafeParser<T>,
  error: string,
): T[] {
  const value = field(body, key);
  if (!Array.isArray(value)) throw new Error(error);
  return value.flatMap((entry) => {
    const parsed = schema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseBody<T>(body: unknown, schema: SafeParser<T>, error: string): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error(error);
  return parsed.data;
}

export function parseNullableBody<T>(
  body: unknown,
  schema: SafeParser<T>,
  error: string,
): T | null {
  if (body === null || body === undefined) return null;
  return parseBody(body, schema, error);
}
