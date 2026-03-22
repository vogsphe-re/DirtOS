use sqlx::SqlitePool;

use super::models::{
    ApplyEnrichmentFields, NewSpecies, Pagination, Species, SpeciesFilters, UpdateSpecies,
};

pub async fn list_species(
    pool: &SqlitePool,
    pagination: Pagination,
) -> Result<Vec<Species>, sqlx::Error> {
    sqlx::query_as::<_, Species>(
        "SELECT * FROM species ORDER BY common_name ASC LIMIT ? OFFSET ?",
    )
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn search_species(
    pool: &SqlitePool,
    query: &str,
    pagination: Pagination,
) -> Result<Vec<Species>, sqlx::Error> {
    let pattern = format!("%{}%", query);
    sqlx::query_as::<_, Species>(
        "SELECT * FROM species
         WHERE common_name LIKE ? OR scientific_name LIKE ?
         ORDER BY common_name ASC LIMIT ? OFFSET ?",
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

pub async fn get_species(pool: &SqlitePool, id: i64) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query_as::<_, Species>("SELECT * FROM species WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_species(
    pool: &SqlitePool,
    input: NewSpecies,
) -> Result<Species, sqlx::Error> {
    let is_user_added = input.is_user_added.unwrap_or(true);
    let result = sqlx::query(
        "INSERT INTO species (
            common_name, scientific_name, family, genus,
            growth_type, sun_requirement, water_requirement,
            soil_ph_min, soil_ph_max, spacing_cm,
            days_to_germination_min, days_to_germination_max,
            days_to_harvest_min, days_to_harvest_max,
            hardiness_zone_min, hardiness_zone_max,
            description, image_url, is_user_added
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(&input.common_name)
    .bind(&input.scientific_name)
    .bind(&input.family)
    .bind(&input.genus)
    .bind(&input.growth_type)
    .bind(&input.sun_requirement)
    .bind(&input.water_requirement)
    .bind(input.soil_ph_min)
    .bind(input.soil_ph_max)
    .bind(input.spacing_cm)
    .bind(input.days_to_germination_min)
    .bind(input.days_to_germination_max)
    .bind(input.days_to_harvest_min)
    .bind(input.days_to_harvest_max)
    .bind(&input.hardiness_zone_min)
    .bind(&input.hardiness_zone_max)
    .bind(&input.description)
    .bind(&input.image_url)
    .bind(is_user_added)
    .execute(pool)
    .await?;

    get_species(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_species(
    pool: &SqlitePool,
    id: i64,
    input: UpdateSpecies,
) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query(
        "UPDATE species SET
            common_name             = COALESCE(?, common_name),
            scientific_name         = COALESCE(?, scientific_name),
            family                  = COALESCE(?, family),
            genus                   = COALESCE(?, genus),
            growth_type             = COALESCE(?, growth_type),
            sun_requirement         = COALESCE(?, sun_requirement),
            water_requirement       = COALESCE(?, water_requirement),
            soil_ph_min             = COALESCE(?, soil_ph_min),
            soil_ph_max             = COALESCE(?, soil_ph_max),
            spacing_cm              = COALESCE(?, spacing_cm),
            days_to_germination_min = COALESCE(?, days_to_germination_min),
            days_to_germination_max = COALESCE(?, days_to_germination_max),
            days_to_harvest_min     = COALESCE(?, days_to_harvest_min),
            days_to_harvest_max     = COALESCE(?, days_to_harvest_max),
            hardiness_zone_min      = COALESCE(?, hardiness_zone_min),
            hardiness_zone_max      = COALESCE(?, hardiness_zone_max),
            description             = COALESCE(?, description),
            image_url               = COALESCE(?, image_url),
            updated_at              = datetime('now')
         WHERE id = ?",
    )
    .bind(input.common_name)
    .bind(input.scientific_name)
    .bind(input.family)
    .bind(input.genus)
    .bind(input.growth_type)
    .bind(input.sun_requirement)
    .bind(input.water_requirement)
    .bind(input.soil_ph_min)
    .bind(input.soil_ph_max)
    .bind(input.spacing_cm)
    .bind(input.days_to_germination_min)
    .bind(input.days_to_germination_max)
    .bind(input.days_to_harvest_min)
    .bind(input.days_to_harvest_max)
    .bind(input.hardiness_zone_min)
    .bind(input.hardiness_zone_max)
    .bind(input.description)
    .bind(input.image_url)
    .bind(id)
    .execute(pool)
    .await?;

    get_species(pool, id).await
}

pub async fn delete_species(pool: &SqlitePool, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query("DELETE FROM species WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Count how many species rows exist (used by seed logic).
pub async fn count_species(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM species")
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

/// Filtered species list supporting text search and category filters.
pub async fn list_species_filtered(
    pool: &SqlitePool,
    filters: SpeciesFilters,
    pagination: Pagination,
) -> Result<Vec<Species>, sqlx::Error> {
    let pattern = filters.query.as_deref().map(|q| format!("%{q}%"));
    sqlx::query_as::<_, Species>(
        "SELECT * FROM species
         WHERE (? IS NULL OR (common_name LIKE ? OR scientific_name LIKE ?))
           AND (? IS NULL OR sun_requirement = ?)
           AND (? IS NULL OR water_requirement = ?)
           AND (? IS NULL OR growth_type = ?)
         ORDER BY common_name ASC LIMIT ? OFFSET ?",
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&filters.sun_requirement)
    .bind(&filters.sun_requirement)
    .bind(&filters.water_requirement)
    .bind(&filters.water_requirement)
    .bind(&filters.growth_type)
    .bind(&filters.growth_type)
    .bind(pagination.limit)
    .bind(pagination.offset)
    .fetch_all(pool)
    .await
}

/// Persist iNaturalist enrichment data on a species row.
pub async fn update_species_inaturalist(
    pool: &SqlitePool,
    id: i64,
    inaturalist_id: i64,
    scientific_name: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    image_url: Option<String>,
    description: Option<String>,
    cached_json: String,
) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query(
        "UPDATE species SET
            inaturalist_id          = ?,
            scientific_name         = COALESCE(?, scientific_name),
            family                  = COALESCE(?, family),
            genus                   = COALESCE(?, genus),
            image_url               = COALESCE(?, image_url),
            description             = COALESCE(?, description),
            cached_inaturalist_json = ?,
            updated_at              = datetime('now')
         WHERE id = ?",
    )
    .bind(inaturalist_id)
    .bind(scientific_name)
    .bind(family)
    .bind(genus)
    .bind(image_url)
    .bind(description)
    .bind(cached_json)
    .bind(id)
    .execute(pool)
    .await?;
    get_species(pool, id).await
}

/// Persist Wikipedia enrichment data on a species row.
pub async fn update_species_wikipedia(
    pool: &SqlitePool,
    id: i64,
    wikipedia_slug: String,
    description: Option<String>,
    image_url: Option<String>,
    cached_json: String,
) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query(
        "UPDATE species SET
            wikipedia_slug        = ?,
            description           = COALESCE(?, description),
            image_url             = COALESCE(?, image_url),
            cached_wikipedia_json = ?,
            updated_at            = datetime('now')
         WHERE id = ?",
    )
    .bind(wikipedia_slug)
    .bind(description)
    .bind(image_url)
    .bind(cached_json)
    .bind(id)
    .execute(pool)
    .await?;
    get_species(pool, id).await
}

/// Persist Encyclopedia of Life (EoL) enrichment data on a species row.
pub async fn update_species_eol(
    pool: &SqlitePool,
    id: i64,
    eol_page_id: i64,
    eol_description: Option<String>,
    image_url: Option<String>,
    growth_type: Option<String>,
    sun_requirement: Option<String>,
    water_requirement: Option<String>,
    soil_ph_min: Option<f64>,
    soil_ph_max: Option<f64>,
    hardiness_zone_min: Option<String>,
    hardiness_zone_max: Option<String>,
    habitat: Option<String>,
    min_temperature_c: Option<f64>,
    max_temperature_c: Option<f64>,
    rooting_depth: Option<String>,
    uses: Option<String>,
    tags: Option<String>,
    cached_json: String,
) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query(
        "UPDATE species SET
            eol_page_id        = ?,
            eol_description    = COALESCE(?, eol_description),
            image_url          = COALESCE(?, image_url),
            growth_type        = COALESCE(?, growth_type),
            sun_requirement    = COALESCE(?, sun_requirement),
            water_requirement  = COALESCE(?, water_requirement),
            soil_ph_min        = COALESCE(?, soil_ph_min),
            soil_ph_max        = COALESCE(?, soil_ph_max),
            hardiness_zone_min = COALESCE(?, hardiness_zone_min),
            hardiness_zone_max = COALESCE(?, hardiness_zone_max),
            habitat            = COALESCE(?, habitat),
            min_temperature_c  = COALESCE(?, min_temperature_c),
            max_temperature_c  = COALESCE(?, max_temperature_c),
            rooting_depth      = COALESCE(?, rooting_depth),
            uses               = COALESCE(?, uses),
            tags               = COALESCE(?, tags),
            cached_eol_json    = ?,
            updated_at         = datetime('now')
         WHERE id = ?",
    )
    .bind(eol_page_id)
    .bind(eol_description)
    .bind(image_url)
    .bind(growth_type)
    .bind(sun_requirement)
    .bind(water_requirement)
    .bind(soil_ph_min)
    .bind(soil_ph_max)
    .bind(hardiness_zone_min)
    .bind(hardiness_zone_max)
    .bind(habitat)
    .bind(min_temperature_c)
    .bind(max_temperature_c)
    .bind(rooting_depth)
    .bind(uses)
    .bind(tags)
    .bind(cached_json)
    .bind(id)
    .execute(pool)
    .await?;
    get_species(pool, id).await
}

/// Persist GBIF enrichment data on a species row.
pub async fn update_species_gbif(
    pool: &SqlitePool,
    id: i64,
    gbif_key: i64,
    gbif_accepted_name: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    habitat: Option<String>,
    native_range: Option<String>,
    establishment_means: Option<String>,
    cached_json: String,
) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query(
        "UPDATE species SET
            gbif_key             = ?,
            gbif_accepted_name   = COALESCE(?, gbif_accepted_name),
            family               = COALESCE(?, family),
            genus                = COALESCE(?, genus),
            habitat              = COALESCE(?, habitat),
            native_range         = COALESCE(?, native_range),
            establishment_means  = COALESCE(?, establishment_means),
            cached_gbif_json     = ?,
            updated_at           = datetime('now')
         WHERE id = ?",
    )
    .bind(gbif_key)
    .bind(gbif_accepted_name)
    .bind(family)
    .bind(genus)
    .bind(habitat)
    .bind(native_range)
    .bind(establishment_means)
    .bind(cached_json)
    .bind(id)
    .execute(pool)
    .await?;
    get_species(pool, id).await
}

pub async fn update_species_trefle(
    pool: &SqlitePool,
    id: i64,
    trefle_id: i64,
    family: Option<String>,
    genus: Option<String>,
    image_url: Option<String>,
    growth_type: Option<String>,
    sun_requirement: Option<String>,
    water_requirement: Option<String>,
    soil_ph_min: Option<f64>,
    soil_ph_max: Option<f64>,
    spacing_cm: Option<f64>,
    days_to_harvest_min: Option<i64>,
    days_to_harvest_max: Option<i64>,
    hardiness_zone_min: Option<String>,
    hardiness_zone_max: Option<String>,
    cached_json: String,
) -> Result<Option<Species>, sqlx::Error> {
    sqlx::query(
        "UPDATE species SET
            trefle_id             = ?,
            family                = COALESCE(?, family),
            genus                 = COALESCE(?, genus),
            image_url             = COALESCE(?, image_url),
            growth_type           = COALESCE(?, growth_type),
            sun_requirement       = COALESCE(?, sun_requirement),
            water_requirement     = COALESCE(?, water_requirement),
            soil_ph_min           = COALESCE(?, soil_ph_min),
            soil_ph_max           = COALESCE(?, soil_ph_max),
            spacing_cm            = COALESCE(?, spacing_cm),
            days_to_harvest_min   = COALESCE(?, days_to_harvest_min),
            days_to_harvest_max   = COALESCE(?, days_to_harvest_max),
            hardiness_zone_min    = COALESCE(?, hardiness_zone_min),
            hardiness_zone_max    = COALESCE(?, hardiness_zone_max),
            cached_trefle_json    = ?,
            updated_at            = datetime('now')
         WHERE id = ?",
    )
    .bind(trefle_id)
    .bind(family)
    .bind(genus)
    .bind(image_url)
    .bind(growth_type)
    .bind(sun_requirement)
    .bind(water_requirement)
    .bind(soil_ph_min)
    .bind(soil_ph_max)
    .bind(spacing_cm)
    .bind(days_to_harvest_min)
    .bind(days_to_harvest_max)
    .bind(hardiness_zone_min)
    .bind(hardiness_zone_max)
    .bind(cached_json)
    .bind(id)
    .execute(pool)
    .await?;
    get_species(pool, id).await
}

/// Apply only the user-approved enrichment fields to a species row.
/// Dynamically builds the UPDATE based on which fields are in `approved_fields`.
pub async fn apply_enrichment_fields(
    pool: &SqlitePool,
    id: i64,
    input: ApplyEnrichmentFields,
) -> Result<Option<Species>, sqlx::Error> {
    let approved: std::collections::HashSet<&str> =
        input.approved_fields.iter().map(|s| s.as_str()).collect();

    // Build SET clauses dynamically. Only include columns the user approved.
    let mut set_clauses: Vec<String> = Vec::new();
    let mut values: Vec<Option<String>> = Vec::new();

    macro_rules! maybe {
        ($col:expr, $val:expr) => {
            if approved.contains($col) {
                if let Some(v) = $val {
                    set_clauses.push(format!("{} = ?", $col));
                    values.push(Some(v.to_string()));
                }
            }
        };
    }

    macro_rules! maybe_num {
        ($col:expr, $val:expr) => {
            if approved.contains($col) {
                if let Some(v) = $val {
                    set_clauses.push(format!("{} = ?", $col));
                    values.push(Some(v.to_string()));
                }
            }
        };
    }

    maybe!("scientific_name", input.scientific_name);
    maybe!("family", input.family);
    maybe!("genus", input.genus);
    maybe!("image_url", input.image_url);
    maybe!("description", input.description);
    maybe!("eol_description", input.eol_description);
    maybe!("growth_type", input.growth_type);
    maybe!("sun_requirement", input.sun_requirement);
    maybe!("water_requirement", input.water_requirement);
    maybe_num!("soil_ph_min", input.soil_ph_min);
    maybe_num!("soil_ph_max", input.soil_ph_max);
    maybe_num!("spacing_cm", input.spacing_cm);
    maybe_num!("days_to_harvest_min", input.days_to_harvest_min);
    maybe_num!("days_to_harvest_max", input.days_to_harvest_max);
    maybe!("hardiness_zone_min", input.hardiness_zone_min);
    maybe!("hardiness_zone_max", input.hardiness_zone_max);
    maybe!("habitat", input.habitat);
    maybe!("native_range", input.native_range);
    maybe!("establishment_means", input.establishment_means);
    maybe_num!("min_temperature_c", input.min_temperature_c);
    maybe_num!("max_temperature_c", input.max_temperature_c);
    maybe!("rooting_depth", input.rooting_depth);
    maybe!("uses", input.uses);
    maybe!("tags", input.tags);
    maybe!("gbif_accepted_name", input.gbif_accepted_name);

    // Always set the source-specific identifier & cached JSON
    if let Some(sid) = &input.source_id {
        match input.source.as_str() {
            "inaturalist" => {
                set_clauses.push("inaturalist_id = ?".to_string());
                values.push(Some(sid.clone()));
            }
            "eol" => {
                set_clauses.push("eol_page_id = ?".to_string());
                values.push(Some(sid.clone()));
            }
            "gbif" => {
                set_clauses.push("gbif_key = ?".to_string());
                values.push(Some(sid.clone()));
            }
            "trefle" => {
                set_clauses.push("trefle_id = ?".to_string());
                values.push(Some(sid.clone()));
            }
            "wikipedia" => {
                set_clauses.push("wikipedia_slug = ?".to_string());
                values.push(Some(sid.clone()));
            }
            _ => {}
        }
    }

    if let Some(ref cj) = input.cached_json {
        let col = match input.source.as_str() {
            "inaturalist" => Some("cached_inaturalist_json"),
            "wikipedia" => Some("cached_wikipedia_json"),
            "eol" => Some("cached_eol_json"),
            "gbif" => Some("cached_gbif_json"),
            "trefle" => Some("cached_trefle_json"),
            _ => None,
        };
        if let Some(col) = col {
            set_clauses.push(format!("{col} = ?"));
            values.push(Some(cj.clone()));
        }
    }

    if set_clauses.is_empty() {
        return get_species(pool, id).await;
    }

    set_clauses.push("updated_at = datetime('now')".to_string());

    let sql = format!(
        "UPDATE species SET {} WHERE id = ?",
        set_clauses.join(", ")
    );

    let mut query = sqlx::query(&sql);
    for v in &values {
        query = query.bind(v.as_deref());
    }
    query = query.bind(id);
    query.execute(pool).await?;

    get_species(pool, id).await
}
