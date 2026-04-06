---
title: "Weather"
description: "Reference for weather cache, settings, and weather-driven alerts."
---

# Weather

## Core settings keys

| Key | Purpose |
|---|---|
| `openweather_api_key` | API key for weather provider |
| `default_latitude` | Default weather latitude |
| `default_longitude` | Default weather longitude |
| `default_elevation_m` | Elevation context |

## Weather cache fields

| Field | Type | Notes |
|---|---|---|
| `environment_id` | integer | Scope |
| `forecast_json` | string | Serialized weather payload |
| `fetched_at` | timestamp | Cache write time |
| `valid_until` | timestamp/null | Cache expiry threshold |

## Alert settings

| Field | Type | Notes |
|---|---|---|
| `heat_max_c` | number | Trigger threshold for high heat |
| `frost_min_c` | number | Trigger threshold for freezing risk |
| `wind_max_ms` | number | Trigger threshold for wind events |
| `precip_prob_threshold` | number | Trigger threshold for rain probability |
| `alerts_enabled` | boolean | Master switch |

> [SCREENSHOT:weather-alert-settings] Capture weather alert thresholds and enable toggle.

## Keywords

- [Weather Cache](glossary.md#weather-cache)
- [Alert Threshold](glossary.md#alert-threshold)
- [API Key](glossary.md#api-key)
