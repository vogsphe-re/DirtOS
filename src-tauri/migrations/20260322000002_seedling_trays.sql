-- Seedling tray grid management
-- Trays hold a user-defined grid of cells, each of which may reference a plant.

CREATE TABLE IF NOT EXISTS seedling_trays (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id  INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    rows            INTEGER NOT NULL DEFAULT 4,
    cols            INTEGER NOT NULL DEFAULT 6,
    cell_size_cm    REAL,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seedling_tray_cells (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    tray_id         INTEGER NOT NULL REFERENCES seedling_trays(id) ON DELETE CASCADE,
    row             INTEGER NOT NULL,
    col             INTEGER NOT NULL,
    plant_id        INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tray_id, row, col)
);

CREATE INDEX IF NOT EXISTS idx_seedling_trays_env ON seedling_trays(environment_id);
CREATE INDEX IF NOT EXISTS idx_seedling_tray_cells_tray ON seedling_tray_cells(tray_id);
CREATE INDEX IF NOT EXISTS idx_seedling_tray_cells_plant ON seedling_tray_cells(plant_id);
