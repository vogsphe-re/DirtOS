use sqlx::SqlitePool;

use super::models::{CustomField, CustomFieldEntityType, NewCustomField, UpdateCustomField};

pub async fn list_custom_fields(
    pool: &SqlitePool,
    entity_type: CustomFieldEntityType,
    entity_id: i64,
) -> Result<Vec<CustomField>, sqlx::Error> {
    sqlx::query_as::<_, CustomField>(
        "SELECT * FROM custom_fields
         WHERE entity_type = ? AND entity_id = ?
         ORDER BY field_name ASC",
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await
}

pub async fn get_custom_field(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<CustomField>, sqlx::Error> {
    sqlx::query_as::<_, CustomField>("SELECT * FROM custom_fields WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_custom_field(
    pool: &SqlitePool,
    input: NewCustomField,
) -> Result<CustomField, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO custom_fields (entity_type, entity_id, field_name, field_value, field_type)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&input.entity_type)
    .bind(input.entity_id)
    .bind(&input.field_name)
    .bind(&input.field_value)
    .bind(&input.field_type)
    .execute(pool)
    .await?;

    get_custom_field(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_custom_field(
    pool: &SqlitePool,
    id: i64,
    input: UpdateCustomField,
) -> Result<Option<CustomField>, sqlx::Error> {
    sqlx::query(
        "UPDATE custom_fields SET
            field_name  = COALESCE(?, field_name),
            field_value = COALESCE(?, field_value),
            field_type  = COALESCE(?, field_type)
         WHERE id = ?",
    )
    .bind(input.field_name)
    .bind(input.field_value)
    .bind(input.field_type)
    .bind(id)
    .execute(pool)
    .await?;
    get_custom_field(pool, id).await
}

pub async fn delete_custom_field(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM custom_fields WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
