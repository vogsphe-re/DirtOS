---
title: "Integrations"
description: "Configure external integrations and API-backed enrichment features."
---

DirtOS supports local configuration for enrichment, weather, and automation integrations.

## Core integration areas

- Weather provider settings
- Species enrichment providers
- Automation providers (for event routing)

## API key handling

- Configure keys in Settings.
- Validate connectivity by running a small sync/test operation.
- Keep keys out of screenshots and shared logs.

## Practical setup order

1. Configure weather API key.
2. Configure plant enrichment provider key(s).
3. Run one enrichment test on a known species.
4. Verify map and weather overlays.

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
