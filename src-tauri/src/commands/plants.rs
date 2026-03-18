use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{NewPlant, NewSeedlingObservation, Pagination, Plant, PlantStatus, SeedlingObservation, UpdatePlant},
    plants, seedling_observations,
};
use crate::services::lifecycle;

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

#[tauri::command]
#[specta::specta]
pub async fn transition_plant_status(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
    new_status: PlantStatus,
) -> Result<Plant, String> {
    let plant = plants::get_plant(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Plant {} not found", plant_id))?;

    lifecycle::validate_transition(&plant.status, &new_status)?;

    plants::transition_plant_status(&pool, plant_id, &plant.status, new_status)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_plants_by_status(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    status: PlantStatus,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Plant>, String> {
    plants::list_plants_by_status(
        &pool,
        environment_id,
        status,
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
pub async fn list_plants_by_location(
    pool: State<'_, SqlitePool>,
    location_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Plant>, String> {
    plants::list_plants_by_location(
        &pool,
        location_id,
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
pub async fn list_seedling_observations(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Vec<SeedlingObservation>, String> {
    seedling_observations::list_observations(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_seedling_observation(
    pool: State<'_, SqlitePool>,
    input: NewSeedlingObservation,
) -> Result<SeedlingObservation, String> {
    seedling_observations::create_observation(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_seedling_observation(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    seedling_observations::delete_observation(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
