use sqlx::SqlitePool;

use super::models::{NewPlant, Pagination, Plant, PlantStatus, UpdatePlant};

pub async fn list_plants(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT * FROM plants WHERE environment_id = ? ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_plants_by_status(
    pool: &SqlitePool,
    environment_id: i64,
    status: PlantStatus,
    pagination: Pagination,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT * FROM plants WHERE environment_id = ? AND status = ?
         ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(status)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_plants_by_location(
    pool: &SqlitePool,
    location_id: i64,
    pagination: Pagination,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT * FROM plants WHERE location_id = ? ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(location_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_plant(pool: &SqlitePool, id: i64) -> Result<Option<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>("SELECT * FROM plants WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_plant(
    pool: &SqlitePool,
    input: NewPlant,
    asset_id: Option<String>,
) -> Result<Plant, sqlx::Error> {
    let status = input.status.unwrap_or(PlantStatus::Planned);
    let result = sqlx::query(
        "INSERT INTO plants
            (species_id, location_id, environment_id, status, name, label, asset_id,
             planted_date, notes, canvas_object_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.species_id)
    .bind(input.location_id)
    .bind(input.environment_id)
    .bind(status)
    .bind(&input.name)
    .bind(&input.label)
    .bind(&asset_id)
    .bind(&input.planted_date)
    .bind(&input.notes)
    .bind(&input.canvas_object_id)
    .execute(pool)
    .await?;

    get_plant(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_plant(
    pool: &SqlitePool,
    id: i64,
    input: UpdatePlant,
) -> Result<Option<Plant>, sqlx::Error> {
    sqlx::query(
        "UPDATE plants SET
            species_id        = COALESCE(?, species_id),
            location_id       = COALESCE(?, location_id),
            status            = COALESCE(?, status),
            name              = COALESCE(?, name),
            label             = COALESCE(?, label),
            planted_date      = COALESCE(?, planted_date),
            germinated_date   = COALESCE(?, germinated_date),
            transplanted_date = COALESCE(?, transplanted_date),
            removed_date      = COALESCE(?, removed_date),
            parent_plant_id   = COALESCE(?, parent_plant_id),
            seed_lot_id       = COALESCE(?, seed_lot_id),
            purchase_source   = COALESCE(?, purchase_source),
            purchase_date     = COALESCE(?, purchase_date),
            purchase_price    = COALESCE(?, purchase_price),
            notes             = COALESCE(?, notes),
            updated_at        = datetime('now')
         WHERE id = ?",
    )
    .bind(input.species_id)
    .bind(input.location_id)
    .bind(input.status)
    .bind(input.name)
    .bind(input.label)
    .bind(input.planted_date)
    .bind(input.germinated_date)
    .bind(input.transplanted_date)
    .bind(input.removed_date)
    .bind(input.parent_plant_id)
    .bind(input.seed_lot_id)
    .bind(input.purchase_source)
    .bind(input.purchase_date)
    .bind(input.purchase_price)
    .bind(input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_plant(pool, id).await
}

pub async fn delete_plant(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM plants WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// List all plants across every environment.
pub async fn list_all_plants(
    pool: &SqlitePool,
    pagination: Pagination,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT * FROM plants ORDER BY environment_id ASC, name ASC LIMIT ? OFFSET ?",
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

/// List plants belonging to a particular species.
pub async fn list_plants_by_species(
    pool: &SqlitePool,
    species_id: i64,
    pagination: Pagination,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT * FROM plants WHERE species_id = ? ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(species_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

/// Validated lifecycle transition — auto-stamps date fields.
pub async fn transition_plant_status(
    pool: &SqlitePool,
    id: i64,
    from: &PlantStatus,
    to: PlantStatus,
) -> Result<Plant, sqlx::Error> {
    match (&from, &to) {
        (_, PlantStatus::Seedling) => {
            sqlx::query(
                "UPDATE plants SET status = ?, germinated_date = COALESCE(germinated_date, date('now')), updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&to)
            .bind(id)
            .execute(pool)
            .await?;
        }
        (PlantStatus::Seedling, PlantStatus::Active) => {
            sqlx::query(
                "UPDATE plants SET status = ?, transplanted_date = COALESCE(transplanted_date, date('now')), updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&to)
            .bind(id)
            .execute(pool)
            .await?;
        }
        (_, PlantStatus::Active) => {
            // planned → active (direct sow): stamp planted_date
            sqlx::query(
                "UPDATE plants SET status = ?, planted_date = COALESCE(planted_date, date('now')), updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&to)
            .bind(id)
            .execute(pool)
            .await?;
        }
        (_, PlantStatus::Harvested) | (_, PlantStatus::Removed) | (_, PlantStatus::Dead) => {
            sqlx::query(
                "UPDATE plants SET status = ?, removed_date = COALESCE(removed_date, date('now')), updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&to)
            .bind(id)
            .execute(pool)
            .await?;
        }
        _ => {
            sqlx::query(
                "UPDATE plants SET status = ?, updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&to)
            .bind(id)
            .execute(pool)
            .await?;
        }
    }

    get_plant(pool, id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

/// Assign a plant to a canvas object UUID, optionally also setting location_id.
pub async fn assign_plant_to_canvas_object(
    pool: &SqlitePool,
    plant_id: i64,
    canvas_object_id: &str,
    location_id: Option<i64>,
) -> Result<Plant, sqlx::Error> {
    sqlx::query(
        "UPDATE plants
         SET canvas_object_id = ?,
             location_id = COALESCE(?, location_id),
             updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(canvas_object_id)
    .bind(location_id)
    .bind(plant_id)
    .execute(pool)
    .await?;

    get_plant(pool, plant_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

/// Remove a plant's canvas object assignment (does not clear location_id).
pub async fn unassign_plant_from_canvas_object(
    pool: &SqlitePool,
    plant_id: i64,
) -> Result<Plant, sqlx::Error> {
    sqlx::query(
        "UPDATE plants SET canvas_object_id = NULL, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(plant_id)
    .execute(pool)
    .await?;

    get_plant(pool, plant_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

/// Return all plants in an environment that are assigned to a canvas object.
pub async fn get_plants_for_canvas(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT * FROM plants WHERE environment_id = ? AND canvas_object_id IS NOT NULL",
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await
}

pub async fn change_plant_status(
    pool: &SqlitePool,
    id: i64,
    status: PlantStatus,
) -> Result<Option<Plant>, sqlx::Error> {
    let removed_date: Option<&str> = match status {
        PlantStatus::Harvested | PlantStatus::Removed | PlantStatus::Dead => {
            Some("date('now')")
        }
        _ => None,
    };
    if removed_date.is_some() {
        sqlx::query(
            "UPDATE plants SET status = ?, removed_date = date('now'), updated_at = datetime('now') WHERE id = ?",
        )
        .bind(&status)
        .bind(id)
        .execute(pool)
        .await?;
    } else {
        sqlx::query(
            "UPDATE plants SET status = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(&status)
        .bind(id)
        .execute(pool)
        .await?;
    }
    get_plant(pool, id).await
}
