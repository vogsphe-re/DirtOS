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

## Development

Use the integration debug Postman pack to validate provider behavior against the
same request patterns used by DirtOS scripts and services.

### Development assets

- Environment: [`api/debug/DirtOS.integrations.postman_environment.json`](../../api/debug/DirtOS.integrations.postman_environment.json)
- Collection docs index: [`api/debug/README.md`](../../api/debug/README.md)
- Token sync helper: [`scripts/debug/postman-debug.sh`](../../scripts/debug/postman-debug.sh)

### Setup workflow

1. Import `api/debug/DirtOS.integrations.postman_environment.json` into Postman.
2. Import the provider collection(s) you want to debug from `api/debug/`.
3. Run `./scripts/debug/postman-debug.sh` to sync provider tokens from `.env`.
4. Set `speciesQuery` (and `limit` if needed) in the Postman environment.
5. Run each collection in its documented order to auto-populate IDs.

### Collection run order

- GBIF: `Match species` or `Search species` → detail/resources (`gbifUsageKey` auto-set).
	See [`api/debug/gbif-debug.README.md`](../../api/debug/gbif-debug.README.md).
- iNaturalist: `Search taxa` → `Taxon detail` (`inatTaxonId` auto-set).
	See [`api/debug/inat-debug.README.md`](../../api/debug/inat-debug.README.md).
- EoL: `Search pages` → `Page detail` → `TraitBank cypher` (`eolPageId` auto-set).
	See [`api/debug/eol-debug.README.md`](../../api/debug/eol-debug.README.md).
- Trefle: `Search plants` → `Plant detail` (`treflePlantId` auto-set, token required).
	See [`api/debug/trefle-debug.README.md`](../../api/debug/trefle-debug.README.md).
- EAN Search: `Lookup public (no token)` and `Lookup with token` for side-by-side behavior.
	See [`api/debug/ean-debug.README.md`](../../api/debug/ean-debug.README.md).
- Wikipedia: `OpenSearch` → set `wikiTitle` → `Page summary`.
	See [`api/debug/wikipedia-debug.README.md`](../../api/debug/wikipedia-debug.README.md).
- Multi-source comparison: run the cross-provider collection with one query.
	See [`api/debug/species-debug.README.md`](../../api/debug/species-debug.README.md).

### Known API behavior during development

- EoL TraitBank can return `401 Unauthorized` depending on API access policy.
- EAN anonymous requests can be rate-limited or rejected without a token.
- Trefle requests require `trefleToken`.

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
