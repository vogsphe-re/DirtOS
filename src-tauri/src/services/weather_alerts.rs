use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

use crate::db::{
    self,
    models::{IssuePriority, IssueStatus, NewIssue, WeatherData},
};

/// Evaluate a fresh `WeatherData` payload against configurable thresholds.
/// Creates issues and emits `weather:alert` events for triggered conditions.
pub async fn check_and_emit_alerts(
    app: &AppHandle,
    pool: &SqlitePool,
    environment_id: i64,
    data: &WeatherData,
) {
    // Load alert settings from DB (uses defaults if not configured)
    let settings = match db::weather::get_alert_settings(pool).await {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("Failed to load weather alert settings: {}", e);
            return;
        }
    };

    if !settings.alerts_enabled {
        return;
    }

    let mut alerts: Vec<(String, String, IssuePriority)> = Vec::new();

    // --- Frost warning ---
    let min_temp = data
        .hourly
        .iter()
        .map(|h| h.temperature_c)
        .chain(data.daily.iter().map(|d| d.temp_min_c))
        .fold(f64::MAX, f64::min);

    if min_temp <= settings.frost_min_c {
        alerts.push((
            "Frost Warning".to_string(),
            format!(
                "Temperatures as low as {:.1}°C forecast. Protect frost-sensitive plants.",
                min_temp
            ),
            IssuePriority::High,
        ));
    }

    // --- Heat warning ---
    if settings.heat_max_c > 0.0 {
        let max_temp = data
            .hourly
            .iter()
            .map(|h| h.temperature_c)
            .chain(data.daily.iter().map(|d| d.temp_max_c))
            .fold(f64::MIN, f64::max);

        if max_temp >= settings.heat_max_c {
            alerts.push((
                "Extreme Heat Warning".to_string(),
                format!(
                    "Temperatures up to {:.1}°C forecast. Ensure adequate watering and shade.",
                    max_temp
                ),
                IssuePriority::High,
            ));
        }
    }

    // --- High wind warning ---
    if settings.wind_max_ms > 0.0 {
        let max_wind = data
            .hourly
            .iter()
            .map(|h| h.wind_speed_ms)
            .chain(data.daily.iter().filter_map(|d| d.wind_speed_max_ms))
            .fold(f64::MIN, f64::max);

        if max_wind >= settings.wind_max_ms {
            alerts.push((
                "High Wind Warning".to_string(),
                format!(
                    "Wind speeds up to {:.1} m/s ({:.0} km/h) forecast. Secure stakes, covers, and structures.",
                    max_wind,
                    max_wind * 3.6
                ),
                IssuePriority::Medium,
            ));
        }
    }

    // --- High precipitation probability ---
    if settings.precip_prob_threshold > 0.0 {
        let max_prob = data
            .daily
            .iter()
            .filter_map(|d| d.precipitation_prob)
            .fold(f64::MIN, f64::max);

        if max_prob >= settings.precip_prob_threshold {
            alerts.push((
                "Heavy Rain Expected".to_string(),
                format!(
                    "Precipitation probability up to {:.0}%. Check drainage and row covers.",
                    max_prob * 100.0
                ),
                IssuePriority::Medium,
            ));
        }
    }

    // --- Storm warning (keyword match) ---
    let storm_keywords = ["thunderstorm", "hail", "violent"];
    let has_storm = data
        .hourly
        .iter()
        .map(|h| h.description.to_lowercase())
        .chain(data.daily.iter().map(|d| d.description.to_lowercase()))
        .any(|desc| storm_keywords.iter().any(|kw| desc.contains(kw)));

    if has_storm {
        alerts.push((
            "Severe Weather Warning".to_string(),
            "Severe weather (storm/hail) forecast. Protect plants and equipment.".to_string(),
            IssuePriority::High,
        ));
    }

    for (title, description, priority) in alerts {
        let issue_input = NewIssue {
            environment_id: Some(environment_id),
            plant_id: None,
            location_id: None,
            title: title.clone(),
            description: Some(description.clone()),
            status: Some(IssueStatus::New),
            priority: Some(priority),
        };

        match db::issues::create_issue(pool, issue_input).await {
            Ok(issue) => {
                tracing::info!("Weather alert issue created: {} (id={})", issue.title, issue.id);

                if let Ok(labels) = db::issues::list_labels(pool).await {
                    if let Some(label) = labels.iter().find(|l| l.name == "Weather Warning") {
                        let _ = db::issues::add_label_to_issue(pool, issue.id, label.id).await;
                    }
                }

                let _ = app
                    .notification()
                    .builder()
                    .title("DirtOS Weather Alert")
                    .body(&description)
                    .show();

                let _ = app.emit(
                    "weather:alert",
                    serde_json::json!({
                        "issue_id": issue.id,
                        "title": title,
                        "body": description,
                    }),
                );
            }
            Err(e) => {
                tracing::warn!("Failed to create weather alert issue: {}", e);
            }
        }
    }
}
