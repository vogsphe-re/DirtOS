# EoL Debug Collection

Collection file: `eol-debug.postman_collection.json`

## Purpose

Debug Encyclopedia of Life search, page detail, and TraitBank Cypher calls used by DirtOS.

## Required Environment Variables

- `ua`
- `speciesQuery`
- `limit`
- `eolBase`
- `eolPageId`

## Requests

1. `Search pages`
- Endpoint: `GET {{eolBase}}/api/search/1.0.json`
- Notes: Sets `eolPageId` from the first search result `id`.

2. `Page detail`
- Endpoint: `GET {{eolBase}}/api/pages/1.0.json`

3. `TraitBank cypher`
- Endpoint: `GET {{eolBase}}/service/cypher`
- Notes: Query uses `eolPageId` in a Cypher expression.

## Quick Run Order

1. Run `Search pages`.
2. Confirm `eolPageId` was updated.
3. Run `Page detail`.
4. Run `TraitBank cypher`.

## Expected Edge Case

- TraitBank may return `401 Unauthorized` depending on EoL access policy.
