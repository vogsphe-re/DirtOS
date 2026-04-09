-- ---------------------------------------------------------------------------
-- Explicit hierarchy restructuring
--
-- Adds explicit site/group location types, plot-group grid metadata,
-- seedling tray → location linkage, and plant lifecycle flags.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys=OFF;

-- ---------------------------------------------------------------------------
-- Recreate locations table with expanded type constraint and grid metadata.
-- ---------------------------------------------------------------------------
CREATE TABLE locations_new (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id   INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    parent_id        INTEGER REFERENCES locations_new(id) ON DELETE SET NULL,
    type             TEXT    NOT NULL CHECK(type IN (
                          'plot','space','tent','tray','pot','shed',
                          'outdoor_site','indoor_site','plot_group','seedling_area'
                      )),
    name             TEXT    NOT NULL,
    label            TEXT,
    position_x       REAL,
    position_y       REAL,
    width            REAL,
    height           REAL,
    canvas_data_json TEXT,
    notes            TEXT,
    asset_id         TEXT,
    grid_rows        INTEGER,
    grid_cols        INTEGER,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO locations_new (
    id, environment_id, parent_id, type, name, label,
    position_x, position_y, width, height, canvas_data_json,
    notes, asset_id, grid_rows, grid_cols, created_at, updated_at
)
SELECT
    id, environment_id, parent_id, type, name, label,
    position_x, position_y, width, height, canvas_data_json,
    notes, asset_id, NULL, NULL, created_at, updated_at
FROM locations;

DROP TABLE locations;
ALTER TABLE locations_new RENAME TO locations;

CREATE INDEX IF NOT EXISTS idx_locations_environment ON locations(environment_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_asset_id ON locations(asset_id) WHERE asset_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Seedling trays can now attach to an explicit seedling_area location.
-- ---------------------------------------------------------------------------
ALTER TABLE seedling_trays ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_seedling_trays_location_id ON seedling_trays(location_id);

-- ---------------------------------------------------------------------------
-- Plant lifecycle flags.
-- ---------------------------------------------------------------------------
ALTER TABLE plants ADD COLUMN is_harvestable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plants ADD COLUMN lifecycle_override TEXT CHECK(lifecycle_override IN ('annual','perennial','biennial'));
CREATE INDEX IF NOT EXISTS idx_plants_is_harvestable ON plants(is_harvestable);

-- ---------------------------------------------------------------------------
-- Backfill explicit outdoor/indoor site nodes for existing root-level data.
-- ---------------------------------------------------------------------------
INSERT INTO locations (
    environment_id, parent_id, type, name, label,
    position_x, position_y, width, height, canvas_data_json,
    notes, asset_id, grid_rows, grid_cols, created_at, updated_at
)
SELECT
    env.id,
    NULL,
    'outdoor_site',
    'Outdoor Site',
    'OUT',
    NULL, NULL, NULL, NULL, NULL,
    'Auto-created during hierarchy restructuring migration.',
    NULL,
    NULL,
    NULL,
    datetime('now'),
    datetime('now')
FROM environments env
WHERE EXISTS (
    SELECT 1
    FROM locations l
    WHERE l.environment_id = env.id
      AND l.parent_id IS NULL
      AND l.type IN ('plot', 'space', 'shed')
)
AND NOT EXISTS (
    SELECT 1
    FROM locations l
    WHERE l.environment_id = env.id
      AND l.parent_id IS NULL
      AND l.type = 'outdoor_site'
);

INSERT INTO locations (
    environment_id, parent_id, type, name, label,
    position_x, position_y, width, height, canvas_data_json,
    notes, asset_id, grid_rows, grid_cols, created_at, updated_at
)
SELECT
    env.id,
    NULL,
    'indoor_site',
    'Indoor Site',
    'IND',
    NULL, NULL, NULL, NULL, NULL,
    'Auto-created during hierarchy restructuring migration.',
    NULL,
    NULL,
    NULL,
    datetime('now'),
    datetime('now')
FROM environments env
WHERE EXISTS (
    SELECT 1
    FROM locations l
    WHERE l.environment_id = env.id
      AND l.parent_id IS NULL
      AND l.type IN ('tent', 'tray', 'pot')
)
AND NOT EXISTS (
    SELECT 1
    FROM locations l
    WHERE l.environment_id = env.id
      AND l.parent_id IS NULL
      AND l.type = 'indoor_site'
);

WITH outdoor_roots AS (
    SELECT environment_id, MIN(id) AS site_id
    FROM locations
    WHERE parent_id IS NULL
      AND type = 'outdoor_site'
    GROUP BY environment_id
)
UPDATE locations
SET parent_id = (
    SELECT site_id
    FROM outdoor_roots r
    WHERE r.environment_id = locations.environment_id
)
WHERE parent_id IS NULL
  AND type IN ('plot', 'space', 'shed')
  AND EXISTS (
      SELECT 1
      FROM outdoor_roots r
      WHERE r.environment_id = locations.environment_id
  );

WITH indoor_roots AS (
    SELECT environment_id, MIN(id) AS site_id
    FROM locations
    WHERE parent_id IS NULL
      AND type = 'indoor_site'
    GROUP BY environment_id
)
UPDATE locations
SET parent_id = (
    SELECT site_id
    FROM indoor_roots r
    WHERE r.environment_id = locations.environment_id
)
WHERE parent_id IS NULL
  AND type IN ('tent', 'tray', 'pot')
  AND EXISTS (
      SELECT 1
      FROM indoor_roots r
      WHERE r.environment_id = locations.environment_id
  );

PRAGMA foreign_keys=ON;
