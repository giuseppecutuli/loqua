CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  ui_locale TEXT NOT NULL DEFAULT 'it' CHECK (ui_locale IN ('it', 'en')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web', 'desktop')),
  name TEXT,
  last_seen_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS learner_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_lang TEXT NOT NULL DEFAULT 'en',
  native_lang TEXT NOT NULL DEFAULT 'it',
  explanation_mode TEXT NOT NULL DEFAULT 'target_simple'
    CHECK (explanation_mode IN ('target_simple', 'native')),
  proficiency_framework TEXT NOT NULL DEFAULT 'CEFR',
  proficiency_estimate TEXT,
  goal TEXT CHECK (goal IS NULL OR goal IN ('work', 'travel', 'daily', 'comprehension', 'exam')),
  daily_minutes INTEGER NOT NULL DEFAULT 20 CHECK (daily_minutes BETWEEN 5 AND 60),
  streak_mode TEXT NOT NULL DEFAULT 'flexible'
    CHECK (streak_mode IN ('daily', 'flexible', 'weekend_off')),
  timezone TEXT NOT NULL DEFAULT 'Europe/Rome',
  interests_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(interests_json)),
  self_assessment_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(self_assessment_json)),
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (user_id, target_lang, native_lang)
);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('terms', 'privacy', 'voice', 'ai_processing', 'analytics')),
  version TEXT NOT NULL,
  granted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, kind, version)
);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  desired_retention REAL NOT NULL DEFAULT 0.90 CHECK (desired_retention BETWEEN 0.80 AND 0.95),
  ai_daily_budget_usd REAL NOT NULL DEFAULT 0.50 CHECK (ai_daily_budget_usd >= 0),
  model_prefs_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(model_prefs_json)),
  notification_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(notification_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  last_pull_at TEXT,
  last_push_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS sync_conflict_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  resolution TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_meta (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  format_version INTEGER NOT NULL,
  schema_version TEXT NOT NULL,
  app_version TEXT NOT NULL,
  checksum TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_user ON learner_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_consents_user ON consents(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user ON sync_conflict_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_backup_meta_user ON backup_meta(user_id, created_at);
