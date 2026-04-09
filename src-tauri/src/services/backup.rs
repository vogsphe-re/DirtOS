use chrono::Utc;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};
use thiserror::Error;

const BACKUP_INTERVAL_SECS: u64 = 60 * 30;
const MAX_BACKUPS: usize = 16;

#[derive(Debug, Error)]
pub enum BackupServiceError {
    #[error("backup directory error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database checkpoint error: {0}")]
    Sql(#[from] sqlx::Error),
}

fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("dirtos.db")
}

pub fn latest_backup(backup_output_dir: &Path) -> Result<Option<PathBuf>, BackupServiceError> {
    if !backup_output_dir.exists() {
        return Ok(None);
    }

    let mut candidates = std::fs::read_dir(backup_output_dir)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("db"))
        .collect::<Vec<_>>();

    candidates.sort();
    Ok(candidates.pop())
}

fn prune_old_backups(backup_output_dir: &Path) -> Result<(), BackupServiceError> {
    if !backup_output_dir.exists() {
        return Ok(());
    }

    let mut candidates = std::fs::read_dir(backup_output_dir)?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("db"))
        .collect::<Vec<_>>();

    candidates.sort();

    let remove_count = candidates.len().saturating_sub(MAX_BACKUPS);
    if remove_count == 0 {
        return Ok(());
    }

    for path in candidates.into_iter().take(remove_count) {
        let _ = std::fs::remove_file(path);
    }

    Ok(())
}

pub async fn create_database_backup(
    pool: &SqlitePool,
    data_dir: &Path,
    backup_output_dir: &Path,
) -> Result<PathBuf, BackupServiceError> {
    std::fs::create_dir_all(backup_output_dir)?;

    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE);")
        .execute(pool)
        .await?;

    let source = db_path(data_dir);
    let target = backup_output_dir.join(format!(
        "dirtos-db-backup-{}.db",
        Utc::now().format("%Y%m%d-%H%M%S")
    ));

    std::fs::copy(source, &target)?;
    prune_old_backups(backup_output_dir)?;

    Ok(target)
}

pub fn restore_latest_backup(
    data_dir: &Path,
    backup_output_dir: &Path,
) -> Result<Option<PathBuf>, BackupServiceError> {
    let Some(latest) = latest_backup(backup_output_dir)? else {
        return Ok(None);
    };

    std::fs::create_dir_all(data_dir)?;

    let live_db = db_path(data_dir);
    if live_db.exists() {
        let corrupt = data_dir.join(format!(
            "dirtos-corrupt-{}.db",
            Utc::now().format("%Y%m%d-%H%M%S")
        ));
        let _ = std::fs::rename(&live_db, corrupt);
    }

    std::fs::copy(&latest, &live_db)?;
    Ok(Some(latest))
}

pub fn start_periodic_backups(data_dir: PathBuf, backup_output_dir: PathBuf, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(BACKUP_INTERVAL_SECS));
        interval.tick().await;

        loop {
            interval.tick().await;
            match create_database_backup(&pool, &data_dir, &backup_output_dir).await {
                Ok(path) => tracing::info!("Created periodic database backup at {:?}", path),
                Err(error) => tracing::warn!("Periodic backup failed: {:?}", error),
            }
        }
    });
}
