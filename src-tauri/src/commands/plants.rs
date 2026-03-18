use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{NewPlant, Pagination, Plant, PlantStatus, UpdatePlant},
    plants,
};

#[tauri::command]
#[specta::specta]
pub async fn list_plants(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Plant>, String> {
    plants::list_plants(
        &pool,
        environment_id,
        Pagination {
            limit: limit.unwrap_or(200),
            offset: offset.unwrap_or(0),
        },
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_all_plants(
    pool: State<'_, SqlitePool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Plant>, String> {
    plants::list_all_plants(
        &pool,
        Pagination {
            limit: limit.unwrap_or(200),
            offset: offset.unwrap_or(0),
        },
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_plants_by_species(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Plant>, String> {
    plants::list_plants_by_species(
        &pool,
        species_id,
        Pagination {
            limit: limit.unwrap_or(200),
            offset: offset.unwrap_or(0),
        },
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_plant(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Plant>, String> {
    plants::get_plant(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_plant(
    pool: State<'_, SqlitePool>,
    input: NewPlant,
) -> Result<Plant, String> {
    plants::create_plant(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_plant(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdatePlant,
) -> Result<Option<Plant>, String> {
    plants::update_plant(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_plant(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    plants::delete_plant(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn change_plant_status(
    pool: State<'_, SqlitePool>,
    id: i64,
    status: PlantStatus,
) -> Result<Option<Plant>, String> {
    plants::change_plant_status(&pool, id, status)
        .await
        .map_err(|e| e.to_string())
}
