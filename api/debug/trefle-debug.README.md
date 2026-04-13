# Trefle Debug Collection

Collection file: `trefle-debug.postman_collection.json`

## Purpose

Debug Trefle search and detail calls used by DirtOS enrichment flows.

## Required Environment Variables

- `ua`
- `speciesQuery`
- `trefleBase`
- `trefleToken`
- `treflePlantId`

## Requests

1. `Search plants`
- Endpoint: `GET {{trefleBase}}/plants/search`
- Notes: Requires `trefleToken`. Sets `treflePlantId` from the first result `id`.

2. `Plant detail`
- Endpoint: `GET {{trefleBase}}/plants/{{treflePlantId}}?token={{trefleToken}}`

## Quick Run Order

1. Sync token via `./scripts/debug/postman-debug.sh` or set `trefleToken` manually.
2. Run `Search plants`.
3. Verify `treflePlantId` is updated.
4. Run `Plant detail`.
