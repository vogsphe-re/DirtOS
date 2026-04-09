---
title: "Environments and Locations"
description: "Reference for environment and location records, fields, and behavior."
---

## Environment fields

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Display name for a garden workspace |
| `latitude` | number | Used by weather/sun calculations |
| `longitude` | number | Used by weather/sun calculations |
| `elevation_m` | number | Elevation context |
| `timezone` | string | Impacts schedule and history interpretation |
| `climate_zone` | string | Plant suitability planning |
| `asset_id` | string | Generated inventory tag |

## Location fields

| Field | Type | Notes |
| --- | --- | --- |
| `environment_id` | integer | Parent environment |
| `parent_id` | integer/null | Hierarchical location support |
| `type` | enum | `plot`, `space`, `tent`, `tray`, `pot`, `shed` |
| `name` | string | User-visible name |
| `label` | string/null | Optional short descriptor |
| `position_x`, `position_y` | number/null | Canvas placement |
| `width`, `height` | number/null | Canvas dimensions |
| `notes` | string/null | Operational details |
| `asset_id` | string | Generated inventory tag |

## Typical use patterns

- One environment per physical site.
- Use location hierarchy for nested spaces.
- Keep names stable so history and reports stay readable.

## Storage roots

- Default user data root: `~/Documents/DirtOS` (or `%USERPROFILE%\\Documents\\DirtOS` on Windows).
- Backup output defaults to `<user_data_root>/backups`.
- Both paths can be overridden in Settings for local disks or network shares.

> [SCREENSHOT:environment-location-editor] Capture environment and location edit forms side by side.

## Keywords

- [Environment](glossary.md#environment)
- [Location](glossary.md#location)
- [Asset Tag](glossary.md#asset-tag)
