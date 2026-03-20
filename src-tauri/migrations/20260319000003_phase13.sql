-- Phase 13: Harvest, Genealogy & Reporting
-- seasons table (define planting/growing seasons per environment)

CREATE TABLE IF NOT EXISTS seasons (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id  INTEGER NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,          -- e.g. "Spring 2026"
    start_date      TEXT    NOT NULL,          -- ISO date
    end_date        TEXT    NOT NULL,          -- ISO date
    notes           TEXT,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_seasons_environment ON seasons(environment_id);
