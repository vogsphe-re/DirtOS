use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::FromRow;

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum LocationType {
    Plot,
    Space,
    Tent,
    Tray,
    Pot,
    Shed,
    OutdoorSite,
    IndoorSite,
    PlotGroup,
    SeedlingArea,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "lowercase")]
pub enum PlantStatus {
    Planned,
    Seedling,
    Active,
    Harvested,
    Removed,
    Dead,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum CustomFieldEntityType {
    Species,
    Plant,
    Location,
    SoilTest,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum CustomFieldType {
    Text,
    Number,
    Date,
    Boolean,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum AdditiveType {
    Fertilizer,
    Amendment,
    Pesticide,
    Fungicide,
    Other,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IssueStatus {
    New,
    Open,
    InProgress,
    Closed,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "lowercase")]
pub enum IssuePriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ScheduleType {
    Water,
    Feed,
    Maintenance,
    Treatment,
    Sample,
    Custom,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ScheduleRunStatus {
    Completed,
    Skipped,
    Missed,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SensorType {
    Moisture,
    Light,
    Temperature,
    Humidity,
    Ph,
    Ec,
    #[serde(rename = "co2")]
    #[sqlx(rename = "co2")]
    Co2,
    AirQuality,
    Custom,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SensorConnectionType {
    Serial,
    Usb,
    Mqtt,
    Http,
    Manual,
    HomeAssistant,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IntegrationProvider {
    Inaturalist,
    Wikipedia,
    Eol,
    Osm,
    HomeAssistant,
    #[serde(rename = "n8n")]
    #[sqlx(rename = "n8n")]
    N8n,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum MapPrivacyLevel {
    Private,
    Obfuscated,
    Shared,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum BackupFormat {
    Json,
    Yaml,
    Archive,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum GrowMethod {
    Soil,
    HydroponicDwc,
    HydroponicNft,
    HydroponicEbbFlow,
    HydroponicDrip,
    Aeroponic,
    Aquaponic,
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Environment {
    pub id: i64,
    pub name: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_m: Option<f64>,
    pub timezone: Option<String>,
    pub climate_zone: Option<String>,
    pub asset_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewEnvironment {
    pub name: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_m: Option<f64>,
    pub timezone: Option<String>,
    pub climate_zone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateEnvironment {
    pub name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub elevation_m: Option<f64>,
    pub timezone: Option<String>,
    pub climate_zone: Option<String>,
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Location {
    pub id: i64,
    pub environment_id: i64,
    pub parent_id: Option<i64>,
    #[sqlx(rename = "type")]
    pub location_type: LocationType,
    pub name: String,
    pub label: Option<String>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub canvas_data_json: Option<String>,
    pub notes: Option<String>,
    pub asset_id: Option<String>,
    pub grid_rows: Option<i64>,
    pub grid_cols: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewLocation {
    pub environment_id: i64,
    pub parent_id: Option<i64>,
    pub location_type: LocationType,
    pub name: String,
    pub label: Option<String>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub canvas_data_json: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub grid_rows: Option<i64>,
    #[serde(default)]
    pub grid_cols: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateLocation {
    pub parent_id: Option<i64>,
    pub location_type: Option<LocationType>,
    pub name: Option<String>,
    pub label: Option<String>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub canvas_data_json: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub grid_rows: Option<i64>,
    #[serde(default)]
    pub grid_cols: Option<i64>,
}

// ---------------------------------------------------------------------------
// Species
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Species {
    pub id: i64,
    pub common_name: String,
    pub scientific_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub inaturalist_id: Option<i64>,
    pub wikipedia_slug: Option<String>,
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub soil_ph_min: Option<f64>,
    pub soil_ph_max: Option<f64>,
    pub spacing_cm: Option<f64>,
    pub days_to_germination_min: Option<i64>,
    pub days_to_germination_max: Option<i64>,
    pub days_to_harvest_min: Option<i64>,
    pub days_to_harvest_max: Option<i64>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub eol_page_id: Option<i64>,
    pub eol_description: Option<String>,
    pub gbif_key: Option<i64>,
    pub gbif_accepted_name: Option<String>,
    pub native_range: Option<String>,
    pub establishment_means: Option<String>,
    pub habitat: Option<String>,
    pub min_temperature_c: Option<f64>,
    pub max_temperature_c: Option<f64>,
    pub rooting_depth: Option<String>,
    pub uses: Option<String>,
    pub tags: Option<String>,
    pub trefle_id: Option<i64>,
    pub cached_inaturalist_json: Option<String>,
    pub cached_wikipedia_json: Option<String>,
    pub cached_eol_json: Option<String>,
    pub cached_gbif_json: Option<String>,
    pub cached_trefle_json: Option<String>,
    pub is_user_added: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSpecies {
    pub common_name: String,
    pub scientific_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub soil_ph_min: Option<f64>,
    pub soil_ph_max: Option<f64>,
    pub spacing_cm: Option<f64>,
    pub days_to_germination_min: Option<i64>,
    pub days_to_germination_max: Option<i64>,
    pub days_to_harvest_min: Option<i64>,
    pub days_to_harvest_max: Option<i64>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub is_user_added: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateSpecies {
    pub common_name: Option<String>,
    pub scientific_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub soil_ph_min: Option<f64>,
    pub soil_ph_max: Option<f64>,
    pub spacing_cm: Option<f64>,
    pub days_to_germination_min: Option<i64>,
    pub days_to_germination_max: Option<i64>,
    pub days_to_harvest_min: Option<i64>,
    pub days_to_harvest_max: Option<i64>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
    pub description: Option<String>,
    pub image_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Plant
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Plant {
    pub id: i64,
    pub species_id: Option<i64>,
    pub location_id: Option<i64>,
    pub environment_id: i64,
    pub status: PlantStatus,
    pub name: String,
    pub label: Option<String>,
    pub asset_id: Option<String>,
    pub planted_date: Option<String>,
    pub germinated_date: Option<String>,
    pub transplanted_date: Option<String>,
    pub removed_date: Option<String>,
    pub parent_plant_id: Option<i64>,
    pub seed_lot_id: Option<i64>,
    pub purchase_source: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<f64>,
    pub is_harvestable: bool,
    pub lifecycle_override: Option<String>,
    pub notes: Option<String>,
    pub canvas_object_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewPlant {
    pub species_id: Option<i64>,
    pub location_id: Option<i64>,
    pub environment_id: i64,
    pub status: Option<PlantStatus>,
    pub name: String,
    pub label: Option<String>,
    pub planted_date: Option<String>,
    #[serde(default)]
    pub is_harvestable: Option<bool>,
    #[serde(default)]
    pub lifecycle_override: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub canvas_object_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdatePlant {
    pub species_id: Option<i64>,
    pub location_id: Option<i64>,
    pub status: Option<PlantStatus>,
    pub name: Option<String>,
    pub label: Option<String>,
    pub planted_date: Option<String>,
    pub germinated_date: Option<String>,
    pub transplanted_date: Option<String>,
    pub removed_date: Option<String>,
    pub parent_plant_id: Option<i64>,
    pub seed_lot_id: Option<i64>,
    pub purchase_source: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<f64>,
    #[serde(default)]
    pub is_harvestable: Option<bool>,
    #[serde(default)]
    pub lifecycle_override: Option<String>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Custom fields (EAV)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct CustomField {
    pub id: i64,
    pub entity_type: CustomFieldEntityType,
    pub entity_id: i64,
    pub field_name: String,
    pub field_value: Option<String>,
    pub field_type: CustomFieldType,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewCustomField {
    pub entity_type: CustomFieldEntityType,
    pub entity_id: i64,
    pub field_name: String,
    pub field_value: Option<String>,
    pub field_type: CustomFieldType,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateCustomField {
    pub field_name: Option<String>,
    pub field_value: Option<String>,
    pub field_type: Option<CustomFieldType>,
}

// ---------------------------------------------------------------------------
// Species filters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SpeciesFilters {
    pub query: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub growth_type: Option<String>,
}

// ---------------------------------------------------------------------------
// Enrichment preview
// ---------------------------------------------------------------------------

/// A single field proposed by an enrichment source.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EnrichmentFieldPreview {
    /// DB column / display key, e.g. "family"
    pub field: String,
    /// Human-readable label, e.g. "Family"
    pub label: String,
    /// Current value already stored on the species (stringified).
    pub current_value: Option<String>,
    /// Value the enrichment source would set.
    pub new_value: Option<String>,
}

/// Full preview returned by a `preview_enrich_*` command.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EnrichmentPreviewResult {
    pub source: String,
    pub fields: Vec<EnrichmentFieldPreview>,
    /// Raw JSON from the external API, to be saved in the cached_*_json column
    /// if the user confirms enrichment.
    pub cached_json: Option<String>,
    /// Source-specific identifier (iNat taxon id, EoL page id, GBIF key, etc.)
    pub source_id: Option<String>,
}

/// Selective enrichment: user picks which fields to apply.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ApplyEnrichmentFields {
    pub source: String,
    /// Field names the user approved (keys from EnrichmentFieldPreview.field).
    pub approved_fields: Vec<String>,
    /// The cached JSON blob to store.
    pub cached_json: Option<String>,
    /// Source-specific identifier.
    pub source_id: Option<String>,

    // All possible field values – only applied if the field name is in approved_fields.
    pub scientific_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub eol_description: Option<String>,
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub soil_ph_min: Option<f64>,
    pub soil_ph_max: Option<f64>,
    pub spacing_cm: Option<f64>,
    pub days_to_harvest_min: Option<i64>,
    pub days_to_harvest_max: Option<i64>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
    pub habitat: Option<String>,
    pub native_range: Option<String>,
    pub establishment_means: Option<String>,
    pub min_temperature_c: Option<f64>,
    pub max_temperature_c: Option<f64>,
    pub rooting_depth: Option<String>,
    pub uses: Option<String>,
    pub tags: Option<String>,
    pub gbif_accepted_name: Option<String>,
}

// ---------------------------------------------------------------------------
// Soil
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SoilType {
    pub id: i64,
    pub name: String,
    pub composition: Option<String>,
    pub ph_default: Option<f64>,
    pub drainage_rating: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SoilTest {
    pub id: i64,
    pub location_id: i64,
    pub test_date: String,
    pub ph: Option<f64>,
    pub nitrogen_ppm: Option<f64>,
    pub phosphorus_ppm: Option<f64>,
    pub potassium_ppm: Option<f64>,
    pub moisture_pct: Option<f64>,
    pub organic_matter_pct: Option<f64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSoilTest {
    pub location_id: i64,
    pub test_date: String,
    pub ph: Option<f64>,
    pub nitrogen_ppm: Option<f64>,
    pub phosphorus_ppm: Option<f64>,
    pub potassium_ppm: Option<f64>,
    pub moisture_pct: Option<f64>,
    pub organic_matter_pct: Option<f64>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Additives
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Additive {
    pub id: i64,
    pub name: String,
    #[sqlx(rename = "type")]
    pub additive_type: AdditiveType,
    pub npk_n: Option<f64>,
    pub npk_p: Option<f64>,
    pub npk_k: Option<f64>,
    pub application_rate: Option<f64>,
    pub application_unit: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewAdditive {
    pub name: String,
    pub additive_type: AdditiveType,
    pub npk_n: Option<f64>,
    pub npk_p: Option<f64>,
    pub npk_k: Option<f64>,
    pub application_rate: Option<f64>,
    pub application_unit: Option<String>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Issue {
    pub id: i64,
    pub environment_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub status: IssueStatus,
    pub priority: IssuePriority,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub closed_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewIssue {
    pub environment_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<IssueStatus>,
    pub priority: Option<IssuePriority>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateIssue {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<IssueStatus>,
    pub priority: Option<IssuePriority>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IssueLabel {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IssueComment {
    pub id: i64,
    pub issue_id: i64,
    pub body: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewIssueLabel {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateIssueLabel {
    pub name: Option<String>,
    pub color: Option<String>,
    pub icon: Option<String>,
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct JournalEntry {
    pub id: i64,
    pub environment_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    pub title: String,
    pub body: Option<String>,
    pub conditions_json: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewJournalEntry {
    pub environment_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    pub title: String,
    pub body: Option<String>,
    pub conditions_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateJournalEntry {
    pub title: Option<String>,
    pub body: Option<String>,
    pub conditions_json: Option<String>,
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Media {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub mime_type: Option<String>,
    pub thumbnail_path: Option<String>,
    pub caption: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewMedia {
    pub entity_type: String,
    pub entity_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub mime_type: Option<String>,
    pub thumbnail_path: Option<String>,
    pub caption: Option<String>,
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Schedule {
    pub id: i64,
    pub environment_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    #[sqlx(rename = "type")]
    pub schedule_type: ScheduleType,
    pub title: String,
    pub cron_expression: Option<String>,
    pub next_run_at: Option<NaiveDateTime>,
    pub is_active: bool,
    pub additive_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSchedule {
    pub environment_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    pub schedule_type: ScheduleType,
    pub title: String,
    pub cron_expression: Option<String>,
    pub next_run_at: Option<NaiveDateTime>,
    pub is_active: Option<bool>,
    pub additive_id: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateSchedule {
    pub schedule_type: Option<ScheduleType>,
    pub title: Option<String>,
    pub cron_expression: Option<String>,
    pub is_active: Option<bool>,
    pub plant_id: Option<i64>,
    pub location_id: Option<i64>,
    pub additive_id: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct ScheduleRun {
    pub id: i64,
    pub schedule_id: i64,
    pub issue_id: Option<i64>,
    pub ran_at: NaiveDateTime,
    pub status: ScheduleRunStatus,
}

// ---------------------------------------------------------------------------
// Calendar Events
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum CalendarEventType {
    Schedule,
    PlantingDate,
    HarvestDate,
    IssueCreated,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CalendarEvent {
    pub id: String,
    pub event_type: CalendarEventType,
    pub date: String,
    pub title: String,
    pub color: Option<String>,
    pub plant_id: Option<i64>,
    pub schedule_id: Option<i64>,
    pub issue_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ScheduleSuggestion {
    pub schedule_type: ScheduleType,
    pub title: String,
    pub cron_expression: String,
    pub cron_label: String,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Sensors
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Sensor {
    pub id: i64,
    pub environment_id: Option<i64>,
    pub location_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub name: String,
    #[sqlx(rename = "type")]
    pub sensor_type: SensorType,
    pub connection_type: SensorConnectionType,
    pub connection_config_json: Option<String>,
    pub poll_interval_seconds: Option<i64>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSensor {
    pub environment_id: Option<i64>,
    pub location_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub name: String,
    pub sensor_type: SensorType,
    pub connection_type: SensorConnectionType,
    pub connection_config_json: Option<String>,
    pub poll_interval_seconds: Option<i64>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateSensor {
    pub name: Option<String>,
    pub sensor_type: Option<SensorType>,
    pub connection_type: Option<SensorConnectionType>,
    pub connection_config_json: Option<String>,
    pub poll_interval_seconds: Option<i64>,
    pub location_id: Option<i64>,
    pub plant_id: Option<i64>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SensorReading {
    pub id: i64,
    pub sensor_id: i64,
    pub value: f64,
    pub unit: Option<String>,
    pub recorded_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SensorLimit {
    pub id: i64,
    pub sensor_id: i64,
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
    pub unit: Option<String>,
    pub alert_enabled: bool,
}

// ---------------------------------------------------------------------------
// Integrations & extensions (Phase 10a)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IntegrationConfig {
    pub id: i64,
    pub provider: IntegrationProvider,
    pub enabled: bool,
    pub auth_json: Option<String>,
    pub settings_json: Option<String>,
    pub sync_interval_minutes: Option<i64>,
    pub cache_ttl_minutes: Option<i64>,
    pub rate_limit_per_minute: Option<i64>,
    pub last_synced_at: Option<NaiveDateTime>,
    pub last_error: Option<String>,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpsertIntegrationConfig {
    pub enabled: bool,
    pub auth_json: Option<String>,
    pub settings_json: Option<String>,
    pub sync_interval_minutes: Option<i64>,
    pub cache_ttl_minutes: Option<i64>,
    pub rate_limit_per_minute: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SpeciesExternalSource {
    pub id: i64,
    pub species_id: i64,
    pub provider: IntegrationProvider,
    pub external_id: Option<String>,
    pub source_url: Option<String>,
    pub attribution: Option<String>,
    pub revision_id: Option<String>,
    pub native_range_json: Option<String>,
    pub metadata_json: Option<String>,
    pub retrieved_at: NaiveDateTime,
    pub last_synced_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IntegrationSyncRun {
    pub id: i64,
    pub provider: String,
    pub operation: String,
    pub status: String,
    pub records_fetched: Option<i64>,
    pub records_upserted: Option<i64>,
    pub error_message: Option<String>,
    pub started_at: NaiveDateTime,
    pub finished_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct EnvironmentMapSetting {
    pub id: i64,
    pub environment_id: i64,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub zoom_level: Option<i64>,
    pub geocode_json: Option<String>,
    pub weather_overlay: bool,
    pub soil_overlay: bool,
    pub boundaries_geojson: Option<String>,
    pub privacy_level: MapPrivacyLevel,
    pub allow_sharing: bool,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpsertEnvironmentMapSetting {
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub zoom_level: Option<i64>,
    pub geocode_json: Option<String>,
    pub weather_overlay: bool,
    pub soil_overlay: bool,
    pub boundaries_geojson: Option<String>,
    pub privacy_level: MapPrivacyLevel,
    pub allow_sharing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IntegrationWebhookToken {
    pub id: i64,
    pub provider: String,
    pub name: String,
    pub token: String,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct AutomationEvent {
    pub id: i64,
    pub provider: String,
    pub event_type: String,
    pub direction: String,
    pub payload_json: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: NaiveDateTime,
    pub processed_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct BackupJob {
    pub id: i64,
    pub name: String,
    pub schedule_cron: Option<String>,
    pub format: BackupFormat,
    pub include_secrets: bool,
    pub is_active: bool,
    pub last_run_status: Option<String>,
    pub last_run_at: Option<NaiveDateTime>,
    pub last_error: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewBackupJob {
    pub name: String,
    pub schedule_cron: Option<String>,
    pub format: BackupFormat,
    pub include_secrets: bool,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateBackupJob {
    pub name: Option<String>,
    pub schedule_cron: Option<String>,
    pub format: Option<BackupFormat>,
    pub include_secrets: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct BackupRun {
    pub id: i64,
    pub backup_job_id: Option<i64>,
    pub status: String,
    pub format: BackupFormat,
    pub output_ref: Option<String>,
    pub bytes_written: Option<i64>,
    pub error_message: Option<String>,
    pub started_at: NaiveDateTime,
    pub finished_at: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct BackupExportData {
    pub version: String,
    pub exported_at: String,
    pub app_settings: Vec<(String, Option<String>)>,
    pub integration_configs: Vec<IntegrationConfig>,
    pub map_settings: Vec<EnvironmentMapSetting>,
    pub backup_jobs: Vec<BackupJob>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ExportPayload {
    pub format: BackupFormat,
    pub filename: String,
    pub content: String,
    pub is_base64: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ImportPayload {
    pub format: BackupFormat,
    pub content: String,
    pub is_base64: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SyncSpeciesResult {
    pub species: Option<Species>,
    pub synced_providers: Vec<String>,
    pub skipped_providers: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct OSMPlaceResult {
    pub display_name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub osm_type: Option<String>,
    pub osm_id: Option<i64>,
}

// ---------------------------------------------------------------------------
// Weather cache
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct WeatherCache {
    pub id: i64,
    pub environment_id: i64,
    pub forecast_json: String,
    pub fetched_at: NaiveDateTime,
    pub valid_until: Option<NaiveDateTime>,
}

// ---------------------------------------------------------------------------
// Weather data (from Open-Meteo; cached as JSON)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CurrentWeather {
    pub temperature_c: f64,
    pub feels_like_c: f64,
    pub humidity: i64,
    pub pressure_hpa: f64,
    pub wind_speed_ms: f64,
    pub wind_direction_deg: f64,
    pub cloud_cover_pct: i64,
    pub description: String,
    pub icon: String,
    pub sunrise: Option<i64>,
    pub sunset: Option<i64>,
    pub dt: i64,
    // Extended fields (Open-Meteo)
    pub uv_index: Option<f64>,
    pub visibility_m: Option<f64>,
    pub dew_point_c: Option<f64>,
    pub wind_gust_ms: Option<f64>,
    pub is_day: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ForecastItem {
    pub dt: i64,
    pub temperature_c: f64,
    pub feels_like_c: f64,
    pub humidity: i64,
    pub wind_speed_ms: f64,
    pub cloud_cover_pct: i64,
    pub precipitation_mm: Option<f64>,
    pub precipitation_prob: Option<f64>,
    pub description: String,
    pub icon: String,
    pub wind_gust_ms: Option<f64>,
    pub wind_direction_deg: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DailyForecast {
    pub date: String,
    pub temp_min_c: f64,
    pub temp_max_c: f64,
    pub description: String,
    pub icon: String,
    pub precipitation_mm: Option<f64>,
    pub precipitation_prob: Option<f64>,
    // Extended fields
    pub uv_index_max: Option<f64>,
    pub wind_speed_max_ms: Option<f64>,
    pub wind_gusts_max_ms: Option<f64>,
    pub precipitation_sum_mm: Option<f64>,
    pub sunrise: Option<String>,
    pub sunset: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WeatherData {
    pub current: CurrentWeather,
    pub hourly: Vec<ForecastItem>,
    pub daily: Vec<DailyForecast>,
    pub from_cache: bool,
    pub fetched_at: String,
    pub location_name: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

/// Configurable thresholds for weather-based issue creation.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WeatherAlertSettings {
    /// Create issue when forecast high exceeds this (°C). 0 = disabled.
    pub heat_max_c: f64,
    /// Create issue when forecast low drops to or below this (°C).
    pub frost_min_c: f64,
    /// Create issue when max wind speed exceeds this (m/s). 0 = disabled.
    pub wind_max_ms: f64,
    /// Create issue when precipitation probability exceeds this (0–1). 0 = disabled.
    pub precip_prob_threshold: f64,
    pub alerts_enabled: bool,
}

// ---------------------------------------------------------------------------
// Harvests
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Harvest {
    pub id: i64,
    pub plant_id: i64,
    pub harvest_date: String,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub quality_rating: Option<i64>,
    pub notes: Option<String>,
    pub asset_id: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewHarvest {
    pub plant_id: i64,
    pub harvest_date: String,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub quality_rating: Option<i64>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Seed lots / seed store
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SeedLot {
    pub id: i64,
    pub parent_plant_id: Option<i64>,
    pub harvest_id: Option<i64>,
    pub species_id: Option<i64>,
    pub lot_label: Option<String>,
    pub quantity: Option<f64>,
    pub viability_pct: Option<f64>,
    pub storage_location: Option<String>,
    pub collected_date: Option<String>,
    pub source_type: String,
    pub asset_id: Option<String>,
    pub vendor: Option<String>,
    pub purchase_date: Option<String>,
    pub expiration_date: Option<String>,
    pub packet_info: Option<String>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSeedLot {
    pub species_id: Option<i64>,
    pub parent_plant_id: Option<i64>,
    pub harvest_id: Option<i64>,
    pub lot_label: Option<String>,
    pub quantity: Option<f64>,
    pub viability_pct: Option<f64>,
    pub storage_location: Option<String>,
    pub collected_date: Option<String>,
    pub source_type: Option<String>,
    pub vendor: Option<String>,
    pub purchase_date: Option<String>,
    pub expiration_date: Option<String>,
    pub packet_info: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateSeedLot {
    pub species_id: Option<i64>,
    pub lot_label: Option<String>,
    pub quantity: Option<f64>,
    pub viability_pct: Option<f64>,
    pub storage_location: Option<String>,
    pub collected_date: Option<String>,
    pub source_type: Option<String>,
    pub vendor: Option<String>,
    pub purchase_date: Option<String>,
    pub expiration_date: Option<String>,
    pub packet_info: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SowSeedInput {
    pub seed_lot_id: i64,
    pub tray_id: i64,
    pub row: i64,
    pub col: i64,
    pub plant_name: Option<String>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Canvas state (full Konva JSON per environment)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct CanvasState {
    pub environment_id: i64,
    pub canvas_json: String,
    pub updated_at: NaiveDateTime,
}

// ---------------------------------------------------------------------------
// Canvas objects
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct CanvasObject {
    pub id: i64,
    pub location_id: i64,
    pub object_type: String,
    pub properties_json: Option<String>,
    pub layer: Option<i64>,
    pub z_index: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ---------------------------------------------------------------------------
// Indoor environments
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IndoorEnvironment {
    pub id: i64,
    pub location_id: i64,
    pub grow_method: Option<GrowMethod>,
    pub light_type: Option<String>,
    pub light_wattage: Option<f64>,
    pub light_schedule_on: Option<String>,
    pub light_schedule_off: Option<String>,
    pub ventilation_type: Option<String>,
    pub ventilation_cfm: Option<f64>,
    pub tent_width: Option<f64>,
    pub tent_depth: Option<f64>,
    pub tent_height: Option<f64>,
    pub reservoir_capacity_liters: Option<f64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewIndoorEnvironment {
    pub location_id: i64,
    pub grow_method: Option<GrowMethod>,
    pub light_type: Option<String>,
    pub light_wattage: Option<f64>,
    pub light_schedule_on: Option<String>,
    pub light_schedule_off: Option<String>,
    pub ventilation_type: Option<String>,
    pub ventilation_cfm: Option<f64>,
    pub tent_width: Option<f64>,
    pub tent_depth: Option<f64>,
    pub tent_height: Option<f64>,
    pub reservoir_capacity_liters: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateIndoorEnvironment {
    pub grow_method: Option<GrowMethod>,
    pub light_type: Option<String>,
    pub light_wattage: Option<f64>,
    pub light_schedule_on: Option<String>,
    pub light_schedule_off: Option<String>,
    pub ventilation_type: Option<String>,
    pub ventilation_cfm: Option<f64>,
    pub tent_width: Option<f64>,
    pub tent_depth: Option<f64>,
    pub tent_height: Option<f64>,
    pub reservoir_capacity_liters: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IndoorReading {
    pub id: i64,
    pub indoor_environment_id: i64,
    pub water_temp: Option<f64>,
    pub water_ph: Option<f64>,
    pub water_ec: Option<f64>,
    pub water_ppm: Option<f64>,
    pub air_temp: Option<f64>,
    pub air_humidity: Option<f64>,
    pub co2_ppm: Option<f64>,
    pub vpd: Option<f64>,
    pub recorded_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewIndoorReading {
    pub indoor_environment_id: i64,
    pub water_temp: Option<f64>,
    pub water_ph: Option<f64>,
    pub water_ec: Option<f64>,
    pub water_ppm: Option<f64>,
    pub air_temp: Option<f64>,
    pub air_humidity: Option<f64>,
    pub co2_ppm: Option<f64>,
    pub vpd: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IndoorNutrientLog {
    pub id: i64,
    pub indoor_environment_id: i64,
    pub additive_id: Option<i64>,
    pub amount: f64,
    pub unit: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IndoorWaterChange {
    pub id: i64,
    pub indoor_environment_id: i64,
    pub volume_liters: Option<f64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct IndoorReservoirTarget {
    pub id: i64,
    pub indoor_environment_id: i64,
    pub ph_min: Option<f64>,
    pub ph_max: Option<f64>,
    pub ec_min: Option<f64>,
    pub ec_max: Option<f64>,
    pub ppm_min: Option<f64>,
    pub ppm_max: Option<f64>,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpsertIndoorReservoirTarget {
    pub ph_min: Option<f64>,
    pub ph_max: Option<f64>,
    pub ec_min: Option<f64>,
    pub ec_max: Option<f64>,
    pub ppm_min: Option<f64>,
    pub ppm_max: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct IndoorEnvironmentSetupInput {
    pub environment_id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub label: Option<String>,
    pub notes: Option<String>,
    pub tent_width: Option<f64>,
    pub tent_depth: Option<f64>,
    pub tent_height: Option<f64>,
    pub grow_method: Option<GrowMethod>,
    pub light_type: Option<String>,
    pub light_wattage: Option<f64>,
    pub light_schedule_on: Option<String>,
    pub light_schedule_off: Option<String>,
    pub ventilation_type: Option<String>,
    pub ventilation_cfm: Option<f64>,
    pub reservoir_capacity_liters: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct IndoorEnvironmentSummary {
    pub indoor_environment: IndoorEnvironment,
    pub location: Location,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ReservoirStatus {
    pub indoor_environment_id: i64,
    pub current_volume_liters: Option<f64>,
    pub last_water_change_at: Option<String>,
    pub days_since_water_change: Option<i64>,
    pub target: Option<IndoorReservoirTarget>,
    pub current_ph: Option<f64>,
    pub current_ec: Option<f64>,
    pub current_ppm: Option<f64>,
    pub nutrient_total_since_change: f64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct IndoorDashboardSummary {
    pub indoor_environment: IndoorEnvironment,
    pub location: Location,
    pub latest_reading: Option<IndoorReading>,
    pub reservoir_status: ReservoirStatus,
    pub active_plant_count: i64,
    pub total_plant_count: i64,
    pub upcoming_schedules: Vec<Schedule>,
    pub recent_issues: Vec<Issue>,
    pub air_exchange_per_hour: Option<f64>,
    pub dli_estimate: Option<f64>,
}

// ---------------------------------------------------------------------------
// Plant groups
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct PlantGroup {
    pub id: i64,
    pub environment_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub group_type: Option<String>,
    pub filter_criteria_json: Option<String>,
    pub color: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewPlantGroup {
    pub environment_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub group_type: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdatePlantGroup {
    pub name: Option<String>,
    pub description: Option<String>,
    pub group_type: Option<String>,
    pub color: Option<String>,
}

// ---------------------------------------------------------------------------
// Seedling observations (Phase 5)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SeedlingObservation {
    pub id: i64,
    pub plant_id: i64,
    pub observed_at: String,
    pub height_cm: Option<f64>,
    pub stem_thickness_mm: Option<f64>,
    pub leaf_node_count: Option<i64>,
    pub leaf_node_spacing_mm: Option<f64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSeedlingObservation {
    pub plant_id: i64,
    pub observed_at: Option<String>,
    pub height_cm: Option<f64>,
    pub stem_thickness_mm: Option<f64>,
    pub leaf_node_count: Option<i64>,
    pub leaf_node_spacing_mm: Option<f64>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct Season {
    pub id: i64,
    pub environment_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSeason {
    pub environment_id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Harvest analytics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct HarvestSummary {
    pub plant_id: i64,
    pub total_quantity: f64,
    pub harvest_count: i64,
    pub avg_quality: Option<f64>,
    pub first_harvest: Option<String>,
    pub last_harvest: Option<String>,
}

/// A single data point used in aggregated report charts.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ReportDataPoint {
    pub label: String,   // x-axis label (species name, month, etc.)
    pub value: f64,      // primary value
    pub secondary: Option<f64>, // optional secondary series
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ReportData {
    pub report_type: String,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub points: Vec<ReportDataPoint>,
    pub unit: Option<String>,
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Recommendation {
    pub category: String,        // "yield", "watering", "placement", "soil"
    pub title: String,
    pub description: String,
    pub confidence: f64,         // 0.0 – 1.0
    pub action_suggestion: Option<String>,
    pub plant_id: Option<i64>,
    pub species_id: Option<i64>,
}

// ---------------------------------------------------------------------------
// Dashboard (Phase 14)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, sqlx::FromRow)]
pub struct Dashboard {
    pub id: i64,
    pub environment_id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub template_key: Option<String>,
    /// JSON-serialised Vec<WidgetConfig>
    pub layout_json: String,
    pub is_default: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewDashboard {
    pub environment_id: Option<i64>,
    pub name: String,
    pub description: Option<String>,
    pub template_key: Option<String>,
    pub layout_json: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateDashboard {
    pub name: Option<String>,
    pub description: Option<String>,
    pub layout_json: Option<String>,
    pub is_default: Option<bool>,
}

// ---------------------------------------------------------------------------
// Seedling trays
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SeedlingTray {
    pub id: i64,
    pub environment_id: i64,
    pub location_id: Option<i64>,
    pub name: String,
    pub rows: i64,
    pub cols: i64,
    pub cell_size_cm: Option<f64>,
    pub notes: Option<String>,
    pub asset_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct NewSeedlingTray {
    pub environment_id: i64,
    #[serde(default)]
    pub location_id: Option<i64>,
    pub name: String,
    pub rows: i64,
    pub cols: i64,
    pub cell_size_cm: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UpdateSeedlingTray {
    #[serde(default)]
    pub location_id: Option<i64>,
    pub name: Option<String>,
    pub rows: Option<i64>,
    pub cols: Option<i64>,
    pub cell_size_cm: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SeedlingTrayCell {
    pub id: i64,
    pub tray_id: i64,
    pub row: i64,
    pub col: i64,
    pub plant_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AssignTrayCell {
    pub tray_id: i64,
    pub row: i64,
    pub col: i64,
    pub plant_id: Option<i64>,
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Auto-enrichment result
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AutoEnrichResult {
    /// Number of species queued for background enrichment.
    pub queued: i64,
    /// Human-readable status message.
    pub message: String,
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Pagination {
    pub limit: i64,
    pub offset: i64,
}

impl Default for Pagination {
    fn default() -> Self {
        Self { limit: 50, offset: 0 }
    }
}

// ---------------------------------------------------------------------------
// Inventory / asset-tag lookup
// ---------------------------------------------------------------------------

/// The result returned when scanning or looking up an asset tag.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AssetTagLookup {
    /// The scanned / queried asset tag string.
    pub asset_tag: String,
    /// Entity category: "plant", "environment", "location", "harvest",
    ///                    "seed_lot", or "seedling_tray".
    pub entity_type: String,
    /// Primary-key ID of the matching record.
    pub entity_id: i64,
    /// Human-readable display name for the entity.
    pub display_name: String,
    /// Optional secondary description (e.g. environment name for a plant).
    pub description: Option<String>,
}

