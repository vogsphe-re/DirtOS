use sqlx::SqlitePool;

use super::models::{NewSpecies, Pagination, Species, SpeciesFilters, UpdateSpecies};

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
