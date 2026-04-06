---
title: "Indoor Environments"
description: "Reference for indoor grow spaces, readings, and reservoir targets."
---

## Indoor environment fields

| Field | Type | Notes |
| --- | --- | --- |
| `location_id` | integer | Linked `tent` or indoor location |
| `grow_method` | enum/null | `soil`, `hydroponic_*`, `aeroponic`, `aquaponic` |
| `light_type` | string/null | Fixture description |
| `light_wattage` | number/null | Fixture power estimate |
| `light_schedule_on/off` | string/null | Daily photoperiod times |
| `ventilation_type` | string/null | Fan/filter strategy |
| `ventilation_cfm` | number/null | Airflow estimate |
| `tent_width/depth/height` | number/null | Dimensions |
| `reservoir_capacity_liters` | number/null | Hydro reservoir volume |

## Indoor reading fields

| Field | Type | Notes |
| --- | --- | --- |
| `water_temp` | number/null | Hydro loops |
| `water_ph` | number/null | Nutrient uptake control |
| `water_ec` | number/null | Nutrient concentration |
| `water_ppm` | number/null | Alternative concentration metric |
| `air_temp` | number/null | Canopy climate |
| `air_humidity` | number/null | VPD component |
| `co2_ppm` | number/null | Gas concentration |
| `vpd` | number/null | Computed vapor pressure deficit |

## Reservoir target fields

| Field | Type | Notes |
| --- | --- | --- |
| `ph_min`, `ph_max` | number/null | pH operating band |
| `ec_min`, `ec_max` | number/null | EC operating band |
| `ppm_min`, `ppm_max` | number/null | PPM operating band |

> [SCREENSHOT:indoor-dashboard-summary] Capture indoor summary with latest reading and target ranges.

## Keywords

- [Indoor Environment](glossary.md#indoor-environment)
- [Reservoir Target](glossary.md#reservoir-target)
- [VPD](glossary.md#vpd)
