use sqlx::SqlitePool;
use tauri::{Emitter, State};

use crate::db::{self, models::{NewSensor, NewSoilTest, Pagination, Sensor, SensorLimit, SensorReading, SoilTest, UpdateSensor}};
use crate::services::sensors::poller;

// ---------------------------------------------------------------------------
// Sensor CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_sensors(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Sensor>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(100),
        offset: offset.unwrap_or(0),
    };
    db::sensors::list_sensors(&pool, environment_id, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_sensor(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Sensor>, String> {
    db::sensors::get_sensor(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_sensor(
    pool: State<'_, SqlitePool>,
    app: tauri::AppHandle,
    input: NewSensor,
) -> Result<Sensor, String> {
    let sensor = db::sensors::create_sensor(&pool, input)
        .await
        .map_err(|e| e.to_string())?;

    // Start polling immediately if active
    if sensor.is_active {
        poller::restart_sensor(&app, &pool, sensor.id).await;
    }

    Ok(sensor)
}

#[tauri::command]
#[specta::specta]
pub async fn update_sensor(
    pool: State<'_, SqlitePool>,
    app: tauri::AppHandle,
    id: i64,
    input: UpdateSensor,
) -> Result<Option<Sensor>, String> {
    let sensor = db::sensors::update_sensor(&pool, id, input)
        .await
        .map_err(|e| e.to_string())?;

    // Restart polling with possibly new interval / active state
    poller::restart_sensor(&app, &pool, id).await;

    Ok(sensor)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_sensor(
    pool: State<'_, SqlitePool>,
    app: tauri::AppHandle,
    id: i64,
) -> Result<bool, String> {
    // Stop the poll task first
    db::sensors::set_sensor_active(&pool, id, false)
        .await
        .map_err(|e| e.to_string())?;
    poller::restart_sensor(&app, &pool, id).await;

    db::sensors::delete_sensor(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn start_sensor(
    pool: State<'_, SqlitePool>,
    app: tauri::AppHandle,
    id: i64,
) -> Result<(), String> {
    db::sensors::set_sensor_active(&pool, id, true)
        .await
        .map_err(|e| e.to_string())?;
    poller::restart_sensor(&app, &pool, id).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_sensor(
    pool: State<'_, SqlitePool>,
    app: tauri::AppHandle,
    id: i64,
) -> Result<(), String> {
    db::sensors::set_sensor_active(&pool, id, false)
        .await
        .map_err(|e| e.to_string())?;
    poller::restart_sensor(&app, &pool, id).await;
    Ok(())
}

// ---------------------------------------------------------------------------
// Sensor readings
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_sensor_readings(
    pool: State<'_, SqlitePool>,
    sensor_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<SensorReading>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(200),
        offset: offset.unwrap_or(0),
    };
    db::sensors::list_readings(&pool, sensor_id, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_latest_reading(
    pool: State<'_, SqlitePool>,
    sensor_id: i64,
) -> Result<Option<SensorReading>, String> {
    db::sensors::get_latest_reading(&pool, sensor_id)
        .await
        .map_err(|e| e.to_string())
}

/// Record a manual reading (used when connection_type == Manual).
#[tauri::command]
#[specta::specta]
pub async fn record_manual_reading(
    pool: State<'_, SqlitePool>,
    app: tauri::AppHandle,
    sensor_id: i64,
    value: f64,
    unit: Option<String>,
) -> Result<SensorReading, String> {
    let reading = db::sensors::record_reading(&pool, sensor_id, value, unit)
        .await
        .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "sensor:reading",
        serde_json::json!({
            "sensor_id": sensor_id,
            "value": reading.value,
            "unit": reading.unit,
            "timestamp": reading.recorded_at.to_string(),
        }),
    );

    Ok(reading)
}

// ---------------------------------------------------------------------------
// Sensor limits
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn get_sensor_limits(
    pool: State<'_, SqlitePool>,
    sensor_id: i64,
) -> Result<Option<SensorLimit>, String> {
    db::sensors::get_limits(&pool, sensor_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn set_sensor_limits(
    pool: State<'_, SqlitePool>,
    sensor_id: i64,
    min_value: Option<f64>,
    max_value: Option<f64>,
    unit: Option<String>,
    alert_enabled: bool,
) -> Result<SensorLimit, String> {
    db::sensors::upsert_limits(&pool, sensor_id, min_value, max_value, unit, alert_enabled)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Soil tests
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn create_soil_test(
    pool: State<'_, SqlitePool>,
    input: NewSoilTest,
) -> Result<SoilTest, String> {
    db::sensors::create_soil_test(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_soil_tests(
    pool: State<'_, SqlitePool>,
    location_id: i64,
) -> Result<Vec<SoilTest>, String> {
    db::sensors::list_soil_tests(&pool, location_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_soil_test(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    db::sensors::delete_soil_test(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
