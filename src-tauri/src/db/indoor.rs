use sqlx::SqlitePool;

use super::models::{
    IndoorEnvironment, IndoorNutrientLog, IndoorReading, IndoorReservoirTarget,
    IndoorWaterChange, NewIndoorEnvironment, NewIndoorReading, UpdateIndoorEnvironment,
    UpsertIndoorReservoirTarget,
};

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

pub async fn get_indoor_environment_by_id(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<IndoorEnvironment>, sqlx::Error> {
    sqlx::query_as::<_, IndoorEnvironment>(
        "SELECT * FROM indoor_environments WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn list_indoor_environments(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<IndoorEnvironment>, sqlx::Error> {
    sqlx::query_as::<_, IndoorEnvironment>(
        "SELECT ie.*
         FROM indoor_environments ie
         JOIN locations l ON l.id = ie.location_id
         WHERE l.environment_id = ?
         ORDER BY l.name ASC",
    )
    .bind(environment_id)
    .fetch_all(pool)
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

pub async fn latest_indoor_reading(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<Option<IndoorReading>, sqlx::Error> {
    sqlx::query_as::<_, IndoorReading>(
        "SELECT * FROM indoor_readings
         WHERE indoor_environment_id = ?
         ORDER BY recorded_at DESC
         LIMIT 1",
    )
    .bind(indoor_environment_id)
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------------
// Nutrient logs
// ---------------------------------------------------------------------------

pub async fn log_nutrient_addition(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    additive_id: Option<i64>,
    amount: f64,
    unit: Option<String>,
) -> Result<IndoorNutrientLog, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO indoor_nutrient_logs
            (indoor_environment_id, additive_id, amount, unit, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))",
    )
    .bind(indoor_environment_id)
    .bind(additive_id)
    .bind(amount)
    .bind(unit.unwrap_or_else(|| "ml".to_string()))
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IndoorNutrientLog>(
        "SELECT * FROM indoor_nutrient_logs WHERE id = ?",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(pool)
    .await
}

pub async fn list_nutrient_logs(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<Vec<IndoorNutrientLog>, sqlx::Error> {
    sqlx::query_as::<_, IndoorNutrientLog>(
        "SELECT * FROM indoor_nutrient_logs
         WHERE indoor_environment_id = ?
         ORDER BY created_at DESC",
    )
    .bind(indoor_environment_id)
    .fetch_all(pool)
    .await
}

pub async fn nutrient_total_since(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    since: Option<chrono::NaiveDateTime>,
) -> Result<f64, sqlx::Error> {
    let row: (Option<f64>,) = if let Some(since) = since {
        sqlx::query_as(
            "SELECT SUM(amount) FROM indoor_nutrient_logs
             WHERE indoor_environment_id = ? AND created_at >= ?",
        )
        .bind(indoor_environment_id)
        .bind(since)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_as(
            "SELECT SUM(amount) FROM indoor_nutrient_logs
             WHERE indoor_environment_id = ?",
        )
        .bind(indoor_environment_id)
        .fetch_one(pool)
        .await?
    };

    Ok(row.0.unwrap_or(0.0))
}

// ---------------------------------------------------------------------------
// Water changes
// ---------------------------------------------------------------------------

pub async fn log_water_change(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    volume_liters: Option<f64>,
    notes: Option<String>,
) -> Result<IndoorWaterChange, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO indoor_water_changes
            (indoor_environment_id, volume_liters, notes, created_at)
         VALUES (?, ?, ?, datetime('now'))",
    )
    .bind(indoor_environment_id)
    .bind(volume_liters)
    .bind(notes)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IndoorWaterChange>(
        "SELECT * FROM indoor_water_changes WHERE id = ?",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(pool)
    .await
}

pub async fn list_water_changes(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<Vec<IndoorWaterChange>, sqlx::Error> {
    sqlx::query_as::<_, IndoorWaterChange>(
        "SELECT * FROM indoor_water_changes
         WHERE indoor_environment_id = ?
         ORDER BY created_at DESC",
    )
    .bind(indoor_environment_id)
    .fetch_all(pool)
    .await
}

pub async fn latest_water_change(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<Option<IndoorWaterChange>, sqlx::Error> {
    sqlx::query_as::<_, IndoorWaterChange>(
        "SELECT * FROM indoor_water_changes
         WHERE indoor_environment_id = ?
         ORDER BY created_at DESC LIMIT 1",
    )
    .bind(indoor_environment_id)
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------------
// Reservoir targets
// ---------------------------------------------------------------------------

pub async fn get_reservoir_target(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<Option<IndoorReservoirTarget>, sqlx::Error> {
    sqlx::query_as::<_, IndoorReservoirTarget>(
        "SELECT * FROM indoor_reservoir_targets
         WHERE indoor_environment_id = ?",
    )
    .bind(indoor_environment_id)
    .fetch_optional(pool)
    .await
}

pub async fn upsert_reservoir_target(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    input: UpsertIndoorReservoirTarget,
) -> Result<IndoorReservoirTarget, sqlx::Error> {
    sqlx::query(
        "INSERT INTO indoor_reservoir_targets
            (indoor_environment_id, ph_min, ph_max, ec_min, ec_max, ppm_min, ppm_max, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(indoor_environment_id) DO UPDATE SET
            ph_min = excluded.ph_min,
            ph_max = excluded.ph_max,
            ec_min = excluded.ec_min,
            ec_max = excluded.ec_max,
            ppm_min = excluded.ppm_min,
            ppm_max = excluded.ppm_max,
            updated_at = excluded.updated_at",
    )
    .bind(indoor_environment_id)
    .bind(input.ph_min)
    .bind(input.ph_max)
    .bind(input.ec_min)
    .bind(input.ec_max)
    .bind(input.ppm_min)
    .bind(input.ppm_max)
    .execute(pool)
    .await?;

    get_reservoir_target(pool, indoor_environment_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}
