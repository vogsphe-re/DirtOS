use chrono::NaiveDateTime;
use sqlx::SqlitePool;

use super::models::{WeatherAlertSettings, WeatherCache};

pub async fn get_cache(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Option<WeatherCache>, sqlx::Error> {
    sqlx::query_as::<_, WeatherCache>(
        "SELECT * FROM weather_cache WHERE environment_id = ?",
    )
    .bind(environment_id)
    .fetch_optional(pool)
    .await
}

pub async fn upsert_cache(
    pool: &SqlitePool,
    environment_id: i64,
    forecast_json: &str,
    valid_until: NaiveDateTime,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO weather_cache (environment_id, forecast_json, fetched_at, valid_until)
         VALUES (?, ?, datetime('now'), ?)
         ON CONFLICT(environment_id) DO UPDATE SET
             forecast_json = excluded.forecast_json,
             fetched_at    = excluded.fetched_at,
             valid_until   = excluded.valid_until",
    )
    .bind(environment_id)
    .bind(forecast_json)
    .bind(valid_until)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>, sqlx::Error> {
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT value FROM app_settings WHERE key = ?")
            .bind(key)
            .fetch_optional(pool)
            .await?;
    Ok(row.and_then(|(v,)| v))
}

pub async fn set_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
             value      = excluded.value,
             updated_at = excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

const ALERT_SETTINGS_KEY: &str = "weather_alert_settings";

pub async fn get_alert_settings(pool: &SqlitePool) -> Result<WeatherAlertSettings, sqlx::Error> {
    let json = get_setting(pool, ALERT_SETTINGS_KEY).await?;
    if let Some(v) = json {
        if let Ok(s) = serde_json::from_str::<WeatherAlertSettings>(&v) {
            return Ok(s);
        }
    }
    Ok(WeatherAlertSettings {
        heat_max_c: 38.0,
        frost_min_c: 0.0,
        wind_max_ms: 15.0,
        precip_prob_threshold: 0.0,
        alerts_enabled: true,
    })
}

pub async fn set_alert_settings(
    pool: &SqlitePool,
    settings: &WeatherAlertSettings,
) -> Result<(), sqlx::Error> {
    let json = serde_json::to_string(settings).unwrap_or_default();
    set_setting(pool, ALERT_SETTINGS_KEY, &json).await
}
