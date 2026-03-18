-- Phase 5: Plant ↔ Garden integration, seedling observations, plant groups.

-- ---------------------------------------------------------------------------
-- Seedling observations (track germination, height, leaf count, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seedling_observations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id         INTEGER NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
    observed_at      TEXT    NOT NULL DEFAULT (date('now')),
    height_cm        REAL,
    stem_thickness_mm REAL,
    leaf_node_count  INTEGER,
    leaf_node_spacing_mm REAL,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Plant groups: add color column (table + members already exist from Phase 1)
-- ---------------------------------------------------------------------------
ALTER TABLE plant_groups ADD COLUMN color TEXT;
