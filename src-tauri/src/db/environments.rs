use sqlx::SqlitePool;

use super::models::{Environment, NewEnvironment, Pagination, UpdateEnvironment};

pub async fn list_environments(
    pool: &SqlitePool,
    pagination: Pagination,
) -> Result<Vec<Environment>, sqlx::Error> {
    sqlx::query_as::<_, Environment>(
        "SELECT * FROM environments ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_environment(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<Environment>, sqlx::Error> {
    sqlx::query_as::<_, Environment>("SELECT * FROM environments WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_environment(
    pool: &SqlitePool,
    input: NewEnvironment,
) -> Result<Environment, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO environments (name, latitude, longitude, elevation_m, timezone, climate_zone)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&input.name)
    .bind(input.latitude)
    .bind(input.longitude)
    .bind(input.elevation_m)
    .bind(&input.timezone)
    .bind(&input.climate_zone)
    .execute(pool)
    .await?;

    get_environment(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_environment(
    pool: &SqlitePool,
    id: i64,
    input: UpdateEnvironment,
) -> Result<Option<Environment>, sqlx::Error> {
    sqlx::query(
        "UPDATE environments SET
            name         = COALESCE(?, name),
            latitude     = COALESCE(?, latitude),
            longitude    = COALESCE(?, longitude),
            elevation_m  = COALESCE(?, elevation_m),
            timezone     = COALESCE(?, timezone),
            climate_zone = COALESCE(?, climate_zone),
            updated_at   = datetime('now')
         WHERE id = ?",
    )
    .bind(input.name)
    .bind(input.latitude)
    .bind(input.longitude)
    .bind(input.elevation_m)
    .bind(input.timezone)
    .bind(input.climate_zone)
    .bind(id)
    .execute(pool)
    .await?;

    get_environment(pool, id).await
}

pub async fn delete_environment(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM environments WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
