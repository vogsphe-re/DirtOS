use std::time::Duration;

use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

const SERVICE: &str = "ProductAdvertisingAPI";
const ALGORITHM: &str = "AWS4-HMAC-SHA256";
const PA_API_PATH: &str = "/paapi5/getitems";
const PA_API_TARGET: &str =
    "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems";
const USER_AGENT: &str = "DirtOS/1.0 (Amazon ASIN lookup integration)";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(12);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Caller-supplied credentials from the integration config.
pub struct AsinCredentials {
    pub access_key: String,
    pub secret_key: String,
    pub partner_tag: String,
    /// One of the recognised `www.amazon.*` marketplace hosts.
    /// Defaults to `www.amazon.com` when omitted.
    pub marketplace: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AsinLookupProduct {
    pub asin: String,
    pub title: Option<String>,
    pub brand: Option<String>,
    pub product_url: Option<String>,
}

#[derive(Debug, Clone)]
pub enum AsinLookupOutcome {
    Found(AsinLookupProduct),
    NotFound,
    /// Credentials are absent or were explicitly rejected by Amazon.
    CredentialsRequired { message: String },
    Error { message: String },
}

// ---------------------------------------------------------------------------
// ASIN validation
// ---------------------------------------------------------------------------

/// Validates and normalises an ASIN to 10 uppercase alphanumeric characters.
pub fn normalize_asin(input: &str) -> Result<String, String> {
    let normalised: String = input.trim().to_ascii_uppercase();
    let clean: String = normalised
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect();

    if clean.len() != 10 {
        return Err(
            "ASIN must be exactly 10 alphanumeric characters (e.g. B0CX1234AB)".to_string(),
        );
    }
    Ok(clean)
}

// ---------------------------------------------------------------------------
// Marketplace routing helpers
// ---------------------------------------------------------------------------

/// Returns `(api_host, region)` for the given marketplace identifier.
fn marketplace_host_and_region(marketplace: &str) -> (&'static str, &'static str) {
    match marketplace {
        "www.amazon.co.uk" => ("webservices.amazon.co.uk", "eu-west-1"),
        "www.amazon.de" => ("webservices.amazon.de", "eu-west-1"),
        "www.amazon.fr" => ("webservices.amazon.fr", "eu-west-1"),
        "www.amazon.es" => ("webservices.amazon.es", "eu-west-1"),
        "www.amazon.it" => ("webservices.amazon.it", "eu-west-1"),
        "www.amazon.in" => ("webservices.amazon.in", "eu-west-1"),
        "www.amazon.ae" => ("webservices.amazon.ae", "eu-west-1"),
        "www.amazon.sa" => ("webservices.amazon.sa", "eu-west-1"),
        "www.amazon.co.jp" => ("webservices.amazon.co.jp", "us-west-2"),
        "www.amazon.com.au" => ("webservices.amazon.com.au", "us-west-2"),
        "www.amazon.sg" => ("webservices.amazon.sg", "us-west-2"),
        // Default / US marketplace
        _ => ("webservices.amazon.com", "us-east-1"),
    }
}

// ---------------------------------------------------------------------------
// AWS Signature Version 4
// ---------------------------------------------------------------------------

fn sha256_hex(data: &[u8]) -> String {
    let digest = Sha256::digest(data);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
    let mut mac =
        HmacSha256::new_from_slice(key).expect("HMAC accepts keys of any length");
    mac.update(data);
    mac.finalize().into_bytes().to_vec()
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn derive_signing_key(
    secret_key: &str,
    date_stamp: &str,
    region: &str,
) -> Vec<u8> {
    let k_date =
        hmac_sha256(format!("AWS4{secret_key}").as_bytes(), date_stamp.as_bytes());
    let k_region = hmac_sha256(&k_date, region.as_bytes());
    let k_service = hmac_sha256(&k_region, SERVICE.as_bytes());
    hmac_sha256(&k_service, b"aws4_request")
}

fn sign_request(
    access_key: &str,
    secret_key: &str,
    region: &str,
    host: &str,
    body: &str,
    amz_date: &str,    // e.g. "20260414T120000Z"
    date_stamp: &str,  // e.g. "20260414"
) -> String {
    let body_hash = sha256_hex(body.as_bytes());

    // Canonical headers must be sorted and lowercased.
    let canonical_headers = format!(
        "content-encoding:amz-1.0\n\
         content-type:application/json; charset=UTF-8\n\
         host:{host}\n\
         x-amz-date:{amz_date}\n\
         x-amz-target:{PA_API_TARGET}\n"
    );
    let signed_headers =
        "content-encoding;content-type;host;x-amz-date;x-amz-target";

    let canonical_request = format!(
        "POST\n{PA_API_PATH}\n\n{canonical_headers}\n{signed_headers}\n{body_hash}"
    );

    let credential_scope =
        format!("{date_stamp}/{region}/{SERVICE}/aws4_request");
    let string_to_sign = format!(
        "{ALGORITHM}\n{amz_date}\n{credential_scope}\n{}",
        sha256_hex(canonical_request.as_bytes())
    );

    let signing_key = derive_signing_key(secret_key, date_stamp, region);
    let signature = hex_encode(&hmac_sha256(&signing_key, string_to_sign.as_bytes()));

    format!(
        "{ALGORITHM} Credential={access_key}/{credential_scope}, \
         SignedHeaders={signed_headers}, Signature={signature}"
    )
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct PaApiResponse {
    #[serde(rename = "ItemsResult")]
    items_result: Option<PaApiItemsResult>,
    #[serde(rename = "Errors")]
    errors: Option<Vec<PaApiError>>,
}

#[derive(Debug, Deserialize)]
struct PaApiItemsResult {
    #[serde(rename = "Items")]
    items: Vec<PaApiItem>,
}

#[derive(Debug, Deserialize)]
struct PaApiItem {
    #[serde(rename = "ASIN")]
    asin: String,
    #[serde(rename = "DetailPageURL")]
    detail_page_url: Option<String>,
    #[serde(rename = "ItemInfo")]
    item_info: Option<PaApiItemInfo>,
}

#[derive(Debug, Deserialize)]
struct PaApiItemInfo {
    #[serde(rename = "Title")]
    title: Option<PaApiDisplayValue>,
    #[serde(rename = "ByLineInfo")]
    by_line_info: Option<PaApiByLineInfo>,
}

#[derive(Debug, Deserialize)]
struct PaApiByLineInfo {
    #[serde(rename = "Brand")]
    brand: Option<PaApiDisplayValue>,
}

#[derive(Debug, Deserialize)]
struct PaApiDisplayValue {
    #[serde(rename = "DisplayValue")]
    display_value: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PaApiError {
    #[serde(rename = "Code")]
    code: String,
    #[serde(rename = "Message")]
    message: Option<String>,
}

// Error response emitted directly at the top level for auth failures.
#[derive(Debug, Deserialize)]
struct PaApiTopLevelError {
    #[serde(rename = "__type")]
    error_type: Option<String>,
    message: Option<String>,
}

// ---------------------------------------------------------------------------
// Public lookup entry point
// ---------------------------------------------------------------------------

pub async fn lookup_asin(
    client: &Client,
    asin: &str,
    creds: &AsinCredentials,
) -> AsinLookupOutcome {
    if creds.access_key.trim().is_empty() || creds.secret_key.trim().is_empty() {
        return AsinLookupOutcome::CredentialsRequired {
            message: "Amazon PA API credentials are not configured. \
                      Add Access Key, Secret Key, and Partner Tag in Settings."
                .to_string(),
        };
    }

    let marketplace = creds
        .marketplace
        .as_deref()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or("www.amazon.com");

    let (host, region) = marketplace_host_and_region(marketplace);

    let now = Utc::now();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = now.format("%Y%m%d").to_string();

    let body = serde_json::json!({
        "ItemIds": [asin],
        "Resources": ["ItemInfo.Title", "ItemInfo.ByLineInfo"],
        "PartnerTag": creds.partner_tag.trim(),
        "PartnerType": "Associates",
        "Marketplace": marketplace,
    })
    .to_string();

    let auth_header = sign_request(
        creds.access_key.trim(),
        creds.secret_key.trim(),
        region,
        host,
        &body,
        &amz_date,
        &date_stamp,
    );

    let url = format!("https://{host}{PA_API_PATH}");

    let response = match client
        .post(&url)
        .header("User-Agent", USER_AGENT)
        .header("Content-Type", "application/json; charset=UTF-8")
        .header("Content-Encoding", "amz-1.0")
        .header("X-Amz-Date", &amz_date)
        .header("X-Amz-Target", PA_API_TARGET)
        .header("Authorization", auth_header)
        .body(body)
        .timeout(REQUEST_TIMEOUT)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return AsinLookupOutcome::Error {
                message: format!("Amazon PA API request failed: {e}"),
            };
        }
    };

    let status = response.status();

    let body_text = match response.text().await {
        Ok(t) => t,
        Err(e) => {
            return AsinLookupOutcome::Error {
                message: format!("Failed to read Amazon PA API response: {e}"),
            };
        }
    };

    // Auth / signature errors come back as HTTP 4xx with a top-level JSON shape.
    if status == reqwest::StatusCode::FORBIDDEN || status == reqwest::StatusCode::UNAUTHORIZED {
        if let Ok(err) = serde_json::from_str::<PaApiTopLevelError>(&body_text) {
            let msg = err
                .message
                .unwrap_or_else(|| "Amazon PA API rejected the request credentials".to_string());
            return AsinLookupOutcome::CredentialsRequired { message: msg };
        }
        return AsinLookupOutcome::CredentialsRequired {
            message: format!("Amazon PA API returned HTTP {status}"),
        };
    }

    if !status.is_success() {
        return AsinLookupOutcome::Error {
            message: format!("Amazon PA API returned HTTP {status}: {body_text}"),
        };
    }

    parse_pa_api_response(asin, &body_text)
}

fn parse_pa_api_response(asin: &str, body: &str) -> AsinLookupOutcome {
    let parsed = match serde_json::from_str::<PaApiResponse>(body) {
        Ok(p) => p,
        Err(e) => {
            return AsinLookupOutcome::Error {
                message: format!("Failed to parse Amazon PA API response: {e}"),
            };
        }
    };

    // Surface any API-level errors first.
    if let Some(errors) = parsed.errors {
        if !errors.is_empty() {
            let first = &errors[0];
            let msg = first
                .message
                .clone()
                .unwrap_or_else(|| first.code.clone());
            if first.code == "InvalidParameterValue"
                && msg.to_ascii_lowercase().contains("item")
            {
                return AsinLookupOutcome::NotFound;
            }
            if first.code == "ItemNotAccessible" {
                return AsinLookupOutcome::NotFound;
            }
            return AsinLookupOutcome::Error { message: msg };
        }
    }

    let item = parsed
        .items_result
        .and_then(|r| r.items.into_iter().next());

    let Some(item) = item else {
        return AsinLookupOutcome::NotFound;
    };

    let title = item
        .item_info
        .as_ref()
        .and_then(|i| i.title.as_ref())
        .and_then(|t| t.display_value.clone())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    let brand = item
        .item_info
        .as_ref()
        .and_then(|i| i.by_line_info.as_ref())
        .and_then(|b| b.brand.as_ref())
        .and_then(|b| b.display_value.clone())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    AsinLookupOutcome::Found(AsinLookupProduct {
        asin: item.asin,
        title,
        brand,
        product_url: item.detail_page_url,
    })
}
