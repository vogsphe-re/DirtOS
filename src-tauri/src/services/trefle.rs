/// Trefle.io plant data API integration.
///
/// Uses the Trefle v1 REST API (requires an access token).
///
/// Endpoints:
///   Search:  https://trefle.io/api/v1/plants/search?q={query}&token={token}
///   Detail:  https://trefle.io/api/v1/plants/{id}?token={token}
use reqwest::Client;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::time::Duration;

const USER_AGENT: &str =
    "DirtOS/1.0 (open-source plant tracking application; contact via GitHub)";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

/// A search candidate returned to the frontend for the user to pick.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TrefleSearchResult {
    /// Trefle plant ID.
    pub id: i64,
    /// Common name (may be empty).
    pub common_name: Option<String>,
    /// Scientific name.
    pub scientific_name: String,
    /// Family common name.
    pub family_common_name: Option<String>,
    /// Family scientific name.
    pub family: Option<String>,
    /// Genus.
    pub genus: Option<String>,
    /// Image URL (thumbnail).
    pub image_url: Option<String>,
}

/// Enrichment data extracted from a Trefle plant detail response.
#[derive(Debug, Clone)]
pub struct TrefleDetail {
    pub id: i64,
    pub scientific_name: String,
    pub common_name: Option<String>,
    pub family: Option<String>,
    pub genus: Option<String>,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub growth_type: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub soil_ph_min: Option<f64>,
    pub soil_ph_max: Option<f64>,
    pub spacing_cm: Option<f64>,
    pub days_to_harvest_min: Option<i64>,
    pub days_to_harvest_max: Option<i64>,
    pub hardiness_zone_min: Option<String>,
    pub hardiness_zone_max: Option<String>,
    pub min_temperature_c: Option<f64>,
    pub max_temperature_c: Option<f64>,
    pub raw_json: String,
}

// ---------------------------------------------------------------------------
// Private API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TrefleSearchResponse {
    data: Option<Vec<TrefleSearchItem>>,
}

#[derive(Debug, Deserialize)]
struct TrefleSearchItem {
    id: Option<i64>,
    common_name: Option<String>,
    scientific_name: Option<String>,
    family_common_name: Option<String>,
    family: Option<String>,
    genus: Option<String>,
    image_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrefleDetailResponse {
    data: Option<TrefleDetailData>,
}

#[derive(Debug, Deserialize)]
struct TrefleDetailData {
    id: i64,
    common_name: Option<String>,
    scientific_name: Option<String>,
    family_common_name: Option<String>,
    #[serde(deserialize_with = "deserialize_name_field", default)]
    family: Option<String>,
    #[serde(deserialize_with = "deserialize_name_field", default)]
    genus: Option<String>,
    image_url: Option<String>,
    main_species: Option<TrefleMainSpecies>,
}

/// Deserialize a field that may be a plain string or an object with a `name` key.
fn deserialize_name_field<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrObj {
        Str(String),
        Obj { name: Option<String> },
    }
    let val: Option<StringOrObj> = Option::deserialize(deserializer)?;
    Ok(match val {
        Some(StringOrObj::Str(s)) => Some(s),
        Some(StringOrObj::Obj { name }) => name,
        None => None,
    })
}

#[derive(Debug, Deserialize)]
struct TrefleMainSpecies {
    growth: Option<TrefleGrowth>,
    specifications: Option<TrefleSpecifications>,
}

#[derive(Debug, Deserialize)]
struct TrefleGrowth {
    light: Option<f64>,
    soil_humidity: Option<f64>,
    ph_minimum: Option<f64>,
    ph_maximum: Option<f64>,
    minimum_temperature: Option<TrefleMeasurement>,
    maximum_temperature: Option<TrefleMeasurement>,
    days_to_harvest: Option<f64>,
    spread: Option<TrefleMeasurement>,
}

#[derive(Debug, Deserialize)]
struct TrefleSpecifications {
    ligneous_type: Option<String>,
    growth_form: Option<String>,
    growth_habit: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TrefleMeasurement {
    cm: Option<f64>,
    deg_c: Option<f64>,
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/// Search Trefle for plants matching a query string.
pub async fn search(
    client: &Client,
    query: &str,
    token: &str,
    limit: u32,
) -> Result<Vec<TrefleSearchResult>, String> {
    let resp = client
        .get("https://trefle.io/api/v1/plants/search")
        .query(&[
            ("q", query),
            ("token", token),
        ])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Trefle search request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Trefle search API returned {}", resp.status()));
    }

    let body: TrefleSearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Trefle search response: {e}"))?;

    let items = body.data.unwrap_or_default();
    let results: Vec<TrefleSearchResult> = items
        .into_iter()
        .filter_map(|item| {
            let id = item.id?;
            let scientific_name = item.scientific_name.filter(|s| !s.is_empty())?;
            Some(TrefleSearchResult {
                id,
                common_name: item.common_name,
                scientific_name,
                family_common_name: item.family_common_name,
                family: item.family,
                genus: item.genus,
                image_url: item.image_url,
            })
        })
        .take(limit as usize)
        .collect();

    Ok(results)
}

/// Fetch detailed plant data from Trefle by plant ID.
pub async fn get_detail(
    client: &Client,
    plant_id: i64,
    token: &str,
) -> Result<TrefleDetail, String> {
    let url = format!("https://trefle.io/api/v1/plants/{plant_id}");
    let resp = client
        .get(&url)
        .query(&[("token", token)])
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Trefle detail request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Trefle detail API returned {}", resp.status()));
    }

    let raw_json = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read Trefle detail response: {e}"))?;

    let body: TrefleDetailResponse = serde_json::from_str(&raw_json)
        .map_err(|e| format!("Failed to parse Trefle detail response: {e}"))?;

    let data = body
        .data
        .ok_or_else(|| "Trefle detail response contained no data".to_string())?;

    let main = data.main_species;
    let growth = main.as_ref().and_then(|m| m.growth.as_ref());
    let specs = main.as_ref().and_then(|m| m.specifications.as_ref());

    // Map Trefle light value (0-10 scale) to sun requirement label.
    let sun_requirement = growth.and_then(|g| g.light).map(|light| {
        if light <= 3.0 {
            "low_light".to_string()
        } else if light <= 6.0 {
            "partial_shade".to_string()
        } else {
            "full_sun".to_string()
        }
    });

    // Map soil humidity (0-10) to water requirement label.
    let water_requirement = growth.and_then(|g| g.soil_humidity).map(|hum| {
        if hum <= 3.0 {
            "low".to_string()
        } else if hum <= 6.0 {
            "moderate".to_string()
        } else {
            "high".to_string()
        }
    });

    let growth_type = specs
        .and_then(|s| {
            s.growth_form
                .clone()
                .or(s.growth_habit.clone())
                .or(s.ligneous_type.clone())
        });

    // Convert spread from cm to spacing.
    let spacing_cm = growth.and_then(|g| g.spread.as_ref()).and_then(|s| s.cm);

    let days_to_harvest = growth.and_then(|g| g.days_to_harvest).map(|d| d as i64);

    // Temperature range from Trefle growth data.
    let min_temperature_c = growth
        .and_then(|g| g.minimum_temperature.as_ref())
        .and_then(|t| t.deg_c);
    let max_temperature_c = growth
        .and_then(|g| g.maximum_temperature.as_ref())
        .and_then(|t| t.deg_c);

    // Hardiness zone derived from min temperature.
    let hardiness_zone_min = min_temperature_c.map(|c| celsius_to_hardiness_zone(c));

    Ok(TrefleDetail {
        id: data.id,
        scientific_name: data.scientific_name.unwrap_or_default(),
        common_name: data.common_name,
        family: data.family.or(data.family_common_name),
        genus: data.genus,
        image_url: data.image_url,
        description: None,
        growth_type,
        sun_requirement,
        water_requirement,
        soil_ph_min: growth.and_then(|g| g.ph_minimum),
        soil_ph_max: growth.and_then(|g| g.ph_maximum),
        spacing_cm,
        days_to_harvest_min: days_to_harvest,
        days_to_harvest_max: None,
        hardiness_zone_min,
        hardiness_zone_max: None,
        min_temperature_c,
        max_temperature_c,
        raw_json,
    })
}

/// Convert minimum temperature in Celsius to USDA hardiness zone string.
fn celsius_to_hardiness_zone(min_c: f64) -> String {
    let zone = if min_c < -45.6 {
        "1"
    } else if min_c < -40.0 {
        "2"
    } else if min_c < -34.4 {
        "3"
    } else if min_c < -28.9 {
        "4"
    } else if min_c < -23.3 {
        "5"
    } else if min_c < -17.8 {
        "6"
    } else if min_c < -12.2 {
        "7"
    } else if min_c < -6.7 {
        "8"
    } else if min_c < -1.1 {
        "9"
    } else if min_c < 4.4 {
        "10"
    } else if min_c < 10.0 {
        "11"
    } else if min_c < 15.6 {
        "12"
    } else {
        "13"
    };
    zone.to_string()
}
