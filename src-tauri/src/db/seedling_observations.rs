use sqlx::SqlitePool;

use super::models::{NewSeedlingObservation, SeedlingObservation};

pub async fn list_observations(
    pool: &SqlitePool,
    plant_id: i64,
) -> Result<Vec<SeedlingObservation>, sqlx::Error> {
    sqlx::query_as::<_, SeedlingObservation>(
        "SELECT * FROM seedling_observations WHERE plant_id = ? ORDER BY observed_at ASC",
    )
    .bind(plant_id)
    .fetch_all(pool)
    .await
}

pub async fn create_observation(
    pool: &SqlitePool,
    input: NewSeedlingObservation,
) -> Result<SeedlingObservation, sqlx::Error> {
    let observed_at = input
        .observed_at
        .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());

    let result = sqlx::query(
        "INSERT INTO seedling_observations
            (plant_id, observed_at, height_cm, stem_thickness_mm,
             leaf_node_count, leaf_node_spacing_mm, notes)
         VALUES (?,?,?,?,?,?,?)",
    )
    .bind(input.plant_id)
    .bind(&observed_at)
    .bind(input.height_cm)
    .bind(input.stem_thickness_mm)
    .bind(input.leaf_node_count)
    .bind(input.leaf_node_spacing_mm)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, SeedlingObservation>(
        "SELECT * FROM seedling_observations WHERE id = ?",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(pool)
    .await
}

pub async fn delete_observation(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM seedling_observations WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}
