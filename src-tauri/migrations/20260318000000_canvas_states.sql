-- Phase 4: canvas_states table for persisting full Konva stage JSON per environment.
CREATE TABLE IF NOT EXISTS canvas_states (
    environment_id INTEGER PRIMARY KEY REFERENCES environments(id) ON DELETE CASCADE,
    canvas_json    TEXT NOT NULL DEFAULT '{}',
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
