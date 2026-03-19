use chrono::NaiveDate;
use sqlx::SqlitePool;

use crate::db::{
    issues,
    models::{Issue, IssueStatus, IssuePriority, NewIssue, Schedule, ScheduleType},
};

/// Auto-generate an issue ticket from a triggered schedule run.
/// Called by the Phase 8 scheduler when a scheduled task fires.
pub async fn create_issue_from_schedule(
    pool: &SqlitePool,
    schedule: &Schedule,
    run_date: NaiveDate,
) -> Result<Issue, sqlx::Error> {
    let title = format!("{} — {}", schedule.title, run_date.format("%Y-%m-%d"));

    let input = NewIssue {
        environment_id: schedule.environment_id,
        plant_id: schedule.plant_id,
        location_id: schedule.location_id,
        title,
        description: schedule.notes.clone(),
        status: Some(IssueStatus::New),
        priority: Some(default_priority_for_type(&schedule.schedule_type)),
    };

    let issue = issues::create_issue(pool, input).await?;

    // Auto-assign a matching label if one exists (best-effort, no error if absent).
    if let Ok(labels) = issues::list_labels(pool).await {
        let target = label_name_for_type(&schedule.schedule_type);
        if let Some(label) = labels.iter().find(|l| l.name.eq_ignore_ascii_case(target)) {
            let _ = issues::add_label_to_issue(pool, issue.id, label.id).await;
        }
    }

    Ok(issue)
}

fn default_priority_for_type(schedule_type: &ScheduleType) -> IssuePriority {
    match schedule_type {
        ScheduleType::Treatment => IssuePriority::High,
        ScheduleType::Feed | ScheduleType::Water => IssuePriority::Medium,
        _ => IssuePriority::Low,
    }
}

fn label_name_for_type(schedule_type: &ScheduleType) -> &'static str {
    match schedule_type {
        ScheduleType::Feed => "Feeding",
        ScheduleType::Water => "Watering Issue",
        ScheduleType::Treatment => "Treatment",
        ScheduleType::Maintenance => "Maintenance",
        _ => "",
    }
}
