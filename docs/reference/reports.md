---
title: "Reports"
description: "Reference for harvest and seasonal reporting data."
---

# Reports

## Harvest fields

| Field | Type | Notes |
| --- | --- | --- |
| `plant_id` | integer | Linked plant |
| `harvest_date` | date | Harvest event date |
| `quantity` | number/null | Measured output |
| `unit` | string/null | Unit label |
| `quality_rating` | integer/null | Subjective quality score |
| `notes` | string/null | Context |
| `asset_id` | string/null | Derived harvest lot tag |

## Season fields

| Field | Type | Notes |
| --- | --- | --- |
| `environment_id` | integer | Scope |
| `name` | string | Season label |
| `start_date`, `end_date` | date | Time boundaries |
| `notes` | string/null | Planning context |

## Report interpretation tips

- Compare quantities across seasons using consistent units.
- Track quality scores by cultivar and location.
- Link anomalies to [Issues](issues.md) and [Journal](journal.md) records.

> [SCREENSHOT:reports-harvest-trends] Capture a report chart with date range and aggregate values.

## Keywords

- [Harvest](glossary.md#harvest)
- [Season](glossary.md#season)
- [Report](glossary.md#report)
