use sqlx::SqlitePool;

use super::models::{JournalEntry, NewJournalEntry, Pagination, UpdateJournalEntry};

pub async fn list_entries(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<JournalEntry>, sqlx::Error> {
    sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE environment_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_entries_by_plant(
    pool: &SqlitePool,
    plant_id: i64,
    pagination: Pagination,
) -> Result<Vec<JournalEntry>, sqlx::Error> {
    sqlx::query_as::<_, JournalEntry>(
        "SELECT * FROM journal_entries WHERE plant_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(plant_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_entry(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<JournalEntry>, sqlx::Error> {
    sqlx::query_as::<_, JournalEntry>("SELECT * FROM journal_entries WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_entry(
    pool: &SqlitePool,
    input: NewJournalEntry,
) -> Result<JournalEntry, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO journal_entries
            (environment_id, plant_id, location_id, title, body, conditions_json)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(input.plant_id)
    .bind(input.location_id)
    .bind(&input.title)
    .bind(&input.body)
    .bind(&input.conditions_json)
    .execute(pool)
    .await?;

    get_entry(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_entry(
    pool: &SqlitePool,
    id: i64,
    input: UpdateJournalEntry,
) -> Result<Option<JournalEntry>, sqlx::Error> {
    sqlx::query(
        "UPDATE journal_entries SET
            title           = COALESCE(?, title),
            body            = COALESCE(?, body),
            conditions_json = COALESCE(?, conditions_json),
            updated_at      = datetime('now')
         WHERE id = ?",
    )
    .bind(input.title)
    .bind(input.body)
    .bind(input.conditions_json)
    .bind(id)
    .execute(pool)
    .await?;

    get_entry(pool, id).await
}

pub async fn delete_entry(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM journal_entries WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
