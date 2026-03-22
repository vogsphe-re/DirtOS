-- Extend seed_lots to serve as a general seed store / inventory
-- Supports both harvested seeds (via parent_plant_id / harvest_id)
-- and purchased / traded / gifted seeds.

ALTER TABLE seed_lots ADD COLUMN species_id       INTEGER REFERENCES species(id) ON DELETE SET NULL;
ALTER TABLE seed_lots ADD COLUMN source_type      TEXT    NOT NULL DEFAULT 'harvested';
ALTER TABLE seed_lots ADD COLUMN vendor           TEXT;
ALTER TABLE seed_lots ADD COLUMN purchase_date    TEXT;
ALTER TABLE seed_lots ADD COLUMN expiration_date  TEXT;
ALTER TABLE seed_lots ADD COLUMN packet_info      TEXT;
ALTER TABLE seed_lots ADD COLUMN updated_at       TEXT    NOT NULL DEFAULT (datetime('now'));

-- Back-fill species_id from parent_plant_id where possible
UPDATE seed_lots
   SET species_id = (SELECT species_id FROM plants WHERE plants.id = seed_lots.parent_plant_id)
 WHERE parent_plant_id IS NOT NULL
   AND species_id IS NULL;
