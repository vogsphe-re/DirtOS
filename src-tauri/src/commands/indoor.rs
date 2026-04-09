use chrono::{Duration, NaiveDate, Utc};
use sqlx::SqlitePool;
use tauri::State;

use crate::{
    db::{
        indoor, locations,
        models::{
            GrowMethod, IndoorDashboardSummary, IndoorEnvironment, IndoorEnvironmentSetupInput,
            IndoorEnvironmentSummary, IndoorNutrientLog, IndoorReading, IndoorReservoirTarget,
            IndoorWaterChange, LocationType, NewIndoorEnvironment, NewIndoorReading,
            NewLocation, ReservoirStatus, UpdateIndoorEnvironment, UpsertIndoorReservoirTarget,
        },
        sensors,
    },
    services::indoor as indoor_service,
};

#[tauri::command]
#[specta::specta]
pub async fn create_indoor_environment(
    pool: State<'_, SqlitePool>,
    input: IndoorEnvironmentSetupInput,
) -> Result<IndoorEnvironmentSummary, String> {
    let location = locations::create_location(
        &pool,
        NewLocation {
            environment_id: input.environment_id,
            parent_id: input.parent_id,
            location_type: LocationType::Tent,
            name: input.name.clone(),
            label: input.label.clone(),
            position_x: None,
            position_y: None,
            width: input.tent_width,
            height: input.tent_depth,
            canvas_data_json: None,
            notes: input.notes.clone(),
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    let indoor_environment = indoor::create_indoor_environment(
        &pool,
        NewIndoorEnvironment {
            location_id: location.id,
            grow_method: input.grow_method,
            light_type: input.light_type,
            light_wattage: input.light_wattage,
            light_schedule_on: input.light_schedule_on,
            light_schedule_off: input.light_schedule_off,
            ventilation_type: input.ventilation_type,
            ventilation_cfm: input.ventilation_cfm,
            tent_width: input.tent_width,
            tent_depth: input.tent_depth,
            tent_height: input.tent_height,
            reservoir_capacity_liters: input.reservoir_capacity_liters,
            notes: input.notes,
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(IndoorEnvironmentSummary {
        indoor_environment,
        location,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn update_indoor_environment(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateIndoorEnvironment,
) -> Result<Option<IndoorEnvironment>, String> {
    indoor::update_indoor_environment(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_indoor_environment(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<IndoorEnvironmentSummary>, String> {
    let Some(indoor_environment) = indoor::get_indoor_environment_by_id(&pool, id)
        .await
        .map_err(|e| e.to_string())?
    else {
        return Ok(None);
    };

    let location = locations::get_location(&pool, indoor_environment.location_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            format!(
                "Location {} missing for indoor environment {id}",
                indoor_environment.location_id
            )
        })?;

    Ok(Some(IndoorEnvironmentSummary {
        indoor_environment,
        location,
    }))
}

#[tauri::command]
#[specta::specta]
pub async fn list_indoor_environments(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<IndoorEnvironmentSummary>, String> {
    let rows = indoor::list_indoor_environments(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(rows.len());
    for indoor_environment in rows {
        if let Some(location) = locations::get_location(&pool, indoor_environment.location_id)
            .await
            .map_err(|e| e.to_string())?
        {
            out.push(IndoorEnvironmentSummary {
                indoor_environment,
                location,
            });
        }
    }
    Ok(out)
}

#[tauri::command]
#[specta::specta]
pub async fn log_indoor_reading(
    pool: State<'_, SqlitePool>,
    mut input: NewIndoorReading,
) -> Result<IndoorReading, String> {
    // Auto-populate from latest matching sensor readings for the indoor location.
    if let Some(indoor_environment) =
        indoor::get_indoor_environment_by_id(&pool, input.indoor_environment_id)
            .await
            .map_err(|e| e.to_string())?
    {
        let location_id = indoor_environment.location_id;
        let location_sensors = sensors::list_all_active(&pool)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|s| s.location_id == Some(location_id))
            .collect::<Vec<_>>();

        for s in location_sensors {
            if let Some(reading) = sensors::get_latest_reading(&pool, s.id)
                .await
                .map_err(|e| e.to_string())?
            {
                indoor_service::apply_sensor_autofill(
                    &mut input,
                    match s.sensor_type {
                        crate::db::models::SensorType::Moisture => "moisture",
                        crate::db::models::SensorType::Light => "light",
                        crate::db::models::SensorType::Temperature => "temperature",
                        crate::db::models::SensorType::Humidity => "humidity",
                        crate::db::models::SensorType::Ph => "ph",
                        crate::db::models::SensorType::Ec => "ec",
                        crate::db::models::SensorType::Co2 => "co2",
                        crate::db::models::SensorType::AirQuality => "air_quality",
                        crate::db::models::SensorType::Custom => "custom",
                    },
                    reading.value,
                );
            }
        }
    }

    if input.vpd.is_none() {
        if let (Some(t), Some(h)) = (input.air_temp, input.air_humidity) {
            input.vpd = Some(indoor_service::calculate_vpd_kpa(t, h));
        }
    }

    let reading = indoor::record_indoor_reading(&pool, input)
        .await
        .map_err(|e| e.to_string())?;

    let _ =
        indoor_service::evaluate_indoor_alerts(&pool, reading.indoor_environment_id, &reading).await;

    Ok(reading)
}

#[tauri::command]
#[specta::specta]
pub async fn list_indoor_readings(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
    start: Option<String>,
    end: Option<String>,
) -> Result<Vec<IndoorReading>, String> {
    if start.is_none() && end.is_none() {
        return indoor::list_indoor_readings(&pool, indoor_env_id, 500)
            .await
            .map_err(|e| e.to_string());
    }

    let start_dt = match start {
        Some(s) => {
            let d = NaiveDate::parse_from_str(&s, "%Y-%m-%d")
                .map_err(|e| format!("Invalid start date: {e}"))?;
            d.and_hms_opt(0, 0, 0)
                .ok_or_else(|| "Invalid start date time".to_string())?
        }
        None => (Utc::now() - Duration::days(30)).naive_utc(),
    };

    let end_dt = match end {
        Some(s) => {
            let d = NaiveDate::parse_from_str(&s, "%Y-%m-%d")
                .map_err(|e| format!("Invalid end date: {e}"))?;
            d.and_hms_opt(23, 59, 59)
                .ok_or_else(|| "Invalid end date time".to_string())?
        }
        None => Utc::now().naive_utc(),
    };

    let mut rows = indoor::list_indoor_readings_since(&pool, indoor_env_id, start_dt)
        .await
        .map_err(|e| e.to_string())?;
    rows.retain(|r| r.recorded_at <= end_dt);
    Ok(rows)
}

#[tauri::command]
#[specta::specta]
pub async fn log_nutrient_addition(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
    additive_id: Option<i64>,
    amount: f64,
    unit: Option<String>,
) -> Result<IndoorNutrientLog, String> {
    indoor::log_nutrient_addition(&pool, indoor_env_id, additive_id, amount, unit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_nutrient_logs(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
) -> Result<Vec<IndoorNutrientLog>, String> {
    indoor::list_nutrient_logs(&pool, indoor_env_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn log_water_change(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
    volume_liters: Option<f64>,
    notes: Option<String>,
) -> Result<IndoorWaterChange, String> {
    let change = indoor::log_water_change(&pool, indoor_env_id, volume_liters, notes)
        .await
        .map_err(|e| e.to_string())?;

    let indoor_env = indoor::get_indoor_environment_by_id(&pool, indoor_env_id)
        .await
        .map_err(|e| e.to_string())?;
    if let Some(indoor_env) = indoor_env {
        let _ = indoor_service::create_indoor_issue(
            &pool,
            &indoor_env,
            "Indoor water change logged",
            "Water change was recorded for this indoor environment.".to_string(),
            &[("Indoor", "#6c757d"), ("Maintenance", "#2a9d8f")],
        )
        .await;
    }

    Ok(change)
}

#[tauri::command]
#[specta::specta]
pub async fn get_reservoir_status(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
) -> Result<ReservoirStatus, String> {
    indoor_service::get_reservoir_status(&pool, indoor_env_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_indoor_dashboard_summary(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
) -> Result<IndoorDashboardSummary, String> {
    indoor_service::indoor_dashboard_summary(&pool, indoor_env_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_indoor_reservoir_target(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
) -> Result<Option<IndoorReservoirTarget>, String> {
    indoor::get_reservoir_target(&pool, indoor_env_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_indoor_reservoir_target(
    pool: State<'_, SqlitePool>,
    indoor_env_id: i64,
    input: UpsertIndoorReservoirTarget,
) -> Result<IndoorReservoirTarget, String> {
    indoor::upsert_reservoir_target(&pool, indoor_env_id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn calculate_vpd(air_temp: f64, humidity: f64) -> f64 {
    indoor_service::calculate_vpd_kpa(air_temp, humidity)
}

#[tauri::command]
#[specta::specta]
pub fn calculate_dli(
    wattage: f64,
    light_type: Option<String>,
    distance_cm: f64,
    hours_on: f64,
) -> f64 {
    indoor_service::calculate_dli(wattage, light_type.as_deref(), distance_cm, hours_on)
}

#[tauri::command]
#[specta::specta]
pub fn list_grow_methods() -> Vec<GrowMethod> {
    vec![
        GrowMethod::Soil,
        GrowMethod::HydroponicDwc,
        GrowMethod::HydroponicNft,
        GrowMethod::HydroponicEbbFlow,
        GrowMethod::HydroponicDrip,
        GrowMethod::Aeroponic,
        GrowMethod::Aquaponic,
    ]
}
