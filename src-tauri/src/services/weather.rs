use chrono::{Duration, Utc};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::db::{
    self,
    models::{CurrentWeather, DailyForecast, ForecastItem, WeatherData},
};

const CACHE_TTL_SECS: i64 = 7_200; // 2 hours

// ---------------------------------------------------------------------------
// Raw OpenWeather API response shapes
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct OWMWeather {
    description: String,
    icon: String,
}

#[derive(Deserialize)]
struct OWMMain {
    temp: f64,
    feels_like: f64,
    humidity: i64,
    pressure: f64,
}

#[derive(Deserialize)]
struct OWMWind {
    speed: f64,
    deg: Option<f64>,
}

#[derive(Deserialize)]
struct OWMClouds {
    all: i64,
}

#[derive(Deserialize)]
struct OWMSys {
    sunrise: Option<i64>,
    sunset: Option<i64>,
}

#[derive(Deserialize)]
struct OWMCurrentResponse {
    dt: i64,
    main: OWMMain,
    weather: Vec<OWMWeather>,
    wind: OWMWind,
    clouds: OWMClouds,
    sys: Option<OWMSys>,
}

#[derive(Deserialize)]
struct OWMPrecip {
    #[serde(rename = "3h")]
    three_h: Option<f64>,
}

#[derive(Deserialize)]
struct OWMForecastItem {
    dt: i64,
    main: OWMMain,
    weather: Vec<OWMWeather>,
    wind: OWMWind,
    clouds: OWMClouds,
    rain: Option<OWMPrecip>,
    snow: Option<OWMPrecip>,
    pop: Option<f64>,
    dt_txt: String,
}

#[derive(Deserialize)]
struct OWMForecastResponse {
    list: Vec<OWMForecastItem>,
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/// Fetch weather for the given environment.
/// Returns `None` if the environment has no coordinates configured.
/// Falls back to cached data when offline or when no API key is set.
pub async fn get_weather(
    pool: &SqlitePool,
    environment_id: i64,
    force_refresh: bool,
) -> Result<Option<WeatherData>, String> {
    // --- coordinates ---
    let env = db::environments::get_environment(pool, environment_id)
        .await
        .map_err(|e| e.to_string())?;

    let env = match env {
        Some(e) => e,
        None => return Err("Environment not found".to_string()),
    };

    let (lat, lon) = match (env.latitude, env.longitude) {
        (Some(lat), Some(lon)) => (lat, lon),
        _ => return Ok(None),
    };

    let now = Utc::now().naive_utc();

    // --- cache check ---
    if !force_refresh {
        if let Ok(Some(cached)) = db::weather::get_cache(pool, environment_id).await {
            if let Some(valid_until) = cached.valid_until {
                if valid_until > now {
                    if let Ok(mut data) =
                        serde_json::from_str::<WeatherData>(&cached.forecast_json)
                    {
                        data.from_cache = true;
                        return Ok(Some(data));
                    }
                }
            }
        }
    }

    // --- API key ---
    let api_key = match db::weather::get_setting(pool, "openweather_api_key").await {
        Ok(Some(key)) if !key.trim().is_empty() => key,
        _ => {
            // No key → return stale cache or None
            if let Ok(Some(cached)) = db::weather::get_cache(pool, environment_id).await {
                if let Ok(mut data) =
                    serde_json::from_str::<WeatherData>(&cached.forecast_json)
                {
                    data.from_cache = true;
                    return Ok(Some(data));
                }
            }
            return Ok(None);
        }
    };

    // --- network fetch ---
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let base = "https://api.openweathermap.org/data/2.5";

    let current_resp = client
        .get(format!(
            "{}/weather?lat={}&lon={}&appid={}&units=metric",
            base, lat, lon, api_key
        ))
        .send()
        .await;

    let current_resp = match current_resp {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Weather fetch failed (current): {}", e);
            // Fall back to stale cache
            if let Ok(Some(cached)) = db::weather::get_cache(pool, environment_id).await {
                if let Ok(mut data) =
                    serde_json::from_str::<WeatherData>(&cached.forecast_json)
                {
                    data.from_cache = true;
                    return Ok(Some(data));
                }
            }
            return Err(format!("Network error: {}", e));
        }
    };

    let forecast_resp = client
        .get(format!(
            "{}/forecast?lat={}&lon={}&appid={}&units=metric",
            base, lat, lon, api_key
        ))
        .send()
        .await
        .map_err(|e| format!("Network error (forecast): {}", e))?;

    let current: OWMCurrentResponse = current_resp
        .json()
        .await
        .map_err(|e| format!("Parse error (current): {}", e))?;

    let forecast: OWMForecastResponse = forecast_resp
        .json()
        .await
        .map_err(|e| format!("Parse error (forecast): {}", e))?;

    // --- build WeatherData ---
    let wi = current.weather.first();
    let current_weather = CurrentWeather {
        temperature_c: current.main.temp,
        feels_like_c: current.main.feels_like,
        humidity: current.main.humidity,
        pressure_hpa: current.main.pressure,
        wind_speed_ms: current.wind.speed,
        wind_direction_deg: current.wind.deg.unwrap_or(0.0),
        cloud_cover_pct: current.clouds.all,
        description: wi.map(|w| w.description.clone()).unwrap_or_default(),
        icon: wi.map(|w| w.icon.clone()).unwrap_or_default(),
        sunrise: current.sys.as_ref().and_then(|s| s.sunrise),
        sunset: current.sys.as_ref().and_then(|s| s.sunset),
        dt: current.dt,
    };

    let hourly: Vec<ForecastItem> = forecast
        .list
        .iter()
        .take(8)
        .map(|item| {
            let w = item.weather.first();
            let precip = item
                .rain
                .as_ref()
                .and_then(|r| r.three_h)
                .or_else(|| item.snow.as_ref().and_then(|s| s.three_h));
            ForecastItem {
                dt: item.dt,
                temperature_c: item.main.temp,
                feels_like_c: item.main.feels_like,
                humidity: item.main.humidity,
                wind_speed_ms: item.wind.speed,
                cloud_cover_pct: item.clouds.all,
                precipitation_mm: precip,
                precipitation_prob: item.pop,
                description: w.map(|w| w.description.clone()).unwrap_or_default(),
                icon: w.map(|w| w.icon.clone()).unwrap_or_default(),
            }
        })
        .collect();

    let daily = aggregate_daily(&forecast.list);
    let fetched_at = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    let data = WeatherData {
        current: current_weather,
        hourly,
        daily,
        from_cache: false,
        fetched_at,
    };

    // --- store in cache ---
    let valid_until = now + Duration::seconds(CACHE_TTL_SECS);
    let json = serde_json::to_string(&data).unwrap_or_default();
    if !json.is_empty() {
        if let Err(e) = db::weather::upsert_cache(pool, environment_id, &json, valid_until).await {
            tracing::warn!("Failed to cache weather data: {}", e);
        }
    }

    Ok(Some(data))
}

// ---------------------------------------------------------------------------
// Daily aggregation helpers
// ---------------------------------------------------------------------------

fn aggregate_daily(items: &[OWMForecastItem]) -> Vec<DailyForecast> {
    use std::collections::BTreeMap;

    let mut by_day: BTreeMap<String, Vec<&OWMForecastItem>> = BTreeMap::new();
    for item in items {
        let date = item.dt_txt.split(' ').next().unwrap_or("").to_string();
        if !date.is_empty() {
            by_day.entry(date).or_default().push(item);
        }
    }

    by_day
        .into_iter()
        .take(5)
        .map(|(date, slots)| {
            let temps: Vec<f64> = slots.iter().map(|i| i.main.temp).collect();
            let temp_min = temps.iter().cloned().fold(f64::MAX, f64::min);
            let temp_max = temps.iter().cloned().fold(f64::MIN, f64::max);

            // Prefer midday slot for representative icon/description
            let rep = slots
                .iter()
                .find(|i| i.dt_txt.contains("12:00:00"))
                .or_else(|| slots.first())
                .copied()
                .unwrap();

            let w = rep.weather.first();

            let precip: Option<f64> = slots.iter().fold(None, |acc, item| {
                let p = item
                    .rain
                    .as_ref()
                    .and_then(|r| r.three_h)
                    .or_else(|| item.snow.as_ref().and_then(|s| s.three_h));
                match (acc, p) {
                    (Some(a), Some(b)) => Some(a + b),
                    (None, b) => b,
                    (a, None) => a,
                }
            });

            let precip_prob = slots
                .iter()
                .filter_map(|i| i.pop)
                .fold(0.0_f64, f64::max);

            DailyForecast {
                date,
                temp_min_c: if temp_min == f64::MAX { 0.0 } else { temp_min },
                temp_max_c: if temp_max == f64::MIN { 0.0 } else { temp_max },
                description: w.map(|w| w.description.clone()).unwrap_or_default(),
                icon: w.map(|w| w.icon.clone()).unwrap_or_default(),
                precipitation_mm: precip,
                precipitation_prob: if precip_prob > 0.0 {
                    Some(precip_prob)
                } else {
                    None
                },
            }
        })
        .collect()
}
