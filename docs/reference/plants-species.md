---
title: "Plants and Species"
description: "Reference for species catalog data and individual plant records."
---

## Species record fields

| Field | Type | Notes |
| --- | --- | --- |
| `common_name` | string | Primary display name |
| `scientific_name` | string/null | Taxonomic identifier |
| `family`, `genus` | string/null | Grouping and enrichment keys |
| `growth_type` | string/null | Used for categorization/tag behavior |
| `sun_requirement`, `water_requirement` | string/null | Care recommendations |
| `soil_ph_min`, `soil_ph_max` | number/null | Soil target range |
| `days_to_germination_*` | integer/null | Seedling planning baseline |
| `days_to_harvest_*` | integer/null | Growth stage timing baseline |

## Plant record fields

| Field | Type | Notes |
| --- | --- | --- |
| `species_id` | integer/null | Linked species record |
| `location_id` | integer/null | Current location |
| `environment_id` | integer | Parent environment |
| `status` | enum | `planned`, `seedling`, `active`, `harvested`, `removed`, `dead` |
| `name` | string | Individual identifier |
| `label` | string/null | Optional code or short marker |
| `asset_id` | string/null | Generated inventory tag |
| `planted_date` | string/null | ISO date |
| `notes` | string/null | Maintenance/history notes |

## Plant status guidance

- `planned`: not physically planted yet
- `seedling`: early development stage
- `active`: in active growth
- `harvested`: production completed
- `removed`: intentionally removed
- `dead`: plant loss

> [SCREENSHOT:plant-status-dropdown] Capture the plant status selector and status legend.

## Keywords

- [Species](glossary.md#species)
- [Plant](glossary.md#plant)
- [Plant Status](glossary.md#plant-status)
- [Asset Tag](glossary.md#asset-tag)
