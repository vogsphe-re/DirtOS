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

pub async fn create_plant(pool: &SqlitePool, input: NewPlant) -> Result<Plant, sqlx::Error> {
    let status = input.status.unwrap_or(PlantStatus::Planned);
    let result = sqlx::query(
        "INSERT INTO plants
            (species_id, location_id, environment_id, status, name, label, planted_date, notes)
         VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(input.species_id)
    .bind(input.location_id)
    .bind(input.environment_id)
    .bind(status)
    .bind(&input.name)
    .bind(&input.label)
    .bind(&input.planted_date)
    .bind(&input.notes)
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
