---
title: "Sensors"
description: "Reference for sensor setup, readings, and alert thresholds."
---

# Sensors

## Sensor fields

| Field | Type | Notes |
| --- | --- | --- |
| `environment_id` | integer/null | Scope |
| `location_id` | integer/null | Optional location assignment |
| `plant_id` | integer/null | Optional plant assignment |
| `name` | string | Sensor display name |
| `type` | enum | `moisture`, `light`, `temperature`, `humidity`, `ph`, `ec`, `co2`, `air_quality`, `custom` |
| `connection_type` | enum | `serial`, `usb`, `mqtt`, `http`, `manual`, `home_assistant` |
| `connection_config_json` | string/null | Provider or hardware config |
| `poll_interval_seconds` | integer/null | Sampling period |
| `is_active` | boolean | Active polling state |

## Reading fields

| Field | Type | Notes |
| --- | --- | --- |
| `sensor_id` | integer | Parent sensor |
| `value` | number | Reading value |
| `unit` | string/null | Unit (`%`, `C`, `lux`, etc.) |
| `recorded_at` | timestamp | Reading timestamp |

## Limit fields

| Field | Type | Notes |
| --- | --- | --- |
| `sensor_id` | integer | Parent sensor |
| `min_value` | number/null | Lower threshold |
| `max_value` | number/null | Upper threshold |
| `unit` | string/null | Expected unit |
| `alert_enabled` | boolean | Enable threshold alerting |

## Best practices

- Start with conservative limits, tighten over time.
- Confirm unit consistency before trusting comparisons.
- Use historical trends, not single-point readings, for diagnosis.

> [SCREENSHOT:sensor-limit-config] Capture sensor limit configuration and an out-of-range reading example.

## Keywords

- [Sensor](glossary.md#sensor)
- [Sensor Limit](glossary.md#sensor-limit)
- [Anomaly](glossary.md#anomaly)
