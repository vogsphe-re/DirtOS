---
title: "Example Garden"
description: "Import and explore the bundled DirtOS example garden dataset."
---

DirtOS installs an import-ready example file at:

`~/Documents/DirtOS/Examples/DirtOS-Example-Garden.json`

## What it includes

- Outdoor beds with vegetables, herbs, and flowering plants
- Indoor tents with environmental telemetry
- Seedling trays with occupied cells and observations
- Historical schedule runs, journal entries, and harvest records
- Sensor limits, out-of-range readings, and generated issues
- Asset tags across tracked inventory entities

## Import steps

1. Open the import/backup section in Settings.
2. Select the example JSON file.
3. Run full import.
4. Verify environment, locations, and records are present.

> [SCREENSHOT:example-garden-import-flow]
> Capture the full import dialog and file selection step.

## Validation checklist

After import, confirm:

- Environments and locations appear in navigation
- Plants include mixed [Plant Status](../reference/glossary.md#plant-status) values
- Seedling trays show assigned cells
- Sensors have [Sensor Limit](../reference/glossary.md#sensor-limit) records
- At least one issue is open and linked to a location or plant

## Re-generating the file

The backend exposes a command that can regenerate and overwrite the example file:

- `save_example_garden`

Use this when demo data schema or feature coverage changes.

## Keywords

- [Example Garden](../reference/glossary.md#example-garden)
- [Import](../reference/glossary.md#import)
- [Sensor Limit](../reference/glossary.md#sensor-limit)
- [Issue](../reference/glossary.md#issue)
