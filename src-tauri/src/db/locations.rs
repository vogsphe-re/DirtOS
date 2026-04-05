use sqlx::SqlitePool;

use super::models::{Location, NewLocation, Pagination, UpdateLocation};
use crate::services::asset_tag;

pub async fn list_locations(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<Location>, sqlx::Error> {
    sqlx::query_as::<_, Location>(
        "SELECT * FROM locations WHERE environment_id = ? ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_child_locations(
    pool: &SqlitePool,
    parent_id: i64,
) -> Result<Vec<Location>, sqlx::Error> {
    sqlx::query_as::<_, Location>(
        "SELECT * FROM locations WHERE parent_id = ? ORDER BY name ASC",
    )
    .bind(parent_id)
    .fetch_all(pool)
    .await
}

pub async fn get_location(pool: &SqlitePool, id: i64) -> Result<Option<Location>, sqlx::Error> {
    sqlx::query_as::<_, Location>("SELECT * FROM locations WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_location(
    pool: &SqlitePool,
    input: NewLocation,
) -> Result<Location, sqlx::Error> {
    // Serialise the LocationType to its snake_case DB value to pick the prefix.
    let type_str = serde_json::to_string(&input.location_type)
        .unwrap_or_default()
        .trim_matches('"')
        .to_string();
    let prefix = asset_tag::prefix_for_location_type(&type_str);
    let tag = asset_tag::generate_tag(prefix);
    let result = sqlx::query(
        "INSERT INTO locations
            (environment_id, parent_id, type, name, label,
             position_x, position_y, width, height, canvas_data_json, notes, asset_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(input.parent_id)
    .bind(&input.location_type)
    .bind(&input.name)
    .bind(&input.label)
    .bind(input.position_x)
    .bind(input.position_y)
    .bind(input.width)
    .bind(input.height)
    .bind(&input.canvas_data_json)
    .bind(&input.notes)
    .bind(&tag)
    .execute(pool)
    .await?;

    get_location(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_location(
    pool: &SqlitePool,
    id: i64,
    input: UpdateLocation,
) -> Result<Option<Location>, sqlx::Error> {
    sqlx::query(
        "UPDATE locations SET
            parent_id        = COALESCE(?, parent_id),
            type             = COALESCE(?, type),
            name             = COALESCE(?, name),
            label            = COALESCE(?, label),
            position_x       = COALESCE(?, position_x),
            position_y       = COALESCE(?, position_y),
            width            = COALESCE(?, width),
            height           = COALESCE(?, height),
            canvas_data_json = COALESCE(?, canvas_data_json),
            notes            = COALESCE(?, notes),
            updated_at       = datetime('now')
         WHERE id = ?",
    )
    .bind(input.parent_id)
    .bind(input.location_type)
    .bind(input.name)
    .bind(input.label)
    .bind(input.position_x)
    .bind(input.position_y)
    .bind(input.width)
    .bind(input.height)
    .bind(input.canvas_data_json)
    .bind(input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_location(pool, id).await
}

pub async fn delete_location(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM locations WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
