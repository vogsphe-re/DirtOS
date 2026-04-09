use std::collections::{HashMap, VecDeque};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use reqwest::{Client, StatusCode};
use serde::Deserialize;

const API_BASE_URL: &str = "https://api.ean-search.org/api";
const USER_AGENT: &str = "DirtOS/1.0 (EAN lookup integration)";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(12);
const PUBLIC_RATE_LIMIT_PER_MINUTE: i64 = 6;

#[derive(Debug, Clone)]
pub struct EanLookupProduct {
    pub ean_code: String,
    pub product_name: Option<String>,
    pub category_name: Option<String>,
    pub issuing_country: Option<String>,
}

#[derive(Debug, Clone)]
pub enum EanLookupOutcome {
    Found(EanLookupProduct),
    NotFound,
    RateLimited {
        limit_per_minute: i64,
        message: String,
    },
    TokenRequired {
        message: String,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Deserialize)]
struct EanApiRow {
    ean: Option<String>,
    name: Option<String>,
    #[serde(rename = "categoryName")]
    category_name: Option<String>,
    #[serde(rename = "issuingCountry")]
    issuing_country: Option<String>,
    error: Option<String>,
}

static RATE_LIMITER: OnceLock<Mutex<HashMap<String, VecDeque<Instant>>>> = OnceLock::new();

fn rate_limiter() -> &'static Mutex<HashMap<String, VecDeque<Instant>>> {
    RATE_LIMITER.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn build_http_client() -> Result<Client, String> {
    Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())
}

pub fn normalize_barcode(input: &str) -> Result<String, String> {
    let normalized: String = input.chars().filter(|c| c.is_ascii_digit()).collect();
    match normalized.len() {
        8 | 12 | 13 | 14 => Ok(normalized),
        _ => Err("EAN/UPC must contain 8, 12, 13, or 14 digits".to_string()),
    }
}

fn effective_rate_limit(token: Option<&str>, configured_limit: Option<i64>) -> Option<i64> {
    if let Some(limit) = configured_limit {
        if limit <= 0 {
            return None;
        }
        return Some(limit);
    }

    if token.is_some() {
        None
    } else {
        Some(PUBLIC_RATE_LIMIT_PER_MINUTE)
    }
}

fn enforce_rate_limit(bucket: &str, limit_per_minute: i64) -> Result<(), String> {
    let now = Instant::now();
    let window = Duration::from_secs(60);

    let mut guard = rate_limiter()
        .lock()
        .map_err(|_| "EAN rate limiter lock poisoned".to_string())?;

    let entries = guard.entry(bucket.to_string()).or_default();

    while entries
        .front()
        .map(|ts| now.duration_since(*ts) >= window)
        .unwrap_or(false)
    {
        entries.pop_front();
    }

    if entries.len() as i64 >= limit_per_minute {
        let retry_after = entries
            .front()
            .map(|ts| window.saturating_sub(now.duration_since(*ts)).as_secs())
            .unwrap_or(60);

        return Err(format!(
            "Rate limit reached ({limit_per_minute}/min). Retry in about {retry_after}s."
        ));
    }

    entries.push_back(now);
    Ok(())
}

fn clean_opt(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn classify_api_error(
    message: &str,
    limit_per_minute: i64,
    token_was_present: bool,
) -> EanLookupOutcome {
    let lower = message.to_ascii_lowercase();

    if lower.contains("rate") && lower.contains("limit") {
        return EanLookupOutcome::RateLimited {
            limit_per_minute,
            message: message.to_string(),
        };
    }

    if lower.contains("invalid token") || (lower.contains("token") && !token_was_present) {
        return EanLookupOutcome::TokenRequired {
            message: "EAN-Search rejected anonymous access. Add an API token in Settings to enable enrichment.".to_string(),
        };
    }

    EanLookupOutcome::Error {
        message: message.to_string(),
    }
}

fn parse_lookup_response(
    barcode: &str,
    body: &str,
    token_was_present: bool,
    limit_per_minute: i64,
) -> EanLookupOutcome {
    let rows = serde_json::from_str::<Vec<EanApiRow>>(body)
        .or_else(|_| serde_json::from_str::<EanApiRow>(body).map(|row| vec![row]));

    let rows = match rows {
        Ok(rows) => rows,
        Err(e) => {
            return EanLookupOutcome::Error {
                message: format!("Failed to parse EAN-Search response: {e}"),
            };
        }
    };

    if rows.is_empty() {
        return EanLookupOutcome::NotFound;
    }

    let first = &rows[0];

    if let Some(error) = first.error.as_deref() {
        return classify_api_error(error, limit_per_minute, token_was_present);
    }

    let product_name = clean_opt(first.name.clone());
    if product_name.is_none() {
        return EanLookupOutcome::NotFound;
    }

    EanLookupOutcome::Found(EanLookupProduct {
        ean_code: clean_opt(first.ean.clone()).unwrap_or_else(|| barcode.to_string()),
        product_name,
        category_name: clean_opt(first.category_name.clone()),
        issuing_country: clean_opt(first.issuing_country.clone()),
    })
}

pub async fn lookup_barcode(
    client: &Client,
    barcode: &str,
    token: Option<&str>,
    configured_rate_limit: Option<i64>,
) -> EanLookupOutcome {
    let token = token.map(str::trim).filter(|v| !v.is_empty());
    let limit_per_minute = effective_rate_limit(token, configured_rate_limit);

    if let Some(limit) = limit_per_minute {
        let bucket = if token.is_some() {
            "ean_search:auth"
        } else {
            "ean_search:public"
        };
        if let Err(message) = enforce_rate_limit(bucket, limit) {
            return EanLookupOutcome::RateLimited {
                limit_per_minute: limit,
                message,
            };
        }
    }

    let mut request = client
        .get(API_BASE_URL)
        .query(&[("op", "barcode-lookup"), ("format", "json")])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(REQUEST_TIMEOUT);

    if barcode.len() == 12 {
        request = request.query(&[("upc", barcode)]);
    } else {
        request = request.query(&[("ean", barcode)]);
    }

    if let Some(token) = token {
        request = request.query(&[("token", token)]);
    }

    let response = match request.send().await {
        Ok(resp) => resp,
        Err(e) => {
            return EanLookupOutcome::Error {
                message: format!("EAN-Search request failed: {e}"),
            };
        }
    };

    if response.status() == StatusCode::TOO_MANY_REQUESTS {
        let limit = limit_per_minute.unwrap_or(PUBLIC_RATE_LIMIT_PER_MINUTE);
        return EanLookupOutcome::RateLimited {
            limit_per_minute: limit,
            message: "EAN-Search returned HTTP 429 (too many requests)".to_string(),
        };
    }

    if !response.status().is_success() {
        return EanLookupOutcome::Error {
            message: format!("EAN-Search returned {}", response.status()),
        };
    }

    let body = match response.text().await {
        Ok(body) => body,
        Err(e) => {
            return EanLookupOutcome::Error {
                message: format!("Failed to read EAN-Search response: {e}"),
            };
        }
    };

    parse_lookup_response(
        barcode,
        &body,
        token.is_some(),
        limit_per_minute.unwrap_or(PUBLIC_RATE_LIMIT_PER_MINUTE),
    )
}
