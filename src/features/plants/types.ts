// Locally-defined types that mirror the auto-generated bindings.
// These are replaced/validated when bindings.ts is regenerated at build time.

export interface Species {
  id: number;
  common_name: string;
  scientific_name: string | null;
  family: string | null;
  genus: string | null;
  inaturalist_id: number | null;
  wikipedia_slug: string | null;
  eol_page_id: number | null;
  eol_description: string | null;
  growth_type: string | null;
  sun_requirement: string | null;
  water_requirement: string | null;
  soil_ph_min: number | null;
  soil_ph_max: number | null;
  spacing_cm: number | null;
  days_to_germination_min: number | null;
  days_to_germination_max: number | null;
  days_to_harvest_min: number | null;
  days_to_harvest_max: number | null;
  hardiness_zone_min: string | null;
  hardiness_zone_max: string | null;
  habitat: string | null;
  min_temperature_c: number | null;
  max_temperature_c: number | null;
  rooting_depth: string | null;
  uses: string | null;
  tags: string | null;
  description: string | null;
  image_url: string | null;
  cached_inaturalist_json: string | null;
  cached_wikipedia_json: string | null;
  is_user_added: boolean;
  created_at: string;
  updated_at: string;
}

export type PlantStatus =
  | "planned"
  | "seedling"
  | "active"
  | "harvested"
  | "removed"
  | "dead";

export interface Plant {
  id: number;
  species_id: number | null;
  location_id: number | null;
  environment_id: number;
  status: PlantStatus;
  name: string;
  label: string | null;
  planted_date: string | null;
  germinated_date: string | null;
  transplanted_date: string | null;
  removed_date: string | null;
  parent_plant_id: number | null;
  seed_lot_id: number | null;
  purchase_source: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CustomFieldEntityType = "species" | "plant" | "location" | "soil_test";
export type CustomFieldType = "text" | "number" | "date" | "boolean";

export interface CustomField {
  id: number;
  entity_type: CustomFieldEntityType;
  entity_id: number;
  field_name: string;
  field_value: string | null;
  field_type: CustomFieldType;
  created_at: string;
}

export interface TaxonResult {
  id: number;
  name: string;
  preferred_common_name: string | null;
  rank: string | null;
  default_photo_url: string | null;
  wikipedia_url: string | null;
  matched_term: string | null;
}

export const PLANT_STATUS_LABELS: Record<PlantStatus, string> = {
  planned: "Planned",
  seedling: "Seedling",
  active: "Active",
  harvested: "Harvested",
  removed: "Removed",
  dead: "Dead",
};

export const PLANT_STATUS_COLORS: Record<PlantStatus, string> = {
  planned: "gray",
  seedling: "lime",
  active: "green",
  harvested: "teal",
  removed: "orange",
  dead: "red",
};
