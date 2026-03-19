use chrono::{NaiveDate, NaiveDateTime, Utc};
use cron::Schedule as CronSchedule;
use sqlx::SqlitePool;
use std::str::FromStr;
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::db::{
    models::{Schedule, ScheduleRunStatus},
    schedules,
};
use crate::services::issue_generator;

/// Compute the next run time for a 5-field cron expression ("m h dom mon dow").
/// Returns None if the expression is invalid or has no upcoming occurrences.
pub fn compute_next_run(cron_expr: &str) -> Option<NaiveDateTime> {
    // The `cron` crate requires 6 fields (sec min hour dom mon dow).
    // Prepend "0" for seconds when the input has 5 fields.
    let fields: Vec<&str> = cron_expr.split_whitespace().collect();
    let six_field = if fields.len() == 5 {
        format!("0 {}", cron_expr)
    } else {
        cron_expr.to_string()
    };

    let sched = CronSchedule::from_str(&six_field).ok()?;
    sched.upcoming(Utc).next().map(|dt| dt.naive_utc())
}

/// Fire a schedule: create an issue, record the run, update next_run_at, notify.
async fn fire_schedule(app: &AppHandle, pool: &SqlitePool, schedule: &Schedule, run_date: NaiveDate) {
    let issue = match issue_generator::create_issue_from_schedule(pool, schedule, run_date).await {
        Ok(i) => i,
        Err(e) => {
            tracing::error!("Failed to create issue for schedule {}: {}", schedule.id, e);
            let _ = schedules::record_run(pool, schedule.id, None, ScheduleRunStatus::Skipped).await;
            return;
        }
    };

    // Record the run
    if let Err(e) = schedules::record_run(pool, schedule.id, Some(issue.id), ScheduleRunStatus::Completed).await {
        tracing::warn!("Failed to record run for schedule {}: {}", schedule.id, e);
    }

    // Update next_run_at
    if let Some(ref cron_expr) = schedule.cron_expression {
        if let Some(next) = compute_next_run(cron_expr) {
            let _ = schedules::update_next_run(pool, schedule.id, next).await;
        }
    }

    // Desktop notification (best-effort)
    let _ = app
        .notification()
        .builder()
        .title("DirtOS")
        .body(&format!("Time for: {}", schedule.title))
        .show();

    // Emit Tauri event so the frontend NotificationCenter can react
    let _ = app.emit("schedule:fired", serde_json::json!({
        "schedule_id": schedule.id,
        "schedule_title": schedule.title,
        "issue_id": issue.id,
        "issue_title": issue.title,
    }));

    tracing::info!(
        "Schedule {} fired → issue {} created",
        schedule.id,
        issue.id
    );
}

/// Start the cron scheduler.
/// Loads all active schedules, catches up missed runs, then runs ongoing jobs.
/// This function is meant to be spawned with `tauri::async_runtime::spawn`.
pub async fn start(app: AppHandle, pool: SqlitePool) {
    let sched = match JobScheduler::new().await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to create job scheduler: {}", e);
            return;
        }
    };

    let schedules = schedules::list_active_schedules(&pool).await.unwrap_or_default();
    let now = Utc::now().naive_utc();

    for schedule in &schedules {
        // Catch up missed runs
        if let Some(next_run) = schedule.next_run_at {
            if next_run < now {
                tracing::info!("Catching up missed schedule: {} ({})", schedule.id, schedule.title);
                fire_schedule(&app, &pool, schedule, Utc::now().date_naive()).await;
            }
        }

        // Register ongoing cron job
        if let Some(ref cron_expr) = schedule.cron_expression {
            register_job(&sched, app.clone(), pool.clone(), schedule.id, cron_expr).await;
        }
    }

    if let Err(e) = sched.start().await {
        tracing::error!("Failed to start job scheduler: {}", e);
        return;
    }

    tracing::info!("Cron scheduler started with {} active schedules", schedules.len());

    // Keep this task alive to hold the scheduler
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
    }
}

async fn register_job(sched: &JobScheduler, app: AppHandle, pool: SqlitePool, schedule_id: i64, cron_expr: &str) {
    // Convert 5-field → 6-field for tokio-cron-scheduler if needed
    let fields: Vec<&str> = cron_expr.split_whitespace().collect();
    let six_field = if fields.len() == 5 {
        format!("0 {}", cron_expr)
    } else {
        cron_expr.to_string()
    };

    let job = Job::new_async(six_field.as_str(), move |_uuid, _lock| {
        let app = app.clone();
        let pool = pool.clone();
        Box::pin(async move {
            if let Ok(Some(schedule)) = schedules::get_schedule(&pool, schedule_id).await {
                if schedule.is_active {
                    fire_schedule(&app, &pool, &schedule, Utc::now().date_naive()).await;
                }
            }
        })
    });

    match job {
        Ok(j) => {
            if let Err(e) = sched.add(j).await {
                tracing::warn!("Failed to register cron job for schedule {}: {}", schedule_id, e);
            }
        }
        Err(e) => {
            tracing::warn!("Invalid cron expression for schedule {}: {}", schedule_id, e);
        }
    }
}
