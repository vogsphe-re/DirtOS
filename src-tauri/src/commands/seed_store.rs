use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{NewSeedLot, Pagination, SeedLot, SowSeedInput, UpdateSeedLot},
    seed_store,
};

#[tauri::command]
#[specta::specta]
pub async fn list_seed_store(
    pool: State<'_, SqlitePool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<SeedLot>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(200),
        offset: offset.unwrap_or(0),
    };
    seed_store::list_seed_store(&pool, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_seed_store_item(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<SeedLot>, String> {
    seed_store::get_seed_lot(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_seed_store_item(
    pool: State<'_, SqlitePool>,
    input: NewSeedLot,
) -> Result<SeedLot, String> {
    seed_store::create_seed_lot(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_seed_store_item(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateSeedLot,
) -> Result<Option<SeedLot>, String> {
    seed_store::update_seed_lot(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_seed_store_item(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    seed_store::delete_seed_lot(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sow_seed_to_tray(
    pool: State<'_, SqlitePool>,
    input: SowSeedInput,
) -> Result<i64, String> {
    seed_store::sow_seed_to_tray(&pool, input)
        .await
        .map_err(|e| e.to_string())
}
