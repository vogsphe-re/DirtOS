use sqlx::SqlitePool;

use super::models::{CanvasState, Location, Pagination};

// ---------------------------------------------------------------------------
// Canvas state persistence
// ---------------------------------------------------------------------------

pub async fn save_canvas(
    pool: &SqlitePool,
    environment_id: i64,
    canvas_json: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO canvas_states (environment_id, canvas_json, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(environment_id) DO UPDATE SET
             canvas_json = excluded.canvas_json,
             updated_at  = excluded.updated_at",
    )
    .bind(environment_id)
    .bind(canvas_json)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn load_canvas(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Option<CanvasState>, sqlx::Error> {
    sqlx::query_as::<_, CanvasState>(
        "SELECT * FROM canvas_states WHERE environment_id = ?",
    )
    .bind(environment_id)
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------------
// Location CRUD (plots, spaces, and other canvas locations)
// ---------------------------------------------------------------------------

pub async fn list_locations_for_env(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<Location>, sqlx::Error> {
    sqlx::query_as::<_, Location>(
        "SELECT * FROM locations WHERE environment_id = ? ORDER BY name ASC",
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await
}

pub use super::locations::{
    create_location, delete_location, get_location, list_child_locations, list_locations_by_type,
    update_location,
};

#[allow(dead_code)]
pub async fn list_locations(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<Location>, sqlx::Error> {
    super::locations::list_locations(pool, environment_id, pagination).await
}
