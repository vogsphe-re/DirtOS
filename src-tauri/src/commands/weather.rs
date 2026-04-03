use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::db::{self, models::{WeatherAlertSettings, WeatherData}};
use crate::services::{weather, weather_alerts};

/// Retrieve weather for the given environment, using cache when valid.
#[tauri::command]
#[specta::specta]
pub async fn get_weather(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Option<WeatherData>, String> {
    weather::get_weather(&pool, environment_id, false).await
}

/// Force a fresh fetch from Open-Meteo, bypassing the cache.
/// Also evaluates weather-based alerts after a successful fetch.
#[tauri::command]
#[specta::specta]
pub async fn refresh_weather(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
    environment_id: i64,
) -> Result<Option<WeatherData>, String> {
    let data = weather::get_weather(&pool, environment_id, true).await?;

    if let Some(ref d) = data {
        weather_alerts::check_and_emit_alerts(&app, &pool, environment_id, d).await;
    }

    Ok(data)
}

/// Return the stored OpenWeather API key, or None if not set.
/// (Kept for backward compat; no longer required for Open-Meteo fetches.)
#[tauri::command]
#[specta::specta]
pub async fn get_weather_api_key(
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, String> {
    db::weather::get_setting(&pool, "openweather_api_key")
        .await
        .map_err(|e| e.to_string())
}

/// Persist the OpenWeather API key (used for radar tile overlays).
#[tauri::command]
#[specta::specta]
pub async fn set_weather_api_key(
    pool: State<'_, SqlitePool>,
    api_key: String,
) -> Result<(), String> {
    db::weather::set_setting(&pool, "openweather_api_key", &api_key)
        .await
        .map_err(|e| e.to_string())
}

/// Return the stored Trefle API token, or None if not set.
#[tauri::command]
#[specta::specta]
pub async fn get_trefle_api_key(
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, String> {
    db::weather::get_setting(&pool, "trefle_api_key")
        .await
        .map_err(|e| e.to_string())
}

/// Persist the Trefle API token in app_settings.
#[tauri::command]
#[specta::specta]
pub async fn set_trefle_api_key(
    pool: State<'_, SqlitePool>,
    api_key: String,
) -> Result<(), String> {
    db::weather::set_setting(&pool, "trefle_api_key", &api_key)
        .await
        .map_err(|e| e.to_string())
}

/// Return the current weather alert threshold settings.
#[tauri::command]
#[specta::specta]
pub async fn get_weather_alert_settings(
    pool: State<'_, SqlitePool>,
) -> Result<WeatherAlertSettings, String> {
    db::weather::get_alert_settings(&pool)
        .await
        .map_err(|e| e.to_string())
}

/// Update the weather alert threshold settings.
#[tauri::command]
#[specta::specta]
pub async fn set_weather_alert_settings(
    pool: State<'_, SqlitePool>,
    settings: WeatherAlertSettings,
) -> Result<(), String> {
    db::weather::set_alert_settings(&pool, &settings)
        .await
        .map_err(|e| e.to_string())
}
