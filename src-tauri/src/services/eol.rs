/// Encyclopedia of Life (EoL) API integration.
///
/// Uses the EoL v1 REST API (no authentication required for read operations).
/// Search:  https://eol.org/api/search/1.0.json?q={query}&page=1&per_page=N
/// Pages:   https://eol.org/api/pages/1.0.json?id={id}&details=true&...
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;

const USER_AGENT: &str =
    "DirtOS/1.0 (open-source plant tracking application; contact via GitHub)";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

/// A candidate article returned by the EoL search API.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EolSearchResult {
    /// EoL numeric page identifier.
    pub id: i64,
    /// Scientific (or vernacular) name used as the page title.
    pub title: String,
    /// Direct link to the EoL page.
    pub link: Option<String>,
    /// Short context snippet provided by the search index.
    pub snippet: Option<String>,
}

/// Enrichment data extracted from an EoL page.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EolDetail {
    /// EoL page identifier (same as the search result id).
    pub page_id: i64,
    /// First vetted text description available on the page.
    pub description: Option<String>,
    /// URL of the first vetted image thumbnail for the taxon.
    pub image_url: Option<String>,
    /// Canonical URL of the EoL page.
    pub page_url: String,
    /// Full raw JSON response body (cached for audit / future re-parse).
    pub raw_json: String,
}

// ---------------------------------------------------------------------------
// Private API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct EolSearchResponse {
    results: Option<Vec<EolSearchItem>>,
}

#[derive(Debug, Deserialize)]
struct EolSearchItem {
    id: i64,
    title: Option<String>,
    link: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EolPageResponse {
    identifier: Option<i64>,
    scientific_name: Option<String>,
    data_objects: Option<Vec<EolDataObject>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EolDataObject {
    #[serde(rename = "type")]
    data_type: Option<String>,
    mime_type: Option<String>,
    description: Option<String>,
    media_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Search EoL for taxa matching the given query.
/// Returns up to `limit` candidate results for the user to choose from.
pub async fn search(
    client: &Client,
    query: &str,
    limit: u32,
) -> Result<Vec<EolSearchResult>, String> {
    let resp = client
        .get("https://eol.org/api/search/1.0.json")
        .query(&[
            ("q", query),
            ("page", "1"),
            ("per_page", &limit.to_string()),
            ("exact", "false"),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("EoL search request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("EoL search API returned {}", resp.status()));
    }

    let body: EolSearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse EoL search response: {e}"))?;

    let results = body
        .results
        .unwrap_or_default()
        .into_iter()
        .map(|item| EolSearchResult {
            id: item.id,
            title: item.title.unwrap_or_else(|| format!("EoL page {}", item.id)),
            link: item.link,
            snippet: item.content.filter(|s| !s.is_empty()),
        })
        .collect();

    Ok(results)
}

/// Fetch full enrichment data for the given EoL page id.
///
/// Requests vetted (`vetted=2`) content only, limiting to 1 image and 1 text
/// description to keep the response small and the data clean.
pub async fn get_page(client: &Client, page_id: i64) -> Result<EolDetail, String> {
    let id_str = page_id.to_string();
    let resp = client
        .get("https://eol.org/api/pages/1.0.json")
        .query(&[
            ("id", id_str.as_str()),
            ("details", "true"),
            ("images_per_page", "1"),
            ("texts_per_page", "1"),
            ("videos_per_page", "0"),
            ("sounds_per_page", "0"),
            ("taxonomy", "false"),
            ("vetted", "2"),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("EoL pages request failed: {e}"))?;

    if resp.status() == 404 {
        return Err(format!("EoL page {page_id} not found"));
    }
    if !resp.status().is_success() {
        return Err(format!("EoL API returned {}", resp.status()));
    }

    let raw_json = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read EoL response body: {e}"))?;

    let data: EolPageResponse = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Failed to parse EoL page response: {e}"))?;

    let page_url = format!("https://eol.org/pages/{page_id}");

    let data_objects = data.data_objects.unwrap_or_default();

    // Extract first text description (HTML stripped to plain text via a
    // simple tag-stripping approach; full HTML is retained in raw_json).
    let description = data_objects
        .iter()
        .find(|o| {
            o.data_type
                .as_deref()
                .map(|t| t.contains("Text"))
                .unwrap_or(false)
        })
        .and_then(|o| o.description.as_deref())
        .map(strip_html_tags);

    // Extract first image thumbnail URL.
    let image_url = data_objects
        .iter()
        .find(|o| {
            o.mime_type
                .as_deref()
                .map(|m| m.starts_with("image/"))
                .unwrap_or(false)
        })
        .and_then(|o| o.media_url.clone());

    Ok(EolDetail {
        page_id,
        description,
        image_url,
        page_url,
        raw_json,
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Naively strip HTML tags from a string for plain-text storage.
fn strip_html_tags(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    // Collapse multiple whitespace sequences into a single space.
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}
