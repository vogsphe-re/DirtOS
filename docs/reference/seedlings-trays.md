---
title: "Seedlings and Trays"
description: "Reference for seedling trays, tray cells, and observation history."
---

## Seedling tray fields

| Field | Type | Notes |
| --- | --- | --- |
| `environment_id` | integer | Parent environment |
| `name` | string | Tray name |
| `rows`, `cols` | integer | Tray grid size |
| `cell_size_cm` | number/null | Cell size estimate |
| `notes` | string/null | Tray-specific context |
| `asset_id` | string | Generated tray tag |

## Tray cell fields

| Field | Type | Notes |
| --- | --- | --- |
| `tray_id` | integer | Parent tray |
| `row`, `col` | integer | Cell coordinates |
| `plant_id` | integer/null | Assigned seedling/plant |
| `notes` | string/null | Cell-specific notes |

## Seedling observation fields

| Field | Type | Notes |
| --- | --- | --- |
| `plant_id` | integer | Tracked plant |
| `observed_at` | date | Observation date |
| `height_cm` | number/null | Height trend |
| `stem_thickness_mm` | number/null | Vigor indicator |
| `leaf_node_count` | integer/null | Development stage |
| `leaf_node_spacing_mm` | number/null | Stretching indicator |
| `notes` | string/null | Qualitative context |

## Practical pattern

1. Assign seedlings to tray cells.
2. Log observations every 3-7 days.
3. Move seedlings to permanent locations and update plant location history.

> [SCREENSHOT:tray-grid-with-observations]
> Capture tray cell assignment panel and observation history list.

## Keywords

- [Seedling Tray](glossary.md#seedling-tray)
- [Tray Cell](glossary.md#tray-cell)
- [Transplant](glossary.md#transplant)
