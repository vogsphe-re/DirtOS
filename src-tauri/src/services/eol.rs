/// Encyclopedia of Life (EoL) API integration.
///
/// Uses the EoL v1 REST API (no authentication required for read operations).
/// Search:    https://eol.org/api/search/1.0.json?q={query}&page=1&per_page=N
/// Pages:     https://eol.org/api/pages/1.0.json?id={id}&details=true&...
/// TraitBank: https://eol.org/service/cypher (read-only Cypher query API)
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::Duration;

const USER_AGENT: &str =
    "DirtOS/1.0 (open-source plant tracking application; contact via GitHub)";

/// Substrings in page titles that indicate a non-plant result (virus, etc.).
const NON_PLANT_KEYWORDS: &[&str] = &[
    "virus", "viroid", "phage", "bacterium", "bacteria",
    "phytoplasma", "mycoplasma", "oomycete", "nematode",
    "prion", "fungus", "fungi",
];

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

/// A candidate page returned by the EoL search API.
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

/// Text / image enrichment data extracted from an EoL page.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EolDetail {
    /// EoL page identifier.
    pub page_id: i64,
    /// First vetted text description available on the page.
    pub description: Option<String>,
    /// URL of the first vetted image thumbnail.
    pub image_url: Option<String>,
    /// Canonical URL of the EoL page.
    pub page_url: String,
    /// Full raw JSON response body (cached for future re-parse).
    pub raw_json: String,
}

/// Growing-info traits pulled from EoL's TraitBank via the Cypher API.
/// All fields default to `None`; the caller may silently use empty defaults
/// if the TraitBank request fails.
#[derive(Debug, Default)]
pub struct EolTraits {
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
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

/// Response from the EoL TraitBank Cypher API.
#[derive(Debug, Deserialize)]
struct CypherResponse {
    columns: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Search EoL for taxa matching `query`.  Filters out obvious non-plant
/// results (viruses, bacteria, fungi, etc.) by title keyword.
/// Returns up to `limit` candidate results.
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
        .timeout(Duration::from_secs(15))
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
        .filter(|item| {
            let title = item.title.as_deref().unwrap_or("").to_lowercase();
            !NON_PLANT_KEYWORDS.iter().any(|kw| title.contains(kw))
        })
        .map(|item| EolSearchResult {
            id: item.id,
            title: item.title.unwrap_or_else(|| format!("EoL page {}", item.id)),
            link: item.link,
            snippet: item.content.filter(|s| !s.is_empty()),
        })
        .collect();

    Ok(results)
}

/// Fetch description and image data for the given EoL page id.
/// Requests vetted (`vetted=2`) content only.
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
        .timeout(Duration::from_secs(20))
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

    let description = data_objects
        .iter()
        .find(|o| o.data_type.as_deref().map(|t| t.contains("Text")).unwrap_or(false))
        .and_then(|o| o.description.as_deref())
        .map(strip_html_tags);

    let image_url = data_objects
        .iter()
        .find(|o| o.mime_type.as_deref().map(|m| m.starts_with("image/")).unwrap_or(false))
        .and_then(|o| o.media_url.clone());

    Ok(EolDetail { page_id, description, image_url, page_url, raw_json })
}

/// Fetch Growing Info traits for a page from EoL's TraitBank Cypher API.
///
/// Queries for growth habit, light/moisture requirements, and hardiness zone
/// data.  Returns empty defaults silently on any error — trait availability
/// varies by species and the TraitBank API is best-effort.
pub async fn get_traits(client: &Client, page_id: i64) -> EolTraits {
    get_traits_inner(client, page_id).await.unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async fn get_traits_inner(client: &Client, page_id: i64) -> Result<EolTraits, String> {
    // Cypher property notation uses {}, which must be {{ }} escaped in format!.
    let query = format!(
        "MATCH (t:Trait)<-[:trait]-(p:Page{{page_id:{page_id}}}) \
         OPTIONAL MATCH (t)-[:predicate]->(pred:Term) \
         OPTIONAL MATCH (t)-[:object_term]->(obj:Term) \
         RETURN pred.name, t.measurement, t.units_name, obj.name LIMIT 100"
    );

    let resp = client
        .get("https://eol.org/service/cypher")
        .query(&[("query", query.as_str())])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        // Short timeout — silently skip traits if TraitBank is slow.
        .timeout(Duration::from_secs(8))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("EoL cypher API returned {}", resp.status()));
    }

    let cypher: CypherResponse = resp.json().await.map_err(|e| e.to_string())?;

    // Resolve column positions by name for safety.
    let pred_idx = cypher.columns.iter().position(|c| c == "pred.name").unwrap_or(0);
    let meas_idx = cypher.columns.iter().position(|c| c == "t.measurement").unwrap_or(1);
    let obj_idx  = cypher.columns.iter().position(|c| c == "obj.name").unwrap_or(3);

    let mut traits = EolTraits::default();

    for row in &cypher.data {
        let pred = row.get(pred_idx)
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();

        let measurement = row.get(meas_idx).and_then(|v| if v.is_null() { None } else { v.as_str() });
        let obj_name    = row.get(obj_idx) .and_then(|v| if v.is_null() { None } else { v.as_str() });
        let value = obj_name.or(measurement);

        match pred.as_str() {
            "growth habit" | "growth form" | "plant growth form" | "habit of plant" => {
                if traits.growth_type.is_none() {
                    traits.growth_type = value.map(normalize_growth_type);
                }
            }
            "shade tolerance" => {
                if traits.sun_requirement.is_none() {
                    traits.sun_requirement = value.map(shade_tolerance_to_sun_req);
                }
            }
            "light requirement" | "light preference" | "sun/shade preference" | "sun exposure" => {
                if traits.sun_requirement.is_none() {
                    traits.sun_requirement = value.map(str::to_owned);
                }
            }
            "moisture use" | "water use" | "water requirement" | "moisture requirement" => {
                if traits.water_requirement.is_none() {
                    traits.water_requirement = value.map(str::to_owned);
                }
            }
            "drought tolerance" => {
                if traits.water_requirement.is_none() {
                    traits.water_requirement = value.map(drought_to_water_req);
                }
            }
            p if p.contains("cold hardiness") || p.contains("hardiness zone") => {
                if p.contains("min") {
                    if traits.hardiness_zone_min.is_none() {
                        traits.hardiness_zone_min = value.map(|v| format!("USDA {v}"));
                    }
                } else if p.contains("max") {
                    if traits.hardiness_zone_max.is_none() {
                        traits.hardiness_zone_max = value.map(|v| format!("USDA {v}"));
                    }
                } else if traits.hardiness_zone_min.is_none() {
                    // Generic hardiness zone — treat as minimum when unqualified.
                    traits.hardiness_zone_min = value.map(|v| format!("USDA {v}"));
                }
            }
            _ => {}
        }
    }

    Ok(traits)
}

fn normalize_growth_type(val: &str) -> String {
    let lower = val.to_lowercase();
    if lower.contains("tree")     { return "tree".to_string(); }
    if lower.contains("vine")     { return "vine".to_string(); }
    if lower.contains("subshrub") { return "subshrub".to_string(); }
    if lower.contains("shrub")    { return "shrub".to_string(); }
    if lower.contains("grass")    { return "grass".to_string(); }
    if lower.contains("forb") || lower.contains("herb") { return "herb".to_string(); }
    lower
}

/// Map USDA shade-tolerance categories to sun-requirement labels.
fn shade_tolerance_to_sun_req(shade_tolerance: &str) -> String {
    match shade_tolerance.to_lowercase().as_str() {
        "intolerant"               => "full sun".to_string(),
        "intermediate"             => "partial shade".to_string(),
        "tolerant" | "very tolerant" => "full shade".to_string(),
        other                      => other.to_string(),
    }
}

/// Map USDA drought-tolerance categories to water-requirement labels.
fn drought_to_water_req(drought_tolerance: &str) -> String {
    match drought_tolerance.to_lowercase().as_str() {
        "none"   => "high".to_string(),
        "low"    => "moderate".to_string(),
        "medium" => "moderate".to_string(),
        "high"   => "low".to_string(),
        other    => other.to_string(),
    }
}

/// Strip HTML tags and collapse whitespace for plain-text storage.
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
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}
