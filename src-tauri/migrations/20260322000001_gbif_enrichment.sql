-- Global Biodiversity Information Facility (GBIF) enrichment columns.
-- gbif_key           : GBIF backbone usage key (integer) for the matched taxon.
-- gbif_accepted_name : accepted scientific name string from the backbone.
-- native_range       : semicolon-separated list of countries / regions where native.
-- establishment_means: native, introduced, invasive, etc.
-- cached_gbif_json   : full raw JSON from the GBIF species detail endpoint.
ALTER TABLE species ADD COLUMN gbif_key              INTEGER;
ALTER TABLE species ADD COLUMN gbif_accepted_name    TEXT;
ALTER TABLE species ADD COLUMN native_range          TEXT;
ALTER TABLE species ADD COLUMN establishment_means   TEXT;
ALTER TABLE species ADD COLUMN cached_gbif_json      TEXT;
