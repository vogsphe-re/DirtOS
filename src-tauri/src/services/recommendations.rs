use sqlx::SqlitePool;

use crate::db::models::Recommendation;

#[derive(sqlx::FromRow)]
struct LowYieldRow {
    species_name: Option<String>,
    species_id: Option<i64>,
    plant_count: i64,
    #[allow(dead_code)]
    total_yield: f64,
}

#[derive(sqlx::FromRow)]
struct IssueRow {
    species_name: Option<String>,
    species_id: Option<i64>,
    issue_count: i64,
}

#[derive(sqlx::FromRow)]
struct SoilRow {
    location_name: String,
    ph: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct OverdueRow {
    plant_id: i64,
    plant_name: String,
    species_name: Option<String>,
}

/// Generate recommendations for an environment based on historical data.
pub async fn get_recommendations(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Vec<Recommendation>, sqlx::Error> {
    let mut recs = Vec::new();

    // -----------------------------------------------------------------------
    // 1. Low-yield species (planted but few/no harvests)
    // -----------------------------------------------------------------------
    let low_yield_rows = sqlx::query_as::<_, LowYieldRow>(
        r#"SELECT
               COALESCE(s.common_name, p.name) AS species_name,
               s.id                             AS species_id,
               COUNT(DISTINCT p.id)             AS plant_count,
               COALESCE(SUM(h.quantity), 0.0)   AS total_yield
           FROM plants p
           LEFT JOIN species s ON s.id = p.species_id
           LEFT JOIN harvests h ON h.plant_id = p.id
           WHERE p.environment_id = ?
             AND p.status NOT IN ('planned', 'seedling')
           GROUP BY COALESCE(s.common_name, p.name)
           HAVING total_yield < 0.001 AND plant_count > 0
           ORDER BY plant_count DESC
           LIMIT 5"#,
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await?;

    for row in &low_yield_rows {
        let species_name = row.species_name.as_deref().unwrap_or("Unknown");
        recs.push(Recommendation {
            category: "yield".into(),
            title: format!("Low yield: {}", species_name),
            description: format!(
                "{} plant(s) of {} have produced no recorded harvests. \
                 Consider reviewing care schedules, light, and nutrient levels.",
                row.plant_count, species_name
            ),
            confidence: 0.75,
            action_suggestion: Some("Review watering and feeding schedules".into()),
            plant_id: None,
            species_id: row.species_id,
        });
    }

    // -----------------------------------------------------------------------
    // 2. Open issues cluster (species with many unresolved issues)
    // -----------------------------------------------------------------------
    let issue_rows = sqlx::query_as::<_, IssueRow>(
        r#"SELECT
               COALESCE(s.common_name, p.name) AS species_name,
               s.id                             AS species_id,
               COUNT(i.id)                      AS issue_count
           FROM issues i
           JOIN plants p ON p.id = i.plant_id
           LEFT JOIN species s ON s.id = p.species_id
           WHERE p.environment_id = ?
             AND i.status IN ('new', 'open', 'in_progress')
           GROUP BY COALESCE(s.common_name, p.name)
           HAVING issue_count >= 2
           ORDER BY issue_count DESC
           LIMIT 5"#,
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await?;

    for row in &issue_rows {
        let species_name = row.species_name.as_deref().unwrap_or("Unknown");
        recs.push(Recommendation {
            category: "health".into(),
            title: format!("Recurring issues: {}", species_name),
            description: format!(
                "{} open issue(s) detected for {}. \
                 Inspect plants for pests, disease, or environmental stress.",
                row.issue_count, species_name
            ),
            confidence: 0.8,
            action_suggestion: Some("Open Issues page and triage open tickets".into()),
            plant_id: None,
            species_id: row.species_id,
        });
    }

    // -----------------------------------------------------------------------
    // 3. Soil pH out of optimal range
    // -----------------------------------------------------------------------
    let soil_rows = sqlx::query_as::<_, SoilRow>(
        r#"SELECT
               l.name AS location_name,
               st.ph  AS ph
           FROM soil_tests st
           JOIN locations l ON l.id = st.location_id
           WHERE l.environment_id = ?
             AND (st.ph < 5.5 OR st.ph > 7.5)
           ORDER BY st.test_date DESC
           LIMIT 5"#,
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await?;

    for row in &soil_rows {
        let ph = row.ph.unwrap_or(0.0);
        let dir = if ph < 5.5 { "too acidic" } else { "too alkaline" };
        recs.push(Recommendation {
            category: "soil".into(),
            title: format!("Soil pH out of range: {}", row.location_name),
            description: format!(
                "Location '{}' recorded pH {:.1} ({}). \
                 Most vegetables prefer pH 6.0–7.0.",
                row.location_name, ph, dir
            ),
            confidence: 0.9,
            action_suggestion: Some(if ph < 5.5 {
                "Apply garden lime to raise pH".into()
            } else {
                "Apply sulfur or acidic mulch to lower pH".into()
            }),
            plant_id: None,
            species_id: None,
        });
    }

    // -----------------------------------------------------------------------
    // 4. Plants overdue for harvest (days_to_harvest exceeded)
    // -----------------------------------------------------------------------
    let overdue_rows = sqlx::query_as::<_, OverdueRow>(
        r#"SELECT
               p.id          AS plant_id,
               p.name        AS plant_name,
               s.common_name AS species_name
           FROM plants p
           JOIN species s ON s.id = p.species_id
           WHERE p.environment_id = ?
             AND p.status = 'active'
             AND s.days_to_harvest_max IS NOT NULL
             AND p.planted_date IS NOT NULL
             AND julianday('now') - julianday(p.planted_date) > s.days_to_harvest_max
           ORDER BY (julianday('now') - julianday(p.planted_date) - s.days_to_harvest_max) DESC
           LIMIT 5"#,
    )
    .bind(environment_id)
    .fetch_all(pool)
    .await?;

    for row in &overdue_rows {
        recs.push(Recommendation {
            category: "harvest".into(),
            title: format!("Overdue harvest: {}", row.plant_name),
            description: format!(
                "'{}' ({}) may be ready or overdue based on species days-to-harvest data. \
                 Currently marked Active with no harvest logged.",
                row.plant_name,
                row.species_name.as_deref().unwrap_or("unknown species")
            ),
            confidence: 0.7,
            action_suggestion: Some("Log a harvest or update plant status".into()),
            plant_id: Some(row.plant_id),
            species_id: None,
        });
    }

    Ok(recs)
}
