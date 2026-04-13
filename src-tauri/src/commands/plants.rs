use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    models::{NewPlant, NewSeedlingObservation, Pagination, Plant, PlantStatus, SeedlingObservation, UpdatePlant},
    plants, seedling_observations,
};
use crate::services::{lifecycle, plant_category};

async fn resolve_plant_lifecycle(
    pool: &SqlitePool,
    plant: &Plant,
) -> Result<Option<String>, sqlx::Error> {
    if let Some(override_value) = plant.lifecycle_override.clone() {
        return Ok(Some(override_value));
    }

    if let Some(species_id) = plant.species_id {
        let growth_type = sqlx::query_scalar::<_, Option<String>>(
            "SELECT growth_type FROM species WHERE id = ?",
        )
        .bind(species_id)
        .fetch_optional(pool)
        .await?
        .flatten();
        return Ok(growth_type);
    }

    Ok(None)
}

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
    // Derive the category slug from the species' growth_type (if a species is
    // linked) and generate a unique asset ID for this plant.
    let growth_type: Option<String> = if let Some(sid) = input.species_id {
        sqlx::query_scalar::<_, Option<String>>("SELECT growth_type FROM species WHERE id = ?")
            .bind(sid)
            .fetch_optional(&*pool)
            .await
            .ok()
            .flatten()
            .flatten()
    } else {
        None
    };
    let asset_id = plant_category::generate_asset_id(growth_type.as_deref());
    plants::create_plant(&pool, input, Some(asset_id))
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

    let lifecycle_type = resolve_plant_lifecycle(&pool, &plant)
        .await
        .map_err(|e| e.to_string())?;

    lifecycle::validate_transition_with_lifecycle(
        &plant.status,
        &new_status,
        lifecycle_type.as_deref(),
    )?;

    plants::transition_plant_status(&pool, plant_id, &plant.status, new_status)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn mark_harvestable(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Plant, String> {
    plants::mark_harvestable(&pool, plant_id, true)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn unmark_harvestable(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Plant, String> {
    plants::mark_harvestable(&pool, plant_id, false)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn cycle_perennial_plant(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Plant, String> {
    let plant = plants::get_plant(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Plant {} not found", plant_id))?;

    let lifecycle_type = resolve_plant_lifecycle(&pool, &plant)
        .await
        .map_err(|e| e.to_string())?;

    if !lifecycle::is_perennial(lifecycle_type.as_deref()) {
        return Err("Only perennial plants can be cycled back to seedling stage".to_string());
    }

    plants::cycle_perennial_plant(&pool, plant_id)
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

// ---------------------------------------------------------------------------
// Canvas plant assignment
// ---------------------------------------------------------------------------

/// Assign an existing plant to a canvas space object, linking them in the DB.
/// Optionally also sets location_id if the space has a DB location record.
#[tauri::command]
#[specta::specta]
pub async fn assign_plant_to_canvas_object(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
    canvas_object_id: String,
    location_id: Option<i64>,
) -> Result<Plant, String> {
    plants::assign_plant_to_canvas_object(&pool, plant_id, &canvas_object_id, location_id)
        .await
        .map_err(|e| e.to_string())
}

/// Remove a plant's canvas object assignment without deleting the plant.
#[tauri::command]
#[specta::specta]
pub async fn unassign_plant_from_canvas_object(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Plant, String> {
    plants::unassign_plant_from_canvas_object(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())
}

/// Clear a plant's local garden assignment, removing both location_id and
/// canvas_object_id.
#[tauri::command]
#[specta::specta]
pub async fn clear_plant_local_assignment(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Plant, String> {
    plants::clear_plant_local_assignment(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())
}

/// Return all plants in an environment that are currently assigned to a canvas object.
#[tauri::command]
#[specta::specta]
pub async fn get_plants_for_canvas(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Plant>, String> {
    plants::get_plants_for_canvas(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}
