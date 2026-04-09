use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch, post},
};
use serde::Deserialize;
use tauri::Manager;

use crate::{
    AppStorageState,
    db::{
        integrations,
        models::{BackupJob, BackupRun, ExportPayload, NewBackupJob, UpdateBackupJob},
    },
    services::backup_jobs,
};

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/backups/jobs", get(list_jobs).post(create_job))
        .route("/api/v1/backups/jobs/{id}", patch(update_job))
        .route("/api/v1/backups/jobs/{id}/run", post(run_job))
        .route("/api/v1/backups/runs", get(list_runs))
}

#[derive(Debug, Deserialize)]
pub struct BackupRunsQuery {
    pub backup_job_id: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Default, Deserialize)]
pub struct RunBackupJobInput {
    pub encryption_password: Option<String>,
}

async fn list_jobs(State(s): State<AppState>) -> ApiResult<Vec<BackupJob>> {
    let rows = integrations::list_backup_jobs(&s.pool)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(rows))
}

async fn create_job(
    State(s): State<AppState>,
    Json(body): Json<NewBackupJob>,
) -> ApiResult<BackupJob> {
    let row = integrations::create_backup_job(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update_job(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateBackupJob>,
) -> Result<Json<BackupJob>, (StatusCode, Json<serde_json::Value>)> {
    match integrations::update_backup_job(&s.pool, id, body).await {
        Ok(Some(row)) => Ok(Json(row)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )),
    }
}

async fn list_runs(
    State(s): State<AppState>,
    Query(q): Query<BackupRunsQuery>,
) -> ApiResult<Vec<BackupRun>> {
    let rows = integrations::list_backup_runs(&s.pool, q.backup_job_id, q.limit.unwrap_or(100))
        .await
        .map_err(ApiError::from)?;
    Ok(Json(rows))
}

async fn run_job(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<RunBackupJobInput>,
) -> ApiResult<ExportPayload> {
    let runtime = s.app_handle.state::<AppStorageState>().get_paths();

    let payload = backup_jobs::run_backup_job_by_id(
        &s.pool,
        id,
        &runtime.data_dir,
        &runtime.backup_output_dir,
        body.encryption_password,
    )
    .await
    .map_err(ApiError::from)?;

    Ok(Json(payload))
}
