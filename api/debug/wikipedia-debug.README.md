# Wikipedia Debug Collection

Collection file: `wikipedia-debug.postman_collection.json`

## Purpose

Debug Wikipedia OpenSearch and page summary calls used by DirtOS.

## Required Environment Variables

- `ua`
- `speciesQuery`
- `limit`
- `wikiApiBase`
- `wikiRestBase`
- `wikiTitle`

## Requests

### OpenSearch

- Endpoint: `GET {{wikiApiBase}}`
- Notes: Returns candidate titles for `speciesQuery`.

### Page summary

- Endpoint: `GET {{wikiRestBase}}/page/summary/{{wikiTitle}}`
- Notes: Collection test accepts `200` or `404`.

## Quick Run Order

1. Run `OpenSearch`.
2. Choose a title and set `wikiTitle`.
3. Run `Page summary`.
