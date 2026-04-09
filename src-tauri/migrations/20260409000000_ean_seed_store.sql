-- ---------------------------------------------------------------------------
-- EAN seed-packet integration
--
-- 1) Adds barcode/enrichment metadata columns to seed_lots so scan results can
--    create and enrich seed-store records.
-- 2) Expands integration provider constraint to include eol + ean_search.
-- ---------------------------------------------------------------------------

ALTER TABLE seed_lots ADD COLUMN ean_code TEXT;
ALTER TABLE seed_lots ADD COLUMN ean_product_name TEXT;
ALTER TABLE seed_lots ADD COLUMN ean_category_name TEXT;
ALTER TABLE seed_lots ADD COLUMN ean_issuing_country TEXT;
ALTER TABLE seed_lots ADD COLUMN ean_last_lookup_at TEXT;

CREATE INDEX IF NOT EXISTS idx_seed_lots_ean_code
    ON seed_lots(ean_code);

PRAGMA foreign_keys=OFF;

CREATE TABLE integration_configs_new (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    provider               TEXT    NOT NULL UNIQUE
                                  CHECK(provider IN (
                                      'inaturalist',
                                      'wikipedia',
                                      'eol',
                                      'osm',
                                      'home_assistant',
                                      'n8n',
                                      'ean_search'
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
