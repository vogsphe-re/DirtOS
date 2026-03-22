-- Add asset_id column to plants for human-readable identifiers.
-- Format: {year}-{category-slug}-{6-hex-chars}  e.g. 2026-herb-a3f5b2
-- NULL for plants that existed before this migration; populated on creation
-- going forward.
ALTER TABLE plants ADD COLUMN asset_id TEXT;
