-- Trefle API enrichment columns.
-- trefle_id          : Trefle plant ID (integer) for the matched plant.
-- cached_trefle_json : full raw JSON from the Trefle plant detail endpoint.
ALTER TABLE species ADD COLUMN trefle_id             INTEGER;
ALTER TABLE species ADD COLUMN cached_trefle_json    TEXT;
