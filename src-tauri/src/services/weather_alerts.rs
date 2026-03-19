use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

use crate::db::{
    self,
    models::{IssuePriority, IssueStatus, NewIssue, WeatherData},
};

const FROST_THRESHOLD_C: f64 = 0.0;
const HEAT_THRESHOLD_C: f64 = 38.0;

/// Evaluate a fresh `WeatherData` payload against plant tolerances.
/// Creates issues and emits `weather:alert` events for triggered conditions.
pub async fn check_and_emit_alerts(
    app: &AppHandle,
    pool: &SqlitePool,
    environment_id: i64,
    data: &WeatherData,
) {
    let mut alerts: Vec<(String, String)> = Vec::new(); // (title, description)

    // --- Frost warning ---
    let min_temp = data
        .hourly
        .iter()
        .map(|h| h.temperature_c)
        .chain(data.daily.iter().map(|d| d.temp_min_c))
        .fold(f64::MAX, f64::min);

    if min_temp <= FROST_THRESHOLD_C {
        alerts.push((
            "Frost Warning".to_string(),
            format!(
                "Temperatures as low as {:.1}°C forecast. Protect frost-sensitive plants.",
                min_temp
            ),
        ));
    }

    // --- Heat warning ---
    let max_temp = data
        .hourly
        .iter()
        .map(|h| h.temperature_c)
        .chain(data.daily.iter().map(|d| d.temp_max_c))
        .fold(f64::MIN, f64::max);

    if max_temp >= HEAT_THRESHOLD_C {
        alerts.push((
            "Extreme Heat Warning".to_string(),
            format!(
                "Temperatures up to {:.1}°C forecast. Ensure adequate watering and shade.",
                max_temp
            ),
        ));
    }

    // --- Storm warning (keyword match in descriptions) ---
    let storm_keywords = ["thunderstorm", "tornado", "hurricane", "storm", "hail"];
    let has_storm = data
        .hourly
        .iter()
        .map(|h| h.description.to_lowercase())
        .chain(data.daily.iter().map(|d| d.description.to_lowercase()))
        .any(|desc| storm_keywords.iter().any(|kw| desc.contains(kw)));

    if has_storm {
        alerts.push((
            "Severe Weather Warning".to_string(),
            "Severe weather conditions (storm/hail) forecast. Protect plants and equipment."
                .to_string(),
        ));
    }

    for (title, description) in alerts {
        // Create an issue
        let issue_input = NewIssue {
            environment_id: Some(environment_id),
            plant_id: None,
            location_id: None,
            title: title.clone(),
            description: Some(description.clone()),
            status: Some(IssueStatus::New),
            priority: Some(IssuePriority::High),
        };

        match db::issues::create_issue(pool, issue_input).await {
            Ok(issue) => {
                tracing::info!("Weather alert issue created: {} (id={})", issue.title, issue.id);

                // Try to tag with "Weather Warning" label (best-effort)
                if let Ok(labels) = db::issues::list_labels(pool).await {
                    if let Some(label) = labels.iter().find(|l| l.name == "Weather Warning") {
                        let _ = db::issues::add_label_to_issue(pool, issue.id, label.id).await;
                    }
                }

                // Desktop notification (best-effort)
                let _ = app
                    .notification()
                    .builder()
                    .title("DirtOS Weather Alert")
                    .body(&description)
                    .show();

                // Tauri event for the NotificationCenter
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
