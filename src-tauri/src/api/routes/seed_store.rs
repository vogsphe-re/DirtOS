use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json,
};
use serde::Deserialize;

use crate::db::{
    integrations,
    models::{
        IntegrationProvider, NewSeedLot, Pagination, SeedAsinLookup, SeedAsinLookupStatus,
        SeedAsinScanResult, SeedEanLookup, SeedEanLookupStatus, SeedLot, SeedLotScanAction,
        SeedLotScanResult, UpdateSeedLot,
    },
    seed_store::{self, AsinSeedMetadata, EanSeedMetadata},
};
use crate::services::{amazon_asin, ean_search};

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/seed-lots", get(list).post(create))
        .route(
            "/api/v1/seed-lots/{id}",
            get(get_one).put(update).delete(remove),
        )
        .route("/api/v1/seed-lots/scan/ean", post(scan_ean))
        .route("/api/v1/seed-lots/scan/asin", post(scan_asin))
}

// ---------------------------------------------------------------------------
// Query / body types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct ListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Deserialize)]
pub struct ScanEanBody {
    pub barcode: String,
}

#[derive(Deserialize)]
pub struct ScanAsinBody {
    pub asin: String,
}

// ---------------------------------------------------------------------------
// Credential extraction helpers (mirrors commands/seed_store.rs)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
struct EanSearchAuthConfig {
    api_token: Option<String>,
    token: Option<String>,
}

fn extract_ean_token(auth_json: Option<&str>) -> Option<String> {
    let parsed: EanSearchAuthConfig = auth_json
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_default();

    parsed
        .api_token
        .or(parsed.token)
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

#[derive(Debug, Deserialize, Default)]
struct AmazonPaApiAuthConfig {
    access_key: Option<String>,
    secret_key: Option<String>,
    partner_tag: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct AmazonPaApiSettingsConfig {
    marketplace: Option<String>,
}

fn extract_amazon_credentials(
    auth_json: Option<&str>,
    settings_json: Option<&str>,
) -> Option<amazon_asin::AsinCredentials> {
    let auth: AmazonPaApiAuthConfig = auth_json
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_default();
    let settings: AmazonPaApiSettingsConfig = settings_json
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_default();

    let access_key = auth
        .access_key
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())?;
    let secret_key = auth
        .secret_key
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())?;
    let partner_tag = auth
        .partner_tag
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .unwrap_or_default();

    Some(amazon_asin::AsinCredentials {
        access_key,
        secret_key,
        partner_tag,
        marketplace: settings.marketplace,
    })
}

// ---------------------------------------------------------------------------
// CRUD handlers
// ---------------------------------------------------------------------------

async fn list(
    State(s): State<AppState>,
    Query(q): Query<ListQuery>,
) -> ApiResult<Vec<SeedLot>> {
    let rows = seed_store::list_seed_store(
        &s.pool,
        Pagination {
            limit: q.limit.unwrap_or(200),
            offset: q.offset.unwrap_or(0),
        },
    )
    .await?;
    Ok(Json(rows))
}

async fn get_one(
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<SeedLot>, (StatusCode, Json<serde_json::Value>)> {
    match seed_store::get_seed_lot(&s.pool, id).await {
        Ok(Some(row)) => Ok(Json(row)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )),
    }
}

async fn create(
    State(s): State<AppState>,
    Json(body): Json<NewSeedLot>,
) -> ApiResult<SeedLot> {
    let row = seed_store::create_seed_lot(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateSeedLot>,
) -> Result<Json<SeedLot>, (StatusCode, Json<serde_json::Value>)> {
    match seed_store::update_seed_lot(&s.pool, id, body).await {
        Ok(Some(row)) => Ok(Json(row)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )),
    }
}

async fn remove(
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    seed_store::delete_seed_lot(&s.pool, id)
        .await
        .map_err(ApiError::from)?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// EAN scan handler
// ---------------------------------------------------------------------------

async fn scan_ean(
    State(s): State<AppState>,
    Json(body): Json<ScanEanBody>,
) -> ApiResult<SeedLotScanResult> {
    let normalized = ean_search::normalize_barcode(&body.barcode)
        .map_err(|e| ApiError::from(e))?;

    let existing = seed_store::get_seed_lot_by_ean(&s.pool, &normalized)
        .await
        .map_err(ApiError::from)?;

    let cfg = integrations::get_integration_config(&s.pool, IntegrationProvider::EanSearch)
        .await
        .map_err(ApiError::from)?;

    let integration_enabled = cfg.as_ref().map(|c| c.enabled).unwrap_or(true);
    let configured_rate_limit = cfg.as_ref().and_then(|c| c.rate_limit_per_minute);
    let api_token = extract_ean_token(cfg.as_ref().and_then(|c| c.auth_json.as_deref()));

    let mut metadata: Option<EanSeedMetadata> = None;

    let lookup = if integration_enabled {
        let client = ean_search::build_http_client().map_err(|e| ApiError::from(e))?;
        match ean_search::lookup_barcode(&client, &normalized, api_token.as_deref(), configured_rate_limit).await {
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
            ean_search::EanLookupOutcome::RateLimited { limit_per_minute, message } => Some(SeedEanLookup {
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
        let seed_lot = seed_store::enrich_seed_lot_from_ean_scan(&s.pool, lot.id, &normalized, metadata.as_ref())
            .await
            .map_err(ApiError::from)?
            .ok_or_else(|| ApiError::from("Seed lot not found while enriching scan result".to_string()))?;

        let action = if metadata.is_some() {
            SeedLotScanAction::Enriched
        } else {
            SeedLotScanAction::Matched
        };

        return Ok(Json(SeedLotScanResult { seed_lot, action, lookup }));
    }

    let seed_lot = seed_store::create_seed_lot_from_ean_scan(&s.pool, &normalized, metadata.as_ref())
        .await
        .map_err(ApiError::from)?;

    Ok(Json(SeedLotScanResult {
        seed_lot,
        action: SeedLotScanAction::Created,
        lookup,
    }))
}

// ---------------------------------------------------------------------------
// ASIN scan handler
// ---------------------------------------------------------------------------

async fn scan_asin(
    State(s): State<AppState>,
    Json(body): Json<ScanAsinBody>,
) -> ApiResult<SeedAsinScanResult> {
    let normalised = amazon_asin::normalize_asin(&body.asin)
        .map_err(|e| ApiError::from(e))?;

    let existing = seed_store::get_seed_lot_by_asin(&s.pool, &normalised)
        .await
        .map_err(ApiError::from)?;

    let cfg = integrations::get_integration_config(&s.pool, IntegrationProvider::AmazonPaApi)
        .await
        .map_err(ApiError::from)?;

    let integration_enabled = cfg.as_ref().map(|c| c.enabled).unwrap_or(false);
    let credentials = extract_amazon_credentials(
        cfg.as_ref().and_then(|c| c.auth_json.as_deref()),
        cfg.as_ref().and_then(|c| c.settings_json.as_deref()),
    );

    let mut metadata: Option<AsinSeedMetadata> = None;

    let lookup = if integration_enabled {
        let creds = credentials.unwrap_or(amazon_asin::AsinCredentials {
            access_key: String::new(),
            secret_key: String::new(),
            partner_tag: String::new(),
            marketplace: None,
        });

        let client = ean_search::build_http_client().map_err(|e| ApiError::from(e))?;
        match amazon_asin::lookup_asin(&client, &normalised, &creds).await {
            amazon_asin::AsinLookupOutcome::Found(product) => {
                metadata = Some(AsinSeedMetadata {
                    title: product.title.clone(),
                    brand: product.brand.clone(),
                    product_url: product.product_url.clone(),
                });
                Some(SeedAsinLookup {
                    asin: product.asin,
                    title: product.title,
                    brand: product.brand,
                    product_url: product.product_url,
                    lookup_status: SeedAsinLookupStatus::Success,
                    message: None,
                })
            }
            amazon_asin::AsinLookupOutcome::NotFound => Some(SeedAsinLookup {
                asin: normalised.clone(),
                title: None,
                brand: None,
                product_url: None,
                lookup_status: SeedAsinLookupStatus::NotFound,
                message: Some("No matching product was found in the Amazon catalog".to_string()),
            }),
            amazon_asin::AsinLookupOutcome::CredentialsRequired { message } => Some(SeedAsinLookup {
                asin: normalised.clone(),
                title: None,
                brand: None,
                product_url: None,
                lookup_status: SeedAsinLookupStatus::CredentialsRequired,
                message: Some(message),
            }),
            amazon_asin::AsinLookupOutcome::Error { message } => Some(SeedAsinLookup {
                asin: normalised.clone(),
                title: None,
                brand: None,
                product_url: None,
                lookup_status: SeedAsinLookupStatus::Error,
                message: Some(message),
            }),
        }
    } else {
        Some(SeedAsinLookup {
            asin: normalised.clone(),
            title: None,
            brand: None,
            product_url: None,
            lookup_status: SeedAsinLookupStatus::Skipped,
            message: Some(
                "Amazon PA API integration is disabled. Enable it in Settings to fetch product data."
                    .to_string(),
            ),
        })
    };

    if let Some(lot) = existing {
        let seed_lot = seed_store::enrich_seed_lot_from_asin_scan(&s.pool, lot.id, &normalised, metadata.as_ref())
            .await
            .map_err(ApiError::from)?
            .ok_or_else(|| ApiError::from("Seed lot not found while enriching ASIN scan result".to_string()))?;

        let action = if metadata.is_some() {
            SeedLotScanAction::Enriched
        } else {
            SeedLotScanAction::Matched
        };

        return Ok(Json(SeedAsinScanResult { seed_lot, action, lookup }));
    }

    let seed_lot = seed_store::create_seed_lot_from_asin_scan(&s.pool, &normalised, metadata.as_ref())
        .await
        .map_err(ApiError::from)?;

    Ok(Json(SeedAsinScanResult {
        seed_lot,
        action: SeedLotScanAction::Created,
        lookup,
    }))
}
