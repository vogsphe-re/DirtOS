use sqlx::SqlitePool;

use super::models::{
    AssignTrayCell, NewSeedlingTray, SeedlingTray, SeedlingTrayCell, UpdateSeedlingTray,
};

// ---------------------------------------------------------------------------
// Trays
// ---------------------------------------------------------------------------

pub async fn list_trays(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<SeedlingTray>, sqlx::Error> {
    sqlx::query_as::<_, SeedlingTray>(
        "SELECT * FROM seedling_trays WHERE environment_id = ? ORDER BY name ASC",
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await
}

pub async fn get_tray(pool: &SqlitePool, id: i64) -> Result<Option<SeedlingTray>, sqlx::Error> {
    sqlx::query_as::<_, SeedlingTray>("SELECT * FROM seedling_trays WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_tray(
    pool: &SqlitePool,
    input: NewSeedlingTray,
) -> Result<SeedlingTray, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO seedling_trays (environment_id, name, rows, cols, cell_size_cm, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(&input.name)
    .bind(input.rows)
    .bind(input.cols)
    .bind(input.cell_size_cm)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    get_tray(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_tray(
    pool: &SqlitePool,
    id: i64,
    input: UpdateSeedlingTray,
) -> Result<Option<SeedlingTray>, sqlx::Error> {
    sqlx::query(
        "UPDATE seedling_trays SET
            name         = COALESCE(?, name),
            rows         = COALESCE(?, rows),
            cols         = COALESCE(?, cols),
            cell_size_cm = COALESCE(?, cell_size_cm),
            notes        = COALESCE(?, notes),
            updated_at   = datetime('now')
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(input.rows)
    .bind(input.cols)
    .bind(input.cell_size_cm)
    .bind(&input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_tray(pool, id).await
}

pub async fn delete_tray(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM seedling_trays WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

pub async fn list_tray_cells(
    pool: &SqlitePool,
    tray_id: i64,
) -> Result<Vec<SeedlingTrayCell>, sqlx::Error> {
    sqlx::query_as::<_, SeedlingTrayCell>(
        "SELECT * FROM seedling_tray_cells WHERE tray_id = ? ORDER BY row ASC, col ASC",
    )
    .bind(tray_id)
    .fetch_all(pool)
    .await
}

/// Assign (or clear) a plant in a tray cell. Uses INSERT OR REPLACE
/// so that calling it for the same (tray, row, col) is idempotent.
pub async fn assign_tray_cell(
    pool: &SqlitePool,
    input: AssignTrayCell,
) -> Result<SeedlingTrayCell, sqlx::Error> {
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
    .bind(input.plant_id)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    // For UPSERT, query by the unique key rather than last_insert_rowid.
    sqlx::query_as::<_, SeedlingTrayCell>(
        "SELECT * FROM seedling_tray_cells WHERE tray_id = ? AND row = ? AND col = ?",
    )
    .bind(input.tray_id)
    .bind(input.row)
    .bind(input.col)
    .fetch_one(pool)
    .await
}

pub async fn clear_tray_cell(
    pool: &SqlitePool,
    tray_id: i64,
    row: i64,
    col: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query(
        "DELETE FROM seedling_tray_cells WHERE tray_id = ? AND row = ? AND col = ?",
    )
    .bind(tray_id)
    .bind(row)
    .bind(col)
    .execute(pool)
    .await?;
    Ok(result.rows_affected() > 0)
}
