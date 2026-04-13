# EAN Search Debug Collection

Collection file: `ean-debug.postman_collection.json`

## Purpose

Debug EAN-Search barcode lookup behavior in both anonymous and token-authenticated modes.

## Required Environment Variables

- `ua`
- `eanBase`
- `eanCode`
- `eanToken` (for authenticated request)

## Requests

1. `Lookup public (no token)`
- Endpoint: `GET {{eanBase}}?ean={{eanCode}}`
- Notes: Uses no token header.

2. `Lookup with token`
- Endpoint: `GET {{eanBase}}?ean={{eanCode}}`
- Notes: Sends `token: {{eanToken}}` header.

## Quick Run Order

1. Run public lookup first to observe anonymous behavior.
2. Set/sync `eanToken`.
3. Run token lookup and compare responses.

## Expected Edge Cases

- Anonymous mode may be rate-limited or rejected.
- Invalid tokens can return API errors.
