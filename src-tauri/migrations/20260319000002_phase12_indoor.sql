-- Phase 12: Indoor Gardening extensions

CREATE TABLE IF NOT EXISTS indoor_nutrient_logs (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    indoor_environment_id INTEGER NOT NULL REFERENCES indoor_environments(id) ON DELETE CASCADE,
    additive_id           INTEGER REFERENCES additives(id) ON DELETE SET NULL,
    amount                REAL    NOT NULL,
    unit                  TEXT    NOT NULL DEFAULT 'ml',
    created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS indoor_water_changes (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    indoor_environment_id INTEGER NOT NULL REFERENCES indoor_environments(id) ON DELETE CASCADE,
    volume_liters         REAL,
    notes                 TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS indoor_reservoir_targets (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    indoor_environment_id INTEGER NOT NULL UNIQUE REFERENCES indoor_environments(id) ON DELETE CASCADE,
    ph_min                REAL,
    ph_max                REAL,
    ec_min                REAL,
    ec_max                REAL,
    ppm_min               REAL,
    ppm_max               REAL,
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_indoor_readings_env_time
    ON indoor_readings(indoor_environment_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_indoor_nutrients_env_time
    ON indoor_nutrient_logs(indoor_environment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_indoor_water_changes_env_time
    ON indoor_water_changes(indoor_environment_id, created_at DESC);
