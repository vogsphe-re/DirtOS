use sqlx::SqlitePool;

use super::models::{Harvest, HarvestSummary, NewHarvest, Pagination, ReportData, ReportDataPoint, Season, SeedLot, NewSeason};

pub async fn list_harvests(
    pool: &SqlitePool,
    plant_id: i64,
    pagination: Pagination,
) -> Result<Vec<Harvest>, sqlx::Error> {
    sqlx::query_as::<_, Harvest>(
        "SELECT * FROM harvests WHERE plant_id = ?
         ORDER BY harvest_date DESC LIMIT ? OFFSET ?",
    )
    .bind(plant_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

/// List all harvests across an environment, optionally filtered by date range.
pub async fn list_all_harvests(
    pool: &SqlitePool,
    environment_id: i64,
    date_from: Option<&str>,
    date_to: Option<&str>,
    pagination: Pagination,
) -> Result<Vec<Harvest>, sqlx::Error> {
    let df = date_from.unwrap_or("0000-01-01");
    let dt = date_to.unwrap_or("9999-12-31");
    sqlx::query_as::<_, Harvest>(
        "SELECT h.* FROM harvests h
         JOIN plants p ON p.id = h.plant_id
         WHERE p.environment_id = ?
           AND h.harvest_date >= ?
           AND h.harvest_date <= ?
         ORDER BY h.harvest_date DESC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(df)
    .bind(dt)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_harvest(pool: &SqlitePool, id: i64) -> Result<Option<Harvest>, sqlx::Error> {
    sqlx::query_as::<_, Harvest>("SELECT * FROM harvests WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_harvest(
    pool: &SqlitePool,
    input: NewHarvest,
) -> Result<Harvest, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO harvests (plant_id, harvest_date, quantity, unit, quality_rating, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(input.plant_id)
    .bind(&input.harvest_date)
    .bind(input.quantity)
    .bind(&input.unit)
    .bind(input.quality_rating)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    get_harvest(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn delete_harvest(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM harvests WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn get_harvest_summary(
    pool: &SqlitePool,
    plant_id: i64,
) -> Result<Option<HarvestSummary>, sqlx::Error> {
    sqlx::query_as::<_, HarvestSummary>(
        "SELECT
             plant_id,
             COALESCE(SUM(quantity), 0.0)    AS total_quantity,
             COUNT(*)                         AS harvest_count,
             AVG(quality_rating)              AS avg_quality,
             MIN(harvest_date)                AS first_harvest,
             MAX(harvest_date)                AS last_harvest
         FROM harvests
         WHERE plant_id = ?
         GROUP BY plant_id",
    )
    .bind(plant_id)
    .fetch_optional(pool)
    .await
}

// ---------------------------------------------------------------------------
// Seed lots
// ---------------------------------------------------------------------------

pub async fn list_seed_lots(
    pool: &SqlitePool,
    pagination: Pagination,
) -> Result<Vec<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>(
        "SELECT * FROM seed_lots ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_seed_lots_by_species(
    pool: &SqlitePool,
    species_id: i64,
    pagination: Pagination,
) -> Result<Vec<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>(
        "SELECT sl.* FROM seed_lots sl
         JOIN plants p ON p.id = sl.parent_plant_id
         WHERE p.species_id = ?
         ORDER BY sl.created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(species_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_seed_lot(pool: &SqlitePool, id: i64) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>("SELECT * FROM seed_lots WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_seed_lot(
    pool: &SqlitePool,
    parent_plant_id: Option<i64>,
    harvest_id: Option<i64>,
    lot_label: Option<String>,
    quantity: Option<f64>,
    viability_pct: Option<f64>,
    storage_location: Option<String>,
    collected_date: Option<String>,
    notes: Option<String>,
) -> Result<SeedLot, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO seed_lots
            (parent_plant_id, harvest_id, lot_label, quantity, viability_pct,
             storage_location, collected_date, notes)
         VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(parent_plant_id)
    .bind(harvest_id)
    .bind(&lot_label)
    .bind(quantity)
    .bind(viability_pct)
    .bind(&storage_location)
    .bind(&collected_date)
    .bind(&notes)
    .execute(pool)
    .await?;

    get_seed_lot(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

pub async fn list_seasons(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<Season>, sqlx::Error> {
    sqlx::query_as::<_, Season>(
        "SELECT * FROM seasons WHERE environment_id = ? ORDER BY start_date DESC",
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await
}

pub async fn get_season(pool: &SqlitePool, id: i64) -> Result<Option<Season>, sqlx::Error> {
    sqlx::query_as::<_, Season>("SELECT * FROM seasons WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_season(
    pool: &SqlitePool,
    input: NewSeason,
) -> Result<Season, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO seasons (environment_id, name, start_date, end_date, notes)
         VALUES (?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(&input.name)
    .bind(&input.start_date)
    .bind(&input.end_date)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    get_season(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn delete_season(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM seasons WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Report data queries
// ---------------------------------------------------------------------------
// Report data queries — uses runtime query_as with anonymous structs
// ---------------------------------------------------------------------------

#[derive(sqlx::FromRow)]
struct LabelValue {
    label: Option<String>,
    value: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct LabelCount {
    label: Option<String>,
    cnt: i64,
}

/// Yields by species for a given environment and date range.
pub async fn report_harvest_by_species(
    pool: &SqlitePool,
    environment_id: i64,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<ReportData, sqlx::Error> {
    let df = date_from.unwrap_or("0000-01-01");
    let dt = date_to.unwrap_or("9999-12-31");

    let rows = sqlx::query_as::<_, LabelValue>(
        "SELECT COALESCE(s.common_name, p.name) AS label,
                COALESCE(SUM(h.quantity), 0.0)  AS value
         FROM harvests h
         JOIN plants p ON p.id = h.plant_id
         LEFT JOIN species s ON s.id = p.species_id
         WHERE p.environment_id = ?
           AND h.harvest_date >= ?
           AND h.harvest_date <= ?
         GROUP BY COALESCE(s.common_name, p.name)
         ORDER BY value DESC",
    )
    .bind(environment_id)
    .bind(df)
    .bind(dt)
    .fetch_all(pool)
    .await?;

    let points = rows
        .into_iter()
        .map(|r| ReportDataPoint {
            label: r.label.unwrap_or_default(),
            value: r.value.unwrap_or(0.0),
            secondary: None,
        })
        .collect();

    Ok(ReportData {
        report_type: "harvest_by_species".into(),
        date_from: date_from.map(String::from),
        date_to: date_to.map(String::from),
        points,
        unit: Some("quantity".into()),
    })
}

/// Yields by month for a given environment and date range.
pub async fn report_harvest_by_month(
    pool: &SqlitePool,
    environment_id: i64,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<ReportData, sqlx::Error> {
    let df = date_from.unwrap_or("0000-01-01");
    let dt = date_to.unwrap_or("9999-12-31");

    let rows = sqlx::query_as::<_, LabelValue>(
        "SELECT strftime('%Y-%m', h.harvest_date) AS label,
                COALESCE(SUM(h.quantity), 0.0)    AS value
         FROM harvests h
         JOIN plants p ON p.id = h.plant_id
         WHERE p.environment_id = ?
           AND h.harvest_date >= ?
           AND h.harvest_date <= ?
         GROUP BY strftime('%Y-%m', h.harvest_date)
         ORDER BY label ASC",
    )
    .bind(environment_id)
    .bind(df)
    .bind(dt)
    .fetch_all(pool)
    .await?;

    let points = rows
        .into_iter()
        .map(|r| ReportDataPoint {
            label: r.label.unwrap_or_default(),
            value: r.value.unwrap_or(0.0),
            secondary: None,
        })
        .collect();

    Ok(ReportData {
        report_type: "harvest_by_month".into(),
        date_from: date_from.map(String::from),
        date_to: date_to.map(String::from),
        points,
        unit: Some("quantity".into()),
    })
}

/// Issue counts by label for a given environment.
pub async fn report_issues_by_label(
    pool: &SqlitePool,
    environment_id: i64,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<ReportData, sqlx::Error> {
    let df = date_from.unwrap_or("0000-01-01");
    let dt = date_to.unwrap_or("9999-12-31");

    let rows = sqlx::query_as::<_, LabelCount>(
        "SELECT COALESCE(il.name, 'Unlabelled') AS label,
                COUNT(*) AS cnt
         FROM issues i
         LEFT JOIN issue_label_assignments ila ON ila.issue_id = i.id
         LEFT JOIN issue_labels il ON il.id = ila.label_id
         WHERE i.environment_id = ?
           AND date(i.created_at) >= ?
           AND date(i.created_at) <= ?
         GROUP BY il.name
         ORDER BY cnt DESC",
    )
    .bind(environment_id)
    .bind(df)
    .bind(dt)
    .fetch_all(pool)
    .await?;

    let points = rows
        .into_iter()
        .map(|r| ReportDataPoint {
            label: r.label.unwrap_or_default(),
            value: r.cnt as f64,
            secondary: None,
        })
        .collect();

    Ok(ReportData {
        report_type: "issues_by_label".into(),
        date_from: date_from.map(String::from),
        date_to: date_to.map(String::from),
        points,
        unit: Some("count".into()),
    })
}

/// Soil pH trend per location.
pub async fn report_soil_ph_trend(
    pool: &SqlitePool,
    environment_id: i64,
    location_id: Option<i64>,
    date_from: Option<&str>,
    date_to: Option<&str>,
) -> Result<ReportData, sqlx::Error> {
    let df = date_from.unwrap_or("0000-01-01");
    let dt = date_to.unwrap_or("9999-12-31");

    let rows: Vec<LabelValue> = if let Some(loc_id) = location_id {
        sqlx::query_as::<_, LabelValue>(
            "SELECT test_date AS label, COALESCE(ph, 0.0) AS value
             FROM soil_tests
             WHERE location_id = ?
               AND test_date >= ?
               AND test_date <= ?
             ORDER BY test_date ASC",
        )
        .bind(loc_id)
        .bind(df)
        .bind(dt)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, LabelValue>(
            "SELECT st.test_date AS label, COALESCE(st.ph, 0.0) AS value
             FROM soil_tests st
             JOIN locations l ON l.id = st.location_id
             WHERE l.environment_id = ?
               AND st.test_date >= ?
               AND st.test_date <= ?
             ORDER BY st.test_date ASC",
        )
        .bind(environment_id)
        .bind(df)
        .bind(dt)
        .fetch_all(pool)
        .await?
    };

    let points = rows
        .into_iter()
        .map(|r| ReportDataPoint {
            label: r.label.unwrap_or_default(),
            value: r.value.unwrap_or(0.0),
            secondary: None,
        })
        .collect();

    Ok(ReportData {
        report_type: "soil_ph_trend".into(),
        date_from: date_from.map(String::from),
        date_to: date_to.map(String::from),
        points,
        unit: Some("pH".into()),
    })
}
