use sqlx::SqlitePool;
use tauri::State;

use crate::db::{environments, issues, journal, locations, plants, schedules, seed_store, sensors};
use crate::db::models::*;
use crate::services::plant_category;

/// Seed a comprehensive demonstration garden with sample data across every
/// feature area. Idempotent: returns the existing environment's id if an
/// environment named "Demo Garden" already exists.
#[tauri::command]
#[specta::specta]
pub async fn seed_demo_garden(pool: State<'_, SqlitePool>) -> Result<i64, String> {
    inner_seed(&pool).await.map_err(|e| e.to_string())
}

async fn inner_seed(pool: &SqlitePool) -> Result<i64, sqlx::Error> {
    // -----------------------------------------------------------------------
    // Guard — don't re-seed
    // -----------------------------------------------------------------------
    if let Some(id) = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM environments WHERE name = 'Demo Garden' LIMIT 1",
    )
    .fetch_optional(pool)
    .await?
    {
        return Ok(id);
    }

    // -----------------------------------------------------------------------
    // Environment
    // -----------------------------------------------------------------------
    let env = environments::create_environment(
        pool,
        NewEnvironment {
            name: "Demo Garden".to_string(),
            latitude: Some(45.5231),
            longitude: Some(-122.6765),
            elevation_m: Some(47.0),
            timezone: Some("America/Los_Angeles".to_string()),
            climate_zone: Some("8b".to_string()),
        },
    )
    .await?;
    let eid = env.id;

    // -----------------------------------------------------------------------
    // Locations
    // -----------------------------------------------------------------------
    let loc_bed_a = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::Plot,
            name: "Raised Bed A".to_string(),
            label: Some("Vegetables".to_string()),
            position_x: Some(100.0),
            position_y: Some(100.0),
            width: Some(240.0),
            height: Some(120.0),
            canvas_data_json: None,
            notes: Some(
                "Main vegetable bed — loamy soil, amended with 4\" compost before season."
                    .to_string(),
            ),
        },
    )
    .await?;

    let loc_bed_b = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::Plot,
            name: "Raised Bed B".to_string(),
            label: Some("Greens & Roots".to_string()),
            position_x: Some(400.0),
            position_y: Some(100.0),
            width: Some(240.0),
            height: Some(120.0),
            canvas_data_json: None,
            notes: Some(
                "Cooler-season crops — carrots, lettuce, spinach, kale.".to_string(),
            ),
        },
    )
    .await?;

    let loc_greenhouse = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::Space,
            name: "Greenhouse".to_string(),
            label: Some("Nursery & Seedlings".to_string()),
            position_x: Some(100.0),
            position_y: Some(280.0),
            width: Some(200.0),
            height: Some(150.0),
            canvas_data_json: None,
            notes: Some(
                "Propagation space with heat mat and supplemental grow lights.".to_string(),
            ),
        },
    )
    .await?;

    let loc_herb_spiral = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::Space,
            name: "Herb Spiral".to_string(),
            label: Some("Herbs".to_string()),
            position_x: Some(370.0),
            position_y: Some(280.0),
            width: Some(180.0),
            height: Some(180.0),
            canvas_data_json: None,
            notes: Some(
                "Free-draining spiral with mediterranean herbs at the top, moisture-lovers at base."
                    .to_string(),
            ),
        },
    )
    .await?;

    let _loc_shed = locations::create_location(
        pool,
        NewLocation {
            environment_id: eid,
            parent_id: None,
            location_type: LocationType::Shed,
            name: "Root Cellar".to_string(),
            label: None,
            position_x: Some(600.0),
            position_y: Some(280.0),
            width: Some(100.0),
            height: Some(80.0),
            canvas_data_json: None,
            notes: Some("Dark, cool seed and produce storage.".to_string()),
        },
    )
    .await?;

    // -----------------------------------------------------------------------
    // Species — look up by common name (seeded from species.json at startup)
    // -----------------------------------------------------------------------
    let sp = |name: &'static str| async move {
        sqlx::query_scalar::<_, i64>(
            "SELECT id FROM species WHERE common_name = ? LIMIT 1",
        )
        .bind(name)
        .fetch_optional(pool)
        .await
        .map(|r| r.unwrap_or(0))
    };

    let sp_tomato = sp("Tomato").await?;
    let sp_bell_pepper = sp("Bell Pepper").await?;
    let sp_basil = sp("Basil").await?;
    let sp_carrot = sp("Carrot").await?;
    let sp_lettuce = sp("Lettuce").await?;
    let sp_spinach = sp("Spinach").await?;
    let sp_cucumber = sp("Cucumber").await?;
    let sp_zucchini = sp("Zucchini").await?;
    let sp_kale = sp("Kale").await?;
    let sp_rosemary = sp("Rosemary").await?;
    let sp_thyme = sp("Thyme").await?;
    let sp_mint = sp("Mint").await?;
    let sp_garlic = sp("Garlic").await?;
    let sp_onion = sp("Onion").await?;
    let sp_sunflower = sp("Sunflower").await?;
    let sp_strawberry = sp("Strawberry").await?;
    let sp_green_bean = sp("Green Bean").await?;
    let sp_swiss_chard = sp("Swiss Chard").await?;
    let sp_pumpkin = sp("Pumpkin").await?;

    // Jalapeño stored under various names in the seed file
    let sp_jalapeno = {
        let v = sp("Jalapeño Pepper").await?;
        if v > 0 {
            v
        } else {
            let v2 = sp("Jalapeno Pepper").await?;
            if v2 > 0 { v2 } else { sp_bell_pepper }
        }
    };

    // -----------------------------------------------------------------------
    // Helper: create a plant and generate its asset id
    // -----------------------------------------------------------------------
    let make_plant = |sid: i64,
                      loc_id: i64,
                      status: PlantStatus,
                      name: &'static str,
                      planted: &'static str,
                      label: Option<&'static str>,
                      notes: Option<&'static str>| async move {
        let growth_type: Option<String> = if sid > 0 {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT growth_type FROM species WHERE id = ? LIMIT 1",
            )
            .bind(sid)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .flatten()
        } else {
            None
        };
        let asset_id = plant_category::generate_asset_id(growth_type.as_deref());
        plants::create_plant(
            pool,
            NewPlant {
                species_id: if sid > 0 { Some(sid) } else { None },
                location_id: Some(loc_id),
                environment_id: eid,
                status: Some(status),
                name: name.to_string(),
                label: label.map(str::to_string),
                planted_date: Some(planted.to_string()),
                notes: notes.map(str::to_string),
                canvas_object_id: None,
            },
            Some(asset_id),
        )
        .await
    };

    // -----------------------------------------------------------------------
    // Plants — Raised Bed A (main vegetables)
    // -----------------------------------------------------------------------
    let p_tom1 = make_plant(
        sp_tomato,
        loc_bed_a.id,
        PlantStatus::Active,
        "Sungold Tomato",
        "2026-04-15",
        Some("SG-01"),
        Some("Indeterminate cherry variety. Staked and trellised. First trusses setting fruit."),
    )
    .await?;

    let p_tom2 = make_plant(
        sp_tomato,
        loc_bed_a.id,
        PlantStatus::Active,
        "San Marzano Tomato",
        "2026-04-15",
        Some("SM-01"),
        Some("Paste tomato for sauce. Shows some interveinal yellowing on lower leaves — monitoring."),
    )
    .await?;

    let p_tom3 = make_plant(
        sp_tomato,
        loc_bed_a.id,
        PlantStatus::Seedling,
        "Cherokee Purple Tomato",
        "2026-05-01",
        Some("CP-01"),
        Some("Heirloom beefsteak. Recently transplanted from greenhouse; still establishing."),
    )
    .await?;

    let p_pepper1 = make_plant(
        sp_bell_pepper,
        loc_bed_a.id,
        PlantStatus::Active,
        "California Wonder Pepper",
        "2026-04-20",
        Some("CAW-01"),
        Some("Classic blocky bell pepper. 3 fruits developing."),
    )
    .await?;

    let _p_pepper_dead = make_plant(
        sp_bell_pepper,
        loc_bed_a.id,
        PlantStatus::Dead,
        "Jimmy Nardello Pepper",
        "2026-03-10",
        None,
        Some("Killed by late frost — failed to harden off adequately before transplant."),
    )
    .await?;

    let p_jalapeno = make_plant(
        sp_jalapeno,
        loc_bed_a.id,
        PlantStatus::Active,
        "TAM Jalapeño",
        "2026-04-20",
        Some("TAM-01"),
        Some("Mild jalapeño variety. 6 peppers currently sizing up."),
    )
    .await?;

    let p_cucumber = make_plant(
        sp_cucumber,
        loc_bed_a.id,
        PlantStatus::Harvested,
        "Marketmore Cucumber",
        "2026-03-20",
        Some("MKT-01"),
        Some("First succession complete — 8 cucumbers harvested over 3 weeks."),
    )
    .await?;

    let p_zucchini = make_plant(
        sp_zucchini,
        loc_bed_a.id,
        PlantStatus::Active,
        "Black Beauty Zucchini",
        "2026-04-10",
        None,
        Some("Incredibly vigorous. Pick every 2 days to maintain quality."),
    )
    .await?;

    let _p_pumpkin = make_plant(
        sp_pumpkin,
        loc_bed_a.id,
        PlantStatus::Planned,
        "Atlantic Giant Pumpkin",
        "2026-06-01",
        None,
        Some("Reserve the far end of Bed A for this sprawling vine."),
    )
    .await?;

    let _p_green_bean = make_plant(
        sp_green_bean,
        loc_bed_a.id,
        PlantStatus::Planned,
        "Blue Lake Bush Bean (Fall)",
        "2026-09-01",
        None,
        Some("Second succession for fall harvest after cucumber is cleared."),
    )
    .await?;

    // -----------------------------------------------------------------------
    // Plants — Raised Bed B (greens & roots)
    // -----------------------------------------------------------------------
    let p_lettuce1 = make_plant(
        sp_lettuce,
        loc_bed_b.id,
        PlantStatus::Harvested,
        "Butterhead Lettuce",
        "2026-02-15",
        Some("BH-01"),
        Some("Spring harvest complete. Two full heads taken, regrowth underway."),
    )
    .await?;

    let p_lettuce2 = make_plant(
        sp_lettuce,
        loc_bed_b.id,
        PlantStatus::Active,
        "Red Romaine Lettuce",
        "2026-03-10",
        Some("RR-01"),
        None,
    )
    .await?;

    let p_spinach = make_plant(
        sp_spinach,
        loc_bed_b.id,
        PlantStatus::Harvested,
        "Bloomsdale Spinach",
        "2026-02-01",
        None,
        Some("Spring spinach — bolted in June heat. Full harvest cut and frozen."),
    )
    .await?;

    let p_kale = make_plant(
        sp_kale,
        loc_bed_b.id,
        PlantStatus::Active,
        "Lacinato Kale",
        "2026-03-01",
        Some("LK-01"),
        Some("Cut-and-come-again, harvesting outer leaves weekly. Looking very healthy."),
    )
    .await?;

    let p_swiss_chard = make_plant(
        sp_swiss_chard,
        loc_bed_b.id,
        PlantStatus::Active,
        "Rainbow Chard",
        "2026-03-15",
        None,
        Some("Beautiful colourful stems. Growing vigorously alongside the kale."),
    )
    .await?;

    let p_carrot1 = make_plant(
        sp_carrot,
        loc_bed_b.id,
        PlantStatus::Active,
        "Danvers 126 Carrot",
        "2026-03-01",
        None,
        Some("Direct-sown in deep, loose soil. Thinned to 5 cm spacing."),
    )
    .await?;

    let _p_carrot2 = make_plant(
        sp_carrot,
        loc_bed_b.id,
        PlantStatus::Planned,
        "Purple Haze Carrot (Fall)",
        "2026-08-15",
        None,
        Some("Fall succession planting planned after spring carrots are lifted."),
    )
    .await?;

    let _p_onion = make_plant(
        sp_onion,
        loc_bed_b.id,
        PlantStatus::Planned,
        "Walla Walla Sweet Onion",
        "2026-09-15",
        None,
        Some("Fall-planted sets for overwintering. Harvest next July."),
    )
    .await?;

    // Removed plant (garlic — already harvested and cleared)
    let p_removed_garlic = make_plant(
        sp_garlic,
        loc_bed_b.id,
        PlantStatus::Removed,
        "German Red Garlic",
        "2025-10-15",
        None,
        Some("Harvested June 20. Cured for 3 weeks. Fully removed from bed."),
    )
    .await?;

    // -----------------------------------------------------------------------
    // Plants — Greenhouse (seedlings in nursery)
    // -----------------------------------------------------------------------
    let p_tom_seedling = make_plant(
        sp_tomato,
        loc_greenhouse.id,
        PlantStatus::Seedling,
        "Mortgage Lifter Seedling",
        "2026-04-28",
        Some("ML-S1"),
        Some("In 4\" pot on heat mat. 3 true leaves. Ready to harden off next week."),
    )
    .await?;

    let p_pepper_seedling = make_plant(
        sp_bell_pepper,
        loc_greenhouse.id,
        PlantStatus::Seedling,
        "Shishito Seedling",
        "2026-05-01",
        Some("SHI-S1"),
        Some("Slow germinator — keep at 26°C. Showing signs of root stress (possible overwatering)."),
    )
    .await?;

    let p_basil_seedling = make_plant(
        sp_basil,
        loc_greenhouse.id,
        PlantStatus::Seedling,
        "Genovese Basil Seedling",
        "2026-05-05",
        Some("GB-S1"),
        Some("Just germinated — first true leaves emerging from cotyledons."),
    )
    .await?;

    let p_sunflower_seedling = make_plant(
        sp_sunflower,
        loc_greenhouse.id,
        PlantStatus::Seedling,
        "Mammoth Sunflower",
        "2026-04-25",
        None,
        Some("Growing very fast — ready to transplant to the garden border."),
    )
    .await?;

    // -----------------------------------------------------------------------
    // Plants — Herb Spiral
    // -----------------------------------------------------------------------
    let p_basil = make_plant(
        sp_basil,
        loc_herb_spiral.id,
        PlantStatus::Active,
        "Genovese Basil",
        "2026-04-10",
        Some("GEN-01"),
        Some("Pinched twice. Free air circulation. Aphid colony found last week — treated."),
    )
    .await?;

    let p_rosemary = make_plant(
        sp_rosemary,
        loc_herb_spiral.id,
        PlantStatus::Active,
        "Tuscan Blue Rosemary",
        "2025-06-01",
        Some("TB-01"),
        Some("Established 2nd-year plant. Drains very well at the top of the spiral."),
    )
    .await?;

    let p_thyme = make_plant(
        sp_thyme,
        loc_herb_spiral.id,
        PlantStatus::Active,
        "Common Thyme",
        "2025-06-01",
        None,
        Some("Perennial. Trim after flowering to keep bushy."),
    )
    .await?;

    let p_mint = make_plant(
        sp_mint,
        loc_herb_spiral.id,
        PlantStatus::Active,
        "Spearmint",
        "2026-03-20",
        None,
        Some("Contained in a pot sunk into the base of the spiral to restrict spreading."),
    )
    .await?;

    let p_strawberry = make_plant(
        sp_strawberry,
        loc_herb_spiral.id,
        PlantStatus::Active,
        "Albion Strawberry",
        "2025-05-01",
        None,
        Some("June-bearing. Runner control ongoing. Produced ~400 g this season."),
    )
    .await?;

    // -----------------------------------------------------------------------
    // Harvests
    // -----------------------------------------------------------------------
    macro_rules! harvest {
        ($pid:expr, $date:expr, $qty:expr, $unit:expr, $rating:expr, $notes:expr) => {
            sqlx::query(
                "INSERT INTO harvests (plant_id, harvest_date, quantity, unit, quality_rating, notes)
                 VALUES (?,?,?,?,?,?)",
            )
            .bind($pid)
            .bind($date)
            .bind($qty as f64)
            .bind($unit)
            .bind($rating as i64)
            .bind($notes)
            .execute(pool)
            .await?
        };
    }

    harvest!(p_lettuce1.id, "2026-03-20", 320.0, "g", 5, "Excellent — full head, no bitterness");
    harvest!(p_lettuce1.id, "2026-04-05", 280.0, "g", 4, "Second cut — slightly smaller heads");
    harvest!(p_lettuce1.id, "2026-04-22", 240.0, "g", 4, "Third cut before bolting");
    harvest!(p_spinach.id,  "2026-03-15", 450.0, "g", 5, "Full spring cut before bolting");
    harvest!(p_cucumber.id, "2026-05-10", 3.0, "fruits", 4, "First flush — good size and flavour");
    harvest!(p_cucumber.id, "2026-05-17", 5.0, "fruits", 5, "Peak production — excellent quality");
    harvest!(p_cucumber.id, "2026-05-24", 2.0, "fruits", 3, "Final flush — starting to yellow quickly");
    harvest!(p_removed_garlic.id, "2026-06-20", 18.0, "bulbs", 5, "Cured 3 weeks. Excellent size and flavour.");
    harvest!(p_basil.id, "2026-05-20", 75.0, "g", 5, "Made two batches of pesto");
    harvest!(p_strawberry.id, "2026-05-28", 180.0, "g", 5, "First ripe berries of season");
    harvest!(p_strawberry.id, "2026-06-05", 220.0, "g", 5, "Peak flush — sweetest berries");
    harvest!(p_tom1.id, "2026-06-10", 200.0, "g", 5, "First Sungold cherries of the season!");
    harvest!(p_tom1.id, "2026-06-17", 400.0, "g", 5, "Full second flush — incredible flavour");
    harvest!(p_zucchini.id, "2026-05-30", 4.0, "fruits", 5, "First zucchinis — picked at 15 cm");
    harvest!(p_zucchini.id, "2026-06-03", 6.0, "fruits", 4, "High-volume days; some slightly over size");

    // -----------------------------------------------------------------------
    // Seedling observations
    // -----------------------------------------------------------------------
    sqlx::query(
        "INSERT INTO seedling_observations
             (plant_id, observed_at, height_cm, stem_thickness_mm, leaf_node_count, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(p_tom_seedling.id)
    .bind("2026-05-01")
    .bind(8.5_f64)
    .bind(3.2_f64)
    .bind(3_i64)
    .bind("3 true leaves. Stem sturdy. Looking healthy on heat mat.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO seedling_observations
             (plant_id, observed_at, height_cm, stem_thickness_mm, leaf_node_count, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(p_tom_seedling.id)
    .bind("2026-05-07")
    .bind(12.0_f64)
    .bind(3.8_f64)
    .bind(4_i64)
    .bind("Good growth this week. Moved to cooler shelf to slow down and harden.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO seedling_observations
             (plant_id, observed_at, height_cm, stem_thickness_mm, leaf_node_count, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(p_basil_seedling.id)
    .bind("2026-05-08")
    .bind(3.5_f64)
    .bind(1.8_f64)
    .bind(2_i64)
    .bind("First true leaves emerging alongside cotyledons. Healthy colour.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO seedling_observations
             (plant_id, observed_at, height_cm, stem_thickness_mm, leaf_node_count, notes)
         VALUES (?,?,?,?,?,?)",
    )
    .bind(p_pepper_seedling.id)
    .bind("2026-05-05")
    .bind(5.0_f64)
    .bind(2.1_f64)
    .bind(2_i64)
    .bind("Somewhat leggy — may need more light. Check roots at next watering.")
    .execute(pool)
    .await?;

    // -----------------------------------------------------------------------
    // Issues
    // -----------------------------------------------------------------------
    let iss_aphids = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: Some(p_basil.id),
            location_id: Some(loc_herb_spiral.id),
            title: "Aphid infestation on Basil".to_string(),
            description: Some(
                "Dense colony of green aphids found on underside of leaves. \
                 Sticky honeydew residue present. Likely spread from neighbouring plot."
                    .to_string(),
            ),
            status: Some(IssueStatus::New),
            priority: Some(IssuePriority::Medium),
        },
    )
    .await?;

    let iss_chlorosis = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: Some(p_tom2.id),
            location_id: Some(loc_bed_a.id),
            title: "Interveinal chlorosis on San Marzano".to_string(),
            description: Some(
                "Yellowing between veins on lower leaves. Possibly magnesium deficiency \
                 or early mosaic virus. Applied Epsom salt foliar spray. Monitor closely."
                    .to_string(),
            ),
            status: Some(IssueStatus::Open),
            priority: Some(IssuePriority::High),
        },
    )
    .await?;

    let iss_root_rot = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: Some(p_pepper_seedling.id),
            location_id: Some(loc_greenhouse.id),
            title: "Root rot suspected in Shishito seedling".to_string(),
            description: Some(
                "Wilting despite moist media. Roots appear brown and mushy at the crown. \
                 Likely overwatering. Repotting into fresh perlite/compost mix immediately."
                    .to_string(),
            ),
            status: Some(IssueStatus::InProgress),
            priority: Some(IssuePriority::Critical),
        },
    )
    .await?;

    let _iss_mildew = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: Some(p_cucumber.id),
            location_id: Some(loc_bed_a.id),
            title: "Powdery mildew on Cucumber (resolved)".to_string(),
            description: Some(
                "Powdery white coating on older leaves mid-season. Treated with \
                 diluted milk spray (1:10) — resolved after 3 applications over 9 days."
                    .to_string(),
            ),
            status: Some(IssueStatus::Closed),
            priority: Some(IssuePriority::Medium),
        },
    )
    .await?;

    let _iss_slugs = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: Some(p_kale.id),
            location_id: Some(loc_bed_b.id),
            title: "Slug damage on Lacinato Kale".to_string(),
            description: Some(
                "Irregular ragged holes in lower kale leaves. Slime trails visible in mornings. \
                 Applied copper tape around perimeter of Bed B. Will monitor."
                    .to_string(),
            ),
            status: Some(IssueStatus::New),
            priority: Some(IssuePriority::Low),
        },
    )
    .await?;

    let _iss_blossom = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(eid),
            plant_id: Some(p_tom1.id),
            location_id: Some(loc_bed_a.id),
            title: "Blossom drop during heatwave".to_string(),
            description: Some(
                "Sungold dropping flowers when temperatures exceed 32°C. Normal physiological \
                 response. Added shade cloth (30%) and increased watering frequency."
                    .to_string(),
            ),
            status: Some(IssueStatus::Closed),
            priority: Some(IssuePriority::Low),
        },
    )
    .await?;

    // Assign matching issue labels by name
    let label_lookup = |name: &'static str| async move {
        sqlx::query_scalar::<_, i64>(
            "SELECT id FROM issue_labels WHERE name = ? LIMIT 1",
        )
        .bind(name)
        .fetch_optional(pool)
        .await
        .map(|r| r.unwrap_or(0))
    };

    let lid_aphids   = label_lookup("Aphids").await?;
    let lid_nutrient = label_lookup("Nutrient Deficiency").await?;
    let lid_rootrot  = label_lookup("Root Rot").await?;
    let lid_mildew   = label_lookup("Powdery Mildew").await?;
    let lid_slugs    = label_lookup("Slug Damage").await?;

    for (iid, lid) in [
        (iss_aphids.id,   lid_aphids),
        (iss_chlorosis.id, lid_nutrient),
        (iss_root_rot.id,  lid_rootrot),
    ] {
        if lid > 0 {
            sqlx::query(
                "INSERT OR IGNORE INTO issue_label_map (issue_id, label_id) VALUES (?,?)",
            )
            .bind(iid)
            .bind(lid)
            .execute(pool)
            .await?;
        }
    }
    // Mildew / slugs labels applied to non-critical resolved/new issues
    let _ = (lid_mildew, lid_slugs); // suppress unused warnings

    // Issue comments
    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(iss_chlorosis.id)
        .bind("Applied Epsom salt foliar spray (1 tbsp/gallon). Checking back in 5 days for improvement.")
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(iss_chlorosis.id)
        .bind("Day 5 follow-up: slight improvement in colour on treated leaves. Applying a second dose. Still watching for viral symptoms.")
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(iss_aphids.id)
        .bind("Released 50 ladybug larvae near the herb spiral this morning. Also knocked off with water jet and sprayed insecticidal soap on undersides of leaves.")
        .execute(pool)
        .await?;
    sqlx::query("INSERT INTO issue_comments (issue_id, body) VALUES (?,?)")
        .bind(iss_root_rot.id)
        .bind("Repotted into fresh 50/50 perlite:compost. Trimmed affected roots. Moved to drier shelf. Holding off watering for 5 days.")
        .execute(pool)
        .await?;

    // -----------------------------------------------------------------------
    // Journal entries
    // -----------------------------------------------------------------------
    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            title: "Spring season kickoff — beds prepared".to_string(),
            body: Some(
                "Turned 4\" of finished compost into both raised beds. Pre-season soil pH test: \
                 Bed A = 6.8 (excellent), Bed B = 6.5 (slightly acid — added lime).\n\n\
                 Laid soaker hose in Bed A, positioned drip rings for tomatoes. \
                 Last frost date for Zone 8b: March 5. Ready to start cool-season crops immediately."
                    .to_string(),
            ),
            conditions_json: Some(
                r#"{"temp_c": 12, "humidity_pct": 65, "weather": "partly cloudy"}"#.to_string(),
            ),
        },
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: Some(p_tom1.id),
            location_id: Some(loc_bed_a.id),
            title: "Transplanted Sungold & San Marzano tomatoes".to_string(),
            body: Some(
                "Hardened off for 10 days before transplanting. Set in deeply (buried to first \
                 true leaf node to encourage extra root development). Added mycorrhizal inoculant \
                 to planting holes. Staked immediately with 1.8 m bamboo.\n\n\
                 Sungold already has 6 flower trusses showing — very eager plant. San Marzano is \
                 slightly pale but should green up once roots establish."
                    .to_string(),
            ),
            conditions_json: Some(
                r#"{"temp_c": 18, "weather": "sunny", "wind": "light"}"#.to_string(),
            ),
        },
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: Some(p_lettuce1.id),
            location_id: Some(loc_bed_b.id),
            title: "First spring lettuce harvest".to_string(),
            body: Some(
                "Butterhead heads reached ~320 g each — excellent spring growth. \
                 Harvested using cut-and-come-again approach on all three plants. \
                 Rinsed and stored in damp cloth bags in the fridge.\n\n\
                 Red Romaine has another 2–3 weeks before it reaches full size."
                    .to_string(),
            ),
            conditions_json: Some(
                r#"{"temp_c": 16, "weather": "overcast"}"#.to_string(),
            ),
        },
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: Some(p_basil.id),
            location_id: Some(loc_herb_spiral.id),
            title: "Aphid colony discovered on Basil".to_string(),
            body: Some(
                "Noticed sticky honeydew residue on basil leaves during morning inspection. \
                 Close examination revealed a large aphid colony on undersides of stems. \
                 Knocked off with strong water jet, then applied insecticidal soap spray.\n\n\
                 Ordered ladybug larvae for biological control. Will monitor daily."
                    .to_string(),
            ),
            conditions_json: Some(
                r#"{"temp_c": 22, "humidity_pct": 58, "weather": "sunny"}"#.to_string(),
            ),
        },
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            title: "Heatwave — emergency watering protocol activated".to_string(),
            body: Some(
                "Temperatures reached 34°C for three consecutive days. Switched to \
                 twice-daily deep watering (morning 6 am + evening 7 pm). Added 30% shade \
                 cloth over Bed B to protect the lettuce and spinach from bolting.\n\n\
                 Zucchini absolutely loving the heat — picking every 2 days now. Tomatoes \
                 showing blossom drop above 32°C, which is normal. Filed a related issue."
                    .to_string(),
            ),
            conditions_json: Some(
                r#"{"temp_c": 34, "humidity_pct": 28, "weather": "sunny — extreme heat event"}"#
                    .to_string(),
            ),
        },
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: Some(p_cucumber.id),
            location_id: Some(loc_bed_a.id),
            title: "Cucumber first succession complete".to_string(),
            body: Some(
                "Pulled Marketmore after final harvest. Total yield: 10 cucumbers. \
                 First succession ran 9 weeks from transplant to removal. \
                 Second succession planned for mid-summer to provide fall harvest.\n\n\
                 Saved 15 seeds from the best two fruits — stored in paper envelope in root cellar."
                    .to_string(),
            ),
            conditions_json: None,
        },
    )
    .await?;

    journal::create_entry(
        pool,
        NewJournalEntry {
            environment_id: Some(eid),
            plant_id: Some(p_removed_garlic.id),
            location_id: Some(loc_bed_b.id),
            title: "Garlic harvest and curing".to_string(),
            body: Some(
                "Lifted 18 German Red garlic bulbs — excellent size, no signs of disease. \
                 Brushed off soil, left roots and tops intact. Tied in bundles of 6 and hung \
                 in the root cellar for curing (3 weeks). \
                 Will save the largest 3 bulbs for replanting in October."
                    .to_string(),
            ),
            conditions_json: Some(
                r#"{"temp_c": 24, "weather": "dry, sunny"}"#.to_string(),
            ),
        },
    )
    .await?;

    // -----------------------------------------------------------------------
    // Schedules
    // -----------------------------------------------------------------------
    let additive_fish: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM additives WHERE name LIKE '%Fish%' LIMIT 1",
    )
    .fetch_optional(pool)
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(loc_bed_a.id),
            schedule_type: ScheduleType::Water,
            title: "Daily morning water — Bed A".to_string(),
            cron_expression: Some("0 7 * * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some(
                "Soaker hose run for 20 minutes. Skip on rain days (>5 mm forecast).".to_string(),
            ),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(loc_bed_b.id),
            schedule_type: ScheduleType::Water,
            title: "Daily morning water — Bed B".to_string(),
            cron_expression: Some("0 7 * * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some("Overhead sprinkler 15 minutes. Avoid evening to prevent mildew.".to_string()),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(loc_herb_spiral.id),
            schedule_type: ScheduleType::Water,
            title: "Every-other-day water — Herb Spiral".to_string(),
            cron_expression: Some("0 8 */2 * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some(
                "Mediterranean herbs prefer drier conditions. Water at base only.".to_string(),
            ),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            schedule_type: ScheduleType::Feed,
            title: "Bi-weekly fish emulsion — all beds".to_string(),
            cron_expression: Some("0 9 1,15 * *".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: additive_fish,
            notes: Some(
                "Dilute 1:20 with water. Apply to soil, avoid foliage. \
                 Skip during heavy fruiting for tomatoes."
                    .to_string(),
            ),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            schedule_type: ScheduleType::Maintenance,
            title: "Weekly full-garden walkthrough".to_string(),
            cron_expression: Some("0 10 * * 0".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some(
                "Check: pest pressure, stake/trellis needs, disease signs, \
                 watering, harvest readiness, succession timing."
                    .to_string(),
            ),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: Some(p_tom1.id),
            location_id: Some(loc_bed_a.id),
            schedule_type: ScheduleType::Maintenance,
            title: "Tomato sucker removal — weekly".to_string(),
            cron_expression: Some("0 11 * * 3".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some(
                "Remove axillary suckers below second flower truss. \
                 Keep 2–3 leader stems on indeterminate varieties."
                    .to_string(),
            ),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: None,
            schedule_type: ScheduleType::Treatment,
            title: "Bi-weekly neem oil spray — preventative".to_string(),
            cron_expression: Some("0 18 1,15 * *".to_string()),
            next_run_at: None,
            is_active: Some(false), // paused while ladybugs active
            additive_id: None,
            notes: Some(
                "1 tsp neem + 1 tsp dish soap per litre warm water. \
                 Spray below 25°C only. Paused during ladybug biological control."
                    .to_string(),
            ),
        },
    )
    .await?;

    schedules::create_schedule(
        pool,
        NewSchedule {
            environment_id: Some(eid),
            plant_id: None,
            location_id: Some(loc_greenhouse.id),
            schedule_type: ScheduleType::Sample,
            title: "Greenhouse soil moisture check".to_string(),
            cron_expression: Some("0 9 * * 1,4".to_string()),
            next_run_at: None,
            is_active: Some(true),
            additive_id: None,
            notes: Some("Use moisture probe. Water only when below 40% VWC.".to_string()),
        },
    )
    .await?;

    // -----------------------------------------------------------------------
    // Sensors
    // -----------------------------------------------------------------------
    let sensor_moisture = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(loc_bed_a.id),
            plant_id: None,
            name: "Bed A — Soil Moisture".to_string(),
            sensor_type: SensorType::Moisture,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: None,
            is_active: Some(false),
        },
    )
    .await?;

    let sensor_temp = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(loc_greenhouse.id),
            plant_id: None,
            name: "Greenhouse Temperature".to_string(),
            sensor_type: SensorType::Temperature,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: None,
            is_active: Some(false),
        },
    )
    .await?;

    let sensor_humidity = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(loc_greenhouse.id),
            plant_id: None,
            name: "Greenhouse Humidity".to_string(),
            sensor_type: SensorType::Humidity,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: None,
            is_active: Some(false),
        },
    )
    .await?;

    let sensor_light = sensors::create_sensor(
        pool,
        NewSensor {
            environment_id: Some(eid),
            location_id: Some(loc_greenhouse.id),
            plant_id: None,
            name: "Greenhouse Light Level".to_string(),
            sensor_type: SensorType::Light,
            connection_type: SensorConnectionType::Manual,
            connection_config_json: None,
            poll_interval_seconds: None,
            is_active: Some(false),
        },
    )
    .await?;

    // Historical sensor readings
    for (days_back, val) in [
        (7i64, 18.2_f64),
        (6, 22.5),
        (5, 24.1),
        (4, 21.8),
        (3, 19.5),
        (2, 17.0),
        (1, 20.4),
        (0, 21.0),
    ] {
        sqlx::query(
            "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at)
             VALUES (?, ?, 'C', datetime('now', ? || ' days'))",
        )
        .bind(sensor_temp.id)
        .bind(val)
        .bind(format!("-{}", days_back))
        .execute(pool)
        .await?;
    }

    for (days_back, val) in [
        (6i64, 72.0_f64),
        (5, 68.0),
        (4, 75.0),
        (3, 71.0),
        (2, 70.0),
        (1, 69.0),
        (0, 73.0),
    ] {
        sqlx::query(
            "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at)
             VALUES (?, ?, '%', datetime('now', ? || ' days'))",
        )
        .bind(sensor_humidity.id)
        .bind(val)
        .bind(format!("-{}", days_back))
        .execute(pool)
        .await?;
    }

    for (days_back, val) in [
        (3i64, 45.0_f64),
        (2, 38.0),
        (1, 52.0),
        (0, 50.0),
    ] {
        sqlx::query(
            "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at)
             VALUES (?, ?, '%', datetime('now', ? || ' days'))",
        )
        .bind(sensor_moisture.id)
        .bind(val)
        .bind(format!("-{}", days_back))
        .execute(pool)
        .await?;
    }

    for (days_back, val) in [(2i64, 35000.0_f64), (1, 42000.0), (0, 38500.0)] {
        sqlx::query(
            "INSERT INTO sensor_readings (sensor_id, value, unit, recorded_at)
             VALUES (?, ?, 'lux', datetime('now', ? || ' days'))",
        )
        .bind(sensor_light.id)
        .bind(val)
        .bind(format!("-{}", days_back))
        .execute(pool)
        .await?;
    }

    // Sensor alert limits
    for (sid, lo, hi, unit) in [
        (sensor_temp.id,     8.0_f64,  35.0_f64, "C"),
        (sensor_humidity.id, 40.0,     85.0,     "%"),
        (sensor_moisture.id, 30.0,     75.0,     "%"),
        (sensor_light.id,    5000.0,   80000.0,  "lux"),
    ] {
        sqlx::query(
            "INSERT INTO sensor_limits
                 (sensor_id, min_value, max_value, unit, alert_enabled)
             VALUES (?,?,?,?,?)",
        )
        .bind(sid)
        .bind(lo)
        .bind(hi)
        .bind(unit)
        .bind(1_i64)
        .execute(pool)
        .await?;
    }

    // -----------------------------------------------------------------------
    // Soil tests
    // -----------------------------------------------------------------------
    sqlx::query(
        "INSERT INTO soil_tests
             (location_id, test_date, ph, nitrogen_ppm, phosphorus_ppm, potassium_ppm,
              moisture_pct, organic_matter_pct, notes)
         VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(loc_bed_a.id)
    .bind("2026-03-01")
    .bind(6.8_f64)
    .bind(42.0_f64)
    .bind(28.0_f64)
    .bind(180.0_f64)
    .bind(35.0_f64)
    .bind(4.2_f64)
    .bind("Pre-season test. Added 3 kg compost per m². Excellent baseline for vegetables.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO soil_tests
             (location_id, test_date, ph, nitrogen_ppm, phosphorus_ppm, potassium_ppm,
              moisture_pct, organic_matter_pct, notes)
         VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(loc_bed_b.id)
    .bind("2026-03-01")
    .bind(6.5_f64)
    .bind(38.0_f64)
    .bind(22.0_f64)
    .bind(165.0_f64)
    .bind(40.0_f64)
    .bind(3.8_f64)
    .bind("Slightly acidic — added agricultural lime at 200 g/m². P slightly low; added bone meal.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO soil_tests
             (location_id, test_date, ph, nitrogen_ppm, phosphorus_ppm, potassium_ppm,
              moisture_pct, organic_matter_pct, notes)
         VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(loc_bed_a.id)
    .bind("2026-05-15")
    .bind(6.9_f64)
    .bind(36.0_f64)
    .bind(30.0_f64)
    .bind(175.0_f64)
    .bind(28.0_f64)
    .bind(4.5_f64)
    .bind("Mid-season check. N slightly depleted by tomatoes — applied fish emulsion. pH stable.")
    .execute(pool)
    .await?;

    // -----------------------------------------------------------------------
    // Seed lots
    // -----------------------------------------------------------------------
    seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: if sp_tomato > 0 { Some(sp_tomato) } else { None },
            parent_plant_id: None,
            harvest_id: None,
            lot_label: Some("Sungold F1 — Johnny's 2026".to_string()),
            quantity: Some(25.0),
            viability_pct: Some(92.0),
            storage_location: Some("Root Cellar, tin A".to_string()),
            collected_date: None,
            source_type: Some("purchased".to_string()),
            vendor: Some("Johnny's Selected Seeds".to_string()),
            purchase_date: Some("2026-01-15".to_string()),
            expiration_date: Some("2028-01-01".to_string()),
            packet_info: Some("25 seeds, F1 hybrid".to_string()),
            notes: Some("High germination rate from this vendor. Store cool and dry.".to_string()),
        },
    )
    .await?;

    seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: if sp_carrot > 0 { Some(sp_carrot) } else { None },
            parent_plant_id: Some(p_carrot1.id),
            harvest_id: None,
            lot_label: Some("Danvers 126 — saved 2025".to_string()),
            quantity: Some(200.0),
            viability_pct: Some(78.0),
            storage_location: Some("Root Cellar, envelope rack row 2".to_string()),
            collected_date: Some("2025-09-20".to_string()),
            source_type: Some("harvested".to_string()),
            vendor: None,
            purchase_date: None,
            expiration_date: Some("2027-09-01".to_string()),
            packet_info: None,
            notes: Some("Open-pollinated. Let 4 plants bolt and go to seed. Good viability.".to_string()),
        },
    )
    .await?;

    seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: if sp_basil > 0 { Some(sp_basil) } else { None },
            parent_plant_id: None,
            harvest_id: None,
            lot_label: Some("Genovese Basil — Territorial Seeds 2026".to_string()),
            quantity: Some(150.0),
            viability_pct: Some(88.0),
            storage_location: Some("Root Cellar, tin A".to_string()),
            collected_date: None,
            source_type: Some("purchased".to_string()),
            vendor: Some("Territorial Seed Company".to_string()),
            purchase_date: Some("2026-02-01".to_string()),
            expiration_date: Some("2028-02-01".to_string()),
            packet_info: Some("Large pack — ~150 seeds".to_string()),
            notes: None,
        },
    )
    .await?;

    seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: if sp_kale > 0 { Some(sp_kale) } else { None },
            parent_plant_id: None,
            harvest_id: None,
            lot_label: Some("Lacinato Kale — Baker Creek 2025".to_string()),
            quantity: Some(80.0),
            viability_pct: Some(85.0),
            storage_location: Some("Root Cellar, tin B".to_string()),
            collected_date: None,
            source_type: Some("purchased".to_string()),
            vendor: Some("Baker Creek Heirloom Seeds".to_string()),
            purchase_date: Some("2025-12-10".to_string()),
            expiration_date: Some("2027-12-01".to_string()),
            packet_info: None,
            notes: None,
        },
    )
    .await?;

    seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: if sp_spinach > 0 { Some(sp_spinach) } else { None },
            parent_plant_id: None,
            harvest_id: None,
            lot_label: Some("Bloomsdale Spinach — 2025 saved".to_string()),
            quantity: Some(120.0),
            viability_pct: Some(72.0),
            storage_location: Some("Root Cellar, envelope rack row 1".to_string()),
            collected_date: Some("2025-07-10".to_string()),
            source_type: Some("harvested".to_string()),
            vendor: None,
            purchase_date: None,
            expiration_date: Some("2027-07-01".to_string()),
            packet_info: None,
            notes: Some("Saved from 3 plants that bolted. Good seed set.".to_string()),
        },
    )
    .await?;

    seed_store::create_seed_lot(
        pool,
        NewSeedLot {
            species_id: if sp_garlic > 0 { Some(sp_garlic) } else { None },
            parent_plant_id: Some(p_removed_garlic.id),
            harvest_id: None,
            lot_label: Some("German Red Garlic — replanting stock 2026".to_string()),
            quantity: Some(14.0),
            viability_pct: Some(95.0),
            storage_location: Some("Root Cellar, mesh bag".to_string()),
            collected_date: Some("2026-06-20".to_string()),
            source_type: Some("harvested".to_string()),
            vendor: None,
            purchase_date: None,
            expiration_date: Some("2026-10-01".to_string()),
            packet_info: None,
            notes: Some("Largest 14 cloves reserved for fall replanting in October.".to_string()),
        },
    )
    .await?;

    // -----------------------------------------------------------------------
    // Seedling tray
    // -----------------------------------------------------------------------
    let tray_id: i64 = sqlx::query_scalar(
        "INSERT INTO seedling_trays
             (environment_id, name, rows, cols, cell_size_cm, notes)
         VALUES (?,?,?,?,?,?)
         RETURNING id",
    )
    .bind(eid)
    .bind("Spring Propagation Tray #1")
    .bind(4_i64)
    .bind(6_i64)
    .bind(4.0_f64)
    .bind("72-cell insert; 24 cells currently occupied")
    .fetch_one(pool)
    .await?;

    for (row, col, pid) in [
        (0i64, 0i64, p_tom_seedling.id),
        (0,    1,    p_tom_seedling.id),
        (0,    2,    p_tom_seedling.id),
        (0,    3,    p_pepper_seedling.id),
        (0,    4,    p_pepper_seedling.id),
        (1,    0,    p_basil_seedling.id),
        (1,    1,    p_basil_seedling.id),
        (1,    2,    p_sunflower_seedling.id),
        (1,    3,    p_sunflower_seedling.id),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO seedling_tray_cells
                 (tray_id, row, col, plant_id)
             VALUES (?,?,?,?)",
        )
        .bind(tray_id)
        .bind(row)
        .bind(col)
        .bind(pid)
        .execute(pool)
        .await?;
    }

    // -----------------------------------------------------------------------
    // Plant groups
    // -----------------------------------------------------------------------
    let gid_nightshades: i64 = sqlx::query_scalar(
        "INSERT INTO plant_groups
             (environment_id, name, description, group_type, color)
         VALUES (?,?,?,?,?)
         RETURNING id",
    )
    .bind(eid)
    .bind("Nightshades")
    .bind("Tomatoes, peppers, and jalapeños — same watering schedule and feeding needs.")
    .bind("family")
    .bind("#e67e22")
    .fetch_one(pool)
    .await?;

    let gid_salad: i64 = sqlx::query_scalar(
        "INSERT INTO plant_groups
             (environment_id, name, description, group_type, color)
         VALUES (?,?,?,?,?)
         RETURNING id",
    )
    .bind(eid)
    .bind("Salad Garden")
    .bind("Cut-and-come-again greens and lettuce for daily fresh salads.")
    .bind("purpose")
    .bind("#27ae60")
    .fetch_one(pool)
    .await?;

    let gid_herbs: i64 = sqlx::query_scalar(
        "INSERT INTO plant_groups
             (environment_id, name, description, group_type, color)
         VALUES (?,?,?,?,?)
         RETURNING id",
    )
    .bind(eid)
    .bind("Herb Collection")
    .bind("Culinary and aromatic herbs from the spiral.")
    .bind("purpose")
    .bind("#8e44ad")
    .fetch_one(pool)
    .await?;

    let gid_roots: i64 = sqlx::query_scalar(
        "INSERT INTO plant_groups
             (environment_id, name, description, group_type, color)
         VALUES (?,?,?,?,?)
         RETURNING id",
    )
    .bind(eid)
    .bind("Root Crops")
    .bind("Carrots, onions — deep bed required, minimal disturbance.")
    .bind("care")
    .bind("#8e6b3e")
    .fetch_one(pool)
    .await?;

    for (gid, pid) in [
        (gid_nightshades, p_tom1.id),
        (gid_nightshades, p_tom2.id),
        (gid_nightshades, p_tom3.id),
        (gid_nightshades, p_pepper1.id),
        (gid_nightshades, p_jalapeno.id),
        (gid_salad, p_lettuce1.id),
        (gid_salad, p_lettuce2.id),
        (gid_salad, p_spinach.id),
        (gid_salad, p_kale.id),
        (gid_salad, p_swiss_chard.id),
        (gid_herbs, p_basil.id),
        (gid_herbs, p_rosemary.id),
        (gid_herbs, p_thyme.id),
        (gid_herbs, p_mint.id),
        (gid_roots, p_carrot1.id),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO plant_group_members (group_id, plant_id) VALUES (?,?)",
        )
        .bind(gid)
        .bind(pid)
        .execute(pool)
        .await?;
    }

    // -----------------------------------------------------------------------
    // Seasons
    // -----------------------------------------------------------------------
    sqlx::query(
        "INSERT INTO seasons (environment_id, name, start_date, end_date, notes)
         VALUES (?,?,?,?,?)",
    )
    .bind(eid)
    .bind("Spring/Summer 2026")
    .bind("2026-03-01")
    .bind("2026-09-30")
    .bind("Main growing season. Focus on tomatoes, cucumbers, courgettes and salad crops.")
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT INTO seasons (environment_id, name, start_date, end_date, notes)
         VALUES (?,?,?,?,?)",
    )
    .bind(eid)
    .bind("Autumn 2026")
    .bind("2026-09-01")
    .bind("2026-11-30")
    .bind("Cool-season crops: carrots, kale, brassicas. Garlic planting.")
    .execute(pool)
    .await?;

    // -----------------------------------------------------------------------
    // Indoor environment — DWC lettuce tent
    // -----------------------------------------------------------------------
    let tent_loc_id: i64 = sqlx::query_scalar(
        "INSERT INTO locations
             (environment_id, parent_id, type, name, label, notes)
         VALUES (?,NULL,'tent',?,?,?)
         RETURNING id",
    )
    .bind(eid)
    .bind("Indoor DWC Tent")
    .bind("Lettuce & Herbs")
    .bind("2×2 grow tent with 200W LED panel. 20 L DWC reservoir.")
    .fetch_one(pool)
    .await?;

    let indoor_id: i64 = sqlx::query_scalar(
        "INSERT INTO indoor_environments
             (location_id, grow_method, light_type, light_wattage,
              light_schedule_on, light_schedule_off,
              ventilation_type, ventilation_cfm,
              tent_width, tent_depth, tent_height,
              reservoir_capacity_liters, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
         RETURNING id",
    )
    .bind(tent_loc_id)
    .bind("hydroponic_dwc")
    .bind("LED Full Spectrum")
    .bind(200.0_f64)
    .bind("06:00")
    .bind("22:00")
    .bind("Inline fan + carbon filter")
    .bind(150.0_f64)
    .bind(60.0_f64)
    .bind(60.0_f64)
    .bind(150.0_f64)
    .bind(20.0_f64)
    .bind("Lettuce production tent. EC target 1.2–1.6. pH target 5.8–6.2.")
    .fetch_one(pool)
    .await?;

    // Indoor readings (last 4 days)
    for (days_back, ph, ec, air_temp, humidity) in [
        (3i64, 6.1_f64, 1.40_f64, 22.5_f64, 68.0_f64),
        (2,    5.9,     1.50,     23.1,      70.0),
        (1,    6.0,     1.45,     22.8,      69.0),
        (0,    5.8,     1.52,     23.0,      71.0),
    ] {
        sqlx::query(
            "INSERT INTO indoor_readings
                 (indoor_environment_id, water_ph, water_ec,
                  air_temp, air_humidity, recorded_at)
             VALUES (?,?,?,?,?,datetime('now', ? || ' days'))",
        )
        .bind(indoor_id)
        .bind(ph)
        .bind(ec)
        .bind(air_temp)
        .bind(humidity)
        .bind(format!("-{}", days_back))
        .execute(pool)
        .await?;
    }

    // Reservoir targets
    sqlx::query(
        "INSERT INTO indoor_reservoir_targets
             (indoor_environment_id, ph_min, ph_max, ec_min, ec_max, updated_at)
         VALUES (?,?,?,?,?,datetime('now'))",
    )
    .bind(indoor_id)
    .bind(5.8_f64)
    .bind(6.2_f64)
    .bind(1.2_f64)
    .bind(1.6_f64)
    .execute(pool)
    .await?;

    // Hydro plants
    make_plant(
        sp_lettuce,
        tent_loc_id,
        PlantStatus::Active,
        "DWC Buttercrunch Lettuce",
        "2026-05-01",
        Some("DWC-L1"),
        Some("Net pot position 1–3. Growing vigorously under 16-hr photoperiod."),
    )
    .await?;

    make_plant(
        sp_basil,
        tent_loc_id,
        PlantStatus::Active,
        "DWC Genovese Basil",
        "2026-05-01",
        Some("DWC-B1"),
        Some("Net pot position 4. High aromatic oil content under tent conditions."),
    )
    .await?;

    Ok(eid)
}
