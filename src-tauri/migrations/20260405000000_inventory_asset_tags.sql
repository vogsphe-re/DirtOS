-- ---------------------------------------------------------------------------
-- Inventory asset tags
--
-- Adds an `asset_id` column to every entity class that participates in
-- inventory management.  Plants already have this column from the earlier
-- migration (20260323000002_plant_asset_id.sql).
--
-- Tag format:  PREFIX-YYRRRR
--   PREFIX  = 3-letter abbreviation (GDN, PLT, SPC, TNT, TRY, POT, SHD,
--              SED, LOT, …)
--   YY      = 2-digit year (e.g. 26 for 2026)
--   RRRR    = 4 random hex digits (assigned at creation time)
--
-- Harvest tags are *derived* from the parent plant's tag by swapping the
-- PLA- prefix for LOT-.  The hex suffix stays the same so harvest ↔ plant
-- association is obvious just from the tag string.
-- ---------------------------------------------------------------------------

ALTER TABLE environments    ADD COLUMN asset_id TEXT;
ALTER TABLE locations       ADD COLUMN asset_id TEXT;
ALTER TABLE seed_lots       ADD COLUMN asset_id TEXT;
ALTER TABLE seedling_trays  ADD COLUMN asset_id TEXT;
ALTER TABLE harvests        ADD COLUMN asset_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_environments_asset_id   ON environments(asset_id)    WHERE asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_asset_id      ON locations(asset_id)       WHERE asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_seed_lots_asset_id      ON seed_lots(asset_id)       WHERE asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_seedling_trays_asset_id ON seedling_trays(asset_id)  WHERE asset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_harvests_asset_id       ON harvests(asset_id)        WHERE asset_id IS NOT NULL;
