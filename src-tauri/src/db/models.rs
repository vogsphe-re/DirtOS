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
pub enum IssueStatus {
    New,
    Open,
    InProgress,
    Closed,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum IssuePriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
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
pub enum ScheduleRunStatus {
    Completed,
    Skipped,
    Missed,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum SensorType {
    Moisture,
    Light,
    Temperature,
    Humidity,
    Ph,
    Ec,
    Co2,
    AirQuality,
    Custom,
}

#[derive(Debug, Clone, PartialEq, sqlx::Type, Serialize, Deserialize, Type)]
#[sqlx(type_name = "TEXT", rename_all = "snake_case")]
pub enum SensorConnectionType {
    Serial,
    Usb,
    Mqtt,
    Http,
    Manual,
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
    pub cached_inaturalist_json: Option<String>,
    pub cached_wikipedia_json: Option<String>,
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
    pub planted_date: Option<String>,
    pub germinated_date: Option<String>,
    pub transplanted_date: Option<String>,
    pub removed_date: Option<String>,
    pub parent_plant_id: Option<i64>,
    pub seed_lot_id: Option<i64>,
    pub purchase_source: Option<String>,
    pub purchase_date: Option<String>,
    pub purchase_price: Option<f64>,
    pub notes: Option<String>,
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
    pub notes: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct ScheduleRun {
    pub id: i64,
    pub schedule_id: i64,
    pub issue_id: Option<i64>,
    pub ran_at: NaiveDateTime,
    pub status: ScheduleRunStatus,
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
// Seed lots
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct SeedLot {
    pub id: i64,
    pub parent_plant_id: Option<i64>,
    pub harvest_id: Option<i64>,
    pub lot_label: Option<String>,
    pub quantity: Option<f64>,
    pub viability_pct: Option<f64>,
    pub storage_location: Option<String>,
    pub collected_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
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

