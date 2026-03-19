use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    journal,
    models::{JournalEntry, NewJournalEntry, Pagination, UpdateJournalEntry},
};

#[tauri::command]
#[specta::specta]
pub async fn list_journal_entries(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    plant_id: Option<i64>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<JournalEntry>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(200),
        offset: offset.unwrap_or(0),
    };
    if let Some(pid) = plant_id {
        journal::list_entries_by_plant(&pool, pid, pagination)
            .await
            .map_err(|e| e.to_string())
    } else {
        journal::list_entries(&pool, environment_id, pagination)
            .await
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_journal_entry(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<JournalEntry>, String> {
    journal::get_entry(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_journal_entry(
    pool: State<'_, SqlitePool>,
    input: NewJournalEntry,
) -> Result<JournalEntry, String> {
    journal::create_entry(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_journal_entry(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateJournalEntry,
) -> Result<Option<JournalEntry>, String> {
    journal::update_entry(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_journal_entry(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    journal::delete_entry(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
