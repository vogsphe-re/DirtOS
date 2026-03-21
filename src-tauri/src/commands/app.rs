use chrono::Utc;
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager, State};

use crate::db::models::{BackupFormat, ExportPayload};
use crate::AppStartupState;
use crate::services::export;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppStartupStatus {
    pub ready: bool,
    pub recovering: bool,
    pub recovered_from_backup: bool,
    pub message: Option<String>,
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
pub async fn export_full_garden_data(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
) -> Result<ExportPayload, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let content = export::export_garden_data_json(&pool, &app_data_dir).await?;

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
    app: AppHandle,
    content: String,
) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    export::import_garden_data_json(&pool, &app_data_dir, &content).await?;
    Ok("Garden data imported successfully".to_string())
}
