---
title: "Schedules"
description: "Reference for recurring tasks and execution history."
---

# Schedules

## Schedule fields

| Field | Type | Notes |
|---|---|---|
| `environment_id` | integer/null | Scope |
| `plant_id` | integer/null | Optional plant targeting |
| `location_id` | integer/null | Optional location targeting |
| `type` | enum | `water`, `feed`, `maintenance`, `treatment`, `sample`, `custom` |
| `title` | string | User-visible task label |
| `cron_expression` | string/null | Recurrence definition |
| `is_active` | boolean | Enable/disable switch |
| `additive_id` | integer/null | Optional nutrient/amendment link |
| `notes` | string/null | Procedure notes |

## Schedule run fields

| Field | Type | Notes |
|---|---|---|
| `schedule_id` | integer | Parent schedule |
| `issue_id` | integer/null | Optional linked issue |
| `ran_at` | timestamp | Execution time |
| `status` | enum | `completed`, `skipped`, `missed` |

## Operational guidance

- Keep schedule names action-oriented and specific.
- Use `location_id` for shared infrastructure tasks.
- Review missed runs weekly.

> [SCREENSHOT:schedule-runs-history] Capture schedule details with recent run statuses.

## Keywords

- [Schedule](glossary.md#schedule)
- [Schedule Run](glossary.md#schedule-run)
- [Cron](glossary.md#cron)
