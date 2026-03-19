-- Phase 10a: Integrations & Extensions

-- Configuration for third-party integrations.
CREATE TABLE IF NOT EXISTS integration_configs (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    provider               TEXT    NOT NULL UNIQUE
                                  CHECK(provider IN ('inaturalist','wikipedia','osm','home_assistant','n8n')),
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

-- Per-species source metadata for provenance and refresh cadence.
CREATE TABLE IF NOT EXISTS species_external_sources (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    species_id         INTEGER NOT NULL REFERENCES species(id) ON DELETE CASCADE,
    provider           TEXT    NOT NULL
                               CHECK(provider IN ('inaturalist','wikipedia')),
    external_id        TEXT,
    source_url         TEXT,
    attribution        TEXT,
    revision_id        TEXT,
    native_range_json  TEXT,
    metadata_json      TEXT,
    retrieved_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    last_synced_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(species_id, provider)
);

-- Observable sync runs with timing and counts.
CREATE TABLE IF NOT EXISTS integration_sync_runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    provider         TEXT    NOT NULL,
    operation        TEXT    NOT NULL,
    status           TEXT    NOT NULL CHECK(status IN ('started','success','error')),
    records_fetched  INTEGER,
    records_upserted INTEGER,
    error_message    TEXT,
    started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    finished_at      TEXT
);

-- OSM/geospatial settings attached to environment with privacy controls.
CREATE TABLE IF NOT EXISTS environment_map_settings (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id    INTEGER NOT NULL UNIQUE REFERENCES environments(id) ON DELETE CASCADE,
    latitude          REAL,
    longitude         REAL,
    zoom_level        INTEGER,
    geocode_json      TEXT,
    weather_overlay   INTEGER NOT NULL DEFAULT 0,
    soil_overlay      INTEGER NOT NULL DEFAULT 0,
    boundaries_geojson TEXT,
    privacy_level     TEXT    NOT NULL DEFAULT 'private'
                                CHECK(privacy_level IN ('private','obfuscated','shared')),
    allow_sharing     INTEGER NOT NULL DEFAULT 0,
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Webhook/API tokens for automation callbacks.
CREATE TABLE IF NOT EXISTS integration_webhook_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    provider    TEXT    NOT NULL CHECK(provider IN ('home_assistant','n8n')),
    name        TEXT    NOT NULL,
    token       TEXT    NOT NULL UNIQUE,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Event log for inbound/outbound automation events.
CREATE TABLE IF NOT EXISTS automation_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    provider      TEXT    NOT NULL,
    event_type    TEXT    NOT NULL,
    direction     TEXT    NOT NULL CHECK(direction IN ('inbound','outbound')),
    payload_json  TEXT,
    status        TEXT    NOT NULL DEFAULT 'received'
                           CHECK(status IN ('received','processed','error')),
    error_message TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    processed_at  TEXT
);

-- Scheduled backup definitions.
CREATE TABLE IF NOT EXISTS backup_jobs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT    NOT NULL,
    schedule_cron     TEXT,
    format            TEXT    NOT NULL DEFAULT 'json' CHECK(format IN ('json','yaml','archive')),
    include_secrets   INTEGER NOT NULL DEFAULT 0,
    is_active         INTEGER NOT NULL DEFAULT 1,
    last_run_status   TEXT,
    last_run_at       TEXT,
    last_error        TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Backup execution history.
CREATE TABLE IF NOT EXISTS backup_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    backup_job_id  INTEGER REFERENCES backup_jobs(id) ON DELETE SET NULL,
    status         TEXT    NOT NULL CHECK(status IN ('started','success','error')),
    format         TEXT    NOT NULL CHECK(format IN ('json','yaml','archive')),
    output_ref     TEXT,
    bytes_written  INTEGER,
    error_message  TEXT,
    started_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    finished_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_species_external_sources_species_provider
    ON species_external_sources(species_id, provider);

CREATE INDEX IF NOT EXISTS idx_integration_sync_runs_provider_started
    ON integration_sync_runs(provider, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_events_provider_created
    ON automation_events(provider, created_at DESC);
