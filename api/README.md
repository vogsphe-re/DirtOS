# DirtOS REST API

DirtOS exposes a local REST API for plugin development and 3rd-party integrations
(n8n, Home Assistant, custom scripts, etc.).

## Quick Start

1. Launch DirtOS normally — the API server starts automatically alongside the app.
2. The API binds to `http://127.0.0.1:7272` by default.
3. Test the connection:

```bash
curl http://127.0.0.1:7272/api/v1/health
# → {"status":"ok","version":"0.4.0"}
```

## Port

The default port is **7272**. Override it by setting `DIRTOS_API_PORT` before
launching the app:

```bash
DIRTOS_API_PORT=8080 pnpm dev
```

## Resources

| Resource | Endpoints |
| --- | --- |
| Health | `GET /api/v1/health` |
| Environments | `GET/POST /api/v1/environments` · `GET/PUT/DELETE /api/v1/environments/{id}` |
| Locations | `GET/POST /api/v1/locations?environment_id=` · `GET/PUT/DELETE /api/v1/locations/{id}` |
| Species | `GET/POST /api/v1/species` · `GET/PUT/DELETE /api/v1/species/{id}` |
| Plants | `GET/POST /api/v1/plants?environment_id=` · `GET/PUT/DELETE /api/v1/plants/{id}` |
| Schedules | `GET/POST /api/v1/schedules?environment_id=` · `GET/PUT/DELETE /api/v1/schedules/{id}` |
| Sensors | `GET/POST /api/v1/sensors?environment_id=` · `GET/PUT/DELETE /api/v1/sensors/{id}` |
| Issues | `GET/POST /api/v1/issues?environment_id=` · `GET/PUT/DELETE /api/v1/issues/{id}` |
| Journal | `GET/POST /api/v1/journal?environment_id=` · `GET/PUT/DELETE /api/v1/journal/{id}` |
| Harvests | `GET/POST /api/v1/harvests?environment_id=` · `GET/DELETE /api/v1/harvests/{id}` |

Collection endpoints that are scoped to an environment require the
`environment_id` query parameter. Harvests additionally support `date_from` and
`date_to` (YYYY-MM-DD) filters.

Location type values are serialized as:
`Plot`, `Space`, `Tent`, `Tray`, `Pot`, `Shed`, `OutdoorSite`, `IndoorSite`,
`PlotGroup`, and `SeedlingArea`.

Plant create/update payloads support lifecycle metadata:
`is_harvestable` and `lifecycle_override` (`annual`, `perennial`, `biennial`).

All collection endpoints support `limit` (default 100) and `offset` pagination
parameters.

## Documentation & Testing

### Swagger UI

Open [`swagger-ui.html`](./swagger-ui.html) in a browser. It loads
[`openapi.yaml`](./openapi.yaml) from the same directory and lets you
execute requests against the running DirtOS API directly.

> **Note:** Browsers enforce CORS for file:// origins. Serve the file locally
> if you hit CORS issues:
> `npx serve api` then open [http://localhost:3000/swagger-ui.html](http://localhost:3000/swagger-ui.html)

### Postman

1. In Postman, go to **Environments → Import** and select
   [`DirtOS.postman_environment.json`](./DirtOS.postman_environment.json).
2. Set the **DirtOS — Local** environment as active.
3. Use `{{baseUrl}}` and `{{environmentId}}` variables in your requests.

## CORS

The API allows requests from any origin, so browser-based tools and local web
apps can talk to it without additional configuration.

## Security

The API is bound to `127.0.0.1` (loopback only) and is not accessible from
other machines on the network. No authentication is required since only local
processes can reach it.

## Integration Examples

### Fetch all plants via curl

```bash
ENV_ID=1
curl "http://127.0.0.1:7272/api/v1/plants?environment_id=${ENV_ID}" | jq .
```

### Create a journal entry

```bash
curl -X POST http://127.0.0.1:7272/api/v1/journal \
  -H "Content-Type: application/json" \
  -d '{"environment_id": 1, "title": "Watered tomatoes", "body": "Looking healthy."}'
```

### Mark an issue as closed

```bash
curl -X PUT http://127.0.0.1:7272/api/v1/issues/3 \
  -H "Content-Type: application/json" \
  -d '{"status": "closed"}'
```

### n8n HTTP Request node

- **Method:** GET  
- **URL:** `http://127.0.0.1:7272/api/v1/plants`  
- **Query Parameters:** `environment_id = 1`  
- **Response Format:** JSON  

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
