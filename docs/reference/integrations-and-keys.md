---
title: "Integrations and API Keys"
description: "Reference for provider configuration, map settings, and sync records."
---

# Integrations and API Keys

## Integration provider fields

| Field | Type | Notes |
| --- | --- | --- |
| `provider` | enum | `inaturalist`, `wikipedia`, `eol`, `ean_search`, `amazon_pa_api`, `osm`, `dropbox`, `google_drive`, `onedrive`, `home_assistant`, `n8n` |
| `enabled` | boolean | Active/inactive state |
| `auth_json` | string/null | Credential payload |
| `settings_json` | string/null | Provider-specific settings |
| `sync_interval_minutes` | integer/null | Scheduled sync period |
| `cache_ttl_minutes` | integer/null | Cache lifetime |
| `rate_limit_per_minute` | integer/null | Request pacing |
| `last_synced_at` | timestamp/null | Last sync time |
| `last_error` | string/null | Most recent provider error |

Cloud provider conventions:

- `auth_json` should contain an OAuth token (`access_token`, `token`, or `bearer_token`).
- `settings_json` can define default cloud folder settings such as `remote_path`.

### EAN-Search (`ean_search`)

`auth_json` shape:

```json
{ "api_token": "<your-token>" }
```

`settings_json`: not used.

`SeedEanLookupStatus` values: `success` | `not_found` | `rate_limited` | `token_required` | `error` | `skipped`

### Amazon Product Advertising API (`amazon_pa_api`)

`auth_json` shape:

```json
{
  "access_key": "<AWS-access-key-ID>",
  "secret_key": "<AWS-secret-access-key>",
  "partner_tag": "<associates-partner-tag>"
}
```

`settings_json` shape:

```json
{ "marketplace": "www.amazon.com" }
```

Supported marketplace values: `www.amazon.com`, `www.amazon.co.uk`, `www.amazon.de`,
`www.amazon.fr`, `www.amazon.it`, `www.amazon.es`, `www.amazon.co.jp`,
`www.amazon.com.au`, `www.amazon.ca`, `www.amazon.in`.

`SeedAsinLookupStatus` values: `success` | `not_found` | `credentials_required` | `error` | `skipped`

## Map settings fields

| Field | Type | Notes |
| --- | --- | --- |
| `latitude`, `longitude` | number/null | Map center |
| `zoom_level` | integer/null | Default zoom |
| `weather_overlay` | boolean | Weather layer toggle |
| `soil_overlay` | boolean | Soil layer toggle |
| `privacy_level` | enum | `private`, `obfuscated`, `shared` |
| `allow_sharing` | boolean | Sharing permission |

## Sync run fields

| Field | Type | Notes |
| --- | --- | --- |
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
