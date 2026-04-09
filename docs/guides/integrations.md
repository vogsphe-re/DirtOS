---
title: "Integrations"
description: "Configure external integrations and API-backed enrichment features."
---

DirtOS supports local configuration for enrichment, weather, and automation integrations.
It also exposes a built-in REST API for plugin development and direct data access.

## REST API

DirtOS runs a local HTTP API on `http://127.0.0.1:7272` automatically when the app
is open. It covers all core entities — environments, plants, species, schedules,
sensors, issues, journal entries, and harvests — and is designed for:

- Custom plugins and scripts that read or write garden data
- Automation platforms (n8n, Home Assistant)
- Development and testing via Swagger UI or Postman

See the [REST API reference](../reference/rest-api.md) for the full endpoint list,
request/response schemas, and integration examples.

## Core integration areas

- Weather provider settings
- Species enrichment providers
- Automation providers (for event routing)
- Cloud backup providers (Dropbox, Google Drive, OneDrive)

## API key handling

- Configure keys in Settings.
- Validate connectivity by running a small sync/test operation.
- Keep keys out of screenshots and shared logs.

## Practical setup order

1. Configure weather API key.
2. Configure plant enrichment provider key(s).
3. Configure cloud backup provider token(s) and path prefix.
4. Run one enrichment test on a known species.
5. Create and run a backup job targeting a separate destination.
6. Verify map and weather overlays.

## Troubleshooting checklist

- Key present but requests fail: verify endpoint/provider enablement.
- Stale data: check sync interval and cache TTL.
- Missing updates: confirm provider is enabled and last error is empty.

> [SCREENSHOT:integrations-settings-panels]
> Capture all integration settings sections with sensitive fields masked.

## Keywords

- [API Key](../reference/glossary.md#api-key)
- [Enrichment](../reference/glossary.md#enrichment)
- [Sync Run](../reference/glossary.md#sync-run)
- [Cache TTL](../reference/glossary.md#cache-ttl)
- [REST API](../reference/glossary.md#rest-api)
