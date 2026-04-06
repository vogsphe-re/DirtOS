---
title: "Journal"
description: "Reference for chronological garden notes and contextual records."
---

# Journal

## Journal entry fields

| Field | Type | Notes |
|---|---|---|
| `environment_id` | integer/null | Scope |
| `plant_id` | integer/null | Optional plant link |
| `location_id` | integer/null | Optional location link |
| `title` | string | Entry summary |
| `body` | string/null | Detailed note |
| `conditions_json` | string/null | Structured context (weather, measurements) |
| `created_at`, `updated_at` | timestamp | Timeline metadata |

## Recommended entry structure

- What changed
- Why it changed
- What to observe next

Example:

```json
{
  "temp_c": 24,
  "humidity_pct": 58,
  "weather": "overcast"
}
```

> [SCREENSHOT:journal-entry-editor] Capture journal entry editor including optional structured conditions.

## Keywords

- [Journal Entry](glossary.md#journal-entry)
- [Conditions JSON](glossary.md#conditions-json)
