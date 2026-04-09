-- ---------------------------------------------------------------------------
-- Storage portability + scheduled backup enhancements
--
-- 1) Expands integration provider constraint for cloud storage providers.
-- 2) Adds backup strategy/destination/lifecycle/dedupe fields.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys=OFF;

CREATE TABLE integration_configs_new (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    provider               TEXT    NOT NULL UNIQUE
                                  CHECK(provider IN (
                                      'inaturalist',
                                      'wikipedia',
                                      'eol',
                                      'ean_search',
                                      'osm',
                                      'dropbox',
                                      'google_drive',
                                      'onedrive',
                                      'home_assistant',
                                      'n8n'
                                  )),
    enabled                INTEGER NOT NULL DEFAULT 0,
    auth_json              TEXT,
    settings_json          TEXT,
    sync_interval_minutes  INTEGER,
    cache_ttl_minutes      INTEGER,
    rate_limit_per_minute  INTEGER,
    last_synced_at         TEXT,
    last_error             TEXT,
    updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO integration_configs_new (
    id,
    provider,
    enabled,
    auth_json,
    settings_json,
    sync_interval_minutes,
    cache_ttl_minutes,
    rate_limit_per_minute,
    last_synced_at,
    last_error,
    updated_at
)
SELECT
    id,
    provider,
    enabled,
    auth_json,
    settings_json,
    sync_interval_minutes,
    cache_ttl_minutes,
    rate_limit_per_minute,
    last_synced_at,
    last_error,
    updated_at
FROM integration_configs;

DROP TABLE integration_configs;
ALTER TABLE integration_configs_new RENAME TO integration_configs;

PRAGMA foreign_keys=ON;

ALTER TABLE backup_jobs
    ADD COLUMN backup_strategy TEXT NOT NULL DEFAULT 'full'
    CHECK(backup_strategy IN ('full','incremental','hybrid'));

ALTER TABLE backup_jobs
    ADD COLUMN destination_kind TEXT NOT NULL DEFAULT 'local'
    CHECK(destination_kind IN ('local','network','cloud'));

ALTER TABLE backup_jobs
    ADD COLUMN destination_path TEXT;

ALTER TABLE backup_jobs
    ADD COLUMN cloud_provider TEXT
    CHECK(cloud_provider IN ('dropbox','google_drive','onedrive'));

ALTER TABLE backup_jobs
    ADD COLUMN cloud_path_prefix TEXT;

ALTER TABLE backup_jobs
    ADD COLUMN lifecycle_policy_json TEXT;

ALTER TABLE backup_jobs
    ADD COLUMN dedupe_enabled INTEGER NOT NULL DEFAULT 1;

ALTER TABLE backup_runs
    ADD COLUMN backup_kind TEXT NOT NULL DEFAULT 'full'
    CHECK(backup_kind IN ('full','incremental','hybrid'));

ALTER TABLE backup_runs
    ADD COLUMN destination_ref TEXT;

ALTER TABLE backup_runs
    ADD COLUMN content_hash TEXT;

ALTER TABLE backup_runs
    ADD COLUMN dedupe_skipped INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_backup_runs_job_started
    ON backup_runs(backup_job_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_backup_runs_job_hash
    ON backup_runs(backup_job_id, content_hash);
