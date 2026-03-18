use sqlx::SqlitePool;

use super::models::{Harvest, NewHarvest, Pagination, SeedLot};

pub async fn list_harvests(
    pool: &SqlitePool,
    plant_id: i64,
    pagination: Pagination,
) -> Result<Vec<Harvest>, sqlx::Error> {
    sqlx::query_as::<_, Harvest>(
        "SELECT * FROM harvests WHERE plant_id = ?
         ORDER BY harvest_date DESC LIMIT ? OFFSET ?",
    )
    .bind(plant_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_harvest(pool: &SqlitePool, id: i64) -> Result<Option<Harvest>, sqlx::Error> {
    sqlx::query_as::<_, Harvest>("SELECT * FROM harvests WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_harvest(
    pool: &SqlitePool,
    input: NewHarvest,
) -> Result<Harvest, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO harvests (plant_id, harvest_date, quantity, unit, quality_rating, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(input.plant_id)
    .bind(&input.harvest_date)
    .bind(input.quantity)
    .bind(&input.unit)
    .bind(input.quality_rating)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    get_harvest(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn delete_harvest(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM harvests WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Seed lots
// ---------------------------------------------------------------------------

pub async fn list_seed_lots(
    pool: &SqlitePool,
    pagination: Pagination,
) -> Result<Vec<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>(
        "SELECT * FROM seed_lots ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_seed_lot(pool: &SqlitePool, id: i64) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>("SELECT * FROM seed_lots WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_seed_lot(
    pool: &SqlitePool,
    parent_plant_id: Option<i64>,
    harvest_id: Option<i64>,
    lot_label: Option<String>,
    quantity: Option<f64>,
    viability_pct: Option<f64>,
    storage_location: Option<String>,
    collected_date: Option<String>,
    notes: Option<String>,
) -> Result<SeedLot, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO seed_lots
            (parent_plant_id, harvest_id, lot_label, quantity, viability_pct,
             storage_location, collected_date, notes)
         VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(parent_plant_id)
    .bind(harvest_id)
    .bind(&lot_label)
    .bind(quantity)
    .bind(viability_pct)
    .bind(&storage_location)
    .bind(&collected_date)
    .bind(&notes)
    .execute(pool)
    .await?;

    get_seed_lot(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}
