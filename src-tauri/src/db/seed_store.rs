use sqlx::SqlitePool;

use super::models::{
    NewSeedLot, Pagination, SeedLot, SowSeedInput, UpdateSeedLot,
};
use crate::services::asset_tag;

pub async fn list_seed_store(
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
    input: NewSeedLot,
) -> Result<SeedLot, sqlx::Error> {
    let source_type = input.source_type.unwrap_or_else(|| "purchased".to_string());
    let tag = asset_tag::generate_tag("SED");
    let result = sqlx::query(
        "INSERT INTO seed_lots
            (species_id, parent_plant_id, harvest_id, lot_label, quantity,
             viability_pct, storage_location, collected_date,
             source_type, vendor, purchase_date, expiration_date, packet_info, notes, asset_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.species_id)
    .bind(input.parent_plant_id)
    .bind(input.harvest_id)
    .bind(&input.lot_label)
    .bind(input.quantity)
    .bind(input.viability_pct)
    .bind(&input.storage_location)
    .bind(&input.collected_date)
    .bind(&source_type)
    .bind(&input.vendor)
    .bind(&input.purchase_date)
    .bind(&input.expiration_date)
    .bind(&input.packet_info)
    .bind(&input.notes)
    .bind(&tag)
    .execute(pool)
    .await?;

    get_seed_lot(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_seed_lot(
    pool: &SqlitePool,
    id: i64,
    input: UpdateSeedLot,
) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query(
        "UPDATE seed_lots SET
            species_id       = COALESCE(?, species_id),
            lot_label        = COALESCE(?, lot_label),
            quantity         = COALESCE(?, quantity),
            viability_pct    = COALESCE(?, viability_pct),
            storage_location = COALESCE(?, storage_location),
            collected_date   = COALESCE(?, collected_date),
            source_type      = COALESCE(?, source_type),
            vendor           = COALESCE(?, vendor),
            purchase_date    = COALESCE(?, purchase_date),
            expiration_date  = COALESCE(?, expiration_date),
            packet_info      = COALESCE(?, packet_info),
            notes            = COALESCE(?, notes),
            updated_at       = datetime('now')
         WHERE id = ?",
    )
    .bind(input.species_id)
    .bind(&input.lot_label)
    .bind(input.quantity)
    .bind(input.viability_pct)
    .bind(&input.storage_location)
    .bind(&input.collected_date)
    .bind(&input.source_type)
    .bind(&input.vendor)
    .bind(&input.purchase_date)
    .bind(&input.expiration_date)
    .bind(&input.packet_info)
    .bind(&input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_seed_lot(pool, id).await
}

pub async fn delete_seed_lot(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM seed_lots WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Sow a seed from a lot into a seedling tray cell.
/// Creates a new plant with Seedling status, assigns it to the tray cell,
/// and decrements the seed lot quantity by 1.
pub async fn sow_seed_to_tray(
    pool: &SqlitePool,
    input: SowSeedInput,
) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Fetch seed lot to get species_id and verify it exists with quantity > 0
    let lot = sqlx::query_as::<_, SeedLot>("SELECT * FROM seed_lots WHERE id = ?")
        .bind(input.seed_lot_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    let current_qty = lot.quantity.unwrap_or(0.0);
    if current_qty <= 0.0 {
        return Err(sqlx::Error::Protocol("Seed lot has no remaining quantity".into()));
    }

    // Get the tray to find its environment_id
    let tray_env: (i64,) =
        sqlx::query_as("SELECT environment_id FROM seedling_trays WHERE id = ?")
            .bind(input.tray_id)
            .fetch_one(&mut *tx)
            .await?;

    // Build a plant name
    let plant_name = input.plant_name.unwrap_or_else(|| {
        format!("Seedling from {}", lot.lot_label.as_deref().unwrap_or("seed lot"))
    });

    // Create the plant with Seedling status
    let plant_result = sqlx::query(
        "INSERT INTO plants (species_id, environment_id, status, name, seed_lot_id, planted_date, notes)
         VALUES (?, ?, 'seedling', ?, ?, date('now'), ?)",
    )
    .bind(lot.species_id)
    .bind(tray_env.0)
    .bind(&plant_name)
    .bind(lot.id)
    .bind(&input.notes)
    .execute(&mut *tx)
    .await?;

    let plant_id = plant_result.last_insert_rowid();

    // Assign the plant to the tray cell (upsert)
    sqlx::query(
        "INSERT INTO seedling_tray_cells (tray_id, row, col, plant_id, notes)
         VALUES (?,?,?,?,?)
         ON CONFLICT(tray_id, row, col) DO UPDATE SET
            plant_id   = excluded.plant_id,
            notes      = excluded.notes,
            updated_at = datetime('now')",
    )
    .bind(input.tray_id)
    .bind(input.row)
    .bind(input.col)
    .bind(plant_id)
    .bind(&input.notes)
    .execute(&mut *tx)
    .await?;

    // Decrement the seed lot quantity
    sqlx::query(
        "UPDATE seed_lots SET quantity = quantity - 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(input.seed_lot_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(plant_id)
}
