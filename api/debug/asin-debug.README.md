# Amazon PA API ASIN Debug Collection

Collection file: `asin-debug.postman_collection.json`

## Purpose

Debug Amazon Product Advertising API v5 ASIN lookup behavior used by the DirtOS
seed store scanner. Validates AWS Signature Version 4 signing, marketplace
routing, and product data extraction (`ItemInfo.Title`, `ItemInfo.ByLineInfo`).

## Required Environment Variables

- `amazonPaAccessKey` — AWS access key ID
- `amazonPaSecretKey` — AWS secret access key
- `amazonPaPartnerTag` — Amazon Associates partner tag
- `amazonPaMarketplace` — Marketplace host (e.g. `www.amazon.com`)
- `asin` — ASIN to look up

## Requests

1. `Lookup ASIN`

- Endpoint: `POST https://webservices.amazon.com/paapi5/getitems`
- Auth: AWS Signature Version 4 (`ProductAdvertisingAPI` service)
- Notes: Sends `Resources` including `ItemInfo.Title` and `ItemInfo.ByLineInfo`.

## Quick Run Order

1. Set `amazonPaAccessKey`, `amazonPaSecretKey`, `amazonPaPartnerTag` in the environment.
2. Set `asin` to a valid Amazon ASIN (e.g. `B08N5WRWNW`).
3. Run `Lookup ASIN` and inspect `ItemsResult.Items[0]`.

## Expected Edge Cases

- Missing or invalid AWS credentials return HTTP 401 or 403 (`credentials_required` in DirtOS).
- ASINs not available on the configured marketplace return an `Errors` array with code `ItemNotAccessible` (`not_found` in DirtOS).
- Sandbox / inactive associate tags may return `InvalidPartnerTag`.

## Shell Debugger

The `scripts/debug/asin-debug.sh` script mirrors this collection and provides
an interactive REPL and CLI mode:

```bash
# Interactive mode
./scripts/debug/asin-debug.sh

# Single lookup
./scripts/debug/asin-debug.sh lookup B08N5WRWNW

# Lookup sample ASIN
./scripts/debug/asin-debug.sh sample
```

Set credentials in `.env` or export as environment variables before running:

```bash
export AMAZON_PA_ACCESS_KEY=AKIA...
export AMAZON_PA_SECRET_KEY=wJal...
export AMAZON_PA_PARTNER_TAG=mytag-20
export AMAZON_PA_MARKETPLACE=www.amazon.com   # optional, default
```
