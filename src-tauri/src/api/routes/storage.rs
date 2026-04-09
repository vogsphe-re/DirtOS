use std::path::PathBuf;

use axum::{
    Json, Router,
    extract::State,
    routing::{get, put},
};
use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::{
    AppStorageState,
    services::storage_paths::{self, StoragePreferences},
};

use super::{ApiError, ApiResult, AppState};

#[derive(Debug, Serialize)]
pub struct StorageSettingsResponse {
    pub default_user_data_dir: String,
    pub user_data_dir: String,
    pub backup_output_dir: String,
    pub using_user_data_override: bool,
    pub pending_migration_from: Option<String>,
    pub restart_required: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetUserDataDirectoryInput {
    pub path: String,
    pub migrate_existing: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SetBackupOutputDirectoryInput {
    pub path: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/settings/storage", get(get_storage_settings))
        .route(
            "/api/v1/settings/storage/user-data",
            put(set_user_data_directory).delete(clear_user_data_directory_override),
        )
        .route(
            "/api/v1/settings/storage/backup-output",
            put(set_backup_output_directory),
        )
}

fn build_response(
    state: &AppState,
    prefs: StoragePreferences,
    restart_required: bool,
) -> Result<StorageSettingsResponse, ApiError> {
    let runtime = state.app_handle.state::<AppStorageState>().get_paths();
    let default_dir = storage_paths::default_user_data_dir(&state.app_handle).map_err(ApiError::from)?;

    Ok(StorageSettingsResponse {
        default_user_data_dir: default_dir.to_string_lossy().into_owned(),
        user_data_dir: runtime.data_dir.to_string_lossy().into_owned(),
        backup_output_dir: runtime.backup_output_dir.to_string_lossy().into_owned(),
        using_user_data_override: prefs.user_data_dir.is_some(),
        pending_migration_from: prefs.pending_migration_from,
        restart_required,
    })
}

async fn get_storage_settings(State(s): State<AppState>) -> ApiResult<StorageSettingsResponse> {
    let prefs = storage_paths::load_storage_preferences(&s.app_handle).map_err(ApiError::from)?;
    let body = build_response(&s, prefs, false)?;
    Ok(Json(body))
}

async fn set_user_data_directory(
    State(s): State<AppState>,
    Json(body): Json<SetUserDataDirectoryInput>,
) -> ApiResult<StorageSettingsResponse> {
    let runtime = s.app_handle.state::<AppStorageState>().get_paths();
    let prefs = storage_paths::apply_user_data_override(
        &s.app_handle,
        &body.path,
        &runtime.data_dir,
        body.migrate_existing.unwrap_or(false),
    )
    .map_err(ApiError::from)?;

    let payload = build_response(&s, prefs, true)?;
    Ok(Json(payload))
}

async fn clear_user_data_directory_override(
    State(s): State<AppState>,
) -> ApiResult<StorageSettingsResponse> {
    let prefs = storage_paths::clear_user_data_override(&s.app_handle).map_err(ApiError::from)?;
    let payload = build_response(&s, prefs, true)?;
    Ok(Json(payload))
}

async fn set_backup_output_directory(
    State(s): State<AppState>,
    Json(body): Json<SetBackupOutputDirectoryInput>,
) -> ApiResult<StorageSettingsResponse> {
    let prefs = storage_paths::apply_backup_output_override(&s.app_handle, body.path).map_err(ApiError::from)?;

    let storage = s.app_handle.state::<AppStorageState>();
    let runtime = storage.get_paths();
    let next_backup_dir = match prefs.backup_output_dir.as_deref() {
        Some(path) => PathBuf::from(path),
        None => runtime.data_dir.join("backups"),
    };

    std::fs::create_dir_all(&next_backup_dir)
        .map_err(|e| ApiError::from(e.to_string()))?;

    storage.set_paths(runtime.data_dir, next_backup_dir);

    let payload = build_response(&s, prefs, false)?;
    Ok(Json(payload))
}
