use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    issues,
    models::{
        Issue, IssueComment, IssueLabel, IssueStatus, NewIssue, NewIssueLabel, Pagination,
        UpdateIssue, UpdateIssueLabel,
    },
};

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_issues(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Issue>, String> {
    issues::list_issues(
        &pool,
        environment_id,
        Pagination {
            limit: limit.unwrap_or(200),
            offset: offset.unwrap_or(0),
        },
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_issue(pool: State<'_, SqlitePool>, id: i64) -> Result<Option<Issue>, String> {
    issues::get_issue(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_issue(
    pool: State<'_, SqlitePool>,
    input: NewIssue,
) -> Result<Issue, String> {
    issues::create_issue(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_issue(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateIssue,
) -> Result<Option<Issue>, String> {
    issues::update_issue(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_issue(pool: State<'_, SqlitePool>, id: i64) -> Result<bool, String> {
    issues::delete_issue(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn transition_issue_status(
    pool: State<'_, SqlitePool>,
    id: i64,
    new_status: IssueStatus,
) -> Result<Option<Issue>, String> {
    let input = UpdateIssue {
        title: None,
        description: None,
        status: Some(new_status),
        priority: None,
        plant_id: None,
        location_id: None,
    };
    issues::update_issue(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_labels(pool: State<'_, SqlitePool>) -> Result<Vec<IssueLabel>, String> {
    issues::list_labels(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_label(
    pool: State<'_, SqlitePool>,
    input: NewIssueLabel,
) -> Result<IssueLabel, String> {
    issues::create_label(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_label(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateIssueLabel,
) -> Result<Option<IssueLabel>, String> {
    issues::update_label(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_label(pool: State<'_, SqlitePool>, id: i64) -> Result<bool, String> {
    issues::delete_label(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_issue_labels(
    pool: State<'_, SqlitePool>,
    issue_id: i64,
) -> Result<Vec<IssueLabel>, String> {
    issues::list_labels_for_issue(&pool, issue_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn assign_issue_label(
    pool: State<'_, SqlitePool>,
    issue_id: i64,
    label_id: i64,
) -> Result<(), String> {
    issues::add_label_to_issue(&pool, issue_id, label_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn remove_issue_label(
    pool: State<'_, SqlitePool>,
    issue_id: i64,
    label_id: i64,
) -> Result<(), String> {
    issues::remove_label_from_issue(&pool, issue_id, label_id)
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_issue_comments(
    pool: State<'_, SqlitePool>,
    issue_id: i64,
) -> Result<Vec<IssueComment>, String> {
    issues::list_comments(&pool, issue_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn add_issue_comment(
    pool: State<'_, SqlitePool>,
    issue_id: i64,
    body: String,
) -> Result<IssueComment, String> {
    issues::add_comment(&pool, issue_id, body)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_issue_comment(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    issues::delete_comment(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
