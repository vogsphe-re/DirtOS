# Species Multi Source Debug Collection

Collection file: `species-debug.postman_collection.json`

## Purpose

Run one species query across all major external providers used by DirtOS.

## Required Environment Variables

- `ua`
- `speciesQuery`
- `limit`
- `gbifBase`
- `inatBase`
- `eolBase`
- `trefleBase`
- `trefleToken`
- `wikiApiBase`

## Requests

1. `GBIF search`
- Endpoint: `GET {{gbifBase}}/species/search`

2. `iNaturalist search`
- Endpoint: `GET {{inatBase}}/taxa`

3. `EoL search`
- Endpoint: `GET {{eolBase}}/api/search/1.0.json`

4. `Trefle search`
- Endpoint: `GET {{trefleBase}}/plants/search`
- Notes: Requires `trefleToken`.

5. `Wikipedia OpenSearch`
- Endpoint: `GET {{wikiApiBase}}`

## Quick Run Order

1. Set `speciesQuery` and optional `limit`.
2. Run all five requests.
3. Compare hit quality and IDs per provider.
