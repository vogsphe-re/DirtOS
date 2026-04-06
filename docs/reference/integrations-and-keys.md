---
title: "Integrations and API Keys"
description: "Reference for provider configuration, map settings, and sync records."
---

# Integrations and API Keys

## Integration provider fields

| Field | Type | Notes |
|---|---|---|
| `provider` | enum | `inaturalist`, `wikipedia`, `osm`, `home_assistant`, `n8n` |
| `enabled` | boolean | Active/inactive state |
| `auth_json` | string/null | Credential payload |
| `settings_json` | string/null | Provider-specific settings |
| `sync_interval_minutes` | integer/null | Scheduled sync period |
| `cache_ttl_minutes` | integer/null | Cache lifetime |
| `rate_limit_per_minute` | integer/null | Request pacing |
| `last_synced_at` | timestamp/null | Last sync time |
| `last_error` | string/null | Most recent provider error |

## Map settings fields

| Field | Type | Notes |
|---|---|---|
| `latitude`, `longitude` | number/null | Map center |
| `zoom_level` | integer/null | Default zoom |
| `weather_overlay` | boolean | Weather layer toggle |
| `soil_overlay` | boolean | Soil layer toggle |
| `privacy_level` | enum | `private`, `obfuscated`, `shared` |
| `allow_sharing` | boolean | Sharing permission |

## Sync run fields

| Field | Type | Notes |
|---|---|---|
| `provider` | string | Integration target |
| `operation` | string | Operation type |
| `status` | string | `started`, `success`, `error` |
| `records_fetched` | integer/null | API pull count |
| `records_upserted` | integer/null | Write count |
| `error_message` | string/null | Failure detail |

> [SCREENSHOT:integrations-sync-run-log] Capture a sync run log entry list with success and error examples.

## Keywords

- [API Key](glossary.md#api-key)
- [Integration Config](glossary.md#integration-config)
- [Sync Run](glossary.md#sync-run)
- [Map Privacy](glossary.md#map-privacy)
