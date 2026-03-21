use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::Instant;

use crate::db::{self, models::{IssuePriority, IssueStatus, NewIssue, SensorConnectionType, SensorLimit}};
use super::build_driver;

// ---------------------------------------------------------------------------
// Shared poller state (sensor_id → task handle)
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub struct PollEntry {
    handle: JoinHandle<()>,
}

pub type PollerState = Arc<Mutex<HashMap<i64, PollEntry>>>;

type BufferedReading = (f64, Option<String>, chrono::NaiveDateTime);

// ---------------------------------------------------------------------------
// Public entry-point: called once on app startup
// ---------------------------------------------------------------------------

pub async fn start(app: AppHandle, pool: SqlitePool) {
    let state: PollerState = Arc::new(Mutex::new(HashMap::new()));
    app.manage(state.clone());

    let sensors = match db::sensors::list_all_active(&pool).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Sensor poller: failed to load active sensors: {:?}", e);
            return;
        }
    };

    let mut locked = state.lock().await;
    for sensor in sensors {
        let interval = sensor.poll_interval_seconds.unwrap_or(60);
        let handle = spawn_sensor_task(app.clone(), pool.clone(), sensor.id, interval);
        locked.insert(sensor.id, PollEntry { handle });
    }
}

// ---------------------------------------------------------------------------
// Runtime control: start/stop a single sensor poller
// ---------------------------------------------------------------------------

pub async fn restart_sensor(app: &AppHandle, pool: &SqlitePool, sensor_id: i64) {
    let Some(state) = app.try_state::<PollerState>() else {
        return;
    };

    let sensor = match db::sensors::get_sensor(pool, sensor_id).await {
        Ok(Some(s)) => s,
        _ => return,
    };

    let mut locked = state.lock().await;
    if let Some(entry) = locked.remove(&sensor_id) {
        entry.handle.abort();
    }

    if sensor.is_active {
        let interval = sensor.poll_interval_seconds.unwrap_or(60);
        let handle = spawn_sensor_task(app.clone(), pool.clone(), sensor_id, interval);
        locked.insert(sensor_id, PollEntry { handle });
    }
}

// ---------------------------------------------------------------------------
// Spawn a polling loop for one sensor
// ---------------------------------------------------------------------------

fn spawn_sensor_task(
    app: AppHandle,
    pool: SqlitePool,
    sensor_id: i64,
    poll_interval_secs: i64,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        let base_interval = Duration::from_secs(poll_interval_secs.max(5) as u64);
        let debounce = Duration::from_secs(3_600); // 1 h between repeated alerts
        let mut backoff = base_interval;
        let mut last_alert_at: Option<Instant> = None;
        let mut buffered_readings: Vec<BufferedReading> = Vec::new();

        loop {
            // Exit gracefully if the sensor was deactivated or removed
            match db::sensors::get_sensor(&pool, sensor_id).await {
                Ok(Some(s)) if !s.is_active => {
                    let _ = flush_buffer(&pool, sensor_id, &mut buffered_readings).await;
                    break;
                }
                Ok(None) => {
                    let _ = flush_buffer(&pool, sensor_id, &mut buffered_readings).await;
                    break;
                }
                Err(e) => {
                    tracing::warn!("Sensor {}: DB error checking status: {:?}", sensor_id, e);
                }
                _ => {}
            }

            match poll_once(&app, &pool, sensor_id, &mut last_alert_at, debounce).await {
                Ok(reading) => {
                    buffered_readings.push(reading);
                    if buffered_readings.len() >= 10 {
                        if let Err(error) = flush_buffer(&pool, sensor_id, &mut buffered_readings).await {
                            tracing::warn!("Sensor {}: batch flush error: {}", sensor_id, error);
                        }
                    }
                    backoff = base_interval;
                }
                Err(e) => {
                    tracing::warn!("Sensor {}: read error: {}", sensor_id, e);
                    backoff = (backoff * 2).min(Duration::from_secs(300));
                }
            }

            tokio::time::sleep(backoff).await;
        }
    })
}

// ---------------------------------------------------------------------------
// One poll cycle
// ---------------------------------------------------------------------------

async fn poll_once(
    app: &AppHandle,
    pool: &SqlitePool,
    sensor_id: i64,
    last_alert_at: &mut Option<Instant>,
    debounce: Duration,
) -> Result<BufferedReading, String> {
    let sensor = db::sensors::get_sensor(pool, sensor_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Sensor not found".to_string())?;

    // Manual sensors are skipped — users enter values via UI
    if sensor.connection_type == SensorConnectionType::Manual {
        return Err("Manual sensors are not polled automatically".to_string());
    }

    let driver = build_driver(&sensor);
    let reading = driver.read().await.map_err(|e| e.to_string())?;

    // Prefer the unit from the limits config as a canonical unit
    let limits_opt = db::sensors::get_limits(pool, sensor_id)
        .await
        .ok()
        .flatten();
    let unit = reading
        .unit
        .or_else(|| limits_opt.as_ref().and_then(|l| l.unit.clone()));
    let recorded_at = Utc::now().naive_utc();

    let _ = app.emit(
        "sensor:reading",
        serde_json::json!({
            "sensorId": sensor_id,
            "sensor_id": sensor_id,
            "value": reading.value,
            "unit": unit,
            "timestamp": recorded_at.to_string(),
        }),
    );

    // Limit check with debounce
    if let Some(limits) = limits_opt {
        if limits.alert_enabled {
            let breached = limits.min_value.map_or(false, |min| reading.value < min)
                || limits.max_value.map_or(false, |max| reading.value > max);

            if breached {
                let should_alert = last_alert_at
                    .map_or(true, |t| t.elapsed() >= debounce);

                if should_alert {
                    create_limit_breach_issue(app, pool, sensor_id, reading.value, &limits).await;
                    *last_alert_at = Some(Instant::now());
                }
            }
        }
    }

    Ok((reading.value, unit, recorded_at))
}

async fn flush_buffer(
    pool: &SqlitePool,
    sensor_id: i64,
    buffered_readings: &mut Vec<BufferedReading>,
) -> Result<(), String> {
    if buffered_readings.is_empty() {
        return Ok(());
    }

    db::sensors::record_readings_batch(pool, sensor_id, buffered_readings)
        .await
        .map_err(|e| e.to_string())?;
    buffered_readings.clear();
    Ok(())
}

// ---------------------------------------------------------------------------
// Create an issue + fire an event on a limit breach
// ---------------------------------------------------------------------------

async fn create_limit_breach_issue(
    app: &AppHandle,
    pool: &SqlitePool,
    sensor_id: i64,
    value: f64,
    limits: &SensorLimit,
) {
    let sensor = match db::sensors::get_sensor(pool, sensor_id).await {
        Ok(Some(s)) => s,
        _ => return,
    };

    let description = if limits.min_value.map_or(false, |min| value < min) {
        format!(
            "Sensor '{}' reading {:.2} is below the minimum threshold of {:.2}.",
            sensor.name,
            value,
            limits.min_value.unwrap()
        )
    } else {
        format!(
            "Sensor '{}' reading {:.2} exceeds the maximum threshold of {:.2}.",
            sensor.name,
            value,
            limits.max_value.unwrap_or(f64::MAX)
        )
    };

    let new_issue = NewIssue {
        environment_id: sensor.environment_id,
        plant_id: sensor.plant_id,
        location_id: sensor.location_id,
        title: format!("Sensor Alert: {}", sensor.name),
        description: Some(description.clone()),
        status: Some(IssueStatus::Open),
        priority: Some(IssuePriority::High),
    };

    let issue = match db::issues::create_issue(pool, new_issue).await {
        Ok(i) => i,
        Err(e) => {
            tracing::warn!("Sensor {}: failed to create alert issue: {:?}", sensor_id, e);
            return;
        }
    };

    // Assign "Sensor Alert" label if it exists
    if let Ok(labels) = db::issues::list_labels(pool).await {
        if let Some(label) = labels.iter().find(|l| l.name == "Sensor Alert") {
            let _ = db::issues::add_label_to_issue(pool, issue.id, label.id).await;
        }
    }

    let _ = app.emit(
        "sensor:limit_breach",
        serde_json::json!({
            "sensor_id": sensor_id,
            "sensor_name": sensor.name,
            "value": value,
            "issue_id": issue.id,
            "description": description,
        }),
    );
}
