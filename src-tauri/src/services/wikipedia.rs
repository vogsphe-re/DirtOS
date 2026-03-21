/// Wikipedia REST API integration.
///
/// Uses the Wikimedia REST API (no authentication required).
/// Summary endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
/// Fuzzy search:     https://en.wikipedia.org/w/api.php?action=opensearch
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;

const USER_AGENT: &str = "DirtOS/1.0 (open-source plant tracking application; contact via GitHub)";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WikiSummary {
    pub title: String,
    pub slug: String,
    pub extract: Option<String>,
    pub thumbnail_url: Option<String>,
    pub page_url: Option<String>,
    pub raw_json: String,
}

/// A candidate article returned by the fuzzy OpenSearch API.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct WikiSearchResult {
    /// Display title of the Wikipedia article.
    pub title: String,
    /// URL-safe page slug (spaces → underscores).
    pub slug: String,
    /// Short description / disambiguation snippet, if available.
    pub description: Option<String>,
    /// Full URL to the Wikipedia article.
    pub url: Option<String>,
}

// ---------------------------------------------------------------------------
// Private API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct WikiApiSummary {
    title: String,
    extract: Option<String>,
    thumbnail: Option<WikiThumbnail>,
    content_urls: Option<WikiContentUrls>,
}

#[derive(Debug, Deserialize)]
struct WikiThumbnail {
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WikiContentUrls {
    desktop: Option<WikiDesktopUrls>,
}

#[derive(Debug, Deserialize)]
struct WikiDesktopUrls {
    page: Option<String>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Fetch the Wikipedia page summary for the given title/slug.
/// `slug` should be the page title as it appears in the Wikipedia URL
/// (spaces replaced by underscores, e.g. "Solanum_lycopersicum").
pub async fn get_summary(client: &Client, slug: &str) -> Result<WikiSummary, String> {
    // Percent-encode the title for the URL path.
    let encoded = slug.replace(' ', "_");
    let url = format!(
        "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
        urlencoding::encode(&encoded)
    );

    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Wikipedia request failed: {e}"))?;

    if resp.status() == 404 {
        return Err(format!("Wikipedia page '{slug}' not found"));
    }
    if !resp.status().is_success() {
        return Err(format!("Wikipedia API returned {}", resp.status()));
    }

    let raw_json = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read Wikipedia response body: {e}"))?;

    let data: WikiApiSummary = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Failed to parse Wikipedia response: {e}"))?;

    Ok(WikiSummary {
        slug: slug.to_string(),
        title: data.title,
        extract: data.extract,
        thumbnail_url: data.thumbnail.and_then(|t| t.source),
        page_url: data
            .content_urls
            .and_then(|u| u.desktop)
            .and_then(|d| d.page),
        raw_json,
    })
}

/// Fuzzy-search Wikipedia using the OpenSearch API and return up to `limit`
/// candidate articles for `query`.  Handles approximate / partial matches well,
/// making it suitable for both scientific names and common names.
///
/// Response format (OpenSearch): `[query, [titles], [descriptions], [urls]]`
pub async fn search_candidates(
    client: &Client,
    query: &str,
    limit: u32,
) -> Result<Vec<WikiSearchResult>, String> {
    let resp = client
        .get("https://en.wikipedia.org/w/api.php")
        .query(&[
            ("action", "opensearch"),
            ("search", query),
            ("limit", &limit.to_string()),
            ("namespace", "0"),
            ("format", "json"),
            ("redirects", "resolve"),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Wikipedia search request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Wikipedia search API returned {}", resp.status()));
    }

    let raw: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Wikipedia search response: {e}"))?;

    // OpenSearch returns a 4-element JSON array.
    let titles = raw[1]
        .as_array()
        .ok_or_else(|| "Unexpected Wikipedia OpenSearch format: missing titles".to_string())?;
    let descriptions = raw[2]
        .as_array()
        .ok_or_else(|| "Unexpected Wikipedia OpenSearch format: missing descriptions".to_string())?;
    let urls = raw[3]
        .as_array()
        .ok_or_else(|| "Unexpected Wikipedia OpenSearch format: missing URLs".to_string())?;

    let results = titles
        .iter()
        .zip(descriptions.iter())
        .zip(urls.iter())
        .filter_map(|((t, d), u)| {
            let title = t.as_str()?.to_string();
            let slug = title.replace(' ', "_");
            let description = d
                .as_str()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());
            let url = u.as_str().map(|s| s.to_string());
            Some(WikiSearchResult {
                title,
                slug,
                description,
                url,
            })
        })
        .collect();

    Ok(results)
}
