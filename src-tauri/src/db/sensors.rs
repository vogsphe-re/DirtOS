use sqlx::SqlitePool;

use super::models::{NewSensor, Pagination, Sensor, SensorLimit, SensorReading};

pub async fn list_sensors(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<Sensor>, sqlx::Error> {
    sqlx::query_as::<_, Sensor>(
        "SELECT * FROM sensors WHERE environment_id = ?
         ORDER BY name ASC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_sensor(pool: &SqlitePool, id: i64) -> Result<Option<Sensor>, sqlx::Error> {
    sqlx::query_as::<_, Sensor>("SELECT * FROM sensors WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_sensor(
    pool: &SqlitePool,
    input: NewSensor,
) -> Result<Sensor, sqlx::Error> {
    let is_active = input.is_active.unwrap_or(true);
    let result = sqlx::query(
        "INSERT INTO sensors
            (environment_id, location_id, plant_id, name, type, connection_type,
             connection_config_json, poll_interval_seconds, is_active)
         VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(input.location_id)
    .bind(input.plant_id)
    .bind(&input.name)
    .bind(&input.sensor_type)
    .bind(&input.connection_type)
    .bind(&input.connection_config_json)
    .bind(input.poll_interval_seconds)
    .bind(is_active)
    .execute(pool)
    .await?;

    get_sensor(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn set_sensor_active(
    pool: &SqlitePool,
    id: i64,
    active: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE sensors SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(active)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_sensor(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM sensors WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Sensor readings
// ---------------------------------------------------------------------------

pub async fn record_reading(
    pool: &SqlitePool,
    sensor_id: i64,
    value: f64,
    unit: Option<String>,
) -> Result<SensorReading, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at)
         VALUES (?, ?, ?, datetime('now'))",
    )
    .bind(sensor_id)
    .bind(value)
    .bind(&unit)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, SensorReading>("SELECT * FROM sensor_readings WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await
}

pub async fn list_readings(
    pool: &SqlitePool,
    sensor_id: i64,
    pagination: Pagination,
) -> Result<Vec<SensorReading>, sqlx::Error> {
    sqlx::query_as::<_, SensorReading>(
        "SELECT * FROM sensor_readings WHERE sensor_id = ?
         ORDER BY recorded_at DESC LIMIT ? OFFSET ?",
    )
    .bind(sensor_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_readings_since(
    pool: &SqlitePool,
    sensor_id: i64,
    since: chrono::NaiveDateTime,
) -> Result<Vec<SensorReading>, sqlx::Error> {
    sqlx::query_as::<_, SensorReading>(
        "SELECT * FROM sensor_readings WHERE sensor_id = ? AND recorded_at >= ?
         ORDER BY recorded_at ASC",
    )
    .bind(sensor_id)
    .bind(since)
    .fetch_all(pool)
    .await
}

pub async fn purge_old_readings(
    pool: &SqlitePool,
    sensor_id: i64,
    before: chrono::NaiveDateTime,
) -> Result<u64, sqlx::Error> {
    let result =
        sqlx::query("DELETE FROM sensor_readings WHERE sensor_id = ? AND recorded_at < ?")
            .bind(sensor_id)
            .bind(before)
            .execute(pool)
            .await?;
    Ok(result.rows_affected())
}

// ---------------------------------------------------------------------------
// Sensor limits
// ---------------------------------------------------------------------------

pub async fn get_limits(
    pool: &SqlitePool,
    sensor_id: i64,
) -> Result<Option<SensorLimit>, sqlx::Error> {
    sqlx::query_as::<_, SensorLimit>("SELECT * FROM sensor_limits WHERE sensor_id = ?")
        .bind(sensor_id)
        .fetch_optional(pool)
        .await
}

pub async fn upsert_limits(
    pool: &SqlitePool,
    sensor_id: i64,
    min_value: Option<f64>,
    max_value: Option<f64>,
    unit: Option<String>,
    alert_enabled: bool,
) -> Result<SensorLimit, sqlx::Error> {
    sqlx::query(
        "INSERT INTO sensor_limits (sensor_id, min_value, max_value, unit, alert_enabled)
         VALUES (?,?,?,?,?)
         ON CONFLICT(sensor_id) DO UPDATE SET
            min_value     = excluded.min_value,
            max_value     = excluded.max_value,
            unit          = excluded.unit,
            alert_enabled = excluded.alert_enabled",
    )
    .bind(sensor_id)
    .bind(min_value)
    .bind(max_value)
    .bind(&unit)
    .bind(alert_enabled)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, SensorLimit>("SELECT * FROM sensor_limits WHERE sensor_id = ?")
        .bind(sensor_id)
        .fetch_one(pool)
        .await
}
