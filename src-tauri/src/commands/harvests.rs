use tauri::State;

use crate::db::{self, models::{Harvest, HarvestSummary, NewHarvest, Pagination, SeedLot}};

// ---------------------------------------------------------------------------
// Harvests
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_harvests(
    pool: State<'_, sqlx::SqlitePool>,
    plant_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Harvest>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(100),
        offset: offset.unwrap_or(0),
    };
    db::harvests::list_harvests(&pool, plant_id, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_all_harvests(
    pool: State<'_, sqlx::SqlitePool>,
    environment_id: i64,
    date_from: Option<String>,
    date_to: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Harvest>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(200),
        offset: offset.unwrap_or(0),
    };
    db::harvests::list_all_harvests(
        &pool,
        environment_id,
        date_from.as_deref(),
        date_to.as_deref(),
        pagination,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_harvest(
    pool: State<'_, sqlx::SqlitePool>,
    input: NewHarvest,
) -> Result<Harvest, String> {
    db::harvests::create_harvest(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_harvest(
    pool: State<'_, sqlx::SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    db::harvests::delete_harvest(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_harvest_summary(
    pool: State<'_, sqlx::SqlitePool>,
    plant_id: i64,
) -> Result<Option<HarvestSummary>, String> {
    db::harvests::get_harvest_summary(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Seed lots
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_seed_lots(
    pool: State<'_, sqlx::SqlitePool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<SeedLot>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(100),
        offset: offset.unwrap_or(0),
    };
    db::harvests::list_seed_lots(&pool, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_seed_lot(
    pool: State<'_, sqlx::SqlitePool>,
    id: i64,
) -> Result<Option<SeedLot>, String> {
    db::harvests::get_seed_lot(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_seed_lot(
    pool: State<'_, sqlx::SqlitePool>,
    parent_plant_id: Option<i64>,
    harvest_id: Option<i64>,
    lot_label: Option<String>,
    quantity: Option<f64>,
    viability_pct: Option<f64>,
    storage_location: Option<String>,
    collected_date: Option<String>,
    notes: Option<String>,
) -> Result<SeedLot, String> {
    db::harvests::create_seed_lot(
        &pool,
        parent_plant_id,
        harvest_id,
        lot_label,
        quantity,
        viability_pct,
        storage_location,
        collected_date,
        notes,
    )
    .await
    .map_err(|e| e.to_string())
}
