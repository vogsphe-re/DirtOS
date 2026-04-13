# DirtOS Integration Debug Postman Pack

This folder contains a dedicated Postman environment and collections for the
external integrations used by DirtOS debug scripts in `scripts/debug/`.

## Files

- `DirtOS.integrations.postman_environment.json`
- `gbif-debug.postman_collection.json`
- `gbif-debug.README.md`
- `inat-debug.postman_collection.json`
- `inat-debug.README.md`
- `eol-debug.postman_collection.json`
- `eol-debug.README.md`
- `trefle-debug.postman_collection.json`
- `trefle-debug.README.md`
- `ean-debug.postman_collection.json`
- `ean-debug.README.md`
- `wikipedia-debug.postman_collection.json`
- `wikipedia-debug.README.md`
- `species-debug.postman_collection.json`
- `species-debug.README.md`

## Import Order

1. Import `DirtOS.integrations.postman_environment.json`.
2. Import one or more `*-debug.postman_collection.json` files.
3. Select the `DirtOS Integrations Debug` environment before running requests.

## Token Sync

Use this helper script to copy integration tokens from `.env` into the Postman
environment:

```bash
./scripts/debug/postman-debug.sh
```

Supported variables in `.env`:

- `TREFLE_ACCESS_KEY`
- `EAN_SEARCH_API_TOKEN` (preferred)
- `EAN_SEARCH_TOKEN` (fallback)

## Notes

- Most collections update ID variables from search responses (for example
  `gbifUsageKey`, `inatTaxonId`, `eolPageId`).
- EoL TraitBank may return HTTP 401; this is expected in some environments.
- Public EAN-Search requests can be rate-limited or rejected without a token.
