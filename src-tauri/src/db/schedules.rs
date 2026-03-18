use sqlx::SqlitePool;

use super::models::{NewSchedule, Pagination, Schedule, ScheduleRun, ScheduleRunStatus};

pub async fn list_schedules(
    pool: &SqlitePool,
    environment_id: i64,
    pagination: Pagination,
) -> Result<Vec<Schedule>, sqlx::Error> {
    sqlx::query_as::<_, Schedule>(
        "SELECT * FROM schedules WHERE environment_id = ?
         ORDER BY title ASC LIMIT ? OFFSET ?",
    )
    .bind(environment_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn list_active_schedules(
    pool: &SqlitePool,
) -> Result<Vec<Schedule>, sqlx::Error> {
    sqlx::query_as::<_, Schedule>(
        "SELECT * FROM schedules WHERE is_active = 1 ORDER BY next_run_at ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_schedule(pool: &SqlitePool, id: i64) -> Result<Option<Schedule>, sqlx::Error> {
    sqlx::query_as::<_, Schedule>("SELECT * FROM schedules WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_schedule(
    pool: &SqlitePool,
    input: NewSchedule,
) -> Result<Schedule, sqlx::Error> {
    let is_active = input.is_active.unwrap_or(true);
    let result = sqlx::query(
        "INSERT INTO schedules
            (environment_id, plant_id, location_id, type, title,
             cron_expression, next_run_at, is_active, additive_id, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.environment_id)
    .bind(input.plant_id)
    .bind(input.location_id)
    .bind(&input.schedule_type)
    .bind(&input.title)
    .bind(&input.cron_expression)
    .bind(input.next_run_at)
    .bind(is_active)
    .bind(input.additive_id)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    get_schedule(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_next_run(
    pool: &SqlitePool,
    id: i64,
    next_run_at: chrono::NaiveDateTime,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE schedules SET next_run_at = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(next_run_at)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_active(
    pool: &SqlitePool,
    id: i64,
    active: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE schedules SET is_active = ?, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(active)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_schedule(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM schedules WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

// ---------------------------------------------------------------------------
// Schedule runs
// ---------------------------------------------------------------------------

pub async fn record_run(
    pool: &SqlitePool,
    schedule_id: i64,
    issue_id: Option<i64>,
    status: ScheduleRunStatus,
) -> Result<ScheduleRun, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO schedule_runs (schedule_id, issue_id, ran_at, status)
         VALUES (?, ?, datetime('now'), ?)",
    )
    .bind(schedule_id)
    .bind(issue_id)
    .bind(status)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, ScheduleRun>("SELECT * FROM schedule_runs WHERE id = ?")
        .bind(result.last_insert_rowid())
        .fetch_one(pool)
        .await
}

pub async fn list_runs(
    pool: &SqlitePool,
    schedule_id: i64,
    pagination: Pagination,
) -> Result<Vec<ScheduleRun>, sqlx::Error> {
    sqlx::query_as::<_, ScheduleRun>(
        "SELECT * FROM schedule_runs WHERE schedule_id = ?
         ORDER BY ran_at DESC LIMIT ? OFFSET ?",
    )
    .bind(schedule_id)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}
