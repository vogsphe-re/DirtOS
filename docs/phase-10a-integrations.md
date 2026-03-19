# Phase 10a: Integrations & Extensions

This document describes the Phase 10a implementation shipped in DirtOS for:

- iNaturalist
- Wikipedia
- OpenStreetMap (OSM)
- Home Assistant
- n8n
- Backup/import/export portability

## Database Additions

Migration: `src-tauri/migrations/20260319000001_phase10a_extensions.sql`

Tables added:

- `integration_configs`: per-provider auth/settings, sync cadence, cache/rate settings, sync health
- `species_external_sources`: attribution and source metadata per species/provider
- `integration_sync_runs`: observable sync history for retries/debugging
- `environment_map_settings`: map coordinates, overlays, privacy/sharing controls
- `integration_webhook_tokens`: callback token registry for Home Assistant / n8n
- `automation_events`: inbound/outbound event audit log
- `backup_jobs`: scheduled backup definitions
- `backup_runs`: backup execution history and status

## Backend Services

### iNaturalist and Wikipedia

Commands:

- `sync_species_external_sources(species_id)`
- `list_species_external_sources(species_id)`
- `list_integration_sync_runs(provider, limit)`

Behavior:

- Uses integration config (enabled flag + optional sync interval) to decide if sync should execute.
- Persists provenance and attribution in `species_external_sources`.
- Records sync success/failure in `integration_sync_runs`.
- Updates `integration_configs.last_synced_at` and `integration_configs.last_error`.

Retry/failure strategy:

- Failures are persisted per run and provider for post-mortem diagnostics.
- Sync can be retried manually from the UI and is idempotent via upsert operations.

### OpenStreetMap

Command:

- `search_osm_places(query, limit)`

Behavior:

- Uses Nominatim search endpoint for geocoding.
- Stores selected map settings via `upsert_environment_map_setting`.

### Home Assistant and n8n

Commands:

- `create_integration_webhook_token(provider, name)`
- `list_integration_webhook_tokens(provider)`
- `process_integration_callback(provider, token, payload_json)`
- `list_automation_events(provider, limit)`

Behavior:

- Webhook token authentication gate for callback ingestion.
- Callback payloads are validated as JSON.
- If `sensor_id` and `value` are provided, telemetry is normalized into `sensor_readings`.
- All callbacks are logged in `automation_events` with processing outcome.

Retry/failure strategy:

- Invalid token or malformed payload returns explicit command errors.
- Every callback is audit-logged with `processed`/`error` status.

## Backup and Portability

Commands:

- `export_configuration(format, include_secrets, encryption_password)`
- `run_backup_job(backup_job_id, encryption_password)`
- `import_configuration(payload, encryption_password)`
- `create_backup_job`, `update_backup_job`, `list_backup_jobs`, `list_backup_runs`

Supported formats:

- JSON
- YAML
- ZIP archive (contains JSON + YAML + schema SQL + CSV extracts)

Security handling:

- If secrets are excluded, secret-like keys are redacted from export payloads.
- If secrets are included and a password is provided, payload content is encrypted using AES-256-GCM-SIV with PBKDF2 key derivation.

Round-trip:

- Import restores app settings, integration configs, map settings, and backup jobs.
- Archive imports read `config/export.json`.

## Frontend Surfaces

The settings route now includes:

- Integrations and extensions panel with tabs for knowledge sync, OSM maps, and automation callbacks
- Backup manager panel for creating jobs, running exports, and importing payloads

Primary file:

- `src/features/integrations/IntegrationExtensionsPanel.tsx`

## Observability

Use these views/commands to inspect health:

- Integration sync run history (`integration_sync_runs`)
- Callback processing events (`automation_events`)
- Backup run history (`backup_runs`)

## Notes and Future Improvements

- Scheduled backup execution currently records definitions and manual runs; cron-triggered backup execution can be connected to scheduler services in a follow-up phase.
- Archive import currently expects an embedded JSON config file path of `config/export.json`.
- iNaturalist/Wikipedia scheduled sync can be fully automated with background jobs in a follow-up iteration.
