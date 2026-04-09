use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const STORAGE_PREFS_FILE: &str = "storage-paths.json";
const APP_DIR_NAME: &str = "DirtOS";
const DB_FILE_NAME: &str = "dirtos.db";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoragePreferences {
    pub user_data_dir: Option<String>,
    pub backup_output_dir: Option<String>,
    pub pending_migration_from: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ResolvedStoragePaths {
    pub data_dir: PathBuf,
    pub backup_output_dir: PathBuf,
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}

fn expand_tilde(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(path));
    }

    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }

    if let Some(rest) = path.strip_prefix("~\\") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }

    PathBuf::from(path)
}

fn normalize_override_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Path must not be empty".to_string());
    }

    let expanded = expand_tilde(trimmed);
    let is_unc = trimmed.starts_with("\\\\");
    if expanded.is_absolute() || is_unc {
        Ok(expanded)
    } else {
        Err("Path must be absolute (or a UNC network path)".to_string())
    }
}

fn is_same_path(left: &Path, right: &Path) -> bool {
    if left == right {
        return true;
    }

    match (std::fs::canonicalize(left), std::fs::canonicalize(right)) {
        (Ok(a), Ok(b)) => a == b,
        _ => false,
    }
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(destination).map_err(|e| e.to_string())?;

    for entry in std::fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let target_path = destination.join(entry.file_name());
        let file_type = entry.file_type().map_err(|e| e.to_string())?;

        if file_type.is_dir() {
            copy_dir_recursive(&entry_path, &target_path)?;
        } else if file_type.is_file() {
            if let Some(parent) = target_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::copy(&entry_path, &target_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_config_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("Failed to resolve app config directory: {e}"))?;

    Ok(base.join(STORAGE_PREFS_FILE))
}

pub fn load_storage_preferences(app: &AppHandle) -> Result<StoragePreferences, String> {
    let path = preferences_path(app)?;
    if !path.exists() {
        return Ok(StoragePreferences::default());
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str::<StoragePreferences>(&raw)
        .map_err(|e| format!("Invalid storage preferences file {path:?}: {e}"))
}

pub fn save_storage_preferences(
    app: &AppHandle,
    preferences: &StoragePreferences,
) -> Result<(), String> {
    let path = preferences_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let serialized = serde_json::to_string_pretty(preferences).map_err(|e| e.to_string())?;
    std::fs::write(&path, serialized).map_err(|e| e.to_string())
}

pub fn default_documents_dir(app: &AppHandle) -> Result<PathBuf, String> {
    match app.path().document_dir() {
        Ok(path) => Ok(path),
        Err(err) => {
            let fallback = home_dir()
                .ok_or_else(|| format!("Unable to resolve document directory: {err}"))?
                .join("Documents");
            tracing::warn!(
                "Failed to resolve document_dir via platform APIs: {}. Falling back to {:?}",
                err,
                fallback
            );
            Ok(fallback)
        }
    }
}

pub fn default_user_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(default_documents_dir(app)?.join(APP_DIR_NAME))
}

pub fn apply_user_data_override(
    app: &AppHandle,
    override_path: &str,
    current_data_dir: &Path,
    migrate_existing: bool,
) -> Result<StoragePreferences, String> {
    let mut prefs = load_storage_preferences(app)?;
    let normalized = normalize_override_path(override_path)?;
    std::fs::create_dir_all(&normalized).map_err(|e| e.to_string())?;

    prefs.user_data_dir = Some(normalized.to_string_lossy().into_owned());
    prefs.pending_migration_from = if migrate_existing && !is_same_path(current_data_dir, &normalized) {
        Some(current_data_dir.to_string_lossy().into_owned())
    } else {
        None
    };

    save_storage_preferences(app, &prefs)?;
    Ok(prefs)
}

pub fn clear_user_data_override(app: &AppHandle) -> Result<StoragePreferences, String> {
    let mut prefs = load_storage_preferences(app)?;
    prefs.user_data_dir = None;
    prefs.pending_migration_from = None;
    save_storage_preferences(app, &prefs)?;
    Ok(prefs)
}

pub fn apply_backup_output_override(
    app: &AppHandle,
    backup_output_dir: Option<String>,
) -> Result<StoragePreferences, String> {
    let mut prefs = load_storage_preferences(app)?;

    prefs.backup_output_dir = match backup_output_dir {
        Some(path) if path.trim().is_empty() => None,
        Some(path) => {
            let normalized = normalize_override_path(&path)?;
            std::fs::create_dir_all(&normalized).map_err(|e| e.to_string())?;
            Some(normalized.to_string_lossy().into_owned())
        }
        None => None,
    };

    save_storage_preferences(app, &prefs)?;
    Ok(prefs)
}

fn apply_pending_migration(
    app: &AppHandle,
    prefs: &mut StoragePreferences,
    data_dir: &Path,
) -> Result<(), String> {
    let Some(source_raw) = prefs.pending_migration_from.clone() else {
        return Ok(());
    };

    let source_dir = PathBuf::from(source_raw);
    if !source_dir.exists() || is_same_path(&source_dir, data_dir) {
        prefs.pending_migration_from = None;
        save_storage_preferences(app, prefs)?;
        return Ok(());
    }

    let source_db = source_dir.join(DB_FILE_NAME);
    let target_db = data_dir.join(DB_FILE_NAME);

    if !source_db.exists() || target_db.exists() {
        prefs.pending_migration_from = None;
        save_storage_preferences(app, prefs)?;
        return Ok(());
    }

    tracing::info!(
        "Migrating user data directory from {:?} to {:?}",
        source_dir,
        data_dir
    );

    copy_dir_recursive(&source_dir, data_dir)?;

    prefs.pending_migration_from = None;
    save_storage_preferences(app, prefs)?;
    Ok(())
}

pub fn resolve_storage_paths(app: &AppHandle) -> Result<ResolvedStoragePaths, String> {
    let default_data_dir = default_user_data_dir(app)?;
    let mut prefs = load_storage_preferences(app)?;

    let data_dir = match prefs.user_data_dir.as_deref() {
        Some(path) => normalize_override_path(path)?,
        None => default_data_dir,
    };

    std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    apply_pending_migration(app, &mut prefs, &data_dir)?;

    let backup_output_dir = match prefs.backup_output_dir.as_deref() {
        Some(path) => normalize_override_path(path)?,
        None => data_dir.join("backups"),
    };

    std::fs::create_dir_all(&backup_output_dir).map_err(|e| e.to_string())?;

    Ok(ResolvedStoragePaths {
        data_dir,
        backup_output_dir,
    })
}
