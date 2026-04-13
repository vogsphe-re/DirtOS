# GBIF Debug Collection

Collection file: `gbif-debug.postman_collection.json`

## Purpose

Debug GBIF species match/search/enrichment calls used by DirtOS.

## Required Environment Variables

- `ua`
- `speciesQuery`
- `limit`
- `gbifBase`
- `gbifUsageKey`

## Requests

1. `Match species`
- Endpoint: `GET {{gbifBase}}/species/match`
- Notes: Sets `gbifUsageKey` from `usageKey` when available.

2. `Search species`
- Endpoint: `GET {{gbifBase}}/species/search`
- Notes: Sets `gbifUsageKey` from the first result key.

3. `Detail by usageKey`
- Endpoint: `GET {{gbifBase}}/species/{{gbifUsageKey}}`

4. `Vernacular names`
- Endpoint: `GET {{gbifBase}}/species/{{gbifUsageKey}}/vernacularNames?limit=50`

5. `Species profiles`
- Endpoint: `GET {{gbifBase}}/species/{{gbifUsageKey}}/speciesProfiles?limit=50`

6. `Distributions`
- Endpoint: `GET {{gbifBase}}/species/{{gbifUsageKey}}/distributions?limit=100`

## Quick Run Order

1. Run `Match species` or `Search species`.
2. Confirm `gbifUsageKey` is populated.
3. Run detail and sub-resource requests.
