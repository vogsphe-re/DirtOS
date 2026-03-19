use sqlx::SqlitePool;
use tauri::State;

use crate::db::{self, models::*};
use crate::services::{schedule_suggestions, scheduler};

const DEFAULT_PAGE_SIZE: i64 = 200;

// ---------------------------------------------------------------------------
// Schedule CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_schedules(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Schedule>, String> {
    db::schedules::list_schedules(
        &pool,
        environment_id,
        Pagination { limit: DEFAULT_PAGE_SIZE, offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_schedule(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Schedule>, String> {
    db::schedules::get_schedule(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_schedule(
    pool: State<'_, SqlitePool>,
    input: NewSchedule,
) -> Result<Schedule, String> {
    // Compute next_run_at from cron expression if not provided
    let input = if input.next_run_at.is_none() {
        let next = input
            .cron_expression
            .as_deref()
            .and_then(scheduler::compute_next_run);
        NewSchedule { next_run_at: next, ..input }
    } else {
        input
    };

    db::schedules::create_schedule(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_schedule(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateSchedule,
) -> Result<Option<Schedule>, String> {
    let next_run = input
        .cron_expression
        .as_deref()
        .and_then(scheduler::compute_next_run);

    db::schedules::update_schedule(&pool, id, input, next_run)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_schedule(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    db::schedules::delete_schedule(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_schedule(
    pool: State<'_, SqlitePool>,
    id: i64,
    active: bool,
) -> Result<bool, String> {
    db::schedules::set_active(&pool, id, active)
        .await
        .map_err(|e| e.to_string())?;
    Ok(true)
}

// ---------------------------------------------------------------------------
// Schedule runs
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_schedule_runs(
    pool: State<'_, SqlitePool>,
    schedule_id: i64,
    limit: Option<i64>,
) -> Result<Vec<ScheduleRun>, String> {
    db::schedules::list_runs(
        &pool,
        schedule_id,
        Pagination { limit: limit.unwrap_or(50), offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Calendar events
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn get_calendar_events(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    start_date: String,
    end_date: String,
) -> Result<Vec<CalendarEvent>, String> {
    let start = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start_date: {}", e))?;
    let end = chrono::NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end_date: {}", e))?;

    let mut events: Vec<CalendarEvent> = Vec::new();

    // --- Schedule occurrences ---
    let schedules = db::schedules::list_schedules(
        &pool,
        environment_id,
        Pagination { limit: 500, offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())?;

    for schedule in &schedules {
        if !schedule.is_active {
            continue;
        }
        let color = schedule_color(&schedule.schedule_type);

        if let Some(ref cron_expr) = schedule.cron_expression {
            // Expand cron occurrences in the date range
            let fields: Vec<&str> = cron_expr.split_whitespace().collect();
            let six_field = if fields.len() == 5 {
                format!("0 {}", cron_expr)
            } else {
                cron_expr.clone()
            };

            use cron::Schedule as CronSched;
            use std::str::FromStr;
            if let Ok(cs) = CronSched::from_str(&six_field) {
                let range_start = chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(
                    start.and_hms_opt(0, 0, 0).unwrap(),
                    chrono::Utc,
                );
                for occurrence in cs.after(&range_start).take(90) {
                    let occ_date = occurrence.date_naive();
                    if occ_date > end {
                        break;
                    }
                    events.push(CalendarEvent {
                        id: format!("schedule:{}:{}", schedule.id, occ_date),
                        event_type: CalendarEventType::Schedule,
                        date: occ_date.format("%Y-%m-%d").to_string(),
                        title: schedule.title.clone(),
                        color: Some(color.to_string()),
                        plant_id: schedule.plant_id,
                        schedule_id: Some(schedule.id),
                        issue_id: None,
                    });
                }
            }
        }
    }

    // --- Plant planting dates (filter by environment_id afterward) ---
    let plants = db::plants::list_all_plants(
        &pool,
        Pagination { limit: 2000, offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())?;
    let plants: Vec<_> = plants.into_iter().filter(|p| p.environment_id == environment_id).collect();

    for plant in &plants {
        if let Some(ref pd) = plant.planted_date {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(pd, "%Y-%m-%d") {
                if d >= start && d <= end {
                    events.push(CalendarEvent {
                        id: format!("plant:{}:planted", plant.id),
                        event_type: CalendarEventType::PlantingDate,
                        date: d.format("%Y-%m-%d").to_string(),
                        title: format!("Planted: {}", plant.name),
                        color: Some("#2d6a4f".to_string()),
                        plant_id: Some(plant.id),
                        schedule_id: None,
                        issue_id: None,
                    });
                }
            }
        }

        if let Some(ref rd) = plant.removed_date {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(rd, "%Y-%m-%d") {
                if d >= start && d <= end {
                    events.push(CalendarEvent {
                        id: format!("plant:{}:harvest", plant.id),
                        event_type: CalendarEventType::HarvestDate,
                        date: d.format("%Y-%m-%d").to_string(),
                        title: format!("Harvested: {}", plant.name),
                        color: Some("#e76f51".to_string()),
                        plant_id: Some(plant.id),
                        schedule_id: None,
                        issue_id: None,
                    });
                }
            }
        }
    }

    // --- Issues created in range ---
    let issues = db::issues::list_issues(
        &pool,
        environment_id,
        Pagination { limit: 2000, offset: 0 },
    )
    .await
    .map_err(|e| e.to_string())?;

    for issue in &issues {
        let date_str = &issue.created_at.format("%Y-%m-%d").to_string();
        if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if d >= start && d <= end {
                events.push(CalendarEvent {
                    id: format!("issue:{}", issue.id),
                    event_type: CalendarEventType::IssueCreated,
                    date: d.format("%Y-%m-%d").to_string(),
                    title: format!("Issue: {}", issue.title),
                    color: Some("#e63946".to_string()),
                    plant_id: issue.plant_id,
                    schedule_id: None,
                    issue_id: Some(issue.id),
                });
            }
        }
    }

    events.sort_by(|a, b| a.date.cmp(&b.date));
    Ok(events)
}

fn schedule_color(t: &ScheduleType) -> &'static str {
    match t {
        ScheduleType::Water => "#219ebc",
        ScheduleType::Feed => "#fb8500",
        ScheduleType::Maintenance => "#8338ec",
        ScheduleType::Treatment => "#e63946",
        ScheduleType::Sample => "#06d6a0",
        ScheduleType::Custom => "#adb5bd",
    }
}

// ---------------------------------------------------------------------------
// Additives
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_additives(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Additive>, String> {
    db::additives::list_additives(&pool)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Schedule suggestions
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn get_schedule_suggestions(
    pool: State<'_, SqlitePool>,
    plant_id: i64,
) -> Result<Vec<ScheduleSuggestion>, String> {
    let plant = db::plants::get_plant(&pool, plant_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Plant not found".to_string())?;

    let species = if let Some(sid) = plant.species_id {
        db::species::get_species(&pool, sid)
            .await
            .ok()
            .flatten()
    } else {
        None
    };

    Ok(schedule_suggestions::suggest_schedules(&plant, species.as_ref()))
}
