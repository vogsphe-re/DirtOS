use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use specta::Type;
use tauri::{AppHandle, State};

use crate::db::models::{BackupFormat, ExportPayload};
use crate::services::storage_paths::{self, StoragePreferences};
use crate::AppStorageState;
use crate::AppStartupState;
use crate::services::export;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppStartupStatus {
    pub ready: bool,
    pub recovering: bool,
    pub recovered_from_backup: bool,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct StorageSettings {
    pub default_user_data_dir: String,
    pub user_data_dir: String,
    pub backup_output_dir: String,
    pub using_user_data_override: bool,
    pub pending_migration_from: Option<String>,
    pub restart_required: bool,
}

fn build_storage_settings(
    app: &AppHandle,
    storage: &AppStorageState,
    prefs: StoragePreferences,
    restart_required: bool,
) -> Result<StorageSettings, String> {
    let runtime = storage.get_paths();
    let default_dir = storage_paths::default_user_data_dir(app)?;

    Ok(StorageSettings {
        default_user_data_dir: default_dir.to_string_lossy().into_owned(),
        user_data_dir: runtime.data_dir.to_string_lossy().into_owned(),
        backup_output_dir: runtime.backup_output_dir.to_string_lossy().into_owned(),
        using_user_data_override: prefs.user_data_dir.is_some(),
        pending_migration_from: prefs.pending_migration_from,
        restart_required,
    })
}

#[tauri::command]
#[specta::specta]
pub fn get_app_startup_status(
    startup: State<'_, AppStartupState>,
) -> Result<AppStartupStatus, String> {
    Ok(startup.get_status())
}

#[tauri::command]
#[specta::specta]
pub fn get_storage_settings(
    app: AppHandle,
    storage: State<'_, AppStorageState>,
) -> Result<StorageSettings, String> {
    let prefs = storage_paths::load_storage_preferences(&app)?;
    build_storage_settings(&app, &storage, prefs, false)
}

#[tauri::command]
#[specta::specta]
pub fn set_user_data_directory(
    app: AppHandle,
    storage: State<'_, AppStorageState>,
    path: String,
    migrate_existing: bool,
) -> Result<StorageSettings, String> {
    let runtime = storage.get_paths();
    let prefs = storage_paths::apply_user_data_override(
        &app,
        &path,
        &runtime.data_dir,
        migrate_existing,
    )?;

    build_storage_settings(&app, &storage, prefs, true)
}

#[tauri::command]
#[specta::specta]
pub fn clear_user_data_directory_override(
    app: AppHandle,
    storage: State<'_, AppStorageState>,
) -> Result<StorageSettings, String> {
    let prefs = storage_paths::clear_user_data_override(&app)?;
    build_storage_settings(&app, &storage, prefs, true)
}

#[tauri::command]
#[specta::specta]
pub fn set_backup_output_directory(
    app: AppHandle,
    storage: State<'_, AppStorageState>,
    path: Option<String>,
) -> Result<StorageSettings, String> {
    let prefs = storage_paths::apply_backup_output_override(&app, path)?;

    let runtime = storage.get_paths();
    let next_backup_dir = match prefs.backup_output_dir.as_deref() {
        Some(path) => std::path::PathBuf::from(path),
        None => runtime.data_dir.join("backups"),
    };

    std::fs::create_dir_all(&next_backup_dir).map_err(|e| e.to_string())?;
    storage.set_paths(runtime.data_dir, next_backup_dir);

    build_storage_settings(&app, &storage, prefs, false)
}

#[tauri::command]
#[specta::specta]
pub async fn export_full_garden_data(
    pool: State<'_, SqlitePool>,
    storage: State<'_, AppStorageState>,
) -> Result<ExportPayload, String> {
    let paths = storage.get_paths();
    let content = export::export_garden_data_json(&pool, &paths.data_dir).await?;

    Ok(ExportPayload {
        format: BackupFormat::Json,
        filename: format!("dirtos-garden-backup-{}.json", Utc::now().format("%Y%m%d-%H%M%S")),
        content,
        is_base64: false,
    })
}

#[tauri::command]
#[specta::specta]
pub async fn import_full_garden_data(
    pool: State<'_, SqlitePool>,
    storage: State<'_, AppStorageState>,
    content: String,
) -> Result<String, String> {
    let paths = storage.get_paths();
    export::import_garden_data_json(&pool, &paths.data_dir, &content).await?;
    Ok("Garden data imported successfully".to_string())
}
