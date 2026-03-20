use tauri::State;

use crate::db::{self, models::{NewSeason, ReportData, Recommendation, Season}};
use crate::services::recommendations;

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_seasons(
    pool: State<'_, sqlx::SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Season>, String> {
    db::harvests::list_seasons(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_season(
    pool: State<'_, sqlx::SqlitePool>,
    input: NewSeason,
) -> Result<Season, String> {
    db::harvests::create_season(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_season(
    pool: State<'_, sqlx::SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    db::harvests::delete_season(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Report data
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn get_report_data(
    pool: State<'_, sqlx::SqlitePool>,
    environment_id: i64,
    report_type: String,
    date_from: Option<String>,
    date_to: Option<String>,
    location_id: Option<i64>,
) -> Result<ReportData, String> {
    let df = date_from.as_deref();
    let dt = date_to.as_deref();

    match report_type.as_str() {
        "harvest_by_species" => db::harvests::report_harvest_by_species(&pool, environment_id, df, dt)
            .await
            .map_err(|e| e.to_string()),

        "harvest_by_month" => db::harvests::report_harvest_by_month(&pool, environment_id, df, dt)
            .await
            .map_err(|e| e.to_string()),

        "issues_by_label" => db::harvests::report_issues_by_label(&pool, environment_id, df, dt)
            .await
            .map_err(|e| e.to_string()),

        "soil_ph_trend" => db::harvests::report_soil_ph_trend(&pool, environment_id, location_id, df, dt)
            .await
            .map_err(|e| e.to_string()),

        _ => Err(format!("Unknown report type: {}", report_type)),
    }
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn get_recommendations(
    pool: State<'_, sqlx::SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Recommendation>, String> {
    recommendations::get_recommendations(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}
