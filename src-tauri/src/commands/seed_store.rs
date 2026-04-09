use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::db::{
    integrations,
    models::{
        IntegrationProvider, NewSeedLot, Pagination, SeedEanLookup, SeedEanLookupStatus, SeedLot,
        SeedLotScanAction, SeedLotScanResult, SowSeedInput, UpdateSeedLot,
    },
    seed_store::{self, EanSeedMetadata},
};
use crate::services::ean_search;

#[derive(Debug, Deserialize, Default)]
struct EanSearchAuthConfig {
    api_token: Option<String>,
    token: Option<String>,
}

fn extract_ean_token(auth_json: Option<&str>) -> Option<String> {
    let parsed = auth_json
        .and_then(|raw| serde_json::from_str::<EanSearchAuthConfig>(raw).ok())
        .unwrap_or_default();

    parsed
        .api_token
        .or(parsed.token)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[tauri::command]
#[specta::specta]
pub async fn list_seed_store(
    pool: State<'_, SqlitePool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<SeedLot>, String> {
    let pagination = Pagination {
        limit: limit.unwrap_or(200),
        offset: offset.unwrap_or(0),
    };
    seed_store::list_seed_store(&pool, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_seed_store_item(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<SeedLot>, String> {
    seed_store::get_seed_lot(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_seed_store_item(
    pool: State<'_, SqlitePool>,
    input: NewSeedLot,
) -> Result<SeedLot, String> {
    seed_store::create_seed_lot(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_seed_store_item(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateSeedLot,
) -> Result<Option<SeedLot>, String> {
    seed_store::update_seed_lot(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_seed_store_item(pool: State<'_, SqlitePool>, id: i64) -> Result<bool, String> {
    seed_store::delete_seed_lot(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sow_seed_to_tray(
    pool: State<'_, SqlitePool>,
    input: SowSeedInput,
) -> Result<i64, String> {
    seed_store::sow_seed_to_tray(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn scan_seed_packet_ean(
    pool: State<'_, SqlitePool>,
    barcode: String,
) -> Result<SeedLotScanResult, String> {
    let normalized = ean_search::normalize_barcode(&barcode)?;
    let existing = seed_store::get_seed_lot_by_ean(&pool, &normalized)
        .await
        .map_err(|e| e.to_string())?;

    let cfg = integrations::get_integration_config(&pool, IntegrationProvider::EanSearch)
        .await
        .map_err(|e| e.to_string())?;

    let integration_enabled = cfg.as_ref().map(|c| c.enabled).unwrap_or(true);
    let configured_rate_limit = cfg.as_ref().and_then(|c| c.rate_limit_per_minute);
    let api_token = extract_ean_token(cfg.as_ref().and_then(|c| c.auth_json.as_deref()));

    let mut metadata: Option<EanSeedMetadata> = None;

    let lookup = if integration_enabled {
        let client = ean_search::build_http_client()?;
        match ean_search::lookup_barcode(
            &client,
            &normalized,
            api_token.as_deref(),
            configured_rate_limit,
        )
        .await
        {
            ean_search::EanLookupOutcome::Found(product) => {
                metadata = Some(EanSeedMetadata {
                    product_name: product.product_name.clone(),
                    category_name: product.category_name.clone(),
                    issuing_country: product.issuing_country.clone(),
                });

                Some(SeedEanLookup {
                    ean_code: product.ean_code,
                    product_name: product.product_name,
                    category_name: product.category_name,
                    issuing_country: product.issuing_country,
                    lookup_status: SeedEanLookupStatus::Success,
                    message: None,
                })
            }
            ean_search::EanLookupOutcome::NotFound => Some(SeedEanLookup {
                ean_code: normalized.clone(),
                product_name: None,
                category_name: None,
                issuing_country: None,
                lookup_status: SeedEanLookupStatus::NotFound,
                message: Some("No matching product was found in EAN-Search".to_string()),
            }),
            ean_search::EanLookupOutcome::RateLimited {
                limit_per_minute,
                message,
            } => Some(SeedEanLookup {
                ean_code: normalized.clone(),
                product_name: None,
                category_name: None,
                issuing_country: None,
                lookup_status: SeedEanLookupStatus::RateLimited,
                message: Some(format!("{message} (limit: {limit_per_minute}/min)")),
            }),
            ean_search::EanLookupOutcome::TokenRequired { message } => Some(SeedEanLookup {
                ean_code: normalized.clone(),
                product_name: None,
                category_name: None,
                issuing_country: None,
                lookup_status: SeedEanLookupStatus::TokenRequired,
                message: Some(message),
            }),
            ean_search::EanLookupOutcome::Error { message } => Some(SeedEanLookup {
                ean_code: normalized.clone(),
                product_name: None,
                category_name: None,
                issuing_country: None,
                lookup_status: SeedEanLookupStatus::Error,
                message: Some(message),
            }),
        }
    } else {
        Some(SeedEanLookup {
            ean_code: normalized.clone(),
            product_name: None,
            category_name: None,
            issuing_country: None,
            lookup_status: SeedEanLookupStatus::Skipped,
            message: Some("EAN-Search integration is disabled in Settings".to_string()),
        })
    };

    if let Some(lot) = existing {
        let seed_lot = seed_store::enrich_seed_lot_from_ean_scan(
            &pool,
            lot.id,
            &normalized,
            metadata.as_ref(),
        )
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Seed lot not found while enriching scan result".to_string())?;

        let action = if metadata.is_some() {
            SeedLotScanAction::Enriched
        } else {
            SeedLotScanAction::Matched
        };

        return Ok(SeedLotScanResult {
            seed_lot,
            action,
            lookup,
        });
    }

    let seed_lot = seed_store::create_seed_lot_from_ean_scan(&pool, &normalized, metadata.as_ref())
        .await
        .map_err(|e| e.to_string())?;

    Ok(SeedLotScanResult {
        seed_lot,
        action: SeedLotScanAction::Created,
        lookup,
    })
}
