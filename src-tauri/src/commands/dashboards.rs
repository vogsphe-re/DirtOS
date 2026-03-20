use tauri::State;

use crate::db::{self, models::{Dashboard, NewDashboard, UpdateDashboard}};

#[tauri::command]
#[specta::specta]
pub async fn list_dashboards(
    pool: State<'_, sqlx::SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Dashboard>, String> {
    db::dashboards::list_dashboards(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_dashboard(
    pool: State<'_, sqlx::SqlitePool>,
    id: i64,
) -> Result<Option<Dashboard>, String> {
    db::dashboards::get_dashboard(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_dashboard(
    pool: State<'_, sqlx::SqlitePool>,
    input: NewDashboard,
) -> Result<Dashboard, String> {
    db::dashboards::create_dashboard(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_dashboard(
    pool: State<'_, sqlx::SqlitePool>,
    id: i64,
    input: UpdateDashboard,
) -> Result<Dashboard, String> {
    db::dashboards::update_dashboard(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_dashboard(
    pool: State<'_, sqlx::SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    db::dashboards::delete_dashboard(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
