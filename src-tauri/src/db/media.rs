use sqlx::SqlitePool;

use super::models::{Media, NewMedia};

pub async fn create_media(pool: &SqlitePool, input: NewMedia) -> Result<Media, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO media
            (entity_type, entity_id, file_path, file_name, mime_type, thumbnail_path, caption)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .bind(&input.file_path)
    .bind(&input.file_name)
    .bind(&input.mime_type)
    .bind(&input.thumbnail_path)
    .bind(&input.caption)
    .execute(pool)
    .await?;

    get_media(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn get_media(pool: &SqlitePool, id: i64) -> Result<Option<Media>, sqlx::Error> {
    sqlx::query_as::<_, Media>("SELECT * FROM media WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_media(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
) -> Result<Vec<Media>, sqlx::Error> {
    sqlx::query_as::<_, Media>(
        "SELECT * FROM media WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC",
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await
}

/// Deletes the DB record and returns the deleted row (so the caller can remove the files).
pub async fn delete_media(pool: &SqlitePool, id: i64) -> Result<Option<Media>, sqlx::Error> {
    let media = get_media(pool, id).await?;
    if let Some(ref m) = media {
        sqlx::query("DELETE FROM media WHERE id = ?")
            .bind(m.id)
            .execute(pool)
            .await?;
    }
    Ok(media)
}
