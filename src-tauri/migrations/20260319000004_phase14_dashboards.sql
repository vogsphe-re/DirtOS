-- Phase 14: Dashboard system
CREATE TABLE IF NOT EXISTS dashboards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    environment_id  INTEGER REFERENCES environments(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    template_key    TEXT,
    layout_json     TEXT NOT NULL DEFAULT '[]',
    is_default      INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dashboards_environment ON dashboards(environment_id);
