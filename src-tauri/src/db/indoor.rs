use sqlx::SqlitePool;

use super::models::{IndoorEnvironment, IndoorReading, NewIndoorEnvironment, NewIndoorReading, UpdateIndoorEnvironment};

pub async fn get_indoor_environment(
    pool: &SqlitePool,
    location_id: i64,
) -> Result<Option<IndoorEnvironment>, sqlx::Error> {
    sqlx::query_as::<_, IndoorEnvironment>(
        "SELECT * FROM indoor_environments WHERE location_id = ?",
    )
    .bind(location_id)
    .fetch_optional(pool)
    .await
}

pub async fn create_indoor_environment(
    pool: &SqlitePool,
    input: NewIndoorEnvironment,
) -> Result<IndoorEnvironment, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO indoor_environments
            (location_id, grow_method, light_type, light_wattage,
             light_schedule_on, light_schedule_off, ventilation_type, ventilation_cfm,
             tent_width, tent_depth, tent_height, reservoir_capacity_liters, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.location_id)
    .bind(&input.grow_method)
    .bind(&input.light_type)
    .bind(input.light_wattage)
    .bind(&input.light_schedule_on)
    .bind(&input.light_schedule_off)
    .bind(&input.ventilation_type)
    .bind(input.ventilation_cfm)
    .bind(input.tent_width)
    .bind(input.tent_depth)
    .bind(input.tent_height)
    .bind(input.reservoir_capacity_liters)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IndoorEnvironment>(
        "SELECT * FROM indoor_environments WHERE id = ?",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(pool)
    .await
}

pub async fn update_indoor_environment(
    pool: &SqlitePool,
    id: i64,
    input: UpdateIndoorEnvironment,
) -> Result<Option<IndoorEnvironment>, sqlx::Error> {
    sqlx::query(
        "UPDATE indoor_environments SET
            grow_method                = COALESCE(?, grow_method),
            light_type                 = COALESCE(?, light_type),
            light_wattage              = COALESCE(?, light_wattage),
            light_schedule_on          = COALESCE(?, light_schedule_on),
            light_schedule_off         = COALESCE(?, light_schedule_off),
            ventilation_type           = COALESCE(?, ventilation_type),
            ventilation_cfm            = COALESCE(?, ventilation_cfm),
            tent_width                 = COALESCE(?, tent_width),
            tent_depth                 = COALESCE(?, tent_depth),
            tent_height                = COALESCE(?, tent_height),
            reservoir_capacity_liters  = COALESCE(?, reservoir_capacity_liters),
            notes                      = COALESCE(?, notes),
            updated_at                 = datetime('now')
         WHERE id = ?",
    )
    .bind(input.grow_method)
    .bind(input.light_type)
    .bind(input.light_wattage)
    .bind(input.light_schedule_on)
    .bind(input.light_schedule_off)
    .bind(input.ventilation_type)
    .bind(input.ventilation_cfm)
    .bind(input.tent_width)
    .bind(input.tent_depth)
    .bind(input.tent_height)
    .bind(input.reservoir_capacity_liters)
    .bind(input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IndoorEnvironment>(
        "SELECT * FROM indoor_environments WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------------
// Indoor readings
// ---------------------------------------------------------------------------

pub async fn record_indoor_reading(
    pool: &SqlitePool,
    input: NewIndoorReading,
) -> Result<IndoorReading, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO indoor_readings
            (indoor_environment_id, water_temp, water_ph, water_ec, water_ppm,
             air_temp, air_humidity, co2_ppm, vpd)
         VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.indoor_environment_id)
    .bind(input.water_temp)
    .bind(input.water_ph)
    .bind(input.water_ec)
    .bind(input.water_ppm)
    .bind(input.air_temp)
    .bind(input.air_humidity)
    .bind(input.co2_ppm)
    .bind(input.vpd)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IndoorReading>("SELECT * FROM indoor_readings WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await
}

pub async fn list_indoor_readings(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    limit: i64,
) -> Result<Vec<IndoorReading>, sqlx::Error> {
    sqlx::query_as::<_, IndoorReading>(
        "SELECT * FROM indoor_readings WHERE indoor_environment_id = ?
         ORDER BY recorded_at DESC LIMIT ?",
    )
    .bind(indoor_environment_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn list_indoor_readings_since(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    since: chrono::NaiveDateTime,
) -> Result<Vec<IndoorReading>, sqlx::Error> {
    sqlx::query_as::<_, IndoorReading>(
        "SELECT * FROM indoor_readings
         WHERE indoor_environment_id = ? AND recorded_at >= ?
         ORDER BY recorded_at ASC",
    )
    .bind(indoor_environment_id)
    .bind(since)
    .fetch_all(pool)
    .await
}
