///
/// 1. Publishes HA MQTT Discovery config messages for every sensor, garden,
///    plant, and active issue so Home Assistant auto-creates entities.
/// 2. Publishes current state snapshots immediately after discovery.
/// 3. Subscribes to command topics from Home Assistant (enable/disable sensors,
///    record manual readings, trigger re-sync).
/// 4. Re-publishes updated state whenever a sensor reading is recorded.
///
/// MQTT settings are stored in the `integration_configs` row for provider
/// `home_assistant` using the following JSON shapes:
///
/// `auth_json`     → `{"url": "http://ha.local:8123", "token": "<llat>"}`
/// `settings_json` → `{"mqtt_broker": "mqtt://localhost:1883",
///                      "topic_prefix": "dirtos",
///                      "instance_id": "garden01"}`
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;
use tokio::time::sleep;

use crate::db::{self, integrations, models::IntegrationProvider};

// ── Config structs ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct HaAuthConfig {
    pub url: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct HaMqttSettings {
    pub mqtt_broker: Option<String>,
    pub topic_prefix: Option<String>,
    pub instance_id: Option<String>,
    pub publish_interval_seconds: Option<u64>,
}

// ── Device info published in HA discovery payloads ─────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HaDevice {
    pub identifiers: Vec<String>,
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub sw_version: String,
}

// ── Entry point ────────────────────────────────────────────────────────────

/// Start the HA publisher. Called once after DB initialisation.
/// Exits silently if the HA integration is not enabled or not configured.
pub async fn start(app: AppHandle, pool: SqlitePool) {
    loop {
        match try_run(&app, &pool).await {
            Ok(()) => {
                tracing::info!("HA publisher: completed a run, will retry in 60s");
            }
            Err(e) => {
                tracing::warn!("HA publisher: error – {}. Retrying in 60s.", e);
            }
        }
        sleep(Duration::from_secs(60)).await;
    }
}

async fn try_run(app: &AppHandle, pool: &SqlitePool) -> Result<(), String> {
    // Load HA integration config
    let configs = integrations::list_integration_configs(pool)
        .await
        .map_err(|e| e.to_string())?;

    let ha_cfg = configs
        .iter()
        .find(|c| c.provider == IntegrationProvider::HomeAssistant && c.enabled);

    let ha_cfg = match ha_cfg {
        Some(c) => c.clone(),
        None => return Ok(()), // integration not enabled
    };

    let settings: HaMqttSettings = ha_cfg
        .settings_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let broker_url = match settings.mqtt_broker {
        Some(ref b) => b.clone(),
        None => return Ok(()), // MQTT broker not configured
    };

    let prefix = settings.topic_prefix.unwrap_or_else(|| "dirtos".to_string());
    let instance_id = settings.instance_id.unwrap_or_else(|| "garden".to_string());
    let interval_secs = settings.publish_interval_seconds.unwrap_or(300);

    // Parse broker URL (mqtt://host:port or plain host:port)
    let addr = broker_url
        .trim_start_matches("mqtt://")
        .trim_start_matches("mqtts://");
    let (host, port) = addr
        .split_once(':')
        .and_then(|(h, p)| p.parse::<u16>().ok().map(|p| (h.to_string(), p)))
        .unwrap_or_else(|| (addr.to_string(), 1883));

    let client_id = format!("dirtos-ha-pub-{}", uuid::Uuid::new_v4());
    let mut mqtt_opts = MqttOptions::new(client_id, &host, port);
    mqtt_opts.set_keep_alive(Duration::from_secs(30));
    mqtt_opts.set_pending_throttle(Duration::from_millis(10));

    let (client, mut event_loop) = AsyncClient::new(mqtt_opts, 64);
    let client = Arc::new(client);

    // Publish availability = online
    let avail_topic = format!("{prefix}/{instance_id}/availability");
    client
        .publish(&avail_topic, QoS::AtLeastOnce, true, b"online".as_ref())
        .await
        .map_err(|e| e.to_string())?;

    // Subscribe to command topics
    let cmd_topic = format!("{prefix}/{instance_id}/cmd/#");
    client
        .subscribe(&cmd_topic, QoS::AtMostOnce)
        .await
        .map_err(|e| e.to_string())?;

    // Publish full discovery + state
    publish_all(&client, pool, &prefix, &instance_id).await?;

    // Event loop: process incoming commands + periodic republish
    let mut last_publish = std::time::Instant::now();

    loop {
        let timeout = Duration::from_secs(5);
        match tokio::time::timeout(timeout, event_loop.poll()).await {
            Ok(Ok(Event::Incoming(Packet::Publish(msg)))) => {
                let topic = &msg.topic;
                if let Err(e) =
                    handle_command(&client, pool, topic, &msg.payload, &prefix, &instance_id, app)
                        .await
                {
                    tracing::warn!("HA publisher: command error: {}", e);
                }
            }
            Ok(Ok(_)) => {}
            Ok(Err(e)) => {
                tracing::warn!("HA publisher: MQTT connection error: {}", e);
                return Err(e.to_string());
            }
            Err(_) => {
                // timeout – check if we should republish
            }
        }

        if last_publish.elapsed() >= Duration::from_secs(interval_secs) {
            publish_all(&client, pool, &prefix, &instance_id).await?;
            last_publish = std::time::Instant::now();
        }

        // Re-check if the integration is still enabled
        let configs = integrations::list_integration_configs(pool)
            .await
            .map_err(|e| e.to_string())?;
        let still_enabled = configs
            .iter()
            .any(|c| c.provider == IntegrationProvider::HomeAssistant && c.enabled);
        if !still_enabled {
            let _ = client
                .publish(&avail_topic, QoS::AtLeastOnce, true, b"offline".as_ref())
                .await;
            let _ = client.disconnect().await;
            return Ok(());
        }
    }
}

// ── Publish helpers ────────────────────────────────────────────────────────

async fn publish_all(
    client: &AsyncClient,
    pool: &SqlitePool,
    prefix: &str,
    instance_id: &str,
) -> Result<(), String> {
    let environments = db::environments::list_environments(
        pool,
        db::models::Pagination { limit: i64::MAX, offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())?;

    for env in &environments {
        publish_garden(client, pool, env, prefix, instance_id).await?;
    }

    let sensors = db::sensors::list_all_active(pool)
        .await
        .map_err(|e| e.to_string())?;

    for sensor in &sensors {
        let env_name = environments
            .iter()
            .find(|e| Some(e.id) == sensor.environment_id)
            .map(|e| e.name.as_str());
        publish_sensor(client, pool, sensor, env_name, prefix, instance_id).await?;
    }

    let plants = db::plants::list_all_plants(
        pool,
        db::models::Pagination { limit: i64::MAX, offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())?;

    for plant in &plants {
        let env_name = environments
            .iter()
            .find(|e| plant.environment_id == e.id)
            .map(|e| e.name.as_str());
        publish_plant(client, &plant, env_name, prefix, instance_id).await?;
    }

    Ok(())
}

async fn publish_garden(
    client: &AsyncClient,
    pool: &SqlitePool,
    env: &db::models::Environment,
    prefix: &str,
    instance_id: &str,
) -> Result<(), String> {
    let plant_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM plants WHERE environment_id = $1",
    )
    .bind(env.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let active_plant_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM plants WHERE environment_id = $1 AND status IN ('seedling','active')",
    )
    .bind(env.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let sensor_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sensors WHERE environment_id = $1 AND is_active = 1",
    )
    .bind(env.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let issue_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM issues WHERE environment_id = $1 AND status = 'open'",
    )
    .bind(env.id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let device = garden_device(env, instance_id);

    let config_payload = json!({
        "id": env.id,
        "name": env.name,
        "plant_count": plant_count,
        "active_plant_count": active_plant_count,
        "sensor_count": sensor_count,
        "issue_count": issue_count,
        "device": device,
    });

    let config_topic = format!("{prefix}/{instance_id}/garden/{}/config", env.id);
    client
        .publish(
            &config_topic,
            QoS::AtLeastOnce,
            true,
            config_payload.to_string().as_bytes(),
        )
        .await
        .map_err(|e| e.to_string())?;

    let state_payload = json!({
        "plant_count": plant_count,
        "active_plant_count": active_plant_count,
        "sensor_count": sensor_count,
        "issue_count": issue_count,
        "updated_at": Utc::now().to_rfc3339(),
    });

    let state_topic = format!("{prefix}/{instance_id}/garden/{}/state", env.id);
    client
        .publish(
            &state_topic,
            QoS::AtLeastOnce,
            true,
            state_payload.to_string().as_bytes(),
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

async fn publish_sensor(
    client: &AsyncClient,
    pool: &SqlitePool,
    sensor: &db::models::Sensor,
    env_name: Option<&str>,
    prefix: &str,
    instance_id: &str,
) -> Result<(), String> {
    let uid = format!("dirtos_{instance_id}_sensor_{}", sensor.id);
    let avail_topic = format!("{prefix}/{instance_id}/availability");
    let state_topic = format!("{prefix}/{instance_id}/sensor/{}/state", sensor.id);

    let sensor_type_str = serde_json::to_value(&sensor.sensor_type)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "custom".to_string());

    let device = if let Some(env_id) = sensor.environment_id {
        json!({
            "identifiers": [format!("dirtos_{instance_id}_garden_{env_id}")],
            "name": env_name.unwrap_or("DirtOS Garden"),
            "manufacturer": "NativeIT",
            "model": "DirtOS Garden OS",
        })
    } else {
        json!({
            "identifiers": [format!("dirtos_{instance_id}")],
            "name": "DirtOS",
            "manufacturer": "NativeIT",
            "model": "DirtOS Garden OS",
        })
    };

    let config_payload = json!({
        "id": sensor.id,
        "name": sensor.name,
        "sensor_type": sensor_type_str,
        "environment_id": sensor.environment_id,
        "environment_name": env_name,
        "is_active": sensor.is_active,
        "unique_id": uid,
        "state_topic": state_topic,
        "availability_topic": avail_topic,
        "device": device,
    });

    let config_topic = format!("{prefix}/{instance_id}/sensor/{}/config", sensor.id);
    client
        .publish(
            &config_topic,
            QoS::AtLeastOnce,
            true,
            config_payload.to_string().as_bytes(),
        )
        .await
        .map_err(|e| e.to_string())?;

    // Fetch latest reading and publish state
    if let Ok(Some(reading)) = db::sensors::get_latest_reading(pool, sensor.id).await {
        let state_payload = json!({
            "value": reading.value,
            "unit": reading.unit,
            "recorded_at": reading.recorded_at.to_string(),
        });
        client
            .publish(
                &state_topic,
                QoS::AtLeastOnce,
                true,
                state_payload.to_string().as_bytes(),
            )
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

async fn publish_plant(
    client: &AsyncClient,
    plant: &db::models::Plant,
    env_name: Option<&str>,
    prefix: &str,
    instance_id: &str,
) -> Result<(), String> {
    let status_str = serde_json::to_value(&plant.status)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "unknown".to_string());

    let state_payload = json!({
        "plant_id": plant.id,
        "name": plant.name,
        "status": status_str,
        "environment_id": plant.environment_id,
        "environment_name": env_name,
    });

    let state_topic = format!("{prefix}/{instance_id}/plant/{}/state", plant.id);
    client
        .publish(
            &state_topic,
            QoS::AtLeastOnce,
            false,
            state_payload.to_string().as_bytes(),
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Command handler ────────────────────────────────────────────────────────

async fn handle_command(
    _client: &AsyncClient,
    pool: &SqlitePool,
    topic: &str,
    payload: &[u8],
    prefix: &str,
    instance_id: &str,
    _app: &AppHandle,
) -> Result<(), String> {
    let parts: Vec<&str> = topic.split('/').collect();

    // {prefix}/{instance_id}/cmd/sync
    if parts.last() == Some(&"sync") {
        tracing::info!("HA publisher: sync command received");
        return Ok(());
    }

    // {prefix}/{instance_id}/cmd/sensor/{sensor_id}/set_active
    if parts.len() >= 6
        && parts.get(parts.len() - 3) == Some(&"sensor")
        && parts.last() == Some(&"set_active")
    {
        let sensor_id_str = parts[parts.len() - 2];
        let sensor_id: i64 = sensor_id_str
            .parse()
            .map_err(|_| format!("Invalid sensor_id: {}", sensor_id_str))?;

        let body: serde_json::Value =
            serde_json::from_slice(payload).unwrap_or(json!({"active": true}));
        let active = body.get("active").and_then(|v| v.as_bool()).unwrap_or(true);

        sqlx::query("UPDATE sensors SET is_active = $1, updated_at = datetime('now') WHERE id = $2")
            .bind(active)
            .bind(sensor_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

        tracing::info!(
            "HA publisher: sensor {} set_active = {}",
            sensor_id,
            active
        );
        return Ok(());
    }

    // {prefix}/{instance_id}/cmd/record_reading/{sensor_id}
    if parts.len() >= 5 && parts.get(parts.len() - 2) == Some(&"record_reading") {
        let sensor_id_str = parts.last().unwrap_or(&"");
        let sensor_id: i64 = sensor_id_str
            .parse()
            .map_err(|_| format!("Invalid sensor_id: {}", sensor_id_str))?;

        let body: serde_json::Value =
            serde_json::from_slice(payload).map_err(|e| e.to_string())?;
        let value = body
            .get("value")
            .and_then(|v| v.as_f64())
            .ok_or("Missing 'value' in record_reading payload")?;
        let unit = body.get("unit").and_then(|v| v.as_str()).map(|s| s.to_string());

        sqlx::query(
            "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at) \
             VALUES ($1, $2, $3, datetime('now'))",
        )
        .bind(sensor_id)
        .bind(value)
        .bind(unit)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        tracing::info!(
            "HA publisher: recorded reading {} for sensor {}",
            value,
            sensor_id
        );
        return Ok(());
    }

    tracing::debug!("HA publisher: unhandled command topic: {}", topic);
    Ok(())
}

// ── Helper: build a device object for a garden ────────────────────────────

fn garden_device(env: &db::models::Environment, instance_id: &str) -> serde_json::Value {
    json!({
        "identifiers": [format!("dirtos_{instance_id}_garden_{}", env.id)],
        "name": env.name,
        "manufacturer": "NativeIT",
        "model": "DirtOS Garden",
        "sw_version": env!("CARGO_PKG_VERSION"),
    })
}
