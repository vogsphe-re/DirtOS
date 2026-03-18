use serde::Deserialize;
use sqlx::SqlitePool;

// ---------------------------------------------------------------------------
// Seed data structs — mirror the JSON files in seed/
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct SeedSpecies {
    common_name: String,
    scientific_name: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    growth_type: Option<String>,
    sun_requirement: Option<String>,
    water_requirement: Option<String>,
    soil_ph_min: Option<f64>,
    soil_ph_max: Option<f64>,
    spacing_cm: Option<f64>,
    days_to_germination_min: Option<i64>,
    days_to_germination_max: Option<i64>,
    days_to_harvest_min: Option<i64>,
    days_to_harvest_max: Option<i64>,
    hardiness_zone_min: Option<String>,
    hardiness_zone_max: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SeedSoilType {
    name: String,
    composition: Option<String>,
    ph_default: Option<f64>,
    drainage_rating: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SeedAdditive {
    name: String,
    #[serde(rename = "type")]
    additive_type: String,
    npk_n: Option<f64>,
    npk_p: Option<f64>,
    npk_k: Option<f64>,
    application_rate: Option<f64>,
    application_unit: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SeedIssueLabel {
    name: String,
    color: Option<String>,
    icon: Option<String>,
}

// Embed seed files at compile time so no runtime filesystem access is needed.
static SPECIES_JSON: &str = include_str!("../../seed/species.json");
static SOIL_TYPES_JSON: &str = include_str!("../../seed/soil_types.json");
static ADDITIVES_JSON: &str = include_str!("../../seed/additives.json");
static ISSUE_LABELS_JSON: &str = include_str!("../../seed/issue_labels.json");

/// Seed the database with initial reference data.
/// Each section is guarded by a row-count check so it is idempotent —
/// re-running will not insert duplicates.
pub async fn seed_initial_data(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    seed_species(pool).await?;
    seed_soil_types(pool).await?;
    seed_additives(pool).await?;
    seed_issue_labels(pool).await?;
    Ok(())
}

async fn seed_species(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM species WHERE is_user_added = 0")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        tracing::debug!("Species already seeded ({} rows). Skipping.", count);
        return Ok(());
    }

    let items: Vec<SeedSpecies> = serde_json::from_str(SPECIES_JSON)
        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

    tracing::info!("Seeding {} species records", items.len());

    for s in items {
        sqlx::query(
            "INSERT OR IGNORE INTO species (
                common_name, scientific_name, family, genus,
                growth_type, sun_requirement, water_requirement,
                soil_ph_min, soil_ph_max, spacing_cm,
                days_to_germination_min, days_to_germination_max,
                days_to_harvest_min, days_to_harvest_max,
                hardiness_zone_min, hardiness_zone_max,
                description, is_user_added
             ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)",
        )
        .bind(&s.common_name)
        .bind(&s.scientific_name)
        .bind(&s.family)
        .bind(&s.genus)
        .bind(&s.growth_type)
        .bind(&s.sun_requirement)
        .bind(&s.water_requirement)
        .bind(s.soil_ph_min)
        .bind(s.soil_ph_max)
        .bind(s.spacing_cm)
        .bind(s.days_to_germination_min)
        .bind(s.days_to_germination_max)
        .bind(s.days_to_harvest_min)
        .bind(s.days_to_harvest_max)
        .bind(&s.hardiness_zone_min)
        .bind(&s.hardiness_zone_max)
        .bind(&s.description)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_soil_types(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM soil_types")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let items: Vec<SeedSoilType> = serde_json::from_str(SOIL_TYPES_JSON)
        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

    tracing::info!("Seeding {} soil types", items.len());

    for s in items {
        sqlx::query(
            "INSERT OR IGNORE INTO soil_types (name, composition, ph_default, drainage_rating, notes)
             VALUES (?,?,?,?,?)",
        )
        .bind(&s.name)
        .bind(&s.composition)
        .bind(s.ph_default)
        .bind(&s.drainage_rating)
        .bind(&s.notes)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_additives(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM additives")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let items: Vec<SeedAdditive> = serde_json::from_str(ADDITIVES_JSON)
        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

    tracing::info!("Seeding {} additives", items.len());

    for a in items {
        sqlx::query(
            "INSERT OR IGNORE INTO additives
                (name, type, npk_n, npk_p, npk_k, application_rate, application_unit, notes)
             VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(&a.name)
        .bind(&a.additive_type)
        .bind(a.npk_n)
        .bind(a.npk_p)
        .bind(a.npk_k)
        .bind(a.application_rate)
        .bind(&a.application_unit)
        .bind(&a.notes)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn seed_issue_labels(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM issue_labels")
        .fetch_one(pool)
        .await?;

    if count > 0 {
        return Ok(());
    }

    let items: Vec<SeedIssueLabel> = serde_json::from_str(ISSUE_LABELS_JSON)
        .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;

    tracing::info!("Seeding {} issue labels", items.len());

    for l in items {
        sqlx::query(
            "INSERT OR IGNORE INTO issue_labels (name, color, icon) VALUES (?,?,?)",
        )
        .bind(&l.name)
        .bind(&l.color)
        .bind(&l.icon)
        .execute(pool)
        .await?;
    }

    Ok(())
}
