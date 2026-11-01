import { MIRROR_DDL, MIRROR_TABLES } from '@loqua/db-sqlite';
import { Platform } from 'react-native';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

export type StorageMode = 'sqlite' | 'localStorage' | 'memory';

let database: SQLiteDatabase | null = null;
let mode: StorageMode = Platform.OS === 'web' ? 'localStorage' : 'memory';
let initialized = false;
const memory = new Map<string, string>();

function canUseWebSqlite(): boolean {
  if (Platform.OS !== 'web') return true;
  if (typeof window === 'undefined') return false;
  return window.crossOriginIsolated === true;
}

function getDatabase(): SQLiteDatabase | null {
  if (initialized) return database;
  initialized = true;

  if (!canUseWebSqlite()) {
    mode = Platform.OS === 'web' ? 'localStorage' : 'memory';
    return null;
  }

  try {
    database = openDatabaseSync('loqua.db');
    database.execSync(MIRROR_DDL);
    database.execSync(
      'CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);',
    );
    mode = 'sqlite';
    return database;
  } catch {
    database = null;
    mode = Platform.OS === 'web' ? 'localStorage' : 'memory';
    return null;
  }
}

function readRaw(key: string): string | null {
  const db = getDatabase();
  if (db) {
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM app_kv WHERE key = ?',
      key,
    );
    return row?.value ?? null;
  }
  if (mode === 'localStorage' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  const db = getDatabase();
  if (db) {
    db.runSync(
      'INSERT INTO app_kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
    return;
  }
  if (mode === 'localStorage' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  memory.set(key, value);
}

export function readJson(key: string): unknown {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeRaw(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  const db = getDatabase();
  if (db) {
    db.runSync('DELETE FROM app_kv WHERE key = ?', key);
    return;
  }
  if (mode === 'localStorage' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  memory.delete(key);
}

export function clearLocalData(): void {
  const db = getDatabase();
  if (db) {
    db.runSync('DELETE FROM app_kv');
    for (const table of MIRROR_TABLES) {
      if (table === 'users') continue;
      db.runSync(`DELETE FROM ${table}`);
    }
    return;
  }
  if (mode === 'localStorage' && typeof localStorage !== 'undefined') {
    localStorage.clear();
    return;
  }
  memory.clear();
}

export function storageMode(): StorageMode {
  getDatabase();
  return mode;
}
