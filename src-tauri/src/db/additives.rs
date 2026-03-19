use sqlx::SqlitePool;

use super::models::Additive;

pub async fn list_additives(pool: &SqlitePool) -> Result<Vec<Additive>, sqlx::Error> {
    sqlx::query_as::<_, Additive>("SELECT * FROM additives ORDER BY name ASC")
        .fetch_all(pool)
        .await
}

pub async fn get_additive(pool: &SqlitePool, id: i64) -> Result<Option<Additive>, sqlx::Error> {
    sqlx::query_as::<_, Additive>("SELECT * FROM additives WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}
