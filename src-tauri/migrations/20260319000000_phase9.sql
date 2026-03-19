-- Phase 9: Weather Integration

-- Persistent key-value store for API keys and user preferences.
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One cached weather payload per environment.
-- forecast_json stores a full serialized WeatherData JSON blob.
CREATE TABLE IF NOT EXISTS weather_cache (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    forecast_json  TEXT    NOT NULL,
    fetched_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    valid_until    TEXT,
    UNIQUE(environment_id)
);
