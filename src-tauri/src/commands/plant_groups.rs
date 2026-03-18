use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{NewPlantGroup, Pagination, Plant, PlantGroup, UpdatePlantGroup},
    plant_groups,
};

#[tauri::command]
#[specta::specta]
pub async fn list_plant_groups(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<PlantGroup>, String> {
    plant_groups::list_groups(
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
pub async fn get_plant_group(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<PlantGroup>, String> {
    plant_groups::get_group(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_plant_group(
    pool: State<'_, SqlitePool>,
    input: NewPlantGroup,
) -> Result<PlantGroup, String> {
    plant_groups::create_group(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_plant_group(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdatePlantGroup,
) -> Result<Option<PlantGroup>, String> {
    plant_groups::update_group(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_plant_group(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    plant_groups::delete_group(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn add_plant_to_group(
    pool: State<'_, SqlitePool>,
    group_id: i64,
    plant_id: i64,
) -> Result<(), String> {
    plant_groups::add_to_group(&pool, group_id, plant_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn remove_plant_from_group(
    pool: State<'_, SqlitePool>,
    group_id: i64,
    plant_id: i64,
) -> Result<bool, String> {
    plant_groups::remove_from_group(&pool, group_id, plant_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_plant_group_plants(
    pool: State<'_, SqlitePool>,
    group_id: i64,
) -> Result<Vec<Plant>, String> {
    plant_groups::list_group_plants(&pool, group_id)
        .await
        .map_err(|e| e.to_string())
}
