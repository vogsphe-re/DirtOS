use reqwest::Client;
use sqlx::SqlitePool;
use tauri::State;

use crate::{
    db::{
        models::{NewSpecies, Pagination, Species, SpeciesFilters, UpdateSpecies},
        species,
    },
    services::{inaturalist, eol, wikipedia},
};

#[tauri::command]
#[specta::specta]
pub async fn list_species(
    pool: State<'_, SqlitePool>,
    query: Option<String>,
    sun_requirement: Option<String>,
    water_requirement: Option<String>,
    growth_type: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Species>, String> {
    let filters = SpeciesFilters {
        query,
        sun_requirement,
        water_requirement,
        growth_type,
    };
    let pagination = Pagination {
        limit: limit.unwrap_or(100),
        offset: offset.unwrap_or(0),
    };
    species::list_species_filtered(&pool, filters, pagination)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_species(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Species>, String> {
    species::get_species(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_species(
    pool: State<'_, SqlitePool>,
    input: NewSpecies,
) -> Result<Species, String> {
    species::create_species(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_species(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateSpecies,
) -> Result<Option<Species>, String> {
    species::update_species(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_species(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    species::delete_species(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

/// Search iNaturalist for taxa matching the given query.
/// Returns up to 20 results — the frontend presents them for the user to pick.
#[tauri::command]
#[specta::specta]
pub async fn search_inaturalist(
    query: String,
) -> Result<Vec<inaturalist::TaxonResult>, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;
    inaturalist::search_taxa(&client, &query).await
}

/// Enrich an existing species record with data fetched from iNaturalist.
/// Uses the species' inaturalist_id if already set; otherwise falls back to
/// searching by scientific_name then common_name.
#[tauri::command]
#[specta::specta]
pub async fn enrich_species_inaturalist(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Species, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    // Determine taxon ID to fetch.
    let taxon_id: i64 = if let Some(id) = sp.inaturalist_id {
        id
    } else {
        // Search by scientific name, fall back to common name.
        let query = sp
            .scientific_name
            .as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or(sp.common_name.as_str());
        let results = inaturalist::search_taxa(&client, query).await?;
        results
            .into_iter()
            .next()
            .ok_or_else(|| format!("No iNaturalist results for '{query}'"))?
            .id
    };

    let detail = inaturalist::get_taxon(&client, taxon_id).await?;

    species::update_species_inaturalist(
        &pool,
        species_id,
        detail.id,
        Some(detail.name),
        detail.family,
        detail.genus,
        detail.default_photo_url,
        None, // description comes from Wikipedia
        detail.raw_json,
    )
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Species {species_id} not found after update"))
}

/// Search Wikipedia for pages matching the given query.
#[tauri::command]
#[specta::specta]
pub async fn search_wikipedia(
    query: String,
) -> Result<wikipedia::WikiSummary, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;
    // Wikipedia summary API works best with exact page titles.
    // We try the query as a slug directly; the caller can adjust.
    wikipedia::get_summary(&client, &query).await
}

/// Enrich an existing species record with data fetched from Wikipedia.
/// Uses the species' wikipedia_slug if already set, otherwise derives a slug
/// from scientific_name or common_name.
#[tauri::command]
#[specta::specta]
pub async fn enrich_species_wikipedia(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Species, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    // Resolve slug: prefer stored value → scientific_name → common_name
    let slug = sp
        .wikipedia_slug
        .filter(|s| !s.is_empty())
        .or_else(|| {
            sp.scientific_name
                .filter(|s| !s.is_empty())
                .map(|s| s.replace(' ', "_"))
        })
        .unwrap_or_else(|| sp.common_name.replace(' ', "_"));

    let summary = wikipedia::get_summary(&client, &slug).await?;

    species::update_species_wikipedia(
        &pool,
        species_id,
        summary.slug.clone(),
        summary.extract,
        summary.thumbnail_url,
        summary.raw_json,
    )
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Species {species_id} not found after update"))
}

/// Search Wikipedia for candidate articles for a species using fuzzy (OpenSearch)
/// matching against both the scientific name and common name.  Returns deduplicated
/// results so the user can pick the correct article.

/// Search Encyclopedia of Life for candidate pages for a species.
/// Queries by scientific name then common name, deduplicates by EoL page id.
#[tauri::command]
#[specta::specta]
pub async fn search_eol_candidates(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Vec<eol::EolSearchResult>, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let sci_query: Option<String> = sp.scientific_name.filter(|s| !s.is_empty());
    let common_query: Option<String> = if sp.common_name.is_empty() { None } else { Some(sp.common_name) };

    // Run both searches concurrently; ignore individual failures.
    let (sci_results, common_results) = tokio::join!(
        async {
            match sci_query.as_deref() {
                Some(name) => eol::search(&client, name, 5).await.unwrap_or_default(),
                None => Vec::new(),
            }
        },
        async {
            match common_query.as_deref() {
                Some(name) => eol::search(&client, name, 5).await.unwrap_or_default(),
                None => Vec::new(),
            }
        }
    );

    let mut seen = std::collections::HashSet::new();
    let mut results: Vec<eol::EolSearchResult> = Vec::new();
    for c in sci_results.into_iter().chain(common_results) {
        if seen.insert(c.id) {
            results.push(c);
        }
    }

    Ok(results)
}

/// Enrich a species record with data from a specific EoL page chosen by the user.
#[tauri::command]
#[specta::specta]
pub async fn enrich_species_eol_by_id(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    eol_page_id: i64,
) -> Result<Species, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    // Fetch page details and TraitBank traits concurrently.
    let (page_result, traits) = tokio::join!(
        eol::get_page(&client, eol_page_id),
        eol::get_traits(&client, eol_page_id)
    );
    let detail = page_result?;

    species::update_species_eol(
        &pool,
        species_id,
        detail.page_id,
        detail.description,
        detail.image_url,
        traits.growth_type,
        traits.sun_requirement,
        traits.water_requirement,
        traits.hardiness_zone_min,
        traits.hardiness_zone_max,
        detail.raw_json,
    )
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Species {species_id} not found after EoL update"))
}
#[tauri::command]
#[specta::specta]
pub async fn search_wikipedia_candidates(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Vec<wikipedia::WikiSearchResult>, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    // Build candidate queries: scientific name first, then common name.
    let mut queries: Vec<String> = Vec::new();
    if let Some(sci) = sp.scientific_name.filter(|s| !s.is_empty()) {
        queries.push(sci);
    }
    if !sp.common_name.is_empty() {
        queries.push(sp.common_name);
    }

    let mut seen = std::collections::HashSet::new();
    let mut results: Vec<wikipedia::WikiSearchResult> = Vec::new();

    for query in queries {
        if let Ok(candidates) = wikipedia::search_candidates(&client, &query, 6).await {
            for c in candidates {
                if seen.insert(c.slug.clone()) {
                    results.push(c);
                }
            }
        }
    }

    Ok(results)
}

/// Enrich a species record using a specific Wikipedia slug chosen by the user.
#[tauri::command]
#[specta::specta]
pub async fn enrich_species_wikipedia_by_slug(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    slug: String,
) -> Result<Species, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let summary = wikipedia::get_summary(&client, &slug).await?;

    species::update_species_wikipedia(
        &pool,
        species_id,
        summary.slug.clone(),
        summary.extract,
        summary.thumbnail_url,
        summary.raw_json,
    )
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Species {species_id} not found after update"))
}
