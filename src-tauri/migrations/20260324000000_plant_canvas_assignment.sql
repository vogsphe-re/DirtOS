-- Link plants to canvas space objects so that garden design assignments are
-- persisted in the database rather than only in the canvas JSON blob.
ALTER TABLE plants ADD COLUMN canvas_object_id TEXT;

CREATE INDEX IF NOT EXISTS idx_plants_canvas_object_id ON plants(canvas_object_id);
