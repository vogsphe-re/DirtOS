use chrono::{Datelike, Duration, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use specta::Type;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::db::{
    environments, harvests, indoor, integrations, issues, journal, locations, plants, schedules,
    seed_store, seedling_observations, seedling_trays, sensors, weather,
};
use crate::db::models::*;
use crate::services::{export, plant_category};

const EXAMPLE_ENV_NAME: &str = "DirtOS Example Garden";
const EXAMPLE_FILE_NAME: &str = "DirtOS-Example-Garden.json";

#[derive(Debug, Clone)]
struct DemoSettings {
    latitude: f64,
    longitude: f64,
    elevation_m: f64,
    openweather_api_key: Option<String>,
    trefle_access_key: Option<String>,
}

#[derive(Debug, Clone)]
struct SpeciesInfo {
    id: i64,
    days_to_harvest: i64,
    growth_type: Option<String>,
}

#[derive(Debug, Clone, Copy)]
enum PlantContext {
    Outdoor,
    Indoor,
    Seedling,
    Perennial,
}

#[derive(Debug, Clone)]
struct PlantTemplate<'a> {
    aliases: &'a [&'a str],
    name: &'a str,
    status: PlantStatus,
    context: PlantContext,
    notes: &'a str,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ExampleGardenImportResult {
    pub output_path: String,
    pub message: String,
}

/// Seed a comprehensive demonstration garden with sample data across every
/// feature area. Idempotent: returns the existing environment's id if an
/// environment named `DirtOS Example Garden` already exists.
#[tauri::command]
#[specta::specta]
pub async fn seed_demo_garden(pool: State<'_, SqlitePool>) -> Result<i64, String> {
    inner_seed(&pool).await.map_err(|e| e.to_string())
}

/// Build a clean example garden backup and save it to:
/// `~/Documents/DirtOS/Examples/DirtOS-Example-Garden.json`.
#[tauri::command]
#[specta::specta]
pub async fn save_example_garden(app: AppHandle) -> Result<String, String> {
    let output_path = default_example_output_path(&app)?;
    let written = write_example_garden_to_path(&output_path).await?;
    Ok(written.to_string_lossy().into_owned())
}

#[tauri::command]
#[specta::specta]
pub async fn import_example_garden(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
) -> Result<ExampleGardenImportResult, String> {
    let output_path = default_example_output_path(&app)?;
    let content = build_example_garden_content().await?;
    let written = write_example_file(&output_path, &content)?;

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    export::import_garden_data_json(&pool, &app_data_dir, &content).await?;

    Ok(ExampleGardenImportResult {
        output_path: written.to_string_lossy().into_owned(),
        message: "Garden data imported successfully".to_string(),
    })
}

pub async fn write_example_garden_to_path(output_path: &Path) -> Result<PathBuf, String> {
    let content = build_example_garden_content().await?;
    write_example_file(output_path, &content)
}

pub fn default_documents_dir() -> Result<PathBuf, String> {
    let home_dir = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Unable to resolve HOME for Documents fallback".to_string())?;

    Ok(home_dir.join("Documents"))
}

pub fn default_example_output_path(app: &AppHandle) -> Result<PathBuf, String> {
    let docs = match app.path().document_dir() {
        Ok(path) => path,
        Err(err) => {
            let fallback = default_documents_dir()?;
            tracing::warn!(
                "Failed to resolve document_dir via platform APIs: {}. Falling back to {:?}",
                err,
                fallback
            );
            fallback
        }
    };

    Ok(docs
        .join("DirtOS")
        .join("Examples")
        .join(EXAMPLE_FILE_NAME))
}

/// Ensure the bundled example file exists in the user's Documents folder.
/// Called during startup; non-fatal if it fails.
pub async fn ensure_example_garden_installed(app: &AppHandle) -> Result<String, String> {
    let output_path = default_example_output_path(app)?;
    if output_path.exists() {
        return Ok(output_path.to_string_lossy().into_owned());
    }

    let written = write_example_garden_to_path(&output_path).await?;
    Ok(written.to_string_lossy().into_owned())
}

async fn build_example_garden_content() -> Result<String, String> {
    let temp_root = std::env::temp_dir().join(format!("dirtos-example-{}", Uuid::new_v4()));
    let temp_data_dir = temp_root.join("app-data");

    let result = async {
        let pool = crate::db::init_db(&temp_data_dir)
            .await
            .map_err(|e| e.to_string())?;

        inner_seed(&pool).await.map_err(|e| e.to_string())?;

        let content = export::export_garden_data_json(&pool, &temp_data_dir).await?;
        pool.close().await;
        Ok::<String, String>(content)
    }
    .await;

    let _ = std::fs::remove_dir_all(&temp_root);
    result
}

fn write_example_file(output_path: &Path, content: &str) -> Result<PathBuf, String> {
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(output_path, content).map_err(|e| e.to_string())?;
    Ok(output_path.to_path_buf())
}

fn read_local_env_file() -> HashMap<String, String> {
    let mut values = HashMap::new();
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join(".env");

    let Ok(raw) = std::fs::read_to_string(path) else {
        return values;
    };

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            values.insert(k.trim().to_string(), v.trim().trim_matches('"').to_string());
        }
    }

    values
}

fn read_setting_value(name: &str, env_file: &HashMap<String, String>) -> Option<String> {
    if let Ok(v) = std::env::var(name) {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    env_file
        .get(name)
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn parse_f64_setting(
    name: &str,
    env_file: &HashMap<String, String>,
    default_value: f64,
) -> f64 {
    let Some(raw) = read_setting_value(name, env_file) else {
        return default_value;
    };

    // Support values like "163m" or quoted values.
    let sanitized: String = raw
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
        .collect();

    sanitized.parse::<f64>().unwrap_or(default_value)
}

fn load_demo_settings() -> DemoSettings {
    let env_file = read_local_env_file();

    DemoSettings {
        latitude: parse_f64_setting("LATITUDE", &env_file, 35.33429),
        longitude: parse_f64_setting("LONGITUDE", &env_file, -80.46207),
        elevation_m: parse_f64_setting("ALTITUDE", &env_file, 163.0),
        openweather_api_key: read_setting_value("OPENWEATHERMAP_API_KEY", &env_file),
        trefle_access_key: read_setting_value("TREFLE_ACCESS_KEY", &env_file),
    }
}

fn seasonal_progress(today: NaiveDate) -> f64 {
    match today.month() {
        1 | 2 => 0.10,
        3 => 0.18,
        4 => 0.24,
        5 => 0.36,
        6 => 0.52,
        7 => 0.68,
        8 => 0.80,
        9 => 0.90,
        10 => 0.76,
        11 => 0.58,
        _ => 0.34,
    }
}

fn planting_date_for_template(
    today: NaiveDate,
    status: PlantStatus,
    context: PlantContext,
    days_to_harvest: i64,
    progress: f64,
) -> NaiveDate {
    match status {
        PlantStatus::Seedling => {
            let age = match context {
                PlantContext::Seedling => 10,
                _ => 16,
            };
            today - Duration::days(age)
        }
        PlantStatus::Active => {
            let offset = match context {
                PlantContext::Outdoor => {
                    let raw = (days_to_harvest as f64 * progress).round() as i64;
                    raw.clamp(12, (days_to_harvest - 7).max(12))
                }
                PlantContext::Indoor => {
                    let raw = (days_to_harvest as f64 * 0.55).round() as i64;
                    raw.clamp(20, 90)
                }
                PlantContext::Perennial => 280,
                PlantContext::Seedling => 20,
            };
            today - Duration::days(offset)
        }
        PlantStatus::Harvested => {
            let offset = (days_to_harvest + 12).clamp(30, 220);
            today - Duration::days(offset)
        }
        PlantStatus::Removed => {
            let offset = (days_to_harvest + 30).clamp(35, 260);
            today - Duration::days(offset)
        }
        PlantStatus::Dead => {
            let offset = (days_to_harvest / 2).clamp(12, 70);
            today - Duration::days(offset)
        }
        PlantStatus::Planned => {
            let lead = match context {
                PlantContext::Outdoor => 14,
                _ => 7,
            };
            today + Duration::days(lead)
        }
    }
}

async fn load_species_index(pool: &SqlitePool) -> Result<HashMap<String, SpeciesInfo>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (i64, String, Option<i64>, Option<i64>, Option<String>)>(
        "SELECT id, common_name, days_to_harvest_min, days_to_harvest_max, growth_type FROM species",
    )
    .fetch_all(pool)
    .await?;

    let mut index = HashMap::new();
    for (id, common_name, min_h, max_h, growth_type) in rows {
        let days = min_h
            .or(max_h)
            .or_else(|| max_h.or(min_h))
            .unwrap_or(85)
            .max(45);

        index.insert(
            common_name.to_ascii_lowercase(),
            SpeciesInfo {
                id,
                days_to_harvest: days,
                growth_type,
            },
        );
    }

    Ok(index)
}

fn resolve_species(index: &HashMap<String, SpeciesInfo>, aliases: &[&str]) -> SpeciesInfo {
    for alias in aliases {
        if let Some(found) = index.get(&alias.to_ascii_lowercase()) {
            return found.clone();
        }
    }

    SpeciesInfo {
        id: 0,
        days_to_harvest: 85,
        growth_type: None,
    }
}

async fn create_template_plants(
    pool: &SqlitePool,
    environment_id: i64,
    location_id: i64,
    label_prefix: &str,
    templates: &[PlantTemplate<'_>],
    species_index: &HashMap<String, SpeciesInfo>,
    today: NaiveDate,
    progress: f64,
) -> Result<Vec<Plant>, sqlx::Error> {
    let mut out = Vec::with_capacity(templates.len());

    for (idx, tpl) in templates.iter().enumerate() {
        let species = resolve_species(species_index, tpl.aliases);
        let planted = planting_date_for_template(
            today,
            tpl.status.clone(),
            tpl.context,
            species.days_to_harvest,
            progress,
        );
        let asset_id = plant_category::generate_asset_id(species.growth_type.as_deref());

        let plant = plants::create_plant(
            pool,
            NewPlant {
                species_id: if species.id > 0 { Some(species.id) } else { None },
                location_id: Some(location_id),
                environment_id,
                status: Some(tpl.status.clone()),
                name: tpl.name.to_string(),
                label: Some(format!("{}-{:02}", label_prefix, idx + 1)),
                planted_date: Some(planted.format("%Y-%m-%d").to_string()),
                is_harvestable: Some(
                    matches!(tpl.status, PlantStatus::Harvested)
                        || matches!(tpl.context, PlantContext::Perennial)
                            && matches!(tpl.status, PlantStatus::Active),
                ),
                lifecycle_override: match tpl.context {
                    PlantContext::Perennial => Some("perennial".to_string()),
                    _ => None,
                },
                notes: Some(tpl.notes.to_string()),
                canvas_object_id: None,
            },
            Some(asset_id),
        )
        .await?;

        out.push(plant);
    }

    Ok(out)
}

fn find_plant<'a>(plants: &'a [Plant], name_part: &str) -> Option<&'a Plant> {
    let needle = name_part.to_ascii_lowercase();
    plants
        .iter()
        .find(|p| p.name.to_ascii_lowercase().contains(&needle))
}

async fn insert_backdated_journal(
    pool: &SqlitePool,
    environment_id: i64,
    plant_id: Option<i64>,
    location_id: Option<i64>,
    days_back: i64,
    title: &str,
    body: &str,
    conditions_json: Option<&str>,
) -> Result<(), sqlx::Error> {
    let offset = format!("-{} days", days_back);

    sqlx::query(
        "INSERT INTO journal_entries
             (environment_id, plant_id, location_id, title, body, conditions_json, created_at, updated_at)
         VALUES (?,?,?,?,?,?,datetime('now', ?),datetime('now', ?))",
    )
    .bind(environment_id)
    .bind(plant_id)
    .bind(location_id)
    .bind(title)
    .bind(body)
    .bind(conditions_json)
    .bind(&offset)
    .bind(&offset)
    .execute(pool)
    .await?;

    Ok(())
}

async fn insert_schedule_run(
    pool: &SqlitePool,
    schedule_id: i64,
    days_back: i64,
    status: ScheduleRunStatus,
) -> Result<(), sqlx::Error> {
    let offset = format!("-{} days", days_back);

    sqlx::query(
        "INSERT INTO schedule_runs (schedule_id, issue_id, ran_at, status)
         VALUES (?,NULL,datetime('now', ?),?)",
    )
    .bind(schedule_id)
    .bind(offset)
    .bind(status)
    .execute(pool)
    .await?;

    Ok(())
}

async fn insert_sensor_reading(
    pool: &SqlitePool,
    sensor_id: i64,
    value: f64,
    unit: &str,
    days_back: i64,
) -> Result<(), sqlx::Error> {
    let offset = format!("-{} days", days_back);

    sqlx::query(
        "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at)
         VALUES (?,?,?,datetime('now', ?))",
    )
    .bind(sensor_id)
    .bind(value)
    .bind(unit)
    .bind(offset)
    .execute(pool)
    .await?;

    Ok(())
}

async fn seed_settings_and_integrations(
    pool: &SqlitePool,
    environment_id: i64,
    settings: &DemoSettings,
) -> Result<(), sqlx::Error> {
    weather::set_setting(pool, "openweather_api_key", settings.openweather_api_key.as_deref().unwrap_or(""))
        .await?;
    weather::set_setting(pool, "trefle_api_key", settings.trefle_access_key.as_deref().unwrap_or(""))
        .await?;
    weather::set_setting(pool, "default_latitude", &settings.latitude.to_string()).await?;
    weather::set_setting(pool, "default_longitude", &settings.longitude.to_string()).await?;
    weather::set_setting(pool, "default_elevation_m", &settings.elevation_m.to_string()).await?;

    integrations::upsert_map_setting(
        pool,
        environment_id,
        UpsertEnvironmentMapSetting {
            latitude: Some(settings.latitude),
            longitude: Some(settings.longitude),
            zoom_level: Some(14),
            geocode_json: Some(
                serde_json::json!({
                    "label": "DirtOS Example Garden",
                    "source": "env",
                    "elevation_m": settings.elevation_m,
                })
                .to_string(),
            ),
            weather_overlay: true,
            soil_overlay: false,
            boundaries_geojson: None,
            privacy_level: MapPrivacyLevel::Private,
            allow_sharing: false,
        },
    )
    .await?;

    integrations::upsert_integration_config(
        pool,
        IntegrationProvider::Osm,
        UpsertIntegrationConfig {
            enabled: true,
            auth_json: None,
            settings_json: Some(
                serde_json::json!({
                    "default_lat": settings.latitude,
                    "default_lon": settings.longitude,
                    "elevation_m": settings.elevation_m,
                })
                .to_string(),
            ),
            sync_interval_minutes: Some(180),
            cache_ttl_minutes: Some(240),
            rate_limit_per_minute: Some(30),
        },
    )
    .await?;

    Ok(())
}

async fn inner_seed(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM environments WHERE name = ? LIMIT 1",
    )
    .bind(EXAMPLE_ENV_NAME)
    .fetch_optional(pool)
    .await?
    {
        return Ok(id);
    }

    let settings = load_demo_settings();
    let today = Utc::now().date_naive();
    let progress = seasonal_progress(today);

    let env = environments::create_environment(
        pool,
        NewEnvironment {
            name: EXAMPLE_ENV_NAME.to_string(),
            latitude: Some(settings.latitude),
            longitude: Some(settings.longitude),
            elevation_m: Some(settings.elevation_m),
            timezone: Some("America/New_York".to_string()),
            climate_zone: Some("7b".to_string()),
        },
    )
    .await?;
    let eid = env.id;

    seed_settings_and_integrations(pool, eid, &settings).await?;

    let outdoor_site = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::OutdoorSite,
            name: "Primary Outdoor Site".to_string(),
            label: Some("OUT-A".to_string()),
            position_x: Some(40.0),
            position_y: Some(40.0),
            width: Some(900.0),
            height: Some(420.0),
            canvas_data_json: None,
            notes: Some("Main outdoor area for raised beds and open-air spaces.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let indoor_site = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::IndoorSite,
            name: "Primary Indoor Site".to_string(),
            label: Some("IND-A".to_string()),
            position_x: Some(320.0),
            position_y: Some(240.0),
            width: Some(560.0),
            height: Some(220.0),
            canvas_data_json: None,
            notes: Some("Main indoor area for tents and seedling propagation.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let bed_east = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(outdoor_site.id),
            location_type: LocationType::Plot,
            name: "Raised Bed East".to_string(),
            label: Some("Warm-season vegetables".to_string()),
            position_x: Some(80.0),
            position_y: Some(80.0),
            width: Some(260.0),
            height: Some(140.0),
            canvas_data_json: None,
            notes: Some("South-facing bed with drip irrigation and trellis line.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let bed_west = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(outdoor_site.id),
            location_type: LocationType::Plot,
            name: "Raised Bed West".to_string(),
            label: Some("Greens and roots".to_string()),
            position_x: Some(380.0),
            position_y: Some(80.0),
            width: Some(260.0),
            height: Some(140.0),
            canvas_data_json: None,
            notes: Some("Cool-season crop rotation bed with shade cloth mounts.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let kitchen_blocks = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(outdoor_site.id),
            location_type: LocationType::PlotGroup,
            name: "Kitchen Blocks".to_string(),
            label: Some("KB".to_string()),
            position_x: Some(680.0),
            position_y: Some(240.0),
            width: Some(181.0),
            height: Some(108.0),
            canvas_data_json: None,
            notes: Some("2x3 grouped micro-beds for succession planting and quick-turn crops.".to_string()),
            grid_rows: Some(2),
            grid_cols: Some(3),
        },
    )
    .await?;

    let mut kitchen_block_spaces = Vec::new();
    for row in 0..2 {
        for col in 0..3 {
            let row_label = (b'A' + row as u8) as char;
            let space_label = format!("KB {}{}", row_label, col + 1);
            let space = locations::create_location(
                pool,
                NewLocation {
                    environment_id: eid,
                    parent_id: Some(kitchen_blocks.id),
                    location_type: LocationType::Space,
                    name: format!("Kitchen Block {}{}", row_label, col + 1),
                    label: Some(space_label),
                    position_x: Some(680.0 + (col as f64 * 63.0)),
                    position_y: Some(240.0 + (row as f64 * 58.0)),
                    width: Some(55.0),
                    height: Some(50.0),
                    canvas_data_json: None,
                    notes: Some("Child space in Kitchen Blocks plot group.".to_string()),
                    grid_rows: None,
                    grid_cols: None,
                },
            )
            .await?;

            kitchen_block_spaces.push(space);
        }
    }

    let kitchen_block_primary = kitchen_block_spaces
        .first()
        .map(|space| space.id)
        .unwrap_or(kitchen_blocks.id);

    let herb_terrace = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(outdoor_site.id),
            location_type: LocationType::Space,
            name: "Herb Terrace".to_string(),
            label: Some("Culinary perennials".to_string()),
            position_x: Some(80.0),
            position_y: Some(270.0),
            width: Some(220.0),
            height: Some(160.0),
            canvas_data_json: None,
            notes: Some("Tiered planters with mixed drainage for mediterranean and moist herbs.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let tent_a = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(indoor_site.id),
            location_type: LocationType::Tent,
            name: "Indoor Tent A".to_string(),
            label: Some("Leafy hydro DWC".to_string()),
            position_x: Some(340.0),
            position_y: Some(270.0),
            width: Some(120.0),
            height: Some(120.0),
            canvas_data_json: None,
            notes: Some("2x2 tent with DWC tote and full-spectrum LED.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let tent_b = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(indoor_site.id),
            location_type: LocationType::Tent,
            name: "Indoor Tent B".to_string(),
            label: Some("Nursery finishing".to_string()),
            position_x: Some(490.0),
            position_y: Some(270.0),
            width: Some(120.0),
            height: Some(120.0),
            canvas_data_json: None,
            notes: Some("2x2 tent for finishing transplants before outdoor move.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let propagation_bench = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(indoor_site.id),
            location_type: LocationType::SeedlingArea,
            name: "Propagation Bench".to_string(),
            label: Some("Seedling trays".to_string()),
            position_x: Some(640.0),
            position_y: Some(270.0),
            width: Some(220.0),
            height: Some(140.0),
            canvas_data_json: None,
            notes: Some("Heated propagation bench with humidity dome and 5000K strip lights.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let _tool_shed = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: Some(outdoor_site.id),
            location_type: LocationType::Shed,
            name: "Tool Shed".to_string(),
            label: Some("Storage".to_string()),
            position_x: Some(760.0),
            position_y: Some(80.0),
            width: Some(100.0),
            height: Some(90.0),
            canvas_data_json: None,
            notes: Some("Stores amendments, spare drippers, and propagation media.".to_string()),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await?;

    let indoor_a = indoor::create_indoor_environment(
        pool,
        NewIndoorEnvironment {
            location_id: tent_a.id,
            grow_method: Some(GrowMethod::HydroponicDwc),
            light_type: Some("LED board".to_string()),
            light_wattage: Some(240.0),
            light_schedule_on: Some("06:00".to_string()),
            light_schedule_off: Some("22:00".to_string()),
            ventilation_type: Some("Inline fan".to_string()),
            ventilation_cfm: Some(185.0),
            tent_width: Some(60.0),
            tent_depth: Some(60.0),
            tent_height: Some(160.0),
            reservoir_capacity_liters: Some(35.0),
            notes: Some("Leafy greens run. Maintain pH 5.8-6.2 and EC 1.2-1.6.".to_string()),
        },
    )
    .await?;

    indoor::upsert_reservoir_target(
        pool,
        indoor_a.id,
        UpsertIndoorReservoirTarget {
            ph_min: Some(5.8),
            ph_max: Some(6.2),
            ec_min: Some(1.2),
            ec_max: Some(1.6),
            ppm_min: Some(700.0),
            ppm_max: Some(950.0),
        },
    )
    .await?;

    let indoor_b = indoor::create_indoor_environment(
        pool,
        NewIndoorEnvironment {
            location_id: tent_b.id,
            grow_method: Some(GrowMethod::Soil),
            light_type: Some("LED bar".to_string()),
            light_wattage: Some(180.0),
            light_schedule_on: Some("07:00".to_string()),
            light_schedule_off: Some("21:00".to_string()),
            ventilation_type: Some("Inline fan".to_string()),
            ventilation_cfm: Some(145.0),
            tent_width: Some(60.0),
            tent_depth: Some(60.0),
            tent_height: Some(160.0),
            reservoir_capacity_liters: None,
            notes: Some("Soil finishing tent for transplant hardening and controlled growth.".to_string()),
        },
    )
    .await?;

    indoor::upsert_reservoir_target(
        pool,
        indoor_b.id,
        UpsertIndoorReservoirTarget {
            ph_min: None,
            ph_max: None,
            ec_min: None,
            ec_max: None,
            ppm_min: None,
            ppm_max: None,
        },
    )
    .await?;

    let species_index = load_species_index(pool).await?;

    let bed_east_templates = vec![
        PlantTemplate { aliases: &["Tomato", "Cherry Tomato"], name: "Sungold Tomato", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Trellised indeterminate cherry tomato with strong spring growth." },
        PlantTemplate { aliases: &["Tomato", "Roma Tomato"], name: "San Marzano Tomato", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Paste tomato trained to two leaders for sauce production." },
        PlantTemplate { aliases: &["Tomato"], name: "Cherokee Purple Tomato", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Heirloom slicer establishing after transplant." },
        PlantTemplate { aliases: &["Bell Pepper"], name: "California Wonder Pepper", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Healthy canopy with first fruit set." },
        PlantTemplate { aliases: &["Jalapeño Pepper", "Jalapeno Pepper"], name: "TAM Jalapeno", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Compact plant with uniform pods." },
        PlantTemplate { aliases: &["Cucumber"], name: "Marketmore Cucumber", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Vertical training on nylon trellis." },
        PlantTemplate { aliases: &["Zucchini"], name: "Black Beauty Zucchini", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Vigorous growth; harvest every 2-3 days." },
        PlantTemplate { aliases: &["Marigold"], name: "French Marigold Companion", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Companion flowering strip for pest pressure reduction." },
        PlantTemplate { aliases: &["Basil", "Thai Basil"], name: "Genovese Basil Border", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Companion basil planted between tomato stations." },
        PlantTemplate { aliases: &["Bush Bean", "Pole Bean"], name: "Blue Lake Bean Succession", status: PlantStatus::Planned, context: PlantContext::Outdoor, notes: "Planned replacement after cucumber flush declines." },
    ];

    let bed_west_templates = vec![
        PlantTemplate { aliases: &["Butterhead Lettuce", "Loose-Leaf Lettuce"], name: "Butterhead Lettuce", status: PlantStatus::Harvested, context: PlantContext::Outdoor, notes: "Primary spring harvest complete; succession prepared." },
        PlantTemplate { aliases: &["Romaine Lettuce", "Lettuce"], name: "Red Romaine Lettuce", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Mid-stage romaine with weekly cut harvest." },
        PlantTemplate { aliases: &["Spinach"], name: "Bloomsdale Spinach", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Still productive under shade cloth in warm spells." },
        PlantTemplate { aliases: &["Kale"], name: "Lacinato Kale", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Cut-and-come-again management underway." },
        PlantTemplate { aliases: &["Swiss Chard"], name: "Rainbow Chard", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Fast regrowth after leaf harvest." },
        PlantTemplate { aliases: &["Carrot"], name: "Danvers 126 Carrot", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Direct seeded in double rows, thinned to spacing." },
        PlantTemplate { aliases: &["Onion", "Green Onion"], name: "Walla Walla Onion", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Sweet onion block in center third of bed." },
        PlantTemplate { aliases: &["Nasturtium"], name: "Nasturtium Edge Planting", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Trap-crop flowering strip at perimeter." },
        PlantTemplate { aliases: &["Kale"], name: "Red Russian Kale", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Second kale cultivar for comparison and staggered cuts." },
        PlantTemplate { aliases: &["Bell Pepper"], name: "Pepper Replacement Start", status: PlantStatus::Dead, context: PlantContext::Outdoor, notes: "Late frost damaged transplant; flagged for replacement." },
    ];

    let herb_templates = vec![
        PlantTemplate { aliases: &["Basil"], name: "Italian Basil Cluster", status: PlantStatus::Harvested, context: PlantContext::Perennial, notes: "Recent heavy cut-and-come-again harvest; candidate for perennial cycle." },
        PlantTemplate { aliases: &["Thyme"], name: "Common Thyme", status: PlantStatus::Active, context: PlantContext::Perennial, notes: "Dry upper terrace section." },
        PlantTemplate { aliases: &["Rosemary"], name: "Tuscan Blue Rosemary", status: PlantStatus::Active, context: PlantContext::Perennial, notes: "Established woody shrub with winter carry-over." },
        PlantTemplate { aliases: &["Oregano"], name: "Greek Oregano", status: PlantStatus::Active, context: PlantContext::Perennial, notes: "Perennial mat trimmed monthly." },
        PlantTemplate { aliases: &["Chives"], name: "Garlic Chives", status: PlantStatus::Active, context: PlantContext::Perennial, notes: "Clump division completed last season." },
        PlantTemplate { aliases: &["Spearmint", "Peppermint"], name: "Spearmint Contained Pot", status: PlantStatus::Active, context: PlantContext::Perennial, notes: "Container sunk in terrace to prevent spread." },
        PlantTemplate { aliases: &["Lavender"], name: "English Lavender", status: PlantStatus::Active, context: PlantContext::Perennial, notes: "Pollinator support and border fragrance." },
    ];

    let kitchen_block_templates = vec![
        PlantTemplate { aliases: &["Arugula"], name: "Kitchen Arugula Block", status: PlantStatus::Active, context: PlantContext::Outdoor, notes: "Fast-turn greens in grouped micro-bed layout." },
        PlantTemplate { aliases: &["Butterhead Lettuce", "Lettuce"], name: "Kitchen Lettuce Succession", status: PlantStatus::Planned, context: PlantContext::Outdoor, notes: "Next succession batch for the grouped kitchen beds." },
    ];

    let tent_a_templates = vec![
        PlantTemplate { aliases: &["Butterhead Lettuce", "Lettuce"], name: "DWC Buttercrunch 1", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Net-pot station A1." },
        PlantTemplate { aliases: &["Butterhead Lettuce", "Lettuce"], name: "DWC Buttercrunch 2", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Net-pot station A2." },
        PlantTemplate { aliases: &["Romaine Lettuce", "Lettuce"], name: "DWC Romaine 1", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Rapid leafy growth under 16h light." },
        PlantTemplate { aliases: &["Romaine Lettuce", "Lettuce"], name: "DWC Romaine 2", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Second romaine succession." },
        PlantTemplate { aliases: &["Basil", "Thai Basil"], name: "DWC Basil 1", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Hydro basil with aromatic leaf production." },
        PlantTemplate { aliases: &["Basil", "Thai Basil"], name: "DWC Basil 2", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Companion hydro basil in corner station." },
    ];

    let tent_b_templates = vec![
        PlantTemplate { aliases: &["Kale"], name: "Tent Kale 1", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Hardening crop for outdoor transfer." },
        PlantTemplate { aliases: &["Kale"], name: "Tent Kale 2", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Slightly behind sister plant in canopy density." },
        PlantTemplate { aliases: &["Swiss Chard"], name: "Tent Chard 1", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Colorful stem cultivar under moderate feed." },
        PlantTemplate { aliases: &["Swiss Chard"], name: "Tent Chard 2", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Strong root mass in 3L pot." },
        PlantTemplate { aliases: &["Cilantro"], name: "Tent Cilantro 1", status: PlantStatus::Active, context: PlantContext::Indoor, notes: "Bolting-resistant line in cooler tent corner." },
        PlantTemplate { aliases: &["Cilantro"], name: "Tent Cilantro 2", status: PlantStatus::Removed, context: PlantContext::Indoor, notes: "Removed after premature bolting; used for seed save." },
    ];

    let propagation_templates = vec![
        PlantTemplate { aliases: &["Tomato"], name: "Mortgage Lifter Seedling", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Tray A cell line, true leaves present." },
        PlantTemplate { aliases: &["Tomato"], name: "Sungold Backup Seedling", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Backup transplant for field gap-fill." },
        PlantTemplate { aliases: &["Tomato", "Roma Tomato"], name: "Roma Paste Seedling", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Compact seedling with thick stem." },
        PlantTemplate { aliases: &["Bell Pepper"], name: "Bell Pepper Seedling", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Heat-mat propagation, moderate vigor." },
        PlantTemplate { aliases: &["Jalapeño Pepper", "Jalapeno Pepper"], name: "Jalapeno Seedling", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Secondary pepper succession." },
        PlantTemplate { aliases: &["Basil"], name: "Basil Seedling Flat", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "High-density basil start for repeated pinching." },
        PlantTemplate { aliases: &["Thai Basil", "Basil"], name: "Thai Basil Seedling", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Warm-rooted aromatic basil cultivar." },
        PlantTemplate { aliases: &["Sunflower"], name: "Sunflower Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Ready for border transplant in 3-5 days." },
        PlantTemplate { aliases: &["Marigold"], name: "Marigold Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Companion flowering transplant." },
        PlantTemplate { aliases: &["Zinnia"], name: "Zinnia Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Pollinator strip replacement start." },
        PlantTemplate { aliases: &["Calendula"], name: "Calendula Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Successive flowering blocks." },
        PlantTemplate { aliases: &["Cucumber"], name: "Lemon Cucumber Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Later succession cucumber transplant." },
        PlantTemplate { aliases: &["Kale"], name: "Kale Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Autumn-ready starter in tray B." },
        PlantTemplate { aliases: &["Butterhead Lettuce", "Lettuce"], name: "Butterhead Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Quick succession for bed west." },
        PlantTemplate { aliases: &["Romaine Lettuce", "Lettuce"], name: "Romaine Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Next cut cycle romaine." },
        PlantTemplate { aliases: &["Swiss Chard"], name: "Chard Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Follow-up after heavy summer cuts." },
        PlantTemplate { aliases: &["Cilantro"], name: "Cilantro Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Shallow root tray seedling." },
        PlantTemplate { aliases: &["Dill"], name: "Dill Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Early flowering support for beneficial insects." },
        PlantTemplate { aliases: &["Borage"], name: "Borage Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Bee-support flowering transplant." },
        PlantTemplate { aliases: &["Nasturtium"], name: "Nasturtium Start", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Aphid trap-crop refresh." },
        PlantTemplate { aliases: &["Oregano"], name: "Oregano Cutting", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Rooted cutting from terrace mother plant." },
        PlantTemplate { aliases: &["Chives"], name: "Chive Division", status: PlantStatus::Seedling, context: PlantContext::Seedling, notes: "Division plug from perennial clump." },
    ];

    let bed_east_plants = create_template_plants(
        pool,
        eid,
        bed_east.id,
        "BE",
        &bed_east_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let bed_west_plants = create_template_plants(
        pool,
        eid,
        bed_west.id,
        "BW",
        &bed_west_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let herb_plants = create_template_plants(
        pool,
        eid,
        herb_terrace.id,
        "HT",
        &herb_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let tent_a_plants = create_template_plants(
        pool,
        eid,
        tent_a.id,
        "TA",
        &tent_a_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let tent_b_plants = create_template_plants(
        pool,
        eid,
        tent_b.id,
        "TB",
        &tent_b_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let propagation_plants = create_template_plants(
        pool,
        eid,
        propagation_bench.id,
        "PB",
        &propagation_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let kitchen_block_plants = create_template_plants(
        pool,
        eid,
        kitchen_block_primary,
        "KB",
        &kitchen_block_templates,
        &species_index,
        today,
        progress,
    )
    .await?;

    let mut all_plants = Vec::new();
    all_plants.extend(bed_east_plants.clone());
    all_plants.extend(bed_west_plants.clone());
    all_plants.extend(herb_plants.clone());
    all_plants.extend(tent_a_plants.clone());
    all_plants.extend(tent_b_plants.clone());
    all_plants.extend(propagation_plants.clone());
    all_plants.extend(kitchen_block_plants.clone());

    let tray_a = seedling_trays::create_tray(
        pool,
        NewSeedlingTray {
            environment_id: eid,
            location_id: Some(propagation_bench.id),
            name: "Propagation Tray A".to_string(),
            rows: 4,
            cols: 8,
            cell_size_cm: Some(4.0),
            notes: Some("40-cell tray. 12 occupied with warm-season starts.".to_string()),
        },
    )
    .await?;

    let tray_b = seedling_trays::create_tray(
        pool,
        NewSeedlingTray {
            environment_id: eid,
            location_id: Some(propagation_bench.id),
            name: "Propagation Tray B".to_string(),
            rows: 4,
            cols: 6,
            cell_size_cm: Some(4.5),
            notes: Some("24-cell tray. 10 occupied with cool-season and flower starts.".to_string()),
        },
    )
    .await?;

    for (idx, plant) in propagation_plants.iter().take(12).enumerate() {
        let row = (idx / 6) as i64;
        let col = (idx % 6) as i64;
        seedling_trays::assign_tray_cell(
            pool,
            AssignTrayCell {
                tray_id: tray_a.id,
                row,
                col,
                plant_id: Some(plant.id),
                notes: Some("Uniform emergence pattern.".to_string()),
            },
        )
        .await?;
    }

    for (idx, plant) in propagation_plants.iter().skip(12).take(10).enumerate() {
        let row = (idx / 5) as i64;
        let col = (idx % 5) as i64;
        seedling_trays::assign_tray_cell(
            pool,
            AssignTrayCell {
                tray_id: tray_b.id,
                row,
                col,
                plant_id: Some(plant.id),
                notes: Some("Secondary succession starts.".to_string()),
            },
        )
        .await?;
    }

    let fish_id = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM additives WHERE name LIKE '%Fish%' LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    let kelp_id = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM additives WHERE name LIKE '%Kelp%' LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    let water_east = schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(bed_east.id),
            schedule_type: ScheduleType::Water,
            title: "Bed East drip watering".to_string(),
            cron_expression: Some("0 6 * * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some("Run 18-22 minutes depending on rainfall forecast.".to_string()),
        },
    )
    .await?;

    let water_west = schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(bed_west.id),
            schedule_type: ScheduleType::Water,
            title: "Bed West micro-sprayer cycle".to_string(),
            cron_expression: Some("0 7 * * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some("Morning cycle only to reduce foliar disease pressure.".to_string()),
        },
    )
    .await?;

    let feed_schedule = schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            schedule_type: ScheduleType::Feed,
            title: "Biweekly organic feed".to_string(),
            cron_expression: Some("0 9 1,15 * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: fish_id.or(kelp_id),
            notes: Some("Alternate fish emulsion and kelp in active growth windows.".to_string()),
        },
    )
    .await?;

    let tent_maintenance = schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(tent_b.id),
            schedule_type: ScheduleType::Maintenance,
            title: "Tent airflow and filter check".to_string(),
            cron_expression: Some("0 11 * * 2,5".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some("Inspect fan controller, pre-filter, and intake path.".to_string()),
        },
    )
    .await?;

    for day in [18, 14, 10, 6, 2] {
        insert_schedule_run(pool, water_east.id, day, ScheduleRunStatus::Completed).await?;
    }
    for day in [19, 15, 11, 7, 3] {
        insert_schedule_run(pool, water_west.id, day, ScheduleRunStatus::Completed).await?;
    }
    insert_schedule_run(pool, water_west.id, 1, ScheduleRunStatus::Missed).await?;

    for day in [20, 6] {
        insert_schedule_run(pool, feed_schedule.id, day, ScheduleRunStatus::Completed).await?;
    }

    for day in [16, 12, 8, 4] {
        insert_schedule_run(pool, tent_maintenance.id, day, ScheduleRunStatus::Completed).await?;
    }

    let cucumber = find_plant(&all_plants, "cucumber").cloned();
    let spinach = find_plant(&all_plants, "spinach").cloned();
    let butterhead = find_plant(&all_plants, "butterhead lettuce").cloned();
    let basil = find_plant(&all_plants, "italian basil").cloned().or_else(|| find_plant(&all_plants, "basil").cloned());

    if let Some(plant) = butterhead.as_ref() {
        let h1 = harvests::create_harvest(
            pool,
            NewHarvest {
                plant_id: plant.id,
                harvest_date: (today - Duration::days(22)).format("%Y-%m-%d").to_string(),
                quantity: Some(280.0),
                unit: Some("g".to_string()),
                quality_rating: Some(5),
                notes: Some("First full head harvest from spring run.".to_string()),
            },
        )
        .await?;

        let _h2 = harvests::create_harvest(
            pool,
            NewHarvest {
                plant_id: plant.id,
                harvest_date: (today - Duration::days(12)).format("%Y-%m-%d").to_string(),
                quantity: Some(240.0),
                unit: Some("g".to_string()),
                quality_rating: Some(4),
                notes: Some("Second cut from regrowth block.".to_string()),
            },
        )
        .await?;

        let _ = seed_store::create_seed_lot(
            pool,
            NewSeedLot {
                species_id: plant.species_id,
                parent_plant_id: Some(plant.id),
                harvest_id: Some(h1.id),
                lot_label: Some("Butterhead Save Lot 2026".to_string()),
                quantity: Some(60.0),
                viability_pct: Some(82.0),
                storage_location: Some("Tool Shed - seed tin B".to_string()),
                collected_date: Some(today.format("%Y-%m-%d").to_string()),
                source_type: Some("harvested".to_string()),
                vendor: None,
                purchase_date: None,
                expiration_date: Some((today + Duration::days(540)).format("%Y-%m-%d").to_string()),
                packet_info: None,
                notes: Some("Saved from selected heads for repeat spring sowing.".to_string()),
            },
        )
        .await?;
    }

    if let Some(plant) = spinach.as_ref() {
        let _ = harvests::create_harvest(
            pool,
            NewHarvest {
                plant_id: plant.id,
                harvest_date: (today - Duration::days(16)).format("%Y-%m-%d").to_string(),
                quantity: Some(320.0),
                unit: Some("g".to_string()),
                quality_rating: Some(4),
                notes: Some("Bulk spinach cut before warm weather stretch.".to_string()),
            },
        )
        .await?;
    }

    if let Some(plant) = basil.as_ref() {
        let _ = harvests::create_harvest(
            pool,
            NewHarvest {
                plant_id: plant.id,
                harvest_date: (today - Duration::days(9)).format("%Y-%m-%d").to_string(),
                quantity: Some(95.0),
                unit: Some("g".to_string()),
                quality_rating: Some(5),
                notes: Some("Pinch harvest for pesto batch and tip pruning.".to_string()),
            },
        )
        .await?;
    }

    let seed_lot_species = find_plant(&all_plants, "kale").and_then(|p| p.species_id);
    let _ = seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: seed_lot_species,
            parent_plant_id: None,
            harvest_id: None,
            lot_label: Some("Lacinato Kale - purchased".to_string()),
            quantity: Some(110.0),
            viability_pct: Some(88.0),
            storage_location: Some("Tool Shed - seed tin A".to_string()),
            collected_date: None,
            source_type: Some("purchased".to_string()),
            vendor: Some("Local Seed Co-op".to_string()),
            purchase_date: Some((today - Duration::days(52)).format("%Y-%m-%d").to_string()),
            expiration_date: Some((today + Duration::days(610)).format("%Y-%m-%d").to_string()),
            packet_info: Some("Packet #KS-410".to_string()),
            notes: Some("Used for bed west and tent hardening succession.".to_string()),
        },
    )
    .await?;

    for (idx, seedling) in propagation_plants.iter().take(5).enumerate() {
        let d1 = today - Duration::days(9 - idx as i64);
        let d2 = today - Duration::days(4 - idx as i64 / 2);

        seedling_observations::create_observation(
            pool,
            NewSeedlingObservation {
                plant_id: seedling.id,
                observed_at: Some(d1.format("%Y-%m-%d").to_string()),
                height_cm: Some(4.5 + idx as f64 * 0.8),
                stem_thickness_mm: Some(1.8 + idx as f64 * 0.2),
                leaf_node_count: Some(2 + idx as i64 / 2),
                leaf_node_spacing_mm: Some(7.0 + idx as f64),
                notes: Some("Healthy cotyledon-to-true-leaf transition.".to_string()),
            },
        )
        .await?;

        seedling_observations::create_observation(
            pool,
            NewSeedlingObservation {
                plant_id: seedling.id,
                observed_at: Some(d2.format("%Y-%m-%d").to_string()),
                height_cm: Some(6.2 + idx as f64 * 1.1),
                stem_thickness_mm: Some(2.1 + idx as f64 * 0.25),
                leaf_node_count: Some(3 + idx as i64 / 2),
                leaf_node_spacing_mm: Some(8.5 + idx as f64),
                notes: Some("Steady vegetative growth under bench lights.".to_string()),
            },
        )
        .await?;
    }

    let bed_east_moisture = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(bed_east.id),
            plant_id: None,
            name: "Bed East Soil Moisture".to_string(),
            sensor_type: SensorType::Moisture,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: Some(3600),
            is_active: Some(true),
        },
    )
    .await?;

    let bed_west_moisture = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(bed_west.id),
            plant_id: None,
            name: "Bed West Soil Moisture".to_string(),
            sensor_type: SensorType::Moisture,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: Some(3600),
            is_active: Some(true),
        },
    )
    .await?;

    let tent_b_temp = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(tent_b.id),
            plant_id: None,
            name: "Tent B Air Temperature".to_string(),
            sensor_type: SensorType::Temperature,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: Some(600),
            is_active: Some(true),
        },
    )
    .await?;

    let tent_a_humidity = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(tent_a.id),
            plant_id: None,
            name: "Tent A Relative Humidity".to_string(),
            sensor_type: SensorType::Humidity,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: Some(600),
            is_active: Some(true),
        },
    )
    .await?;

    sensors::upsert_limits(
        pool,
        bed_east_moisture.id,
        Some(35.0),
        Some(70.0),
        Some("%".to_string()),
        true,
    )
    .await?;

    sensors::upsert_limits(
        pool,
        bed_west_moisture.id,
        Some(35.0),
        Some(70.0),
        Some("%".to_string()),
        true,
    )
    .await?;

    sensors::upsert_limits(
        pool,
        tent_b_temp.id,
        Some(18.0),
        Some(27.0),
        Some("C".to_string()),
        true,
    )
    .await?;

    sensors::upsert_limits(
        pool,
        tent_a_humidity.id,
        Some(55.0),
        Some(75.0),
        Some("%".to_string()),
        true,
    )
    .await?;

    for (days_back, east, west, temp, humidity) in [
        (4, 54.0, 52.0, 24.1, 66.0),
        (3, 51.0, 48.0, 24.4, 64.0),
        (2, 49.0, 44.0, 25.1, 65.0),
        (1, 47.0, 39.0, 26.0, 68.0),
        (0, 46.0, 18.0, 31.3, 72.0),
    ] {
        insert_sensor_reading(pool, bed_east_moisture.id, east, "%", days_back).await?;
        insert_sensor_reading(pool, bed_west_moisture.id, west, "%", days_back).await?;
        insert_sensor_reading(pool, tent_b_temp.id, temp, "C", days_back).await?;
        insert_sensor_reading(pool, tent_a_humidity.id, humidity, "%", days_back).await?;
    }

    for (days_back, ph, ec, air_temp, humidity) in [
        (4, 6.1, 1.35, 22.1, 67.0),
        (3, 6.0, 1.40, 22.5, 68.0),
        (2, 5.9, 1.47, 22.8, 69.0),
        (1, 5.9, 1.52, 23.0, 70.0),
        (0, 5.8, 1.58, 23.3, 71.0),
    ] {
        sqlx::query(
            "INSERT INTO indoor_readings
                 (indoor_environment_id, water_ph, water_ec, air_temp, air_humidity, recorded_at)
             VALUES (?,?,?,?,?,datetime('now', ?))",
        )
        .bind(indoor_a.id)
        .bind(ph)
        .bind(ec)
        .bind(air_temp)
        .bind(humidity)
        .bind(format!("-{} days", days_back))
        .execute(pool)
        .await?;
    }

    for (days_back, amount_ml) in [(7, 150.0), (3, 140.0)] {
        sqlx::query(
            "INSERT INTO indoor_nutrient_logs
                 (indoor_environment_id, additive_id, amount, unit, created_at)
             VALUES (?,?,?,?,datetime('now', ?))",
        )
        .bind(indoor_a.id)
        .bind(fish_id)
        .bind(amount_ml)
        .bind("ml")
        .bind(format!("-{} days", days_back))
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "INSERT INTO indoor_water_changes
             (indoor_environment_id, volume_liters, notes, created_at)
         VALUES (?,?,?,datetime('now', '-6 days'))",
    )
    .bind(indoor_a.id)
    .bind(24.0)
    .bind("Full reservoir refresh after EC drift.")
    .execute(pool)
    .await?;

    let mildew_issue = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: cucumber.as_ref().map(|p| p.id),
            location_id: Some(bed_east.id),
            title: "Powdery mildew spotted on cucumber lower leaves".to_string(),
            description: Some(
                "Lower canopy leaves show early powdery mildew. Increased airflow and initiated weekly potassium bicarbonate treatment."
                    .to_string(),
            ),
            status: Some(IssueStatus::Open),
            priority: Some(IssuePriority::Medium),
        },
    )
    .await?;

    let fan_issue = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(tent_b.id),
            title: "Tent B exhaust fan controller offline".to_string(),
            description: Some(
                "Fan controller intermittently drops to 0%. High-temperature spikes detected in Tent B sensor readings."
                    .to_string(),
            ),
            status: Some(IssueStatus::InProgress),
            priority: Some(IssuePriority::High),
        },
    )
    .await?;

    let moisture_issue = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(bed_west.id),
            title: "Bed West moisture below threshold".to_string(),
            description: Some(
                "Soil moisture dropped to 18%, below configured minimum of 35%. Suspected clogged dripper line on west manifold."
                    .to_string(),
            ),
            status: Some(IssueStatus::New),
            priority: Some(IssuePriority::Medium),
        },
    )
    .await?;

    let label_ids: HashMap<String, i64> = sqlx::query_as::<_, (String, i64)>(
        "SELECT name, id FROM issue_labels",
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|(name, id)| (name.to_ascii_lowercase(), id))
    .collect();

    let label_for = |name: &str| label_ids.get(&name.to_ascii_lowercase()).copied();

    for (issue_id, label_name) in [
        (mildew_issue.id, "Powdery Mildew"),
        (fan_issue.id, "Mechanical Damage"),
        (moisture_issue.id, "Watering Issue"),
    ] {
        if let Some(label_id) = label_for(label_name) {
            sqlx::query("INSERT OR IGNORE INTO issue_label_map (issue_id, label_id) VALUES (?,?)")
                .bind(issue_id)
                .bind(label_id)
                .execute(pool)
                .await?;
        }
    }

    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(mildew_issue.id)
        .bind("Pruned lower affected leaves and increased spacing on trellis string. Next check in 3 days.")
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(fan_issue.id)
        .bind("Temporary fan bypass installed. Replacement controller ordered.")
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(moisture_issue.id)
        .bind("Flushed dripper line and replaced one emitter. Re-check moisture after next morning cycle.")
        .execute(pool)
        .await?;

    insert_backdated_journal(
        pool,
        eid,
        None,
        None,
        28,
        "Season setup and bed prep",
        "Compost incorporated in both outdoor beds, drip lines tested, and first wave of spring transplants staged.",
        Some(r#"{"temp_c": 15, "weather": "partly_cloudy"}"#),
    )
    .await?;

    insert_backdated_journal(
        pool,
        eid,
        cucumber.as_ref().map(|p| p.id),
        Some(bed_east.id),
        12,
        "Cucumber canopy trained and tied",
        "Main leader tied to vertical support. Removed basal laterals for airflow and disease prevention.",
        Some(r#"{"temp_c": 22, "humidity_pct": 61}"#),
    )
    .await?;

    insert_backdated_journal(
        pool,
        eid,
        spinach.as_ref().map(|p| p.id),
        Some(bed_west.id),
        16,
        "Spinach and lettuce heavy cut",
        "Completed bulk harvest and immediate cool rinse. Prepared succession starts on propagation bench.",
        Some(r#"{"temp_c": 19, "weather": "overcast"}"#),
    )
    .await?;

    insert_backdated_journal(
        pool,
        eid,
        None,
        Some(tent_b.id),
        2,
        "Tent B airflow anomaly observed",
        "Detected elevated canopy temperature and reduced exhaust airflow. Opened maintenance issue and switched to temporary fan profile.",
        Some(r#"{"air_temp_c": 30.8, "humidity_pct": 70}"#),
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            title: "Example garden imported and ready".to_string(),
            body: Some(
                "This environment demonstrates outdoor beds, indoor tents, seedling trays, schedules, sensor monitoring, and issue workflows."
                    .to_string(),
            ),
            conditions_json: Some(
                serde_json::json!({
                    "lat": settings.latitude,
                    "lon": settings.longitude,
                    "elevation_m": settings.elevation_m,
                })
                .to_string(),
            ),
        },
    )
    .await?;

    let spring_start = NaiveDate::from_ymd_opt(today.year(), 3, 1).unwrap_or(today);
    let summer_end = NaiveDate::from_ymd_opt(today.year(), 9, 30).unwrap_or(today);
    let fall_start = NaiveDate::from_ymd_opt(today.year(), 9, 1).unwrap_or(today);
    let fall_end = NaiveDate::from_ymd_opt(today.year(), 11, 30).unwrap_or(today);

    sqlx::query(
        "INSERT INTO seasons (environment_id, name, start_date, end_date, notes)
         VALUES (?,?,?,?,?)",
    )
    .bind(eid)
    .bind(format!("Spring-Summer {}", today.year()))
    .bind(spring_start.format("%Y-%m-%d").to_string())
    .bind(summer_end.format("%Y-%m-%d").to_string())
    .bind("Primary production window for vegetables, herbs, and flowers.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO seasons (environment_id, name, start_date, end_date, notes)
         VALUES (?,?,?,?,?)",
    )
    .bind(eid)
    .bind(format!("Autumn {}", today.year()))
    .bind(fall_start.format("%Y-%m-%d").to_string())
    .bind(fall_end.format("%Y-%m-%d").to_string())
    .bind("Cool-weather succession and seed-saving focus.")
    .execute(pool)
    .await?;

    Ok(eid)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn example_garden_backup_imports_into_clean_database() {
        let temp_root = std::env::temp_dir().join(format!("dirtos-demo-import-test-{}", Uuid::new_v4()));
        let app_data_dir = temp_root.join("app-data");

        let result = async {
            let content = build_example_garden_content().await?;
            let pool = crate::db::init_db(&app_data_dir)
                .await
                .map_err(|e| e.to_string())?;

            crate::services::export::import_garden_data_json(&pool, &app_data_dir, &content).await?;

            let environment_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(1) FROM environments",
            )
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;

            let plant_count = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(1) FROM plants",
            )
            .fetch_one(&pool)
            .await
            .map_err(|e| e.to_string())?;

            pool.close().await;

            Ok::<(i64, i64), String>((environment_count, plant_count))
        }
        .await;

        let _ = std::fs::remove_dir_all(&temp_root);

        let (environment_count, plant_count) = result.expect("demo garden import should succeed");
        assert!(environment_count > 0, "expected imported environments");
        assert!(plant_count > 0, "expected imported plants");
    }
}
