---
title: "Glossary"
description: "Linked terminology for DirtOS concepts and entities."
---

# Glossary

## Asset Tag

Generated inventory identifier for tracked entities such as environments, locations, plants, trays, seed lots, and harvest lots.

## Alert Threshold

Minimum or maximum value used to detect out-of-range conditions.

## Anomaly

A reading, event, or behavior outside expected operational bounds.

## API Key

Credential used to authenticate requests to external services.

## Backup Export

Serialized snapshot of DirtOS data that can be imported later.

## Build

Static generation process for documentation output.

## Cache TTL

Duration before cached data should be considered stale.

## Conditions JSON

Structured metadata attached to journal entries (for example weather context).

## Cron

Recurrence expression used by schedules.

## docmd

Documentation generation tool used by DirtOS for authoring, navigation, and static build output.

## Enrichment

Process of adding species data from external providers.

## Environment

Top-level garden workspace containing locations, plants, and records.

## Example Garden

Bundled importable dataset that demonstrates DirtOS features and workflows.

## Harvest

Recorded yield event linked to an individual plant.

## Import

Process of loading serialized DirtOS data into the local database.

## Indoor Environment

Configuration and telemetry record for an indoor grow space.

## Integration Config

Provider configuration record for external services.

## Issue

Trackable problem, warning, or task requiring attention.

## Issue Priority

Severity indicator: `low`, `medium`, `high`, `critical`.

## Issue Status

Lifecycle state: `new`, `open`, `in_progress`, `closed`.

## Journal Entry

Timestamped note with optional linked plant/location context.

## Location

Physical or logical gardening area within an environment.

## Map Privacy

Visibility mode for shared geospatial map settings.

## Migration

Database schema evolution step applied at startup.

## Navigation

Documentation sidebar/menu hierarchy.

## Plant

Individual tracked specimen linked to species metadata.

## Plant Status

Lifecycle state: `planned`, `seedling`, `active`, `harvested`, `removed`, `dead`.

## Report

Aggregated output used for seasonal and performance review.

## REST API

Local HTTP server embedded in DirtOS (default port 7272). Exposes garden data
over standard REST endpoints for plugins, scripts, and 3rd-party integrations.
See the [REST API reference](rest-api.md).

## Reservoir Target

Defined min/max water chemistry ranges for indoor hydro systems.

## Restore

Recovering a previous exported/backup state.

## Schedule

Recurring maintenance/treatment/sample definition.

## Schedule Run

Execution record for a schedule event.

## Season

Time-bounded growing period used in reporting/planning.

## Seedling Tray

Grid-based structure for seedling propagation and assignment.

## Sensor

Telemetry source attached to environment/location/plant context.

## Sensor Limit

Configured min/max values for a sensor.

## Species

Catalog-level plant definition with growth metadata.

## SQLite

Embedded local database engine used by DirtOS.

## Sync Run

Recorded execution of an integration synchronization operation.

## Tauri

Desktop runtime framework used by DirtOS.

## Transplant

Movement of a plant from one growth context/location to another.

## VPD

Vapor Pressure Deficit; indoor climate balance indicator.

## Weather Cache

Stored weather payload for offline and fallback usage.
