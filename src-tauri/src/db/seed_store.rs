use sqlx::SqlitePool;

use super::models::{NewSeedLot, Pagination, SeedLot, SowSeedInput, UpdateSeedLot};
use crate::services::asset_tag;

#[derive(Debug, Clone, Default)]
pub struct EanSeedMetadata {
    pub product_name: Option<String>,
    pub category_name: Option<String>,
    pub issuing_country: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct AsinSeedMetadata {
    pub title: Option<String>,
    pub brand: Option<String>,
    pub product_url: Option<String>,
}

pub async fn list_seed_store(
    pool: &SqlitePool,
    pagination: Pagination,
) -> Result<Vec<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>(
        "SELECT * FROM seed_lots ORDER BY created_at DESC LIMIT ? OFFSET ?",
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_seed_lot(pool: &SqlitePool, id: i64) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>("SELECT * FROM seed_lots WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_seed_lot(pool: &SqlitePool, input: NewSeedLot) -> Result<SeedLot, sqlx::Error> {
    let source_type = input.source_type.unwrap_or_else(|| "purchased".to_string());
    let tag = asset_tag::generate_tag("SED");
    let result = sqlx::query(
        "INSERT INTO seed_lots
            (species_id, parent_plant_id, harvest_id, lot_label, quantity,
             viability_pct, storage_location, collected_date,
             source_type, vendor, purchase_date, expiration_date,
             packet_info, ean_code, ean_product_name, ean_category_name,
             ean_issuing_country, ean_last_lookup_at, sale_ean, sale_asin, notes, asset_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(input.species_id)
    .bind(input.parent_plant_id)
    .bind(input.harvest_id)
    .bind(&input.lot_label)
    .bind(input.quantity)
    .bind(input.viability_pct)
    .bind(&input.storage_location)
    .bind(&input.collected_date)
    .bind(&source_type)
    .bind(&input.vendor)
    .bind(&input.purchase_date)
    .bind(&input.expiration_date)
    .bind(&input.packet_info)
    .bind(&input.ean_code)
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind(&input.sale_ean)
    .bind(&input.sale_asin)
    .bind(&input.notes)
    .bind(&tag)
    .execute(pool)
    .await?;

    get_seed_lot(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_seed_lot(
    pool: &SqlitePool,
    id: i64,
    input: UpdateSeedLot,
) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query(
        "UPDATE seed_lots SET
            species_id       = COALESCE(?, species_id),
            lot_label        = COALESCE(?, lot_label),
            quantity         = COALESCE(?, quantity),
            viability_pct    = COALESCE(?, viability_pct),
            storage_location = COALESCE(?, storage_location),
            collected_date   = COALESCE(?, collected_date),
            source_type      = COALESCE(?, source_type),
            vendor           = COALESCE(?, vendor),
            purchase_date    = COALESCE(?, purchase_date),
            expiration_date  = COALESCE(?, expiration_date),
            packet_info      = COALESCE(?, packet_info),
            ean_code         = COALESCE(?, ean_code),
            sale_ean         = COALESCE(?, sale_ean),
            sale_asin        = COALESCE(?, sale_asin),
            notes            = COALESCE(?, notes),
            updated_at       = datetime('now')
         WHERE id = ?",
    )
    .bind(input.species_id)
    .bind(&input.lot_label)
    .bind(input.quantity)
    .bind(input.viability_pct)
    .bind(&input.storage_location)
    .bind(&input.collected_date)
    .bind(&input.source_type)
    .bind(&input.vendor)
    .bind(&input.purchase_date)
    .bind(&input.expiration_date)
    .bind(&input.packet_info)
    .bind(&input.ean_code)
    .bind(&input.sale_ean)
    .bind(&input.sale_asin)
    .bind(&input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_seed_lot(pool, id).await
}

pub async fn delete_seed_lot(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM seed_lots WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

pub async fn get_seed_lot_by_ean(
    pool: &SqlitePool,
    ean_code: &str,
) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>(
        "SELECT * FROM seed_lots
         WHERE ean_code = ?
         ORDER BY updated_at DESC
         LIMIT 1",
    )
    .bind(ean_code)
    .fetch_optional(pool)
    .await
}

fn packet_info_with_ean(existing: Option<&str>, ean_code: &str) -> Option<String> {
    let ean_fragment = format!("EAN {ean_code}");
    let current = existing.unwrap_or("").trim();

    if current.is_empty() {
        return Some(ean_fragment);
    }

    if current
        .to_ascii_uppercase()
        .contains(&ean_fragment.to_ascii_uppercase())
    {
        return None;
    }

    Some(format!("{current} | {ean_fragment}"))
}

pub async fn create_seed_lot_from_ean_scan(
    pool: &SqlitePool,
    ean_code: &str,
    metadata: Option<&EanSeedMetadata>,
) -> Result<SeedLot, sqlx::Error> {
    let tag = asset_tag::generate_tag("SED");
    let product_name = metadata.and_then(|m| m.product_name.clone());
    let category_name = metadata.and_then(|m| m.category_name.clone());
    let issuing_country = metadata.and_then(|m| m.issuing_country.clone());

    let lot_label = product_name
        .clone()
        .or_else(|| Some(format!("Seed packet {ean_code}")));

    let mut packet_parts = vec![format!("EAN {ean_code}")];
    if let Some(category) = &category_name {
        packet_parts.push(format!("Category {category}"));
    }
    if let Some(country) = &issuing_country {
        packet_parts.push(format!("Country {country}"));
    }
    let packet_info = Some(packet_parts.join(" | "));

    let result = sqlx::query(
        "INSERT INTO seed_lots
            (species_id, parent_plant_id, harvest_id, lot_label, quantity,
             viability_pct, storage_location, collected_date,
             source_type, vendor, purchase_date, expiration_date,
             packet_info, ean_code, ean_product_name, ean_category_name,
             ean_issuing_country, ean_last_lookup_at, notes, asset_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?,?)",
    )
    .bind(Option::<i64>::None)
    .bind(Option::<i64>::None)
    .bind(Option::<i64>::None)
    .bind(&lot_label)
    .bind(Option::<f64>::None)
    .bind(Option::<f64>::None)
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind("purchased")
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind(&packet_info)
    .bind(ean_code)
    .bind(product_name)
    .bind(category_name)
    .bind(issuing_country)
    .bind(Option::<String>::None)
    .bind(&tag)
    .execute(pool)
    .await?;

    get_seed_lot(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn enrich_seed_lot_from_ean_scan(
    pool: &SqlitePool,
    lot_id: i64,
    ean_code: &str,
    metadata: Option<&EanSeedMetadata>,
) -> Result<Option<SeedLot>, sqlx::Error> {
    let Some(existing) = get_seed_lot(pool, lot_id).await? else {
        return Ok(None);
    };

    let product_name = metadata.and_then(|m| m.product_name.clone());
    let category_name = metadata.and_then(|m| m.category_name.clone());
    let issuing_country = metadata.and_then(|m| m.issuing_country.clone());

    let should_fill_label = existing
        .lot_label
        .as_deref()
        .map(|v| v.trim().is_empty())
        .unwrap_or(true);
    let lot_label = if should_fill_label {
        product_name.clone()
    } else {
        None
    };

    let packet_info = packet_info_with_ean(existing.packet_info.as_deref(), ean_code);

    sqlx::query(
        "UPDATE seed_lots SET
            lot_label           = COALESCE(?, lot_label),
            packet_info         = COALESCE(?, packet_info),
            ean_code            = ?,
            ean_product_name    = COALESCE(?, ean_product_name),
            ean_category_name   = COALESCE(?, ean_category_name),
            ean_issuing_country = COALESCE(?, ean_issuing_country),
            ean_last_lookup_at  = datetime('now'),
            updated_at          = datetime('now')
         WHERE id = ?",
    )
    .bind(lot_label)
    .bind(packet_info)
    .bind(ean_code)
    .bind(product_name)
    .bind(category_name)
    .bind(issuing_country)
    .bind(lot_id)
    .execute(pool)
    .await?;

    get_seed_lot(pool, lot_id).await
}

/// Sow a seed from a lot into a seedling tray cell.
/// Creates a new plant with Seedling status, assigns it to the tray cell,
/// and decrements the seed lot quantity by 1.
pub async fn sow_seed_to_tray(pool: &SqlitePool, input: SowSeedInput) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;

    // Fetch seed lot to get species_id and verify it exists with quantity > 0
    let lot = sqlx::query_as::<_, SeedLot>("SELECT * FROM seed_lots WHERE id = ?")
        .bind(input.seed_lot_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    let current_qty = lot.quantity.unwrap_or(0.0);
    if current_qty <= 0.0 {
        return Err(sqlx::Error::Protocol(
            "Seed lot has no remaining quantity".into(),
        ));
    }

    // Get the tray to find its environment_id
    let tray_env: (i64,) = sqlx::query_as("SELECT environment_id FROM seedling_trays WHERE id = ?")
        .bind(input.tray_id)
        .fetch_one(&mut *tx)
        .await?;

    // Build a plant name
    let plant_name = input.plant_name.unwrap_or_else(|| {
        format!(
            "Seedling from {}",
            lot.lot_label.as_deref().unwrap_or("seed lot")
        )
    });

    // Create the plant with Seedling status
    let plant_result = sqlx::query(
        "INSERT INTO plants (species_id, environment_id, status, name, seed_lot_id, planted_date, notes)
         VALUES (?, ?, 'seedling', ?, ?, date('now'), ?)",
    )
    .bind(lot.species_id)
    .bind(tray_env.0)
    .bind(&plant_name)
    .bind(lot.id)
    .bind(&input.notes)
    .execute(&mut *tx)
    .await?;

    let plant_id = plant_result.last_insert_rowid();

    // Assign the plant to the tray cell (upsert)
    sqlx::query(
        "INSERT INTO seedling_tray_cells (tray_id, row, col, plant_id, notes)
         VALUES (?,?,?,?,?)
         ON CONFLICT(tray_id, row, col) DO UPDATE SET
            plant_id   = excluded.plant_id,
            notes      = excluded.notes,
            updated_at = datetime('now')",
    )
    .bind(input.tray_id)
    .bind(input.row)
    .bind(input.col)
    .bind(plant_id)
    .bind(&input.notes)
    .execute(&mut *tx)
    .await?;

    // Decrement the seed lot quantity
    sqlx::query(
        "UPDATE seed_lots SET quantity = quantity - 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(input.seed_lot_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(plant_id)
}

// ---------------------------------------------------------------------------
// ASIN scan helpers
// ---------------------------------------------------------------------------

pub async fn get_seed_lot_by_asin(
    pool: &SqlitePool,
    asin: &str,
) -> Result<Option<SeedLot>, sqlx::Error> {
    sqlx::query_as::<_, SeedLot>(
        "SELECT * FROM seed_lots
         WHERE asin_code = ?
         ORDER BY updated_at DESC
         LIMIT 1",
    )
    .bind(asin)
    .fetch_optional(pool)
    .await
}

fn packet_info_with_asin(existing: Option<&str>, asin: &str) -> Option<String> {
    let fragment = format!("ASIN {asin}");
    let current = existing.unwrap_or("").trim();

    if current.is_empty() {
        return Some(fragment);
    }

    if current
        .to_ascii_uppercase()
        .contains(&fragment.to_ascii_uppercase())
    {
        return None;
    }

    Some(format!("{current} | {fragment}"))
}

pub async fn create_seed_lot_from_asin_scan(
    pool: &SqlitePool,
    asin: &str,
    metadata: Option<&AsinSeedMetadata>,
) -> Result<SeedLot, sqlx::Error> {
    let tag = asset_tag::generate_tag("SED");
    let title = metadata.and_then(|m| m.title.clone());
    let brand = metadata.and_then(|m| m.brand.clone());

    let lot_label = title
        .clone()
        .or_else(|| Some(format!("Amazon product {asin}")));

    let mut packet_parts = vec![format!("ASIN {asin}")];
    if let Some(b) = &brand {
        packet_parts.push(format!("Brand {b}"));
    }
    let packet_info = Some(packet_parts.join(" | "));

    let result = sqlx::query(
        "INSERT INTO seed_lots
            (species_id, parent_plant_id, harvest_id, lot_label, quantity,
             viability_pct, storage_location, collected_date,
             source_type, vendor, purchase_date, expiration_date,
             packet_info, asin_code, asin_product_title, asin_brand,
             asin_last_lookup_at, notes, asset_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?,?)",
    )
    .bind(Option::<i64>::None)
    .bind(Option::<i64>::None)
    .bind(Option::<i64>::None)
    .bind(&lot_label)
    .bind(Option::<f64>::None)
    .bind(Option::<f64>::None)
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind("purchased")
    .bind(brand.clone())
    .bind(Option::<String>::None)
    .bind(Option::<String>::None)
    .bind(&packet_info)
    .bind(asin)
    .bind(title)
    .bind(brand)
    .bind(Option::<String>::None)
    .bind(&tag)
    .execute(pool)
    .await?;

    get_seed_lot(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn enrich_seed_lot_from_asin_scan(
    pool: &SqlitePool,
    lot_id: i64,
    asin: &str,
    metadata: Option<&AsinSeedMetadata>,
) -> Result<Option<SeedLot>, sqlx::Error> {
    let Some(existing) = get_seed_lot(pool, lot_id).await? else {
        return Ok(None);
    };

    let title = metadata.and_then(|m| m.title.clone());
    let brand = metadata.and_then(|m| m.brand.clone());

    let should_fill_label = existing
        .lot_label
        .as_deref()
        .map(|v| v.trim().is_empty())
        .unwrap_or(true);
    let lot_label = if should_fill_label { title.clone() } else { None };

    let packet_info = packet_info_with_asin(existing.packet_info.as_deref(), asin);

    sqlx::query(
        "UPDATE seed_lots SET
            lot_label            = COALESCE(?, lot_label),
            packet_info          = COALESCE(?, packet_info),
            asin_code            = ?,
            asin_product_title   = COALESCE(?, asin_product_title),
            asin_brand           = COALESCE(?, asin_brand),
            asin_last_lookup_at  = datetime('now'),
            updated_at           = datetime('now')
         WHERE id = ?",
    )
    .bind(lot_label)
    .bind(packet_info)
    .bind(asin)
    .bind(title)
    .bind(brand)
    .bind(lot_id)
    .execute(pool)
    .await?;

    get_seed_lot(pool, lot_id).await
}
