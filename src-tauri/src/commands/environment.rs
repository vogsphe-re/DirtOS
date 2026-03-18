use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    environments,
    models::{Environment, NewEnvironment, Pagination, UpdateEnvironment},
};

#[tauri::command]
#[specta::specta]
pub async fn list_environments(pool: State<'_, SqlitePool>) -> Result<Vec<Environment>, String> {
    environments::list_environments(&pool, Pagination { limit: 500, offset: 0 })
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_environment(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Environment>, String> {
    environments::get_environment(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_environment(
    pool: State<'_, SqlitePool>,
    input: NewEnvironment,
) -> Result<Environment, String> {
    environments::create_environment(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_environment(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateEnvironment,
) -> Result<Option<Environment>, String> {
    environments::update_environment(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_environment(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    environments::delete_environment(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
