use std::{collections::BTreeMap, path::Path};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{sqlite::{SqliteArguments, SqliteRow}, Column, Row, Sqlite, SqlitePool, TypeInfo, ValueRef};

const INTERNAL_TABLES: &[&str] = &["_sqlx_migrations", "sqlite_sequence"];

#[derive(Debug, Serialize, Deserialize)]
struct GardenBackup {
    version: String,
    exported_at: String,
    tables: BTreeMap<String, Vec<Value>>,
    media_files: Vec<MediaBackupFile>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MediaBackupFile {
    relative_path: String,
    data_base64: String,
}

async fn list_user_tables(pool: &SqlitePool) -> Result<Vec<String>, String> {
    let table_names = sqlx::query_scalar::<_, String>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(table_names
        .into_iter()
        .filter(|name| !INTERNAL_TABLES.contains(&name.as_str()))
        .collect())
}

fn normalize_media_path(path: &str, app_data_dir: &Path) -> String {
    std::path::Path::new(path)
        .strip_prefix(app_data_dir)
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| path.to_string())
}

fn row_to_json(row: &SqliteRow, table: &str, app_data_dir: &Path) -> Result<Value, String> {
    let mut object = Map::new();

    for column in row.columns() {
        let index = column.ordinal();
        let raw = row.try_get_raw(index).map_err(|e| e.to_string())?;
        let value = if raw.is_null() {
            Value::Null
        } else {
            match raw.type_info().name().to_ascii_uppercase().as_str() {
                "INTEGER" | "INT" => Value::from(row.try_get::<i64, _>(index).map_err(|e| e.to_string())?),
                "REAL" | "FLOAT" | "DOUBLE" | "NUMERIC" => {
                    Value::from(row.try_get::<f64, _>(index).map_err(|e| e.to_string())?)
                }
                "BLOB" => serde_json::json!({
                    "__type": "blob",
                    "base64": STANDARD.encode(row.try_get::<Vec<u8>, _>(index).map_err(|e| e.to_string())?),
                }),
                _ => {
                    let text = row
                        .try_get::<String, _>(index)
                        .or_else(|_| row.try_get::<i64, _>(index).map(|value| value.to_string()))
                        .or_else(|_| row.try_get::<f64, _>(index).map(|value| value.to_string()))
                        .map_err(|e| e.to_string())?;

                    if table == "media" && (column.name() == "file_path" || column.name() == "thumbnail_path") {
                        Value::String(normalize_media_path(&text, app_data_dir))
                    } else {
                        Value::String(text)
                    }
                }
            }
        };

        object.insert(column.name().to_string(), value);
    }

    Ok(Value::Object(object))
}

async fn dump_table(pool: &SqlitePool, table: &str, app_data_dir: &Path) -> Result<Vec<Value>, String> {
    let sql = format!("SELECT * FROM \"{}\"", table.replace('"', "\"\""));
    let rows = sqlx::query(&sql)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    rows.into_iter()
        .map(|row| row_to_json(&row, table, app_data_dir))
        .collect()
}

fn collect_media_files(tables: &BTreeMap<String, Vec<Value>>, app_data_dir: &Path) -> Vec<MediaBackupFile> {
    tables
        .get("media")
        .into_iter()
        .flat_map(|rows| rows.iter())
        .filter_map(Value::as_object)
        .flat_map(|row| ["file_path", "thumbnail_path"].into_iter().filter_map(|key| row.get(key).and_then(Value::as_str)))
        .filter_map(|relative_path| {
            let full_path = app_data_dir.join(relative_path);
            std::fs::read(&full_path).ok().map(|bytes| MediaBackupFile {
                relative_path: relative_path.to_string(),
                data_base64: STANDARD.encode(bytes),
            })
        })
        .collect()
}

pub async fn export_garden_data_json(pool: &SqlitePool, app_data_dir: &Path) -> Result<String, String> {
    let mut tables = BTreeMap::new();
    for table in list_user_tables(pool).await? {
        tables.insert(table.clone(), dump_table(pool, &table, app_data_dir).await?);
    }

    let backup = GardenBackup {
        version: "15.0".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        media_files: collect_media_files(&tables, app_data_dir),
        tables,
    };

    serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())
}

fn bind_value<'a>(
    mut query: sqlx::query::Query<'a, Sqlite, SqliteArguments<'a>>,
    table: &str,
    column: &str,
    value: &'a Value,
    app_data_dir: &'a Path,
) -> Result<sqlx::query::Query<'a, Sqlite, SqliteArguments<'a>>, String> {
    query = match value {
        Value::Null => query.bind(Option::<String>::None),
        Value::Bool(v) => query.bind(*v),
        Value::Number(v) => {
            if let Some(i) = v.as_i64() {
                query.bind(i)
            } else if let Some(f) = v.as_f64() {
                query.bind(f)
            } else {
                return Err(format!("Unsupported numeric value in {table}.{column}"));
            }
        }
        Value::String(v) => {
            if table == "media" && (column == "file_path" || column == "thumbnail_path") {
                query.bind(app_data_dir.join(v).to_string_lossy().to_string())
            } else {
                query.bind(v)
            }
        }
        Value::Object(map) if map.get("__type").and_then(Value::as_str) == Some("blob") => {
            let blob = map
                .get("base64")
                .and_then(Value::as_str)
                .ok_or_else(|| format!("Invalid blob value in {table}.{column}"))?;
            query.bind(STANDARD.decode(blob).map_err(|e| e.to_string())?)
        }
        other => query.bind(other.to_string()),
    };

    Ok(query)
}

async fn insert_row(pool: &SqlitePool, table: &str, row: &Map<String, Value>, app_data_dir: &Path) -> Result<(), String> {
    let columns = row.keys().cloned().collect::<Vec<_>>();
    let escaped_columns = columns
        .iter()
        .map(|column| format!("\"{}\"", column.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = vec!["?"; columns.len()].join(", ");
    let sql = format!(
        "INSERT INTO \"{}\" ({}) VALUES ({})",
        table.replace('"', "\"\""),
        escaped_columns,
        placeholders
    );

    let mut query = sqlx::query(&sql);
    for column in &columns {
        query = bind_value(
            query,
            table,
            column,
            row.get(column)
                .ok_or_else(|| format!("Missing value for {}.{}", table, column))?,
            app_data_dir,
        )?;
    }

    query.execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn import_garden_data_json(pool: &SqlitePool, app_data_dir: &Path, content: &str) -> Result<(), String> {
    let backup: GardenBackup = serde_json::from_str(content).map_err(|e| e.to_string())?;
    let table_names = list_user_tables(pool).await?;

    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    for table in table_names.iter().rev() {
        let sql = format!("DELETE FROM \"{}\"", table.replace('"', "\"\""));
        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    for (table, rows) in &backup.tables {
        if !table_names.iter().any(|name| name == table) {
            continue;
        }

        for row in rows {
            let object = row
                .as_object()
                .ok_or_else(|| format!("Table {} contains a non-object row", table))?;
            insert_row(pool, table, object, app_data_dir).await?;
        }
    }

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    for media in backup.media_files {
        let target = app_data_dir.join(media.relative_path);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(target, STANDARD.decode(media.data_base64).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
