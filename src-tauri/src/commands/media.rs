use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, State};

use crate::db::{
    media as media_db,
    models::{Media, NewMedia},
};
use crate::services::media::MediaService;

#[tauri::command]
#[specta::specta]
pub async fn upload_media(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
    entity_type: String,
    entity_id: i64,
    file_path: String,
) -> Result<Media, String> {
    let src_path = std::path::PathBuf::from(&file_path);
    let file_name = src_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();

    let file_bytes = std::fs::read(&src_path).map_err(|e| e.to_string())?;
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let svc = MediaService::new(app_data_dir);
    let stored = svc.store_file(&file_bytes, &file_name, &entity_type, entity_id)?;

    media_db::create_media(
        &pool,
        NewMedia {
            entity_type,
            entity_id,
            file_path: stored.file_path,
            file_name,
            mime_type: stored.mime_type,
            thumbnail_path: stored.thumbnail_path,
            caption: None,
        },
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_media(
    pool: State<'_, SqlitePool>,
    entity_type: String,
    entity_id: i64,
) -> Result<Vec<Media>, String> {
    media_db::list_media(&pool, &entity_type, entity_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_media(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
    id: i64,
) -> Result<bool, String> {
    let media = media_db::delete_media(&pool, id)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(m) = media {
        let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let svc = MediaService::new(app_data_dir);
        svc.delete_files(&m.file_path, m.thumbnail_path.as_deref());
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Returns the file (or its thumbnail) as a base64-encoded string with the MIME type,
/// so the frontend can render it as a data: URI without needing asset:// protocol.
#[tauri::command]
#[specta::specta]
pub async fn read_media_base64(
    pool: State<'_, SqlitePool>,
    app: AppHandle,
    id: i64,
    thumbnail: bool,
) -> Result<MediaBase64, String> {
    let media = media_db::get_media(&pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Media not found".to_string())?;

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let svc = MediaService::new(app_data_dir);

    let (path, is_thumbnail) = if thumbnail {
        match &media.thumbnail_path {
            Some(p) => (p.as_str(), true),
            None => (media.file_path.as_str(), false),
        }
    } else {
        (media.file_path.as_str(), false)
    };

    let data = svc.read_as_base64(path)?;
    let mime_type = media
        .mime_type
        .unwrap_or_else(|| "application/octet-stream".to_string());

    Ok(MediaBase64 {
        id: media.id,
        mime_type,
        data,
        is_thumbnail,
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
pub struct MediaBase64 {
    pub id: i64,
    pub mime_type: String,
    pub data: String,
    pub is_thumbnail: bool,
}
