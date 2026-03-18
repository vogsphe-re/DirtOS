use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    canvas,
    models::{Location, NewLocation, UpdateLocation},
};

// ---------------------------------------------------------------------------
// Canvas state
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn save_canvas(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    canvas_json: String,
) -> Result<(), String> {
    canvas::save_canvas(&pool, environment_id, &canvas_json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn load_canvas(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Option<String>, String> {
    canvas::load_canvas(&pool, environment_id)
        .await
        .map(|opt| opt.map(|s| s.canvas_json))
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Location CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_locations(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Location>, String> {
    canvas::list_locations_for_env(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_location(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Location>, String> {
    canvas::get_location(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_location(
    pool: State<'_, SqlitePool>,
    input: NewLocation,
) -> Result<Location, String> {
    canvas::create_location(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_location(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateLocation,
) -> Result<Option<Location>, String> {
    canvas::update_location(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_location(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    canvas::delete_location(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_child_locations(
    pool: State<'_, SqlitePool>,
    parent_id: i64,
) -> Result<Vec<Location>, String> {
    canvas::list_child_locations(&pool, parent_id)
        .await
        .map_err(|e| e.to_string())
}
