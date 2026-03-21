-- Encyclopedia of Life (EoL) enrichment columns for the species table.
ALTER TABLE species ADD COLUMN eol_page_id       INTEGER;
ALTER TABLE species ADD COLUMN cached_eol_json   TEXT;
