---
title: "Architecture"
description: "Technical architecture overview of DirtOS frontend, backend, and data flow."
---

# Architecture

## Frontend

- React 19 + TanStack Router
- Mantine UI shell and components
- React Query for async command-backed state
- Zustand for focused local stores
- Konva and React Three Fiber for 2D/3D planning surfaces

## Backend

- Tauri 2 desktop runtime
- Rust command modules by feature domain
- SQLite local data store
- Embedded axum HTTP server (REST API on `127.0.0.1:7272`)
- Services for export/import, scheduler, sensors, weather, integrations, and backup

## Startup lifecycle

1. Resolve app data directory.
2. Initialize DB, run migrations, and seed reference data.
3. Attempt backup recovery if DB init fails.
4. Start scheduler, sensor polling, and backup services.
5. Start the REST API server (`127.0.0.1:7272`).
6. Ensure example garden file exists in Documents.

## Data safety model

- SQLite WAL enabled for local durability/concurrency
- Backup snapshots and importable JSON export
- Media file persistence handled alongside table export

> [SCREENSHOT:architecture-diagram-placeholder] Add an architecture diagram showing frontend-command-service-data flow.

## Keywords

- [Tauri](glossary.md#tauri)
- [SQLite](glossary.md#sqlite)
- [Migration](glossary.md#migration)
- [Backup Export](glossary.md#backup-export)
- [REST API](glossary.md#rest-api)
