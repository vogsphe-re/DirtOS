---
title: "REST API"
description: "Reference for the DirtOS local REST API — endpoints, resources, and integration patterns."
---

# REST API

DirtOS embeds a local HTTP API server (axum) that exposes garden data for plugins
and 3rd-party integrations. The API starts automatically whenever DirtOS is running.

## Base URL and port

```shell
http://127.0.0.1:7272
```

The default port is **7272**. Override it by setting `DIRTOS_API_PORT` in the
environment before launching DirtOS:

```bash
DIRTOS_API_PORT=8080 pnpm dev
```

The server binds to loopback only — it is not reachable from other machines on
the network.

## Health check

```bash
curl http://127.0.0.1:7272/api/v1/health
# → {"status":"ok","version":"0.4.0"}
```

## Resources

All endpoints are prefixed with `/api/v1/`. Timestamps are ISO 8601 UTC strings.
Most enum values use lowercase snake_case. `LocationType` values are PascalCase.

| Resource | Collection URL | Item URL |
| --- | --- | --- |
| Health | `GET /api/v1/health` | — |
| Storage settings | `/api/v1/settings/storage` | `/api/v1/settings/storage/user-data`, `/api/v1/settings/storage/backup-output` |
| Backup jobs | `/api/v1/backups/jobs` | `/api/v1/backups/jobs/{id}`, `/api/v1/backups/jobs/{id}/run` |
| Backup runs | `/api/v1/backups/runs` | — |
| Environments | `/api/v1/environments` | `/api/v1/environments/{id}` |
| Locations | `/api/v1/locations` | `/api/v1/locations/{id}` |
| Species | `/api/v1/species` | `/api/v1/species/{id}` |
| Plants | `/api/v1/plants` | `/api/v1/plants/{id}` |
| Schedules | `/api/v1/schedules` | `/api/v1/schedules/{id}` |
| Sensors | `/api/v1/sensors` | `/api/v1/sensors/{id}` |
| Issues | `/api/v1/issues` | `/api/v1/issues/{id}` |
| Journal | `/api/v1/journal` | `/api/v1/journal/{id}` |
| Harvests | `/api/v1/harvests` | `/api/v1/harvests/{id}` |
| Seed lots | `/api/v1/seed-lots` | `/api/v1/seed-lots/{id}` |

Location types currently supported by `LocationType`:
`Plot`, `Space`, `Tent`, `Tray`, `Pot`, `Shed`, `OutdoorSite`, `IndoorSite`,
`PlotGroup`, and `SeedlingArea`.

Plant payloads include lifecycle metadata fields:
`is_harvestable` and `lifecycle_override` (`annual`, `perennial`, `biennial`).

### Standard HTTP methods

| Method | Behaviour |
| --- | --- |
| `GET` (collection) | List records |
| `POST` | Create a record |
| `GET` (item) | Fetch a single record |
| `PUT` | Update a record (all fields optional) |
| `DELETE` | Remove a record — returns `204 No Content` |

Harvests do not support `PUT` (delete and re-create to correct a record).

Seed lot scan endpoints accept a JSON body and return the resulting seed lot
together with lookup details:

| Endpoint | Body field | Description |
| --- | --- | --- |
| `POST /api/v1/seed-lots/scan/ean` | `barcode` | EAN-8 / EAN-13 lookup via EAN-Search |
| `POST /api/v1/seed-lots/scan/asin` | `asin` | Amazon ASIN lookup via PA API v5 |

Scan endpoints create a new seed lot when none matching the barcode or ASIN
exists, or enrich an existing one with product metadata when a match is found.

Storage endpoints support moving user data to absolute local or UNC network paths.
When a user data directory override is changed, responses include `restart_required`
to indicate that DirtOS must restart before switching active database/media paths.

Backup job payloads include strategy and destination controls:

- `backup_strategy`: `full`, `incremental`, `hybrid`
- `destination_kind`: `local`, `network`, `cloud`
- cloud uploads: `cloud_provider` (`dropbox`, `google_drive`, `onedrive`) and `cloud_path_prefix`
- lifecycle/dedupe: `lifecycle_policy_json` (for example `{"keep_last":14}`) and `dedupe_enabled`

### Pagination

Collection endpoints support `limit` (default `100`) and `offset` (default `0`):

```shell
GET /api/v1/plants?environment_id=1&limit=50&offset=50
```

### Environment scoping

Most collection endpoints require `environment_id` as a query parameter to
scope results to a specific garden environment:

```shell
GET /api/v1/plants?environment_id=1
GET /api/v1/issues?environment_id=1
```

The `/api/v1/species` and `/api/v1/environments` endpoints are not
environment-scoped.

### Harvest date filtering

The `/api/v1/harvests` collection endpoint additionally accepts `date_from` and
`date_to` filters (YYYY-MM-DD format):

```shell
GET /api/v1/harvests?environment_id=1&date_from=2026-01-01&date_to=2026-06-30
```

## Error responses

Errors are returned as JSON with an `error` string field.

| HTTP Status | Meaning |
| --- | --- |
| `404 Not Found` | Record does not exist |
| `500 Internal Server Error` | Unexpected database or server error |

```json
{ "error": "not found" }
```

## CORS

All origins are accepted. Browser-based tools and local web apps can call the
API without any additional configuration.

## Quick reference examples

### List all plants in environment 1

```bash
curl "http://127.0.0.1:7272/api/v1/plants?environment_id=1" | jq .
```

### Create a journal entry

```bash
curl -X POST http://127.0.0.1:7272/api/v1/journal \
  -H "Content-Type: application/json" \
  -d '{"environment_id": 1, "title": "Watered tomatoes", "body": "Looking healthy."}'
```

### Update an issue status

```bash
curl -X PUT http://127.0.0.1:7272/api/v1/issues/3 \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

### Record a harvest

```bash
curl -X POST http://127.0.0.1:7272/api/v1/harvests \
  -H "Content-Type: application/json" \
  -d '{"plant_id": 12, "harvest_date": "2026-07-15", "quantity": 1.4, "unit": "kg"}'
```

### Configure a custom backup output directory

```bash
curl -X PUT http://127.0.0.1:7272/api/v1/settings/storage/backup-output \
  -H "Content-Type: application/json" \
  -d '{"path":"/mnt/backup/DirtOS"}'
```

### Run a backup job immediately

```bash
curl -X POST http://127.0.0.1:7272/api/v1/backups/jobs/3/run \
  -H "Content-Type: application/json" \
  -d '{"encryption_password":null}'
```

### List all seed lots

```bash
curl "http://127.0.0.1:7272/api/v1/seed-lots" | jq .
```

### Scan a seed packet by EAN barcode

```bash
curl -X POST http://127.0.0.1:7272/api/v1/seed-lots/scan/ean \
  -H "Content-Type: application/json" \
  -d '{"barcode": "5010356101123"}'
```

### Scan a seed packet by Amazon ASIN

```bash
curl -X POST http://127.0.0.1:7272/api/v1/seed-lots/scan/asin \
  -H "Content-Type: application/json" \
  -d '{"asin": "B08N5WRWNW"}'
```

The `api/` directory at the project root contains:

| File | Purpose |
| --- | --- |
| [`openapi.yaml`](../../api/openapi.yaml) | Full OpenAPI 3.1 spec with schemas for every resource |
| [`swagger-ui.html`](../../api/swagger-ui.html) | Swagger UI — open in a browser to browse and execute requests |
| [`DirtOS.postman_environment.json`](../../api/DirtOS.postman_environment.json) | Postman environment with `baseUrl` and `environmentId` variables |
| [`api/debug/DirtOS.integrations.postman_environment.json`](../../api/debug/DirtOS.integrations.postman_environment.json) | Postman environment for external provider debugging |
| [`api/debug/*.postman_collection.json`](../../api/debug/README.md) | Provider-specific Postman collections (GBIF, iNaturalist, EoL, Trefle, EAN, Wikipedia, cross-source) |
| [`README.md`](../../api/README.md) | Integration quick-start with n8n and Home Assistant examples |

### Using Swagger UI

Open `api/swagger-ui.html` in a browser while DirtOS is running. The **Try it
out** button on each operation sends live requests to the API.

The page includes an embedded fallback copy of the OpenAPI spec, so it also
works when opened directly from `file://`.

### Using Postman

1. **Environments → Import** → select `api/DirtOS.postman_environment.json`.
2. Set **DirtOS — Local** as the active environment.
3. Use `{{baseUrl}}` and `{{environmentId}}` variables in requests.

### Using Postman for provider development

1. Import `api/debug/DirtOS.integrations.postman_environment.json`.
2. Import one or more collections from `api/debug/`.
3. Run `./scripts/debug/postman-debug.sh` to sync `trefleToken` and `eanToken` from `.env`.
4. Execute requests in the order documented for each provider.

Provider docs:

- [`api/debug/gbif-debug.README.md`](../../api/debug/gbif-debug.README.md)
- [`api/debug/inat-debug.README.md`](../../api/debug/inat-debug.README.md)
- [`api/debug/eol-debug.README.md`](../../api/debug/eol-debug.README.md)
- [`api/debug/trefle-debug.README.md`](../../api/debug/trefle-debug.README.md)
- [`api/debug/ean-debug.README.md`](../../api/debug/ean-debug.README.md)
- [`api/debug/wikipedia-debug.README.md`](../../api/debug/wikipedia-debug.README.md)
- [`api/debug/species-debug.README.md`](../../api/debug/species-debug.README.md)

Expected provider-specific behavior while testing:

- EoL TraitBank Cypher may return `401`.
- EAN public mode can be rate-limited.
- Trefle endpoints require a token.

## Integration patterns

### n8n

Use the **HTTP Request** node:

- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/plants`
- **Query string:** `environment_id=1`
- **Response format:** JSON

Trigger workflows on DirtOS data changes by polling collection endpoints on a
schedule node.

### Home Assistant REST sensor

```yaml
sensor:
  - platform: rest
    name: DirtOS active plants
    resource: http://127.0.0.1:7272/api/v1/plants
    params:
      environment_id: 1
    value_template: "{{ value_json | length }}"
    scan_interval: 300
```

### Custom scripts / plugins

Any script that can make HTTP requests can read and write DirtOS data. See
`api/README.md` for a full walkthrough.

## Keywords

- [REST API](glossary.md#rest-api)
- [Environment](glossary.md#environment)
- [Plant](glossary.md#plant)
- [Schedule](glossary.md#schedule)
- [Sensor](glossary.md#sensor)
- [Issue](glossary.md#issue)
- [Integration Config](glossary.md#integration-config)
