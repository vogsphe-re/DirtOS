use reqwest::Client;
use sqlx::SqlitePool;
use tauri::State;

use crate::{
    db::{
        self,
        models::{
            ApplyEnrichmentFields, AutoEnrichResult, EnrichmentFieldPreview, EnrichmentPreviewResult, NewSpecies,
            Pagination, Species, SpeciesFilters, UpdateSpecies,
        },
        species,
    },
    services::{inaturalist, eol, gbif, trefle, wikipedia},
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

    if sci_query.is_none() && common_query.is_none() {
        return Err("This species has no scientific name or common name to search with.".to_string());
    }

    // Run both searches concurrently.
    let (sci_result, common_result) = tokio::join!(
        async {
            match sci_query.as_deref() {
                Some(name) => eol::search(&client, name, 13).await,
                None => Ok(Vec::new()),
            }
        },
        async {
            match common_query.as_deref() {
                Some(name) => eol::search(&client, name, 13).await,
                None => Ok(Vec::new()),
            }
        }
    );

    // If both searches failed, surface the primary error so the user can see
    // what went wrong (network error, TLS failure, etc.).
    let sci_results = match sci_result {
        Ok(v) => v,
        Err(e) if common_result.is_err() => return Err(e),
        Err(_) => Vec::new(),
    };
    let common_results = common_result.unwrap_or_default();

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

    let tags_json = if detail.tags.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&detail.tags).unwrap_or_default())
    };
    let uses_str = if traits.uses.is_empty() {
        None
    } else {
        Some(traits.uses.join(", "))
    };

    species::update_species_eol(
        &pool,
        species_id,
        detail.page_id,
        detail.description,
        detail.image_url,
        traits.growth_type,
        traits.sun_requirement,
        traits.water_requirement,
        traits.soil_ph_min,
        traits.soil_ph_max,
        traits.hardiness_zone_min,
        traits.hardiness_zone_max,
        traits.habitat,
        traits.min_temperature_c,
        traits.max_temperature_c,
        traits.rooting_depth,
        uses_str,
        tags_json,
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
        if let Ok(candidates) = wikipedia::search_candidates(&client, &query, 13).await {
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

/// Search GBIF for candidate backbone taxa matching a species.
/// Uses fuzzy match and free-text search concurrently, deduplicates by usage key.
#[tauri::command]
#[specta::specta]
pub async fn search_gbif_candidates(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Vec<gbif::GbifSearchResult>, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let sci_name: Option<String> = sp.scientific_name.filter(|s| !s.is_empty());
    let common_name: Option<String> = if sp.common_name.is_empty() { None } else { Some(sp.common_name) };

    if sci_name.is_none() && common_name.is_none() {
        return Err("This species has no scientific name or common name to search with.".to_string());
    }

    // Run match (best single hit) and search (broader) concurrently.
    let (match_result, search_sci, search_common) = tokio::join!(
        async {
            match sci_name.as_deref() {
                Some(name) => gbif::match_species(&client, name).await.ok(),
                None => match common_name.as_deref() {
                    Some(name) => gbif::match_species(&client, name).await.ok(),
                    None => None,
                },
            }
        },
        async {
            match sci_name.as_deref() {
                Some(name) => gbif::search(&client, name, 13).await.unwrap_or_default(),
                None => Vec::new(),
            }
        },
        async {
            match common_name.as_deref() {
                Some(name) => gbif::search(&client, name, 13).await.unwrap_or_default(),
                None => Vec::new(),
            }
        }
    );

    // Deduplicate by GBIF key, putting the match result first if present.
    let mut seen = std::collections::HashSet::new();
    let mut results: Vec<gbif::GbifSearchResult> = Vec::new();

    if let Some(m) = match_result {
        seen.insert(m.key);
        results.push(m);
    }
    for c in search_sci.into_iter().chain(search_common) {
        if seen.insert(c.key) {
            results.push(c);
        }
    }

    Ok(results)
}

/// Enrich a species record with data from a specific GBIF backbone taxon
/// chosen by the user.
#[tauri::command]
#[specta::specta]
pub async fn enrich_species_gbif_by_key(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    gbif_key: i64,
) -> Result<Species, String> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let detail = gbif::get_detail(&client, gbif_key).await?;

    let native_range = if detail.native_range.is_empty() {
        None
    } else {
        Some(detail.native_range.join("; "))
    };
    let establishment_means = if detail.establishment_means.is_empty() {
        None
    } else {
        Some(detail.establishment_means.join(", "))
    };

    species::update_species_gbif(
        &pool,
        species_id,
        detail.key,
        Some(detail.scientific_name),
        detail.family,
        detail.genus,
        detail.habitat,
        native_range,
        establishment_means,
        detail.raw_json,
    )
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Species {species_id} not found after GBIF update"))
}

/// Search Trefle for candidate plants matching a species.
/// Uses the stored Trefle API token from app_settings.
#[tauri::command]
#[specta::specta]
pub async fn search_trefle_candidates(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Vec<trefle::TrefleSearchResult>, String> {
    let token = db::weather::get_setting(&pool, "trefle_api_key")
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Trefle API token not configured. Set it in Settings.".to_string())?;

    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let sci_name: Option<String> = sp.scientific_name.filter(|s| !s.is_empty());
    let common_name: Option<String> = if sp.common_name.is_empty() { None } else { Some(sp.common_name) };

    if sci_name.is_none() && common_name.is_none() {
        return Err("This species has no scientific name or common name to search with.".to_string());
    }

    let (sci_results, common_results) = tokio::join!(
        async {
            match sci_name.as_deref() {
                Some(name) => trefle::search(&client, name, &token, 13).await.unwrap_or_default(),
                None => Vec::new(),
            }
        },
        async {
            match common_name.as_deref() {
                Some(name) => trefle::search(&client, name, &token, 13).await.unwrap_or_default(),
                None => Vec::new(),
            }
        }
    );

    let mut seen = std::collections::HashSet::new();
    let mut results: Vec<trefle::TrefleSearchResult> = Vec::new();
    for c in sci_results.into_iter().chain(common_results) {
        if seen.insert(c.id) {
            results.push(c);
        }
    }

    Ok(results)
}

/// Enrich a species record with data from a specific Trefle plant chosen by the user.
#[tauri::command]
#[specta::specta]
pub async fn enrich_species_trefle_by_id(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    trefle_id: i64,
) -> Result<Species, String> {
    let token = db::weather::get_setting(&pool, "trefle_api_key")
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Trefle API token not configured. Set it in Settings.".to_string())?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let detail = trefle::get_detail(&client, trefle_id, &token).await?;

    species::update_species_trefle(
        &pool,
        species_id,
        detail.id,
        detail.family,
        detail.genus,
        detail.image_url,
        detail.growth_type,
        detail.sun_requirement,
        detail.water_requirement,
        detail.soil_ph_min,
        detail.soil_ph_max,
        detail.spacing_cm,
        detail.days_to_harvest_min,
        detail.days_to_harvest_max,
        detail.hardiness_zone_min,
        detail.hardiness_zone_max,
        detail.min_temperature_c,
        detail.max_temperature_c,
        detail.raw_json,
    )
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Species {species_id} not found after Trefle update"))
}

// ---------------------------------------------------------------------------
// Enrichment Preview Commands
// ---------------------------------------------------------------------------

fn field(
    field: &str,
    label: &str,
    current: Option<&str>,
    new_val: Option<String>,
) -> EnrichmentFieldPreview {
    EnrichmentFieldPreview {
        field: field.to_string(),
        label: label.to_string(),
        current_value: current.map(|s| s.to_string()),
        new_value: new_val,
    }
}

fn field_num<T: std::fmt::Display>(
    field_name: &str,
    label: &str,
    current: Option<T>,
    new_val: Option<T>,
) -> EnrichmentFieldPreview {
    EnrichmentFieldPreview {
        field: field_name.to_string(),
        label: label.to_string(),
        current_value: current.map(|v| v.to_string()),
        new_value: new_val.map(|v| v.to_string()),
    }
}

/// Preview iNaturalist enrichment without writing to DB.
#[tauri::command]
#[specta::specta]
pub async fn preview_enrich_inaturalist(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<EnrichmentPreviewResult, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let taxon_id: i64 = if let Some(id) = sp.inaturalist_id {
        id
    } else {
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

    let mut fields = vec![
        field(
            "scientific_name",
            "Scientific name",
            sp.scientific_name.as_deref(),
            Some(detail.name.clone()),
        ),
        field("family", "Family", sp.family.as_deref(), detail.family.clone()),
        field("genus", "Genus", sp.genus.as_deref(), detail.genus.clone()),
        field(
            "image_url",
            "Image",
            sp.image_url.as_deref(),
            detail.default_photo_url.clone(),
        ),
    ];
    // Only include fields that actually have a new value
    fields.retain(|f| f.new_value.is_some());

    Ok(EnrichmentPreviewResult {
        source: "inaturalist".to_string(),
        fields,
        cached_json: Some(detail.raw_json),
        source_id: Some(taxon_id.to_string()),
    })
}

/// Preview Wikipedia enrichment without writing to DB.
#[tauri::command]
#[specta::specta]
pub async fn preview_enrich_wikipedia(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    slug: String,
) -> Result<EnrichmentPreviewResult, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let summary = wikipedia::get_summary(&client, &slug).await?;

    let mut fields = vec![
        field(
            "description",
            "Description",
            sp.description.as_deref(),
            summary.extract.clone(),
        ),
        field(
            "image_url",
            "Image",
            sp.image_url.as_deref(),
            summary.thumbnail_url.clone(),
        ),
    ];
    fields.retain(|f| f.new_value.is_some());

    Ok(EnrichmentPreviewResult {
        source: "wikipedia".to_string(),
        fields,
        cached_json: Some(summary.raw_json),
        source_id: Some(summary.slug),
    })
}

/// Preview EoL enrichment without writing to DB.
#[tauri::command]
#[specta::specta]
pub async fn preview_enrich_eol(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    eol_page_id: i64,
) -> Result<EnrichmentPreviewResult, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let (page_result, traits) = tokio::join!(
        eol::get_page(&client, eol_page_id),
        eol::get_traits(&client, eol_page_id)
    );
    let detail = page_result?;

    let tags_json = if detail.tags.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&detail.tags).unwrap_or_default())
    };
    let uses_str = if traits.uses.is_empty() {
        None
    } else {
        Some(traits.uses.join(", "))
    };

    let mut fields = vec![
        field("eol_description", "Description (EoL)", sp.eol_description.as_deref(), detail.description.clone()),
        field("image_url", "Image", sp.image_url.as_deref(), detail.image_url.clone()),
        field("growth_type", "Growth type", sp.growth_type.as_deref(), traits.growth_type.clone()),
        field("sun_requirement", "Sun requirement", sp.sun_requirement.as_deref(), traits.sun_requirement.clone()),
        field("water_requirement", "Water requirement", sp.water_requirement.as_deref(), traits.water_requirement.clone()),
        field_num("soil_ph_min", "Soil pH min", sp.soil_ph_min, traits.soil_ph_min),
        field_num("soil_ph_max", "Soil pH max", sp.soil_ph_max, traits.soil_ph_max),
        field("hardiness_zone_min", "Hardiness zone min", sp.hardiness_zone_min.as_deref(), traits.hardiness_zone_min.clone()),
        field("hardiness_zone_max", "Hardiness zone max", sp.hardiness_zone_max.as_deref(), traits.hardiness_zone_max.clone()),
        field("habitat", "Habitat", sp.habitat.as_deref(), traits.habitat.clone()),
        field_num("min_temperature_c", "Min temperature (°C)", sp.min_temperature_c, traits.min_temperature_c),
        field_num("max_temperature_c", "Max temperature (°C)", sp.max_temperature_c, traits.max_temperature_c),
        field("rooting_depth", "Rooting depth", sp.rooting_depth.as_deref(), traits.rooting_depth.clone()),
        field("uses", "Uses", sp.uses.as_deref(), uses_str.clone()),
        field("tags", "Tags", sp.tags.as_deref(), tags_json.clone()),
    ];
    fields.retain(|f| f.new_value.is_some());

    Ok(EnrichmentPreviewResult {
        source: "eol".to_string(),
        fields,
        cached_json: Some(detail.raw_json),
        source_id: Some(eol_page_id.to_string()),
    })
}

/// Preview GBIF enrichment without writing to DB.
#[tauri::command]
#[specta::specta]
pub async fn preview_enrich_gbif(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    gbif_key: i64,
) -> Result<EnrichmentPreviewResult, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let detail = gbif::get_detail(&client, gbif_key).await?;

    let native_range = if detail.native_range.is_empty() {
        None
    } else {
        Some(detail.native_range.join("; "))
    };
    let establishment_means = if detail.establishment_means.is_empty() {
        None
    } else {
        Some(detail.establishment_means.join(", "))
    };

    let mut fields = vec![
        field("gbif_accepted_name", "Accepted name", sp.gbif_accepted_name.as_deref(), Some(detail.scientific_name.clone())),
        field("family", "Family", sp.family.as_deref(), detail.family.clone()),
        field("genus", "Genus", sp.genus.as_deref(), detail.genus.clone()),
        field("habitat", "Habitat", sp.habitat.as_deref(), detail.habitat.clone()),
        field("native_range", "Native range", sp.native_range.as_deref(), native_range.clone()),
        field("establishment_means", "Establishment means", sp.establishment_means.as_deref(), establishment_means.clone()),
    ];
    fields.retain(|f| f.new_value.is_some());

    Ok(EnrichmentPreviewResult {
        source: "gbif".to_string(),
        fields,
        cached_json: Some(detail.raw_json),
        source_id: Some(gbif_key.to_string()),
    })
}

/// Preview Trefle enrichment without writing to DB.
#[tauri::command]
#[specta::specta]
pub async fn preview_enrich_trefle(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    trefle_id: i64,
) -> Result<EnrichmentPreviewResult, String> {
    let token = db::weather::get_setting(&pool, "trefle_api_key")
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Trefle API token not configured. Set it in Settings.".to_string())?;

    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    let detail = trefle::get_detail(&client, trefle_id, &token).await?;

    let mut fields = vec![
        field("family", "Family", sp.family.as_deref(), detail.family.clone()),
        field("genus", "Genus", sp.genus.as_deref(), detail.genus.clone()),
        field("image_url", "Image", sp.image_url.as_deref(), detail.image_url.clone()),
        field("growth_type", "Growth type", sp.growth_type.as_deref(), detail.growth_type.clone()),
        field("sun_requirement", "Sun requirement", sp.sun_requirement.as_deref(), detail.sun_requirement.clone()),
        field("water_requirement", "Water requirement", sp.water_requirement.as_deref(), detail.water_requirement.clone()),
        field_num("soil_ph_min", "Soil pH min", sp.soil_ph_min, detail.soil_ph_min),
        field_num("soil_ph_max", "Soil pH max", sp.soil_ph_max, detail.soil_ph_max),
        field_num("spacing_cm", "Spacing (cm)", sp.spacing_cm, detail.spacing_cm),
        field_num("days_to_harvest_min", "Days to harvest (min)", sp.days_to_harvest_min, detail.days_to_harvest_min),
        field_num("days_to_harvest_max", "Days to harvest (max)", sp.days_to_harvest_max, detail.days_to_harvest_max),
        field("hardiness_zone_min", "Hardiness zone min", sp.hardiness_zone_min.as_deref(), detail.hardiness_zone_min.clone()),
        field("hardiness_zone_max", "Hardiness zone max", sp.hardiness_zone_max.as_deref(), detail.hardiness_zone_max.clone()),
        field_num("min_temperature_c", "Min. temperature (°C)", sp.min_temperature_c, detail.min_temperature_c),
        field_num("max_temperature_c", "Max. temperature (°C)", sp.max_temperature_c, detail.max_temperature_c),
    ];
    fields.retain(|f| f.new_value.is_some());

    Ok(EnrichmentPreviewResult {
        source: "trefle".to_string(),
        fields,
        cached_json: Some(detail.raw_json),
        source_id: Some(trefle_id.to_string()),
    })
}

/// Apply user-approved enrichment fields to a species.
#[tauri::command]
#[specta::specta]
pub async fn apply_enrichment_preview(
    pool: State<'_, SqlitePool>,
    species_id: i64,
    input: ApplyEnrichmentFields,
) -> Result<Species, String> {
    species::apply_enrichment_fields(&pool, species_id, input)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))
}

/// Automatically enrich species from Trefle in the background.
///
/// - Pass `species_ids = null` to enrich **all** species that currently lack a
///   `trefle_id` (i.e. have never been enriched from Trefle).
/// - Pass a list of IDs to limit enrichment to those specific species (only
///   processes species whose `trefle_id` is still NULL).
///
/// Requests are rate-limited to ≤ 30 per minute (2 s between each HTTP call).
/// The command returns immediately; enrichment runs in a background task.
#[tauri::command]
#[specta::specta]
pub async fn auto_enrich_trefle(
    pool: State<'_, SqlitePool>,
    species_ids: Option<Vec<i64>>,
) -> Result<AutoEnrichResult, String> {
    // Require a Trefle API key – return gracefully if one isn't configured.
    let token = match db::weather::get_setting(&pool, "trefle_api_key").await {
        Ok(Some(t)) if !t.trim().is_empty() => t,
        _ => {
            return Ok(AutoEnrichResult {
                queued: 0,
                message: "Trefle API key not configured – skipping auto-enrichment.".to_string(),
            });
        }
    };

    // Collect the species that still need Trefle data.
    let to_enrich: Vec<Species> = if let Some(ref ids) = species_ids {
        let mut result = Vec::new();
        for &id in ids {
            if let Ok(Some(sp)) = species::get_species(&pool, id).await {
                if sp.trefle_id.is_none() {
                    result.push(sp);
                }
            }
        }
        result
    } else {
        species::list_species_without_trefle(&pool)
            .await
            .map_err(|e| e.to_string())?
    };

    let queued = to_enrich.len() as i64;

    if queued == 0 {
        return Ok(AutoEnrichResult {
            queued: 0,
            message: "All species already have Trefle data.".to_string(),
        });
    }

    // Clone pool + token so they can move into the background task.
    let pool_bg = pool.inner().clone();

    tauri::async_runtime::spawn(async move {
        let client = match reqwest::Client::builder().use_rustls_tls().build() {
            Ok(c) => c,
            Err(_) => return,
        };

        for sp in to_enrich {
            // Sleep first so the very first request also respects the limit.
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

            // Pick the best search query: prefer scientific name.
            let query = sp
                .scientific_name
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .unwrap_or(&sp.common_name);

            let candidates = match trefle::search(&client, query.trim(), &token, 1).await {
                Ok(r) => r,
                Err(_) => continue,
            };

            let candidate = match candidates.into_iter().next() {
                Some(c) => c,
                None => continue,
            };

            // Rate-limit the second request (detail fetch).
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

            let detail = match trefle::get_detail(&client, candidate.id, &token).await {
                Ok(d) => d,
                Err(_) => continue,
            };

            // update_species_trefle uses COALESCE for every column except
            // trefle_id, so existing values are preserved.
            let _ = species::update_species_trefle(
                &pool_bg,
                sp.id,
                detail.id,
                detail.family,
                detail.genus,
                detail.image_url,
                detail.growth_type,
                detail.sun_requirement,
                detail.water_requirement,
                detail.soil_ph_min,
                detail.soil_ph_max,
                detail.spacing_cm,
                detail.days_to_harvest_min,
                detail.days_to_harvest_max,
                detail.hardiness_zone_min,
                detail.hardiness_zone_max,
                detail.min_temperature_c,
                detail.max_temperature_c,
                detail.raw_json,
            )
            .await;
        }
    });

    Ok(AutoEnrichResult {
        queued,
        message: format!(
            "Queued {queued} species for background Trefle enrichment."
        ),
    })
}
