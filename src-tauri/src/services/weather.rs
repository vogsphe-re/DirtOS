use chrono::{Duration, Utc};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::db::{
    self,
    models::{CurrentWeather, DailyForecast, ForecastItem, WeatherData},
};

const CACHE_TTL_SECS: i64 = 7_200; // 2 hours

// ---------------------------------------------------------------------------
// WMO Weather Code helpers
// ---------------------------------------------------------------------------

fn wmo_description(code: i64) -> &'static str {
    match code {
        0 => "Clear sky",
        1 => "Mainly clear",
        2 => "Partly cloudy",
        3 => "Overcast",
        45 => "Foggy",
        48 => "Rime fog",
        51 => "Light drizzle",
        53 => "Moderate drizzle",
        55 => "Dense drizzle",
        56 => "Light freezing drizzle",
        57 => "Heavy freezing drizzle",
        61 => "Slight rain",
        63 => "Moderate rain",
        65 => "Heavy rain",
        66 => "Light freezing rain",
        67 => "Heavy freezing rain",
        71 => "Slight snowfall",
        73 => "Moderate snowfall",
        75 => "Heavy snowfall",
        77 => "Snow grains",
        80 => "Slight rain showers",
        81 => "Moderate rain showers",
        82 => "Violent rain showers",
        85 => "Slight snow showers",
        86 => "Heavy snow showers",
        95 => "Thunderstorm",
        96 => "Thunderstorm with slight hail",
        99 => "Thunderstorm with heavy hail",
        _ => "Unknown",
    }
}

/// Map WMO code + is_day flag to an OWM-compatible icon code string.
fn wmo_icon(code: i64, is_day: bool) -> &'static str {
    match code {
        0 => if is_day { "01d" } else { "01n" },
        1 | 2 => if is_day { "02d" } else { "02n" },
        3 => "04d",
        45 | 48 => "50d",
        51 | 53 | 55 | 56 | 57 => "09d",
        61 | 63 | 65 | 66 | 67 => if is_day { "10d" } else { "10n" },
        71 | 73 | 75 | 77 | 85 | 86 => "13d",
        80 | 81 | 82 => "09d",
        95 | 96 | 99 => "11d",
        _ => if is_day { "01d" } else { "01n" },
    }
}

// ---------------------------------------------------------------------------
// Open-Meteo API response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct OpenMeteoCurrent {
    time: String,
    temperature_2m: Option<f64>,
    relative_humidity_2m: Option<f64>,
    apparent_temperature: Option<f64>,
    is_day: Option<i64>,
    #[allow(dead_code)]
    precipitation: Option<f64>,
    weather_code: Option<i64>,
    cloud_cover: Option<f64>,
    pressure_msl: Option<f64>,
    wind_speed_10m: Option<f64>,
    wind_direction_10m: Option<f64>,
    wind_gusts_10m: Option<f64>,
    uv_index: Option<f64>,
    dew_point_2m: Option<f64>,
    visibility: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoHourly {
    time: Vec<String>,
    temperature_2m: Vec<Option<f64>>,
    relative_humidity_2m: Vec<Option<f64>>,
    apparent_temperature: Vec<Option<f64>>,
    precipitation_probability: Vec<Option<f64>>,
    precipitation: Vec<Option<f64>>,
    weather_code: Vec<Option<i64>>,
    cloud_cover: Vec<Option<f64>>,
    wind_speed_10m: Vec<Option<f64>>,
    wind_direction_10m: Vec<Option<f64>>,
    wind_gusts_10m: Vec<Option<f64>>,
    is_day: Vec<Option<i64>>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoDaily {
    time: Vec<String>,
    weather_code: Vec<Option<i64>>,
    temperature_2m_max: Vec<Option<f64>>,
    temperature_2m_min: Vec<Option<f64>>,
    sunrise: Vec<Option<String>>,
    sunset: Vec<Option<String>>,
    uv_index_max: Vec<Option<f64>>,
    precipitation_sum: Vec<Option<f64>>,
    precipitation_probability_max: Vec<Option<f64>>,
    wind_speed_10m_max: Vec<Option<f64>>,
    wind_gusts_10m_max: Vec<Option<f64>>,
}

#[derive(Debug, Deserialize)]
struct OpenMeteoResponse {
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[allow(dead_code)]
    timezone: Option<String>,
    current: Option<OpenMeteoCurrent>,
    hourly: Option<OpenMeteoHourly>,
    daily: Option<OpenMeteoDaily>,
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/// Fetch weather for the given environment using Open-Meteo (free, no key).
/// Returns `None` if the environment has no coordinates configured.
/// Falls back to cached data when offline.
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

    // --- network fetch from Open-Meteo ---
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.open-meteo.com/v1/forecast\
         ?latitude={lat}&longitude={lon}\
         &current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,\
         precipitation,weather_code,cloud_cover,pressure_msl,\
         wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,dew_point_2m,visibility\
         &hourly=temperature_2m,relative_humidity_2m,apparent_temperature,\
         precipitation_probability,precipitation,weather_code,cloud_cover,\
         wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day\
         &daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,\
         uv_index_max,precipitation_sum,precipitation_probability_max,\
         wind_speed_10m_max,wind_gusts_10m_max\
         &temperature_unit=celsius&wind_speed_unit=ms\
         &timezone=auto&forecast_days=10&forecast_hours=48"
    );

    let resp = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            tracing::warn!("Open-Meteo fetch failed: {}", e);
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

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!("Open-Meteo HTTP {}: {}", status, body);
        if let Ok(Some(cached)) = db::weather::get_cache(pool, environment_id).await {
            if let Ok(mut data) = serde_json::from_str::<WeatherData>(&cached.forecast_json) {
                data.from_cache = true;
                return Ok(Some(data));
            }
        }
        return Err(format!("Weather API error {}: {}", status, body));
    }

    let om: OpenMeteoResponse = resp
        .json()
        .await
        .map_err(|e| format!("Parse error from Open-Meteo: {}", e))?;

    let data = build_weather_data(om, now, lat, lon)?;

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
// Build WeatherData from Open-Meteo response
// ---------------------------------------------------------------------------

fn build_weather_data(
    om: OpenMeteoResponse,
    now: chrono::NaiveDateTime,
    lat: f64,
    lon: f64,
) -> Result<WeatherData, String> {
    let current_raw = om
        .current
        .ok_or_else(|| "Open-Meteo returned no current data".to_string())?;

    let now_ts = now.and_utc().timestamp();
    let is_day = current_raw.is_day.unwrap_or(1) != 0;
    let wmo_code = current_raw.weather_code.unwrap_or(0);
    let current_dt = parse_iso_to_unix(&current_raw.time).unwrap_or(now_ts);

    let current = CurrentWeather {
        temperature_c: current_raw.temperature_2m.unwrap_or(0.0),
        feels_like_c: current_raw.apparent_temperature.unwrap_or(0.0),
        humidity: current_raw.relative_humidity_2m.unwrap_or(0.0) as i64,
        pressure_hpa: current_raw.pressure_msl.unwrap_or(0.0),
        wind_speed_ms: current_raw.wind_speed_10m.unwrap_or(0.0),
        wind_direction_deg: current_raw.wind_direction_10m.unwrap_or(0.0),
        cloud_cover_pct: current_raw.cloud_cover.unwrap_or(0.0) as i64,
        description: wmo_description(wmo_code).to_string(),
        icon: wmo_icon(wmo_code, is_day).to_string(),
        sunrise: None, // filled from daily[0] below
        sunset: None,
        dt: current_dt,
        uv_index: current_raw.uv_index,
        visibility_m: current_raw.visibility,
        dew_point_c: current_raw.dew_point_2m,
        wind_gust_ms: current_raw.wind_gusts_10m,
        is_day: Some(is_day),
    };

    // --- hourly (next 48h) ---
    let hourly = if let Some(h) = om.hourly {
        let n = h.time.len();
        (0..n)
            .map(|i| {
                let code = h.weather_code.get(i).and_then(|v| *v).unwrap_or(0);
                let day = h.is_day.get(i).and_then(|v| *v).unwrap_or(1) != 0;
                ForecastItem {
                    dt: parse_iso_to_unix(h.time.get(i).map(|s| s.as_str()).unwrap_or(""))
                        .unwrap_or(0),
                    temperature_c: h.temperature_2m.get(i).and_then(|v| *v).unwrap_or(0.0),
                    feels_like_c: h.apparent_temperature.get(i).and_then(|v| *v).unwrap_or(0.0),
                    humidity: h.relative_humidity_2m.get(i).and_then(|v| *v).unwrap_or(0.0) as i64,
                    wind_speed_ms: h.wind_speed_10m.get(i).and_then(|v| *v).unwrap_or(0.0),
                    cloud_cover_pct: h.cloud_cover.get(i).and_then(|v| *v).unwrap_or(0.0) as i64,
                    precipitation_mm: h.precipitation.get(i).and_then(|v| *v),
                    precipitation_prob: h
                        .precipitation_probability
                        .get(i)
                        .and_then(|v| *v)
                        .map(|v| v / 100.0),
                    description: wmo_description(code).to_string(),
                    icon: wmo_icon(code, day).to_string(),
                    wind_gust_ms: h.wind_gusts_10m.get(i).and_then(|v| *v),
                    wind_direction_deg: h.wind_direction_10m.get(i).and_then(|v| *v),
                }
            })
            .collect()
    } else {
        vec![]
    };

    // --- daily (up to 10 days) ---
    let (daily, today_sunrise_ts, today_sunset_ts) = if let Some(d) = om.daily {
        let n = d.time.len();
        let mut sr_ts: Option<i64> = None;
        let mut ss_ts: Option<i64> = None;
        let days: Vec<DailyForecast> = (0..n)
            .map(|i| {
                let code = d.weather_code.get(i).and_then(|v| *v).unwrap_or(0);
                let sr = d.sunrise.get(i).and_then(|v| v.clone());
                let ss = d.sunset.get(i).and_then(|v| v.clone());
                if i == 0 {
                    sr_ts = sr.as_deref().and_then(|s| parse_iso_to_unix(s));
                    ss_ts = ss.as_deref().and_then(|s| parse_iso_to_unix(s));
                }
                DailyForecast {
                    date: d.time.get(i).cloned().unwrap_or_default(),
                    temp_min_c: d.temperature_2m_min.get(i).and_then(|v| *v).unwrap_or(0.0),
                    temp_max_c: d.temperature_2m_max.get(i).and_then(|v| *v).unwrap_or(0.0),
                    description: wmo_description(code).to_string(),
                    icon: wmo_icon(code, true).to_string(),
                    precipitation_mm: d.precipitation_sum.get(i).and_then(|v| *v),
                    precipitation_prob: d
                        .precipitation_probability_max
                        .get(i)
                        .and_then(|v| *v)
                        .map(|v| v / 100.0),
                    uv_index_max: d.uv_index_max.get(i).and_then(|v| *v),
                    wind_speed_max_ms: d.wind_speed_10m_max.get(i).and_then(|v| *v),
                    wind_gusts_max_ms: d.wind_gusts_10m_max.get(i).and_then(|v| *v),
                    precipitation_sum_mm: d.precipitation_sum.get(i).and_then(|v| *v),
                    sunrise: sr,
                    sunset: ss,
                }
            })
            .collect();
        (days, sr_ts, ss_ts)
    } else {
        (vec![], None, None)
    };

    let fetched_at = now.format("%Y-%m-%dT%H:%M:%S").to_string();

    let mut data = WeatherData {
        current,
        hourly,
        daily,
        from_cache: false,
        fetched_at,
        location_name: None,
        latitude: Some(lat),
        longitude: Some(lon),
    };

    // Backfill sunrise/sunset on current from daily[0]
    data.current.sunrise = today_sunrise_ts;
    data.current.sunset = today_sunset_ts;

    Ok(data)
}

// ---------------------------------------------------------------------------
// ISO 8601 datetime / date → unix timestamp
// ---------------------------------------------------------------------------

fn parse_iso_to_unix(s: &str) -> Option<i64> {
    if s.is_empty() {
        return None;
    }
    // Full datetime "2026-04-03T14:00"
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M") {
        return Some(dt.and_utc().timestamp());
    }
    // Date only "2026-04-03"
    if let Ok(d) = chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Some(d.and_hms_opt(12, 0, 0)?.and_utc().timestamp());
    }
    None
}
