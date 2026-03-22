/// Global Biodiversity Information Facility (GBIF) API integration.
///
/// Uses the public GBIF v1 REST API (no authentication required for read
/// operations).
///
/// Endpoints:
///   Match:     https://api.gbif.org/v1/species/match?name={name}
///   Search:    https://api.gbif.org/v1/species/search?q={q}&limit=N
///   Detail:    https://api.gbif.org/v1/species/{key}
///   Profiles:  https://api.gbif.org/v1/species/{key}/speciesProfiles
///   Distrib:   https://api.gbif.org/v1/species/{key}/distributions
///   Vernac:    https://api.gbif.org/v1/species/{key}/vernacularNames
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::Duration;

const USER_AGENT: &str =
    "DirtOS/1.0 (open-source plant tracking application; contact via GitHub)";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

/// A search/match candidate returned to the frontend for the user to pick.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct GbifSearchResult {
    /// GBIF backbone usage key.
    pub key: i64,
    /// Scientific name (with authorship) as given by GBIF.
    pub scientific_name: String,
    /// Canonical name without authorship.
    pub canonical_name: Option<String>,
    /// Taxonomic rank (SPECIES, GENUS, etc.).
    pub rank: Option<String>,
    /// Taxonomic status (ACCEPTED, SYNONYM, etc.).
    pub status: Option<String>,
    /// Match confidence (0–100) from the fuzzy match endpoint.
    pub confidence: Option<i64>,
    /// Full classification breadcrumb (e.g. "Plantae > Tracheophyta > …").
    pub classification: Option<String>,
}

/// Enrichment data extracted from GBIF for a species.
#[derive(Debug, Clone)]
pub struct GbifDetail {
    pub key: i64,
    pub scientific_name: String,
    pub canonical_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub kingdom: Option<String>,
    pub phylum: Option<String>,
    pub order: Option<String>,
    pub rank: Option<String>,
    pub taxonomic_status: Option<String>,
    pub authorship: Option<String>,
    pub vernacular_name_en: Option<String>,
    pub habitat: Option<String>,
    pub native_range: Vec<String>,
    pub establishment_means: Vec<String>,
    pub raw_json: String,
}

// ---------------------------------------------------------------------------
// Private API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifSearchResponse {
    results: Option<Vec<GbifSpeciesItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifMatchResponse {
    usage_key: Option<i64>,
    scientific_name: Option<String>,
    canonical_name: Option<String>,
    rank: Option<String>,
    status: Option<String>,
    match_type: Option<String>,
    confidence: Option<i64>,
    kingdom: Option<String>,
    phylum: Option<String>,
    order: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    #[serde(rename = "class")]
    class_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifSpeciesItem {
    key: Option<i64>,
    nub_key: Option<i64>,
    scientific_name: Option<String>,
    canonical_name: Option<String>,
    rank: Option<String>,
    taxonomic_status: Option<String>,
    kingdom: Option<String>,
    phylum: Option<String>,
    order: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    #[serde(rename = "class")]
    class_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifSpeciesDetail {
    key: i64,
    scientific_name: Option<String>,
    canonical_name: Option<String>,
    authorship: Option<String>,
    kingdom: Option<String>,
    phylum: Option<String>,
    order: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    rank: Option<String>,
    taxonomic_status: Option<String>,
    _vernacular_name: Option<String>,
    #[serde(rename = "class")]
    _class_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifPagedResponse<T> {
    results: Option<Vec<T>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifVernacularItem {
    vernacular_name: Option<String>,
    language: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifProfileItem {
    habitat: Option<String>,
    marine: Option<bool>,
    freshwater: Option<bool>,
    terrestrial: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GbifDistributionItem {
    locality: Option<String>,
    country: Option<String>,
    establishment_means: Option<String>,
    _status: Option<String>,
    _source: Option<String>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Fuzzy-match a species name against the GBIF backbone taxonomy.
/// Returns a single best match, or Err if no match / NONE match type.
pub async fn match_species(
    client: &Client,
    name: &str,
) -> Result<GbifSearchResult, String> {
    let resp = client
        .get("https://api.gbif.org/v1/species/match")
        .query(&[
            ("name", name),
            ("kingdom", "Plantae"),
            ("strict", "false"),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("GBIF match request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GBIF match API returned {}", resp.status()));
    }

    let body: GbifMatchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GBIF match response: {e}"))?;

    // GBIF returns matchType "NONE" when there's no match.
    if body.match_type.as_deref() == Some("NONE") || body.usage_key.is_none() {
        return Err(format!("No GBIF match found for \"{name}\""));
    }

    let classification = build_classification(
        body.kingdom.as_deref(),
        body.phylum.as_deref(),
        body.class_name.as_deref(),
        body.order.as_deref(),
        body.family.as_deref(),
        body.genus.as_deref(),
    );

    Ok(GbifSearchResult {
        key: body.usage_key.unwrap(),
        scientific_name: body.scientific_name.unwrap_or_default(),
        canonical_name: body.canonical_name,
        rank: body.rank,
        status: body.status,
        confidence: body.confidence,
        classification: Some(classification),
    })
}

/// Free-text search for species in the GBIF backbone.
/// Filters to kingdom Plantae and returns up to `limit` results.
pub async fn search(
    client: &Client,
    query: &str,
    limit: u32,
) -> Result<Vec<GbifSearchResult>, String> {
    let limit_str = limit.to_string();
    let resp = client
        .get("https://api.gbif.org/v1/species/search")
        .query(&[
            ("q", query),
            ("rank", "SPECIES"),
            ("highertaxonKey", "6"), // kingdom Plantae
            ("status", "ACCEPTED"),
            ("limit", limit_str.as_str()),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("GBIF search request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GBIF search API returned {}", resp.status()));
    }

    let body: GbifSearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GBIF search response: {e}"))?;

    let results = body
        .results
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            let key = item.key.or(item.nub_key)?;
            let classification = build_classification(
                item.kingdom.as_deref(),
                item.phylum.as_deref(),
                item.class_name.as_deref(),
                item.order.as_deref(),
                item.family.as_deref(),
                item.genus.as_deref(),
            );
            Some(GbifSearchResult {
                key,
                scientific_name: item.scientific_name.unwrap_or_else(|| format!("GBIF {key}")),
                canonical_name: item.canonical_name,
                rank: item.rank,
                status: item.taxonomic_status,
                confidence: None,
                classification: Some(classification),
            })
        })
        .collect();

    Ok(results)
}

/// Fetch full enrichment data for a GBIF backbone usage key.
/// Calls the detail, vernacularNames, speciesProfiles, and distributions
/// endpoints concurrently.
pub async fn get_detail(
    client: &Client,
    usage_key: i64,
) -> Result<GbifDetail, String> {
    let key_str = usage_key.to_string();
    let base = format!("https://api.gbif.org/v1/species/{key_str}");

    // Fetch all four endpoints concurrently.
    let (detail_res, vernacular_res, profiles_res, distrib_res) = tokio::join!(
        fetch_detail(client, &base),
        fetch_vernacular_names(client, &base),
        fetch_species_profiles(client, &base),
        fetch_distributions(client, &base),
    );

    let (detail, raw_json) = detail_res?;
    let vernaculars = vernacular_res.unwrap_or_default();
    let profiles = profiles_res.unwrap_or_default();
    let distributions = distrib_res.unwrap_or_default();

    // Pick the first English vernacular name.
    let vernacular_name_en = vernaculars
        .iter()
        .find(|v| {
            v.language
                .as_deref()
                .map(|l| l == "eng" || l == "en")
                .unwrap_or(false)
        })
        .and_then(|v| v.vernacular_name.clone());

    // Resolve habitat from species profiles (take first non-empty).
    let habitat = profiles
        .iter()
        .find_map(|p| p.habitat.clone().filter(|h| !h.is_empty()))
        .or_else(|| {
            // Fall back to boolean flags (terrestrial, marine, freshwater).
            let flags: Vec<&str> = profiles
                .iter()
                .flat_map(|p| {
                    let mut f = Vec::new();
                    if p.terrestrial == Some(true) { f.push("terrestrial"); }
                    if p.freshwater == Some(true) { f.push("freshwater"); }
                    if p.marine == Some(true) { f.push("marine"); }
                    f
                })
                .collect();
            if flags.is_empty() { None } else { Some(flags.join(", ")) }
        });

    // Collect unique native-range localities and establishment means.
    let mut range_set = std::collections::BTreeSet::new();
    let mut means_set = std::collections::BTreeSet::new();
    for d in &distributions {
        if let Some(means) = d.establishment_means.as_deref() {
            let lower = means.to_lowercase();
            means_set.insert(lower);
            // Only include NATIVE distributions in the native_range field.
            if means.eq_ignore_ascii_case("NATIVE") {
                if let Some(loc) = d.locality.as_deref().filter(|l| !l.is_empty()) {
                    // Truncate very long locality strings (GBIF sometimes has paragraphs).
                    let short = if loc.len() > 80 { &loc[..80] } else { loc };
                    range_set.insert(short.to_string());
                }
                if let Some(country) = d.country.as_deref().filter(|c| !c.is_empty()) {
                    range_set.insert(country.to_string());
                }
            }
        }
    }

    Ok(GbifDetail {
        key: detail.key,
        scientific_name: detail.scientific_name.unwrap_or_default(),
        canonical_name: detail.canonical_name,
        family: detail.family,
        genus: detail.genus,
        kingdom: detail.kingdom,
        phylum: detail.phylum,
        order: detail.order,
        rank: detail.rank,
        taxonomic_status: detail.taxonomic_status,
        authorship: detail.authorship,
        vernacular_name_en,
        habitat,
        native_range: range_set.into_iter().collect(),
        establishment_means: means_set.into_iter().collect(),
        raw_json,
    })
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async fn fetch_detail(
    client: &Client,
    base_url: &str,
) -> Result<(GbifSpeciesDetail, String), String> {
    let resp = client
        .get(base_url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("GBIF detail request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("GBIF detail API returned {}", resp.status()));
    }

    let raw_json = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read GBIF detail body: {e}"))?;

    let detail: GbifSpeciesDetail = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Failed to parse GBIF detail response: {e}"))?;

    Ok((detail, raw_json))
}

async fn fetch_vernacular_names(
    client: &Client,
    base_url: &str,
) -> Result<Vec<GbifVernacularItem>, String> {
    let url = format!("{base_url}/vernacularNames?limit=50");
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("GBIF vernacular names request failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let body: GbifPagedResponse<GbifVernacularItem> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GBIF vernacular names: {e}"))?;

    Ok(body.results.unwrap_or_default())
}

async fn fetch_species_profiles(
    client: &Client,
    base_url: &str,
) -> Result<Vec<GbifProfileItem>, String> {
    let url = format!("{base_url}/speciesProfiles?limit=50");
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("GBIF species profiles request failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let body: GbifPagedResponse<GbifProfileItem> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GBIF species profiles: {e}"))?;

    Ok(body.results.unwrap_or_default())
}

async fn fetch_distributions(
    client: &Client,
    base_url: &str,
) -> Result<Vec<GbifDistributionItem>, String> {
    let url = format!("{base_url}/distributions?limit=100");
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("GBIF distributions request failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let body: GbifPagedResponse<GbifDistributionItem> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GBIF distributions: {e}"))?;

    Ok(body.results.unwrap_or_default())
}

fn build_classification(
    kingdom: Option<&str>,
    phylum: Option<&str>,
    class: Option<&str>,
    order: Option<&str>,
    family: Option<&str>,
    genus: Option<&str>,
) -> String {
    [kingdom, phylum, class, order, family, genus]
        .iter()
        .filter_map(|v| *v)
        .filter(|v| !v.is_empty())
        .collect::<Vec<_>>()
        .join(" > ")
}
