use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{AssignTrayCell, NewSeedlingTray, SeedlingTray, SeedlingTrayCell, UpdateSeedlingTray},
    seedling_trays,
};

#[tauri::command]
#[specta::specta]
pub async fn list_seedling_trays(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<SeedlingTray>, String> {
    seedling_trays::list_trays(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_seedling_tray(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<SeedlingTray>, String> {
    seedling_trays::get_tray(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_seedling_tray(
    pool: State<'_, SqlitePool>,
    input: NewSeedlingTray,
) -> Result<SeedlingTray, String> {
    seedling_trays::create_tray(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_seedling_tray(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateSeedlingTray,
) -> Result<Option<SeedlingTray>, String> {
    seedling_trays::update_tray(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_seedling_tray(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    seedling_trays::delete_tray(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_seedling_tray_cells(
    pool: State<'_, SqlitePool>,
    tray_id: i64,
) -> Result<Vec<SeedlingTrayCell>, String> {
    seedling_trays::list_tray_cells(&pool, tray_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn assign_seedling_tray_cell(
    pool: State<'_, SqlitePool>,
    input: AssignTrayCell,
) -> Result<SeedlingTrayCell, String> {
    seedling_trays::assign_tray_cell(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn clear_seedling_tray_cell(
    pool: State<'_, SqlitePool>,
    tray_id: i64,
    row: i64,
    col: i64,
) -> Result<bool, String> {
    seedling_trays::clear_tray_cell(&pool, tray_id, row, col)
        .await
        .map_err(|e| e.to_string())
}
