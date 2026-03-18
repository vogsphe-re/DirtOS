-- Phase 1: Full DirtOS schema.
-- Tables are ordered so that referenced tables are created before referencing ones.
-- plants.seed_lot_id is a plain INTEGER (no FK declared) to break the circular
-- dependency with seed_lots; referential integrity is enforced at the app layer.

-- ---------------------------------------------------------------------------
-- Environments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS environments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    latitude    REAL,
    longitude   REAL,
    elevation_m REAL,
    timezone    TEXT,
    climate_zone TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Location hierarchy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id   INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    parent_id        INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    type             TEXT    NOT NULL CHECK(type IN ('plot','space','tent','tray','pot','shed')),
    name             TEXT    NOT NULL,
    label            TEXT,
    position_x       REAL,
    position_y       REAL,
    width            REAL,
    height           REAL,
    canvas_data_json TEXT,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Species catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS species (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    common_name              TEXT    NOT NULL,
    scientific_name          TEXT,
    family                   TEXT,
    genus                    TEXT,
    inaturalist_id           INTEGER,
    wikipedia_slug           TEXT,
    growth_type              TEXT,
    sun_requirement          TEXT,
    water_requirement        TEXT,
    soil_ph_min              REAL,
    soil_ph_max              REAL,
    spacing_cm               REAL,
    days_to_germination_min  INTEGER,
    days_to_germination_max  INTEGER,
    days_to_harvest_min      INTEGER,
    days_to_harvest_max      INTEGER,
    hardiness_zone_min       TEXT,
    hardiness_zone_max       TEXT,
    description              TEXT,
    image_url                TEXT,
    cached_inaturalist_json  TEXT,
    cached_wikipedia_json    TEXT,
    is_user_added            INTEGER NOT NULL DEFAULT 0,
    created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Soil
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soil_types (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    composition     TEXT,
    ph_default      REAL,
    drainage_rating TEXT,
    notes           TEXT
);

-- ---------------------------------------------------------------------------
-- Additives / Fertilizers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS additives (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,
    type             TEXT    NOT NULL CHECK(type IN ('fertilizer','amendment','pesticide','fungicide','other')),
    npk_n            REAL,
    npk_p            REAL,
    npk_k            REAL,
    application_rate REAL,
    application_unit TEXT,
    notes            TEXT
);

-- ---------------------------------------------------------------------------
-- Individual plants
-- Note: seed_lot_id has no FK constraint to avoid circular dependency.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plants (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    species_id       INTEGER REFERENCES species(id) ON DELETE SET NULL,
    location_id      INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    environment_id   INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    status           TEXT    NOT NULL DEFAULT 'planned'
                             CHECK(status IN ('planned','seedling','active','harvested','removed','dead')),
    name             TEXT    NOT NULL,
    label            TEXT,
    planted_date     TEXT,
    germinated_date  TEXT,
    transplanted_date TEXT,
    removed_date     TEXT,
    parent_plant_id  INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    seed_lot_id      INTEGER,  -- refs seed_lots(id); no FK to break circular dep
    purchase_source  TEXT,
    purchase_date    TEXT,
    purchase_price   REAL,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Custom attributes (EAV for user-defined fields)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_fields (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT    NOT NULL CHECK(entity_type IN ('species','plant','location','soil_test')),
    entity_id   INTEGER NOT NULL,
    field_name  TEXT    NOT NULL,
    field_value TEXT,
    field_type  TEXT    NOT NULL CHECK(field_type IN ('text','number','date','boolean')),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Soil tests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soil_tests (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    test_date           TEXT    NOT NULL,
    ph                  REAL,
    nitrogen_ppm        REAL,
    phosphorus_ppm      REAL,
    potassium_ppm       REAL,
    moisture_pct        REAL,
    organic_matter_pct  REAL,
    notes               TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Issue tracker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS issues (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    plant_id       INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    title          TEXT    NOT NULL,
    description    TEXT,
    status         TEXT    NOT NULL DEFAULT 'new'
                           CHECK(status IN ('new','open','in_progress','closed')),
    priority       TEXT    NOT NULL DEFAULT 'medium'
                           CHECK(priority IN ('low','medium','high','critical')),
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    closed_at      TEXT
);

CREATE TABLE IF NOT EXISTS issue_labels (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE,
    color TEXT,
    icon  TEXT
);

CREATE TABLE IF NOT EXISTS issue_label_map (
    issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES issue_labels(id) ON DELETE CASCADE,
    PRIMARY KEY (issue_id, label_id)
);

CREATE TABLE IF NOT EXISTS issue_comments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id   INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    body       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Journal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    plant_id       INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    title          TEXT    NOT NULL,
    body           TEXT,
    conditions_json TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Media / Attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type    TEXT    NOT NULL,
    entity_id      INTEGER NOT NULL,
    file_path      TEXT    NOT NULL,
    file_name      TEXT    NOT NULL,
    mime_type      TEXT,
    thumbnail_path TEXT,
    caption        TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Schedules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    plant_id       INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    type           TEXT    NOT NULL
                           CHECK(type IN ('water','feed','maintenance','treatment','sample','custom')),
    title          TEXT    NOT NULL,
    cron_expression TEXT,
    next_run_at    TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1,
    additive_id    INTEGER REFERENCES additives(id) ON DELETE SET NULL,
    notes          TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    issue_id    INTEGER REFERENCES issues(id) ON DELETE SET NULL,
    ran_at      TEXT    NOT NULL,
    status      TEXT    NOT NULL CHECK(status IN ('completed','skipped','missed'))
);

-- ---------------------------------------------------------------------------
-- Sensors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensors (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id        INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    location_id           INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    plant_id              INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    name                  TEXT    NOT NULL,
    type                  TEXT    NOT NULL
                                  CHECK(type IN ('moisture','light','temperature','humidity','ph','ec','co2','air_quality','custom')),
    connection_type       TEXT    NOT NULL
                                  CHECK(connection_type IN ('serial','usb','mqtt','http','manual')),
    connection_config_json TEXT,
    poll_interval_seconds  INTEGER,
    is_active             INTEGER NOT NULL DEFAULT 1,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id   INTEGER NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
    value       REAL    NOT NULL,
    unit        TEXT,
    recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sensor_limits (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id     INTEGER NOT NULL UNIQUE REFERENCES sensors(id) ON DELETE CASCADE,
    min_value     REAL,
    max_value     REAL,
    unit          TEXT,
    alert_enabled INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------------
-- Weather cache
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_cache (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    forecast_json  TEXT    NOT NULL,
    fetched_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    valid_until    TEXT
);

-- ---------------------------------------------------------------------------
-- Harvests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS harvests (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id       INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    harvest_date   TEXT    NOT NULL,
    quantity       REAL,
    unit           TEXT,
    quality_rating INTEGER,
    notes          TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Seed lots (genealogy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seed_lots (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_plant_id  INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    harvest_id       INTEGER REFERENCES harvests(id) ON DELETE SET NULL,
    lot_label        TEXT,
    quantity         REAL,
    viability_pct    REAL,
    storage_location TEXT,
    collected_date   TEXT,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Garden canvas objects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS canvas_objects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id     INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    object_type     TEXT    NOT NULL,
    properties_json TEXT,
    layer           INTEGER,
    z_index         INTEGER,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Indoor gardening extensions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indoor_environments (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id               INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    grow_method               TEXT
                                      CHECK(grow_method IN
                                            ('soil','hydroponic_dwc','hydroponic_nft',
                                             'hydroponic_ebb_flow','hydroponic_drip',
                                             'aeroponic','aquaponic')),
    light_type                TEXT,
    light_wattage             REAL,
    light_schedule_on         TEXT,
    light_schedule_off        TEXT,
    ventilation_type          TEXT,
    ventilation_cfm           REAL,
    tent_width                REAL,
    tent_depth                REAL,
    tent_height               REAL,
    reservoir_capacity_liters REAL,
    notes                     TEXT,
    created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS indoor_readings (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    indoor_environment_id INTEGER NOT NULL REFERENCES indoor_environments(id) ON DELETE CASCADE,
    water_temp            REAL,
    water_ph              REAL,
    water_ec              REAL,
    water_ppm             REAL,
    air_temp              REAL,
    air_humidity          REAL,
    co2_ppm               REAL,
    vpd                   REAL,
    recorded_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Plant groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plant_groups (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id       INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name                 TEXT    NOT NULL,
    description          TEXT,
    group_type           TEXT,
    filter_criteria_json TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plant_group_members (
    group_id INTEGER NOT NULL REFERENCES plant_groups(id) ON DELETE CASCADE,
    plant_id INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, plant_id)
);

-- ---------------------------------------------------------------------------
-- Indexes for common query patterns
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_locations_environment   ON locations(environment_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent        ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_plants_species          ON plants(species_id);
CREATE INDEX IF NOT EXISTS idx_plants_location         ON plants(location_id);
CREATE INDEX IF NOT EXISTS idx_plants_environment      ON plants(environment_id);
CREATE INDEX IF NOT EXISTS idx_plants_status           ON plants(status);
CREATE INDEX IF NOT EXISTS idx_issues_environment      ON issues(environment_id);
CREATE INDEX IF NOT EXISTS idx_issues_plant            ON issues(plant_id);
CREATE INDEX IF NOT EXISTS idx_issues_status           ON issues(status);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor  ON sensor_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_time    ON sensor_readings(recorded_at);
CREATE INDEX IF NOT EXISTS idx_journal_environment     ON journal_entries(environment_id);
CREATE INDEX IF NOT EXISTS idx_journal_plant           ON journal_entries(plant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_environment   ON schedules(environment_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run      ON schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_harvests_plant          ON harvests(plant_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity    ON custom_fields(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_media_entity            ON media(entity_type, entity_id);
