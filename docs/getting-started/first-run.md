---
title: "First Run"
description: "Create your first environment and verify core setup."
---

When DirtOS opens for the first time, complete setup in this order.

## 1. Confirm startup status

- Wait until startup shows `Ready`.
- If recovery runs, read the message and continue only when complete.

## 2. Create an environment

Create one [Environment](../reference/glossary.md#environment) for your garden.

Recommended initial values:

| Field | Example | Why it matters |
| --- | --- | --- |
| Name | `Home Garden 2026` | Used in lists and reports |
| Latitude | `35.33429` | Weather and sunlight calculations |
| Longitude | `-80.46207` | Weather and sunlight calculations |
| Elevation (m) | `163` | Weather context |
| Timezone | `America/New_York` | Schedule and history timestamps |
| Climate Zone | `7b` | Plant suitability planning |

> [SCREENSHOT:first-run-environment-form]
> Capture the environment creation form with all fields visible.

## 3. Define locations

Create core [Location](../reference/glossary.md#location) entries, such as:

- Raised bed or plot
- Indoor tent or room
- Propagation or seedling area

## 4. Verify settings

Open Settings and confirm:

- API keys (weather, enrichment providers)
- Alert preferences
- Backup/export options

## 5. Choose your starting data

Pick one:

- Manual setup (empty environment)
- Import from backup
- Import the bundled [Example Garden](example-garden.md)

## Keywords

- [Environment](../reference/glossary.md#environment)
- [Location](../reference/glossary.md#location)
- [API Key](../reference/glossary.md#api-key)
- [Example Garden](../reference/glossary.md#example-garden)
