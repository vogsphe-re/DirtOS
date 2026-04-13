# iNaturalist Debug Collection

Collection file: `inat-debug.postman_collection.json`

## Purpose

Debug iNaturalist taxon search and taxon detail calls used by DirtOS.

## Required Environment Variables

- `ua`
- `speciesQuery`
- `inatBase`
- `inatTaxonId`

## Requests

1. `Search taxa`

- Endpoint: `GET {{inatBase}}/taxa`
- Notes: Sets `inatTaxonId` from the first result `id`.

1. `Taxon detail`

- Endpoint: `GET {{inatBase}}/taxa/{{inatTaxonId}}`

## Quick Run Order

1. Run `Search taxa` with `speciesQuery`.
2. Verify `inatTaxonId` is updated.
3. Run `Taxon detail`.
