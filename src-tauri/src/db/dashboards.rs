use sqlx::SqlitePool;

use crate::db::models::{Dashboard, NewDashboard, UpdateDashboard};

pub async fn list_dashboards(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<Dashboard>, sqlx::Error> {
    sqlx::query_as::<_, Dashboard>(
        "SELECT * FROM dashboards WHERE environment_id = ? ORDER BY is_default DESC, created_at ASC",
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await
}

pub async fn get_dashboard(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<Dashboard>, sqlx::Error> {
    sqlx::query_as::<_, Dashboard>("SELECT * FROM dashboards WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_dashboard(
    pool: &SqlitePool,
    input: NewDashboard,
) -> Result<Dashboard, sqlx::Error> {
    let id = sqlx::query(
        "INSERT INTO dashboards (environment_id, name, description, template_key, layout_json, is_default)
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(input.environment_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.template_key)
    .bind(&input.layout_json)
    .bind(input.is_default)
    .execute(pool)
    .await?
    .last_insert_rowid();

    get_dashboard(pool, id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_dashboard(
    pool: &SqlitePool,
    id: i64,
    input: UpdateDashboard,
) -> Result<Dashboard, sqlx::Error> {
    sqlx::query(
        "UPDATE dashboards
         SET name        = COALESCE(?, name),
             description = COALESCE(?, description),
             layout_json = COALESCE(?, layout_json),
             is_default  = COALESCE(?, is_default),
             updated_at  = datetime('now')
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.layout_json)
    .bind(input.is_default)
    .bind(id)
    .execute(pool)
    .await?;

    get_dashboard(pool, id).await?.ok_or(sqlx::Error::RowNotFound)
}

pub async fn delete_dashboard(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let rows = sqlx::query("DELETE FROM dashboards WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(rows > 0)
}
