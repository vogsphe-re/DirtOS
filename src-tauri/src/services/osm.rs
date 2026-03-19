use reqwest::Client;
use serde::Deserialize;

use crate::db::models::OSMPlaceResult;

const NOMINATIM_BASE: &str = "https://nominatim.openstreetmap.org";
const USER_AGENT: &str = "DirtOS/1.0 (open-source garden management app)";

#[derive(Debug, Deserialize)]
struct NominatimPlace {
    display_name: String,
    lat: String,
    lon: String,
    osm_type: Option<String>,
    osm_id: Option<i64>,
}

pub async fn search_places(
    client: &Client,
    query: &str,
    limit: usize,
) -> Result<Vec<OSMPlaceResult>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let resp = client
        .get(format!("{NOMINATIM_BASE}/search"))
        .query(&[
            ("q", query),
            ("format", "jsonv2"),
            ("limit", &limit.to_string()),
            ("addressdetails", "1"),
        ])
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("OSM search request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("OSM search API returned {}", resp.status()));
    }

    let places: Vec<NominatimPlace> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse OSM response: {e}"))?;

    places
        .into_iter()
        .map(|p| {
            let latitude = p
                .lat
                .parse::<f64>()
                .map_err(|e| format!("Invalid latitude in OSM response: {e}"))?;
            let longitude = p
                .lon
                .parse::<f64>()
                .map_err(|e| format!("Invalid longitude in OSM response: {e}"))?;
            Ok(OSMPlaceResult {
                display_name: p.display_name,
                latitude,
                longitude,
                osm_type: p.osm_type,
                osm_id: p.osm_id,
            })
        })
        .collect()
}
