/// Inventory mode commands.
///
/// Provides asset-tag lookup (used by barcode scanner integration) and a
/// query for building the barcode label print page.
///
/// Uses non-macro sqlx (`sqlx::query()`) throughout so no compile-time
/// database connection is required.
use sqlx::{Row, SqlitePool};
use tauri::State;

use crate::db::models::AssetTagLookup;

// ---------------------------------------------------------------------------
// Tag lookup
// ---------------------------------------------------------------------------

/// Look up any entity by its asset tag.
///
/// Searches environments, locations, plants, harvests, seed_lots, and
/// seedling_trays in priority order and returns the first matching record.
///
/// Returns `None` when no entity carries the given tag.
#[tauri::command]
#[specta::specta]
pub async fn lookup_asset_tag(
    pool: State<'_, SqlitePool>,
    tag: String,
) -> Result<Option<AssetTagLookup>, String> {
    let tag = tag.trim().to_uppercase();

    // Environments
    if let Some(row) = sqlx::query(
        "SELECT id, name FROM environments WHERE UPPER(asset_id) = ? LIMIT 1",
    )
    .bind(&tag)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(Some(AssetTagLookup {
            asset_tag: tag,
            entity_type: "environment".into(),
            entity_id: row.get("id"),
            display_name: row.get("name"),
            description: None,
        }));
    }

    // Locations
    if let Some(row) = sqlx::query(
        "SELECT l.id, l.name, e.name AS env_name
         FROM locations l
         JOIN environments e ON e.id = l.environment_id
         WHERE UPPER(l.asset_id) = ? LIMIT 1",
    )
    .bind(&tag)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(Some(AssetTagLookup {
            asset_tag: tag,
            entity_type: "location".into(),
            entity_id: row.get("id"),
            display_name: row.get("name"),
            description: Some(row.get("env_name")),
        }));
    }

    // Plants
    if let Some(row) = sqlx::query(
        "SELECT p.id, p.name, e.name AS env_name
         FROM plants p
         JOIN environments e ON e.id = p.environment_id
         WHERE UPPER(p.asset_id) = ? LIMIT 1",
    )
    .bind(&tag)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(Some(AssetTagLookup {
            asset_tag: tag,
            entity_type: "plant".into(),
            entity_id: row.get("id"),
            display_name: row.get("name"),
            description: Some(row.get("env_name")),
        }));
    }

    // Harvests
    if let Some(row) = sqlx::query(
        "SELECT h.id, h.harvest_date, p.name AS plant_name
         FROM harvests h
         JOIN plants p ON p.id = h.plant_id
         WHERE UPPER(h.asset_id) = ? LIMIT 1",
    )
    .bind(&tag)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    {
        let date: String = row.get("harvest_date");
        return Ok(Some(AssetTagLookup {
            asset_tag: tag,
            entity_type: "harvest".into(),
            entity_id: row.get("id"),
            display_name: format!("Harvest {}", date),
            description: Some(row.get("plant_name")),
        }));
    }

    // Seed lots
    if let Some(row) = sqlx::query(
        "SELECT id, lot_label, asset_id FROM seed_lots WHERE UPPER(asset_id) = ? LIMIT 1",
    )
    .bind(&tag)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    {
        let id: i64 = row.get("id");
        let label: Option<String> = row.get("lot_label");
        return Ok(Some(AssetTagLookup {
            asset_tag: tag,
            entity_type: "seed_lot".into(),
            entity_id: id,
            display_name: label.unwrap_or_else(|| format!("Seed Lot #{}", id)),
            description: None,
        }));
    }

    // Seedling trays
    if let Some(row) = sqlx::query(
        "SELECT st.id, st.name, e.name AS env_name
         FROM seedling_trays st
         JOIN environments e ON e.id = st.environment_id
         WHERE UPPER(st.asset_id) = ? LIMIT 1",
    )
    .bind(&tag)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| e.to_string())?
    {
        return Ok(Some(AssetTagLookup {
            asset_tag: tag,
            entity_type: "seedling_tray".into(),
            entity_id: row.get("id"),
            display_name: row.get("name"),
            description: Some(row.get("env_name")),
        }));
    }

    Ok(None)
}

// ---------------------------------------------------------------------------
// Label print list
// ---------------------------------------------------------------------------

/// Return all tagged entities for the barcode label print page.
///
/// Each entry in the result can be rendered as a 2" × 1.5" label in the
/// browser's print view.  Pass `entity_types` as a comma-separated filter
/// ("plant,seed_lot") or an empty string / `None` for all types.
#[tauri::command]
#[specta::specta]
pub async fn list_asset_tags(
    pool: State<'_, SqlitePool>,
    entity_types: Option<String>,
) -> Result<Vec<AssetTagLookup>, String> {
    let filter: Vec<String> = entity_types
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let all = filter.is_empty();
    let mut results: Vec<AssetTagLookup> = Vec::new();

    if all || filter.contains(&"environment".to_string()) {
        let rows = sqlx::query(
            "SELECT id, name, asset_id FROM environments WHERE asset_id IS NOT NULL ORDER BY name",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for r in rows {
            let asset_id: String = r.get("asset_id");
            results.push(AssetTagLookup {
                asset_tag: asset_id,
                entity_type: "environment".into(),
                entity_id: r.get("id"),
                display_name: r.get("name"),
                description: None,
            });
        }
    }

    if all || filter.contains(&"location".to_string()) {
        let rows = sqlx::query(
            "SELECT l.id, l.name, l.asset_id, e.name AS env_name
             FROM locations l JOIN environments e ON e.id = l.environment_id
             WHERE l.asset_id IS NOT NULL ORDER BY e.name, l.name",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for r in rows {
            let asset_id: String = r.get("asset_id");
            results.push(AssetTagLookup {
                asset_tag: asset_id,
                entity_type: "location".into(),
                entity_id: r.get("id"),
                display_name: r.get("name"),
                description: Some(r.get("env_name")),
            });
        }
    }

    if all || filter.contains(&"plant".to_string()) {
        let rows = sqlx::query(
            "SELECT p.id, p.name, p.asset_id, e.name AS env_name
             FROM plants p JOIN environments e ON e.id = p.environment_id
             WHERE p.asset_id IS NOT NULL ORDER BY e.name, p.name",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for r in rows {
            let asset_id: String = r.get("asset_id");
            results.push(AssetTagLookup {
                asset_tag: asset_id,
                entity_type: "plant".into(),
                entity_id: r.get("id"),
                display_name: r.get("name"),
                description: Some(r.get("env_name")),
            });
        }
    }

    if all || filter.contains(&"harvest".to_string()) {
        let rows = sqlx::query(
            "SELECT h.id, h.harvest_date, h.asset_id, p.name AS plant_name
             FROM harvests h JOIN plants p ON p.id = h.plant_id
             WHERE h.asset_id IS NOT NULL ORDER BY h.harvest_date DESC",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for r in rows {
            let asset_id: String = r.get("asset_id");
            let date: String = r.get("harvest_date");
            results.push(AssetTagLookup {
                asset_tag: asset_id,
                entity_type: "harvest".into(),
                entity_id: r.get("id"),
                display_name: format!("Harvest {}", date),
                description: Some(r.get("plant_name")),
            });
        }
    }

    if all || filter.contains(&"seed_lot".to_string()) {
        let rows = sqlx::query(
            "SELECT id, lot_label, asset_id FROM seed_lots WHERE asset_id IS NOT NULL ORDER BY id DESC",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for r in rows {
            let asset_id: String = r.get("asset_id");
            let id: i64 = r.get("id");
            let label: Option<String> = r.get("lot_label");
            results.push(AssetTagLookup {
                asset_tag: asset_id,
                entity_type: "seed_lot".into(),
                entity_id: id,
                display_name: label.unwrap_or_else(|| format!("Seed Lot #{}", id)),
                description: None,
            });
        }
    }

    if all || filter.contains(&"seedling_tray".to_string()) {
        let rows = sqlx::query(
            "SELECT st.id, st.name, st.asset_id, e.name AS env_name
             FROM seedling_trays st JOIN environments e ON e.id = st.environment_id
             WHERE st.asset_id IS NOT NULL ORDER BY e.name, st.name",
        )
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;
        for r in rows {
            let asset_id: String = r.get("asset_id");
            results.push(AssetTagLookup {
                asset_tag: asset_id,
                entity_type: "seedling_tray".into(),
                entity_id: r.get("id"),
                display_name: r.get("name"),
                description: Some(r.get("env_name")),
            });
        }
    }

    Ok(results)
}
