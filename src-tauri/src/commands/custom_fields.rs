use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    custom_fields,
    models::{CustomField, CustomFieldEntityType, NewCustomField, UpdateCustomField},
};

#[tauri::command]
#[specta::specta]
pub async fn list_custom_fields(
    pool: State<'_, SqlitePool>,
    entity_type: CustomFieldEntityType,
    entity_id: i64,
) -> Result<Vec<CustomField>, String> {
    custom_fields::list_custom_fields(&pool, entity_type, entity_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_custom_field(
    pool: State<'_, SqlitePool>,
    input: NewCustomField,
) -> Result<CustomField, String> {
    custom_fields::create_custom_field(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_custom_field(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateCustomField,
) -> Result<Option<CustomField>, String> {
    custom_fields::update_custom_field(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_custom_field(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    custom_fields::delete_custom_field(&pool, id)
        .await
        .map_err(|e| e.to_string())
}
