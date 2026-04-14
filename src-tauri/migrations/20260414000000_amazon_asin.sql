-- ---------------------------------------------------------------------------
-- Amazon ASIN product lookup integration
--
-- 1) Adds asin columns to seed_lots so ASIN scan results can create and
--    enrich seed-store records independently from the EAN workflow.
-- 2) Expands integration provider constraint to include amazon_pa_api.
-- ---------------------------------------------------------------------------

ALTER TABLE seed_lots ADD COLUMN asin_code             TEXT;
ALTER TABLE seed_lots ADD COLUMN asin_product_title    TEXT;
ALTER TABLE seed_lots ADD COLUMN asin_brand            TEXT;
ALTER TABLE seed_lots ADD COLUMN asin_last_lookup_at   TEXT;

CREATE INDEX IF NOT EXISTS idx_seed_lots_asin_code
    ON seed_lots(asin_code);

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
                                      'ean_search',
                                      'amazon_pa_api'
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

INSERT INTO integration_configs_new SELECT * FROM integration_configs;

DROP TABLE integration_configs;
ALTER TABLE integration_configs_new RENAME TO integration_configs;

PRAGMA foreign_keys=ON;
