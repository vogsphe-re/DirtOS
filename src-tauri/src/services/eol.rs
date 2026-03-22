/// Encyclopedia of Life (EoL) API integration.
///
/// Uses the EoL v1 REST API (no authentication required for read operations).
/// Search:    https://eol.org/api/search/1.0.json?q={query}&page=1&per_page=N
/// Pages:     https://eol.org/api/pages/1.0.json?id={id}&details=true&taxonomy=true&...
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
    /// Taxonomy hierarchy tags derived from EoL's classification tree.
    /// Each entry is an English vernacular name (or scientific name fallback)
    /// for an ancestor taxon — e.g. ["Flowering plants", "Nightshades"].
    pub tags: Vec<String>,
}

/// Growing-info traits pulled from EoL's TraitBank via the Cypher API.
/// All fields default to `None`/empty; the caller may silently use empty defaults
/// if the TraitBank request fails.
#[derive(Debug, Default)]
pub struct EolTraits {
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub soil_ph_min: Option<f64>,
    pub soil_ph_max: Option<f64>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
    pub habitat: Option<String>,
    pub min_temperature_c: Option<f64>,
    pub max_temperature_c: Option<f64>,
    pub rooting_depth: Option<String>,
    pub uses: Vec<String>,
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

/// EoL v1 pages API wraps everything under a "taxonConcept" top-level key.
#[derive(Debug, Deserialize)]
struct EolPageResponse {
    #[serde(rename = "taxonConcept")]
    taxon_concept: EolPageBody,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EolPageBody {
    data_objects: Option<Vec<EolDataObject>>,
    taxon_concepts: Option<Vec<EolTaxonConceptRef>>,
}

#[derive(Debug, Deserialize)]
struct EolDataObject {
    /// "http://purl.org/dc/dcmitype/Text" or "...StillImage".
    #[serde(rename = "dataType")]
    data_type: Option<String>,
    #[serde(rename = "mimeType")]
    mime_type: Option<String>,
    #[serde(rename = "description")]
    description: Option<String>,
    /// Preferred CDN URL served via EoL's own infrastructure.
    #[serde(rename = "eolMediaURL")]
    eol_media_url: Option<String>,
    /// Original source URL (may be HTTP-only or unavailable).
    #[serde(rename = "mediaURL")]
    media_url: Option<String>,
}

/// A flat taxonomy entry as returned inside the page response.
/// Only used to obtain the `identifier` for a follow-up hierarchy_entries call.
#[derive(Debug, Deserialize)]
struct EolTaxonConceptRef {
    identifier: Option<i64>,
}

/// Response from the EoL v1 hierarchy_entries endpoint.
#[derive(Debug, Default, Deserialize)]
struct EolHierarchyEntryResponse {
    ancestors: Option<Vec<EolHierarchyAncestor>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EolHierarchyAncestor {
    scientific_name: Option<String>,
    vernacular_names: Option<Vec<EolVernacularName>>,
}

#[derive(Debug, Deserialize)]
struct EolVernacularName {
    #[serde(rename = "vernacularName")]
    vernacular_name: Option<String>,
    language: Option<String>,
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

/// Fetch description, image data, and taxonomy tags for the given EoL page id.
/// Requests vetted (`vetted=2`) content only.
pub async fn get_page(client: &Client, page_id: i64) -> Result<EolDetail, String> {
    let id_str = page_id.to_string();
    let resp = client
        .get("https://eol.org/api/pages/1.0.json")
        .query(&[
            ("id", id_str.as_str()),
            ("details", "true"),
            ("taxonomy", "true"),
            ("images_per_page", "1"),
            ("texts_per_page", "1"),
            ("videos_per_page", "0"),
            ("sounds_per_page", "0"),
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
    let data_objects = data.taxon_concept.data_objects.unwrap_or_default();

    let description = data_objects
        .iter()
        .find(|o| o.data_type.as_deref().map(|t| t.contains("Text")).unwrap_or(false))
        .and_then(|o| o.description.as_deref())
        .map(strip_html_tags);

    // Prefer the EOL CDN URL (HTTPS) over the original source URL.
    let image_url = data_objects
        .iter()
        .find(|o| {
            o.data_type.as_deref().map(|t| t.contains("StillImage")).unwrap_or(false)
                || o.mime_type.as_deref().map(|m| m.starts_with("image/")).unwrap_or(false)
        })
        .and_then(|o| o.eol_media_url.clone().or_else(|| o.media_url.clone()));

    // Taxonomy tags: look up the first taxon concept's ancestor hierarchy.
    let first_concept_id = data.taxon_concept.taxon_concepts.as_deref()
        .and_then(|tcs| tcs.first())
        .and_then(|tc| tc.identifier);
    let tags = if let Some(concept_id) = first_concept_id {
        fetch_hierarchy_tags(client, concept_id).await
    } else {
        Vec::new()
    };

    Ok(EolDetail { page_id, description, image_url, page_url, raw_json, tags })
}

/// Scrape Growing Info traits from the EoL public species page.
///
/// Parses the `<ul class='sample-traits'>` block and the auto-generated brief
/// summary paragraph that EoL renders server-side on every page.
/// Returns empty defaults silently on any network or parse error.
pub async fn get_traits(client: &Client, page_id: i64) -> EolTraits {
    scrape_traits(client, page_id).await.unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async fn scrape_traits(client: &Client, page_id: i64) -> Result<EolTraits, String> {
    let url = format!("https://eol.org/pages/{page_id}");
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.5")
        .timeout(Duration::from_secs(20))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("EoL page scrape returned {}", resp.status()));
    }

    let html = resp.text().await.map_err(|e| e.to_string())?;
    Ok(parse_traits_from_html(&html))
}

/// Parse `EolTraits` from the HTML of an EoL species page.
///
/// Extracts the `<ul class='sample-traits'>` key/value pairs.
/// Each `<li>` contains one `sample-trait-key` div and one `sample-trait-val` div.
fn parse_traits_from_html(html: &str) -> EolTraits {
    let mut traits = EolTraits::default();
    let mut uses_set: std::collections::BTreeSet<String> = Default::default();

    // Locate the sample-traits list.
    let list_start = match html.find("class='sample-traits'") {
        Some(pos) => pos,
        None => return traits,
    };
    // Work within the bounds of </ul> that closes the list.
    let list_end = html[list_start..].find("</ul>")
        .map(|p| list_start + p)
        .unwrap_or(html.len());
    let list_html = &html[list_start..list_end];

    // Split on <li> boundaries.
    for item in list_html.split("<li>").skip(1) {
        let key = extract_between(item, "class='sample-trait-key", "</div>")
            .or_else(|| extract_between(item, "class=\"sample-trait-key", "</div>"));
        let val = extract_between(item, "class='sample-trait-val", "</div>")
            .or_else(|| extract_between(item, "class=\"sample-trait-val", "</div>"));

        if let (Some(raw_key), Some(raw_val)) = (key, val) {
            let pred = strip_html_tags(&raw_key).to_lowercase();
            let value = strip_html_tags(&raw_val);
            let value = value.trim();
            if pred.is_empty() || value.is_empty() {
                continue;
            }
            apply_trait(&mut traits, &mut uses_set, &pred, value);
        }
    }

    if !uses_set.is_empty() {
        traits.uses = uses_set.into_iter().collect();
    }
    traits
}

/// Pull the content between the first `>` after `marker` and `end_tag`.
fn extract_between<'a>(html: &'a str, marker: &str, end_tag: &str) -> Option<String> {
    let start = html.find(marker)?;
    let content_start = html[start..].find('>')? + start + 1;
    let content_end = html[content_start..].find(end_tag)? + content_start;
    Some(html[content_start..content_end].to_owned())
}

/// Apply a single predicate/value pair to the traits struct.
fn apply_trait(
    traits: &mut EolTraits,
    uses_set: &mut std::collections::BTreeSet<String>,
    pred: &str,
    value: &str,
) {
    match pred {
        // ----- Growth form -----
        "growth habit" | "growth form" | "plant growth form" | "habit of plant" => {
            if traits.growth_type.is_none() {
                traits.growth_type = Some(normalize_growth_type(value));
            }
        }
        // ----- Light / shade -----
        "shade tolerance" => {
            if traits.sun_requirement.is_none() {
                traits.sun_requirement = Some(shade_tolerance_to_sun_req(value));
            }
        }
        p if p.contains("light") || p.contains("sun") => {
            if traits.sun_requirement.is_none() {
                traits.sun_requirement = Some(value.to_owned());
            }
        }
        // ----- Moisture / water -----
        p if p.contains("moisture") || p.contains("water use") || p.contains("water requirement") => {
            if traits.water_requirement.is_none() {
                traits.water_requirement = Some(value.to_owned());
            }
        }
        "drought tolerance" => {
            if traits.water_requirement.is_none() {
                traits.water_requirement = Some(drought_to_water_req(value));
            }
        }
        // ----- Soil pH -----
        // EoL shows "optimal growth pH" as a single value like "6.8"
        p if p.contains("ph") || p.contains("soil acidity") => {
            let parsed: Option<f64> = value.split_whitespace().next().and_then(|s| s.parse().ok());
            if p.contains("min") || p.contains("lower") || p.contains("minimum") {
                if traits.soil_ph_min.is_none() { traits.soil_ph_min = parsed; }
            } else if p.contains("max") || p.contains("upper") || p.contains("maximum") {
                if traits.soil_ph_max.is_none() { traits.soil_ph_max = parsed; }
            } else {
                // "optimal growth pH" — use as both min and max to display a single value.
                if traits.soil_ph_min.is_none() { traits.soil_ph_min = parsed; }
                if traits.soil_ph_max.is_none() { traits.soil_ph_max = parsed; }
            }
        }
        // ----- Hardiness zone -----
        p if p.contains("cold hardiness") || p.contains("hardiness zone") => {
            let formatted = format!("USDA {value}");
            if p.contains("min") {
                if traits.hardiness_zone_min.is_none() { traits.hardiness_zone_min = Some(formatted); }
            } else if p.contains("max") {
                if traits.hardiness_zone_max.is_none() { traits.hardiness_zone_max = Some(formatted); }
            } else if traits.hardiness_zone_min.is_none() {
                traits.hardiness_zone_min = Some(formatted);
            }
        }
        // ----- Habitat -----
        p if p == "habitat" || p.contains("habitat type") || p.contains("ecological niche")
            || p.contains("biome") =>
        {
            if traits.habitat.is_none() {
                traits.habitat = Some(value.to_owned());
            }
        }
        // ----- Temperature -----
        // EoL displays "optimal growth temperature" as e.g. "27 degrees celsius"
        p if p.contains("temperature") => {
            let celsius = parse_temperature_str(value);
            if p.contains("min") || p.contains("lower") || p.contains("cold") {
                if traits.min_temperature_c.is_none() { traits.min_temperature_c = celsius; }
            } else if p.contains("max") || p.contains("upper") || p.contains("heat") {
                if traits.max_temperature_c.is_none() { traits.max_temperature_c = celsius; }
            } else if traits.min_temperature_c.is_none() && traits.max_temperature_c.is_none() {
                // Optimal / unqualified: show as single value via min.
                traits.min_temperature_c = celsius;
            }
        }
        // ----- Rooting depth -----
        p if p.contains("rooting depth") || p.contains("root depth") || p.contains("depth of root") => {
            if traits.rooting_depth.is_none() {
                traits.rooting_depth = Some(value.to_owned());
            }
        }
        // ----- Uses -----
        p if p.contains("used for") || p == "use" || p.contains("economic use")
            || p.contains("folk use") || p.contains("traditional use") =>
        {
            uses_set.insert(value.to_lowercase());
        }
        _ => {}
    }
}

/// Parse a human-readable temperature string like "27 degrees celsius" or "300 K" to °C.
fn parse_temperature_str(s: &str) -> Option<f64> {
    // Extract the leading numeric part.
    let num_str: String = s.chars().take_while(|c| c.is_ascii_digit() || *c == '.' || *c == '-').collect();
    let num: f64 = num_str.parse().ok()?;
    let lower = s.to_lowercase();
    if lower.contains('k') && !lower.contains("kind") {
        Some(num - 273.15)
    } else if lower.contains('f') && !lower.contains("for") {
        Some((num - 32.0) * 5.0 / 9.0)
    } else {
        Some(num) // degrees celsius or unitless
    }
}

/// Fetch ancestor taxonomy labels from the EoL v1 hierarchy_entries API.
///
/// Prefers English vernacular names; falls back to scientific names.
/// Returns an empty vec silently on any error.
async fn fetch_hierarchy_tags(client: &Client, entry_id: i64) -> Vec<String> {
    let url = format!(
        "https://eol.org/api/hierarchy_entries/1.0.json?id={entry_id}&common_names=true"
    );
    let resp = match client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };
    let body: EolHierarchyEntryResponse = match resp.json().await {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };
    body.ancestors
        .unwrap_or_default()
        .into_iter()
        .filter_map(|a| {
            let vernacular: Option<String> = a.vernacular_names
                .as_deref()
                .and_then(|names| {
                    names.iter()
                        .find(|n| n.language.as_deref() == Some("en"))
                        .and_then(|n| n.vernacular_name.clone())
                });
            vernacular.or_else(|| a.scientific_name)
        })
        .filter(|t| !t.is_empty())
        .collect()
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
