/// iNaturalist REST API v1 integration.
///
/// Documentation: https://api.inaturalist.org/v1/docs/
/// Rate limit: ~1 req/second (we wait 500 ms between calls to be safe).
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::Duration;
use tokio::time::sleep;

const BASE_URL: &str = "https://api.inaturalist.org/v1";
const USER_AGENT: &str = "DirtOS/1.0 (open-source plant tracking application)";

// ---------------------------------------------------------------------------
// Public result types (exported via specta)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TaxonResult {
    pub id: i64,
    pub name: String,
    pub preferred_common_name: Option<String>,
    pub rank: Option<String>,
    pub default_photo_url: Option<String>,
    pub wikipedia_url: Option<String>,
    pub matched_term: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TaxonDetail {
    pub id: i64,
    pub name: String,
    pub preferred_common_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub rank: Option<String>,
    pub default_photo_url: Option<String>,
    pub wikipedia_url: Option<String>,
    pub raw_json: String,
}

// ---------------------------------------------------------------------------
// Private API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct InatResponse {
    results: Vec<InatTaxon>,
}

#[derive(Debug, Deserialize)]
struct InatTaxon {
    id: i64,
    name: String,
    preferred_common_name: Option<String>,
    rank: Option<String>,
    default_photo: Option<InatPhoto>,
    wikipedia_url: Option<String>,
    matched_term: Option<String>,
    #[serde(default)]
    ancestors: Vec<InatAncestor>,
}

#[derive(Debug, Deserialize)]
struct InatAncestor {
    name: String,
    rank: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InatPhoto {
    medium_url: Option<String>,
    url: Option<String>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Search the iNaturalist taxa endpoint and return up to 20 results.
/// Input `query` is a plain text search string (common or scientific name).
pub async fn search_taxa(client: &Client, query: &str) -> Result<Vec<TaxonResult>, String> {
    sleep(Duration::from_millis(500)).await;

    let resp = client
        .get(format!("{BASE_URL}/taxa"))
        .query(&[
            ("q", query),
            ("per_page", "20"),
            ("rank", "species,subspecies,variety"),
            ("locale", "en"),
        ])
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("iNaturalist request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("iNaturalist API returned {}", resp.status()));
    }

    let data: InatResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse iNaturalist response: {e}"))?;

    Ok(data
        .results
        .into_iter()
        .map(|t| TaxonResult {
            id: t.id,
            name: t.name,
            preferred_common_name: t.preferred_common_name,
            rank: t.rank,
            default_photo_url: t
                .default_photo
                .and_then(|p| p.medium_url.or(p.url)),
            wikipedia_url: t.wikipedia_url,
            matched_term: t.matched_term,
        })
        .collect())
}

/// Fetch full taxon detail by iNaturalist taxon ID.
/// Returns the parsed `TaxonDetail` plus the raw JSON for caching.
pub async fn get_taxon(client: &Client, taxon_id: i64) -> Result<TaxonDetail, String> {
    sleep(Duration::from_millis(500)).await;

    let resp = client
        .get(format!("{BASE_URL}/taxa/{taxon_id}"))
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("iNaturalist request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("iNaturalist API returned {}", resp.status()));
    }

    let raw_json = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read iNaturalist response body: {e}"))?;

    let data: InatResponse = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Failed to parse iNaturalist response: {e}"))?;

    let taxon = data
        .results
        .into_iter()
        .next()
        .ok_or_else(|| format!("Taxon {taxon_id} not found in iNaturalist response"))?;

    // Extract family and genus from ancestor list when present.
    let family = taxon
        .ancestors
        .iter()
        .find(|a| a.rank.as_deref() == Some("family"))
        .map(|a| a.name.clone());
    let genus = taxon
        .ancestors
        .iter()
        .find(|a| a.rank.as_deref() == Some("genus"))
        .map(|a| a.name.clone());

    Ok(TaxonDetail {
        id: taxon.id,
        name: taxon.name,
        preferred_common_name: taxon.preferred_common_name,
        family,
        genus,
        rank: taxon.rank,
        default_photo_url: taxon.default_photo.and_then(|p| p.medium_url.or(p.url)),
        wikipedia_url: taxon.wikipedia_url,
        raw_json,
    })
}
