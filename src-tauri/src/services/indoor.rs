use chrono::{NaiveDateTime, Utc};
use sqlx::SqlitePool;

use crate::db::{
    indoor,
    issues,
    locations,
    models::{
        IndoorDashboardSummary, IndoorEnvironment, IndoorReading, IssueLabel, IssuePriority,
        NewIssue, NewIssueLabel, Pagination, ReservoirStatus, Schedule,
    },
    plants, schedules,
};

pub fn calculate_vpd_kpa(air_temp_c: f64, relative_humidity_percent: f64) -> f64 {
    let saturation_vp = 0.6108 * ((17.27 * air_temp_c) / (air_temp_c + 237.3)).exp();
    let rh_ratio = (relative_humidity_percent / 100.0).clamp(0.0, 1.0);
    (saturation_vp - (saturation_vp * rh_ratio)).max(0.0)
}

pub fn calculate_dli(
    wattage: f64,
    light_type: Option<&str>,
    distance_cm: f64,
    hours_on: f64,
) -> f64 {
    let efficacy_umol_j = match light_type.unwrap_or("LED").to_ascii_lowercase().as_str() {
        "hps" => 1.7,
        "cmh" => 1.6,
        "fluorescent" => 1.1,
        "led" => 2.4,
        _ => 1.8,
    };

    let distance_factor = (100.0 / distance_cm.max(10.0)).clamp(0.25, 2.0);
    let estimated_ppfd = (wattage * efficacy_umol_j * distance_factor) / 3.0;
    (estimated_ppfd * 3600.0 * hours_on) / 1_000_000.0
}

fn classify_vpd(vpd: f64) -> &'static str {
    if vpd < 0.4 || vpd > 1.6 {
        "danger"
    } else if vpd < 0.8 {
        "propagation"
    } else if vpd <= 1.2 {
        "vegetative"
    } else {
        "flowering"
    }
}

fn classify_reservoir_status(
    ph: Option<f64>,
    ec: Option<f64>,
    ppm: Option<f64>,
    target: Option<&crate::db::models::IndoorReservoirTarget>,
) -> String {
    let Some(target) = target else {
        return "unknown".to_string();
    };

    let mut breaches = 0;

    if let Some(ph) = ph {
        if target.ph_min.is_some_and(|v| ph < v) || target.ph_max.is_some_and(|v| ph > v) {
            breaches += 1;
        }
    }

    if let Some(ec) = ec {
        if target.ec_min.is_some_and(|v| ec < v) || target.ec_max.is_some_and(|v| ec > v) {
            breaches += 1;
        }
    }

    if let Some(ppm) = ppm {
        if target.ppm_min.is_some_and(|v| ppm < v) || target.ppm_max.is_some_and(|v| ppm > v) {
            breaches += 1;
        }
    }

    if breaches == 0 {
        "green".to_string()
    } else if breaches == 1 {
        "yellow".to_string()
    } else {
        "red".to_string()
    }
}

async fn ensure_issue_label(
    pool: &SqlitePool,
    name: &str,
    color: &str,
) -> Result<IssueLabel, String> {
    let labels = issues::list_labels(pool).await.map_err(|e| e.to_string())?;
    if let Some(label) = labels.into_iter().find(|l| l.name.eq_ignore_ascii_case(name)) {
        return Ok(label);
    }

    issues::create_label(
        pool,
        NewIssueLabel {
            name: name.to_string(),
            color: Some(color.to_string()),
            icon: Some("alert".to_string()),
        },
    )
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_indoor_issue(
    pool: &SqlitePool,
    indoor_env: &IndoorEnvironment,
    title: &str,
    description: String,
    labels: &[(&str, &str)],
) -> Result<(), String> {
    let location = locations::get_location(pool, indoor_env.location_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Location {} not found", indoor_env.location_id))?;

    let issue = issues::create_issue(
        pool,
        NewIssue {
            environment_id: Some(location.environment_id),
            plant_id: None,
            location_id: Some(indoor_env.location_id),
            title: title.to_string(),
            description: Some(description),
            status: None,
            priority: Some(IssuePriority::High),
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    for (label_name, color) in labels {
        let label = ensure_issue_label(pool, label_name, color).await?;
        issues::add_label_to_issue(pool, issue.id, label.id)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub async fn evaluate_indoor_alerts(
    pool: &SqlitePool,
    indoor_environment_id: i64,
    reading: &IndoorReading,
) -> Result<(), String> {
    let indoor_env = indoor::get_indoor_environment_by_id(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Indoor environment {indoor_environment_id} not found"))?;

    if let Some(vpd) = reading.vpd {
        if !(0.4..=1.6).contains(&vpd) {
            create_indoor_issue(
                pool,
                &indoor_env,
                "VPD out of range",
                format!(
                    "Indoor environment VPD is {:.2} kPa (zone: {}). Expected range is 0.4-1.6.",
                    vpd,
                    classify_vpd(vpd)
                ),
                &[("Indoor", "#6c757d"), ("VPD Alert", "#e63946")],
            )
            .await?;
        }
    }

    let status = get_reservoir_status(pool, indoor_environment_id).await?;
    if status.status == "red" {
        create_indoor_issue(
            pool,
            &indoor_env,
            "Reservoir values out of range",
            format!(
                "Current values — pH: {:?}, EC: {:?}, PPM: {:?}. Targets may be breached.",
                status.current_ph, status.current_ec, status.current_ppm
            ),
            &[("Indoor", "#6c757d"), ("Nutrient Alert", "#f4a261")],
        )
        .await?;
    }

    Ok(())
}

pub async fn get_reservoir_status(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<ReservoirStatus, String> {
    let indoor_env = indoor::get_indoor_environment_by_id(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Indoor environment {indoor_environment_id} not found"))?;

    let latest_reading = indoor::latest_indoor_reading(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?;

    let target = indoor::get_reservoir_target(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?;

    let last_change = indoor::latest_water_change(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?;

    let since = last_change.as_ref().map(|c| c.created_at);
    let nutrient_total = indoor::nutrient_total_since(pool, indoor_environment_id, since)
        .await
        .map_err(|e| e.to_string())?;

    let now = Utc::now().naive_utc();
    let (last_change_at, days_since) = if let Some(change) = &last_change {
        let days = (now - change.created_at).num_days();
        (Some(change.created_at.to_string()), Some(days))
    } else {
        (None, None)
    };

    let current_volume = last_change
        .as_ref()
        .and_then(|c| c.volume_liters)
        .or(indoor_env.reservoir_capacity_liters);

    let current_ph = latest_reading.as_ref().and_then(|r| r.water_ph);
    let current_ec = latest_reading.as_ref().and_then(|r| r.water_ec);
    let current_ppm = latest_reading.as_ref().and_then(|r| r.water_ppm);

    let status = classify_reservoir_status(current_ph, current_ec, current_ppm, target.as_ref());

    Ok(ReservoirStatus {
        indoor_environment_id,
        current_volume_liters: current_volume,
        last_water_change_at: last_change_at,
        days_since_water_change: days_since,
        target,
        current_ph,
        current_ec,
        current_ppm,
        nutrient_total_since_change: nutrient_total,
        status,
    })
}

pub async fn indoor_dashboard_summary(
    pool: &SqlitePool,
    indoor_environment_id: i64,
) -> Result<IndoorDashboardSummary, String> {
    let indoor_environment = indoor::get_indoor_environment_by_id(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Indoor environment {indoor_environment_id} not found"))?;

    let location = locations::get_location(pool, indoor_environment.location_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Location {} not found", indoor_environment.location_id))?;

    let latest_reading = indoor::latest_indoor_reading(pool, indoor_environment_id)
        .await
        .map_err(|e| e.to_string())?;

    let reservoir_status = get_reservoir_status(pool, indoor_environment_id).await?;

    let all_plants = plants::list_plants_by_location(pool, indoor_environment.location_id, Pagination { limit: 500, offset: 0 })
        .await
        .map_err(|e| e.to_string())?;
    let total_plant_count = all_plants.len() as i64;
    let active_plant_count = all_plants
        .iter()
        .filter(|p| matches!(p.status, crate::db::models::PlantStatus::Active | crate::db::models::PlantStatus::Seedling))
        .count() as i64;

    let upcoming_schedules = schedules::list_schedules(pool, location.environment_id, Pagination { limit: 200, offset: 0 })
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|s| s.location_id == Some(location.id) || s.environment_id == Some(location.environment_id))
        .take(12)
        .collect::<Vec<Schedule>>();

    let recent_issues = issues::list_issues(pool, location.environment_id, Pagination { limit: 30, offset: 0 })
        .await
        .map_err(|e| e.to_string())?
        .into_iter()
        .filter(|i| i.location_id == Some(location.id))
        .take(8)
        .collect();

    let volume_m3 = match (indoor_environment.tent_width, indoor_environment.tent_depth, indoor_environment.tent_height) {
        (Some(w), Some(d), Some(h)) => Some((w * d * h) / 1_000_000.0),
        _ => None,
    };

    let air_exchange_per_hour = match (indoor_environment.ventilation_cfm, volume_m3) {
        (Some(cfm), Some(v)) if v > 0.0 => Some((cfm * 60.0) / (v * 35.3147)),
        _ => None,
    };

    let dli_estimate = match (
        indoor_environment.light_wattage,
        indoor_environment.light_schedule_on.as_ref(),
        indoor_environment.light_schedule_off.as_ref(),
    ) {
        (Some(w), Some(on), Some(off)) => {
            let hours_on = estimate_hours_on(on, off).unwrap_or(12.0);
            Some(calculate_dli(w, indoor_environment.light_type.as_deref(), 60.0, hours_on))
        }
        _ => None,
    };

    Ok(IndoorDashboardSummary {
        indoor_environment,
        location,
        latest_reading,
        reservoir_status,
        active_plant_count,
        total_plant_count,
        upcoming_schedules,
        recent_issues,
        air_exchange_per_hour,
        dli_estimate,
    })
}

fn estimate_hours_on(on: &str, off: &str) -> Option<f64> {
    fn parse_hm(s: &str) -> Option<i64> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 2 {
            return None;
        }
        let h = parts[0].parse::<i64>().ok()?;
        let m = parts[1].parse::<i64>().ok()?;
        Some(h * 60 + m)
    }

    let on_m = parse_hm(on)?;
    let off_m = parse_hm(off)?;
    let delta = if off_m >= on_m {
        off_m - on_m
    } else {
        (24 * 60 - on_m) + off_m
    };
    Some(delta as f64 / 60.0)
}

pub fn apply_sensor_autofill(
    reading: &mut crate::db::models::NewIndoorReading,
    sensor_type: &str,
    value: f64,
) {
    match sensor_type {
        "temperature" => {
            if reading.air_temp.is_none() {
                reading.air_temp = Some(value);
            }
        }
        "humidity" => {
            if reading.air_humidity.is_none() {
                reading.air_humidity = Some(value);
            }
        }
        "co2" => {
            if reading.co2_ppm.is_none() {
                reading.co2_ppm = Some(value);
            }
        }
        "ph" => {
            if reading.water_ph.is_none() {
                reading.water_ph = Some(value);
            }
        }
        "ec" => {
            if reading.water_ec.is_none() {
                reading.water_ec = Some(value);
            }
        }
        _ => {}
    }
}

pub fn stale_maintenance_issue_needed(
    last_water_change_at: Option<NaiveDateTime>,
    threshold_days: i64,
) -> bool {
    let now = Utc::now().naive_utc();
    match last_water_change_at {
        Some(ts) => (now - ts).num_days() > threshold_days,
        None => true,
    }
}
