-- Extended species attributes populated by EoL enrichment.
-- eol_description : EoL-specific overview text, shown in the Growing Info tab.
-- habitat         : habitat type(s) from TraitBank (e.g. "terrestrial", "forest").
-- min_temperature_c / max_temperature_c : optimal growth temperature range in °C.
-- rooting_depth   : rooting depth category / measurement from TraitBank.
-- uses            : comma-separated list of documented uses (food, medicine, etc.).
-- tags            : JSON array of taxonomy category tags from the EoL hierarchy.
ALTER TABLE species ADD COLUMN eol_description    TEXT;
ALTER TABLE species ADD COLUMN habitat            TEXT;
ALTER TABLE species ADD COLUMN min_temperature_c  REAL;
ALTER TABLE species ADD COLUMN max_temperature_c  REAL;
ALTER TABLE species ADD COLUMN rooting_depth      TEXT;
ALTER TABLE species ADD COLUMN uses               TEXT;
ALTER TABLE species ADD COLUMN tags               TEXT;
