-- ---------------------------------------------------------------------------
-- Sale codes for plants, harvests, and seed lots
--
-- Adds sale_ean (EAN/UPC) and sale_asin (Amazon ASIN) columns to the three
-- primary garden asset tables so users can assign their own product codes to
-- items they package and sell.
-- ---------------------------------------------------------------------------

ALTER TABLE plants      ADD COLUMN sale_ean  TEXT;
ALTER TABLE plants      ADD COLUMN sale_asin TEXT;

ALTER TABLE harvests    ADD COLUMN sale_ean  TEXT;
ALTER TABLE harvests    ADD COLUMN sale_asin TEXT;

ALTER TABLE seed_lots   ADD COLUMN sale_ean  TEXT;
ALTER TABLE seed_lots   ADD COLUMN sale_asin TEXT;
