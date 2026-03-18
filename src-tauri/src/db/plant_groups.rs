use sqlx::SqlitePool;

use super::models::{NewPlantGroup, Pagination, Plant, PlantGroup, UpdatePlantGroup};

pub async fn list_groups(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<PlantGroup>, sqlx::Error> {
    sqlx::query_as::<_, PlantGroup>(
        "SELECT * FROM plant_groups WHERE environment_id = ? ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_group(pool: &SqlitePool, id: i64) -> Result<Option<PlantGroup>, sqlx::Error> {
    sqlx::query_as::<_, PlantGroup>("SELECT * FROM plant_groups WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_group(
    pool: &SqlitePool,
    input: NewPlantGroup,
) -> Result<PlantGroup, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO plant_groups (environment_id, name, description, group_type, color)
         VALUES (?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(&input.name)
    .bind(&input.description)
    .bind(&input.group_type)
    .bind(&input.color)
    .execute(pool)
    .await?;

    get_group(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_group(
    pool: &SqlitePool,
    id: i64,
    input: UpdatePlantGroup,
) -> Result<Option<PlantGroup>, sqlx::Error> {
    sqlx::query(
        "UPDATE plant_groups SET
            name        = COALESCE(?, name),
            description = COALESCE(?, description),
            group_type  = COALESCE(?, group_type),
            color       = COALESCE(?, color),
            updated_at  = datetime('now')
         WHERE id = ?",
    )
    .bind(input.name)
    .bind(input.description)
    .bind(input.group_type)
    .bind(input.color)
    .bind(id)
    .execute(pool)
    .await?;

    get_group(pool, id).await
}

pub async fn delete_group(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM plant_groups WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn add_to_group(
    pool: &SqlitePool,
    group_id: i64,
    plant_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT OR IGNORE INTO plant_group_members (group_id, plant_id) VALUES (?,?)",
    )
    .bind(group_id)
    .bind(plant_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove_from_group(
    pool: &SqlitePool,
    group_id: i64,
    plant_id: i64,
) -> Result<bool, sqlx::Error> {
    let result =
        sqlx::query("DELETE FROM plant_group_members WHERE group_id = ? AND plant_id = ?")
            .bind(group_id)
            .bind(plant_id)
            .execute(pool)
            .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn list_group_plants(
    pool: &SqlitePool,
    group_id: i64,
) -> Result<Vec<Plant>, sqlx::Error> {
    sqlx::query_as::<_, Plant>(
        "SELECT p.* FROM plants p
         JOIN plant_group_members m ON m.plant_id = p.id
         WHERE m.group_id = ?
         ORDER BY p.name ASC",
    )
    .bind(group_id)
    .fetch_all(pool)
    .await
}
