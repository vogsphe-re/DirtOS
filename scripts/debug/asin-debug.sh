#!/usr/bin/env bash
# ============================================================================
# asin-debug.sh — Interactive Amazon PA API debugger for DirtOS
#
# Mirrors the API calls made by:
#   src-tauri/src/services/amazon_asin.rs (lookup_asin, sign_request)
#   src-tauri/src/commands/seed_store.rs  (scan_seed_packet_asin)
#
# Reads Amazon PA API credentials from .env:
#   AMAZON_PA_ACCESS_KEY   — AWS access key ID
#   AMAZON_PA_SECRET_KEY   — AWS secret access key
#   AMAZON_PA_PARTNER_TAG  — Amazon Associates partner tag
#   AMAZON_PA_MARKETPLACE  — Marketplace host (default: www.amazon.com)
#
# Usage:
#   ./scripts/debug/asin-debug.sh                    # interactive mode
#   ./scripts/debug/asin-debug.sh normalize <asin>   # normalize and validate
#   ./scripts/debug/asin-debug.sh lookup <asin>      # lookup via PA API
#   ./scripts/debug/asin-debug.sh sample             # lookup built-in sample
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Colours (disabled if not a tty)
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  BLUE=$'\033[34m' MAGENTA=$'\033[35m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" BLUE="" MAGENTA="" RESET=""
fi

# ---------------------------------------------------------------------------
# Required tools
# ---------------------------------------------------------------------------
for cmd in curl jq openssl awk; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Locate project root and .env
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="${PROJECT_ROOT}/.env"

# ---------------------------------------------------------------------------
# Load credentials from .env (env vars take precedence)
# ---------------------------------------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  _ACCESS_KEY_FROM_ENV=$(grep -E '^AMAZON_PA_ACCESS_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _SECRET_KEY_FROM_ENV=$(grep -E '^AMAZON_PA_SECRET_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _PARTNER_TAG_FROM_ENV=$(grep -E '^AMAZON_PA_PARTNER_TAG=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
  _MARKETPLACE_FROM_ENV=$(grep -E '^AMAZON_PA_MARKETPLACE=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]' || true)
fi

AMAZON_ACCESS_KEY="${AMAZON_PA_ACCESS_KEY:-${_ACCESS_KEY_FROM_ENV:-}}"
AMAZON_SECRET_KEY="${AMAZON_PA_SECRET_KEY:-${_SECRET_KEY_FROM_ENV:-}}"
AMAZON_PARTNER_TAG="${AMAZON_PA_PARTNER_TAG:-${_PARTNER_TAG_FROM_ENV:-}}"
AMAZON_MARKETPLACE="${AMAZON_PA_MARKETPLACE:-${_MARKETPLACE_FROM_ENV:-www.amazon.com}}"

# ---------------------------------------------------------------------------
# Sample ASIN and state variables
# ---------------------------------------------------------------------------
SAMPLE_ASIN="B08N5WRWNW"

# Per-request state (populated by perform_lookup)
REQ_HTTP_CODE=""
REQ_DURATION_MS=""
REQ_RESPONSE_BODY=""

# Per-lookup results (populated by parse_lookup_response)
LOOKUP_ASIN=""
LOOKUP_TITLE=""
LOOKUP_BRAND=""
LOOKUP_URL=""
LOOKUP_STATUS=""
LOOKUP_MESSAGE=""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; echo "$s"; }

mask_cred() {
  local s="$1"
  [[ -z "$s" ]] && echo "(not set)" && return
  echo "${s:0:4}…(masked)"
}

# ---------------------------------------------------------------------------
# normalize_asin — strip non-alphanumeric, uppercase, validate 10 chars
# ---------------------------------------------------------------------------
normalize_asin() {
  local raw="$1"
  # Strip any whitespace and dashes
  local stripped
  stripped=$(echo "$raw" | tr -d '[:space:]-' | tr '[:lower:]' '[:upper:]')
  # Keep only alphanumeric characters
  stripped=$(echo "$stripped" | tr -cd '[:alnum:]')

  if [[ ${#stripped} -ne 10 ]]; then
    echo "${RED}Error: ASIN must be exactly 10 alphanumeric characters (got ${#stripped} after normalizing '${raw}').${RESET}" >&2
    return 1
  fi
  echo "$stripped"
}

# ---------------------------------------------------------------------------
# lookup_status_color — ANSI color for a lookup status string
# ---------------------------------------------------------------------------
lookup_status_color() {
  case "$1" in
    success)              echo "$GREEN" ;;
    not_found)            echo "$YELLOW" ;;
    credentials_required) echo "$MAGENTA" ;;
    error)                echo "$RED" ;;
    *)                    echo "$DIM" ;;
  esac
}

# ---------------------------------------------------------------------------
# Marketplace routing — maps host to AWS region (same logic as amazon_asin.rs)
# ---------------------------------------------------------------------------
marketplace_region() {
  case "$1" in
    www.amazon.com|webservices.amazon.com)          echo "us-east-1" ;;
    www.amazon.co.uk|webservices.amazon.co.uk)      echo "eu-west-1" ;;
    www.amazon.de|webservices.amazon.de)            echo "eu-west-1" ;;
    www.amazon.fr|webservices.amazon.fr)            echo "eu-west-1" ;;
    www.amazon.it|webservices.amazon.it)            echo "eu-west-1" ;;
    www.amazon.es|webservices.amazon.es)            echo "eu-west-1" ;;
    www.amazon.co.jp|webservices.amazon.co.jp)      echo "us-west-2" ;;
    www.amazon.com.au|webservices.amazon.com.au)    echo "us-west-2" ;;
    www.amazon.ca|webservices.amazon.ca)            echo "us-east-1" ;;
    www.amazon.in|webservices.amazon.in)            echo "eu-west-1" ;;
    *)                                              echo "us-east-1" ;;
  esac
}

# Normalise the marketplace to the webservices hostname used in HTTP calls
marketplace_endpoint() {
  local host="$1"
  case "$host" in
    webservices.*)  echo "$host" ;;
    www.*)          echo "webservices.${host#www.}" ;;
    *)              echo "webservices.${host}" ;;
  esac
}

# ---------------------------------------------------------------------------
# hmac_sha256 — sign a message with a key using HMAC-SHA256
# Returns raw binary piped through xxd for derived-key chaining.
#
# Usage:
#   hmac_sha256_hex  <string-key> <string-message>  → hex output
#   hmac_sha256_bin  <hex-key>    <string-message>  → hex output (key is hex)
# ---------------------------------------------------------------------------
hmac_sha256_hex() {
  local key="$1"
  local msg="$2"
  printf '%s' "$msg" | openssl dgst -sha256 -hmac "$key" 2>/dev/null | awk '{print $NF}'
}

hmac_sha256_bin() {
  local key_hex="$1"
  local msg="$2"
  printf '%s' "$msg" \
    | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${key_hex}" 2>/dev/null \
    | awk '{print $NF}'
}

# ---------------------------------------------------------------------------
# sha256_hex — SHA-256 hash of a string, returns lowercase hex
# ---------------------------------------------------------------------------
sha256_hex() {
  printf '%s' "$1" | openssl dgst -sha256 2>/dev/null | awk '{print $NF}'
}

# ---------------------------------------------------------------------------
# derive_signing_key — AWS Sig V4 key derivation matching amazon_asin.rs
#   kDate     = HMAC-SHA256("AWS4" + secret_key, date_stamp)
#   kRegion   = HMAC-SHA256(kDate, region)
#   kService  = HMAC-SHA256(kRegion, "ProductAdvertisingAPI")
#   kSigning  = HMAC-SHA256(kService, "aws4_request")
# Returns the final signing key as lowercase hex.
# ---------------------------------------------------------------------------
derive_signing_key() {
  local secret_key="$1"
  local date_stamp="$2"   # YYYYMMDD
  local region="$3"

  local k_date
  k_date=$(hmac_sha256_hex "AWS4${secret_key}" "$date_stamp")

  local k_region
  k_region=$(hmac_sha256_bin "$k_date" "$region")

  local k_service
  k_service=$(hmac_sha256_bin "$k_region" "ProductAdvertisingAPI")

  local k_signing
  k_signing=$(hmac_sha256_bin "$k_service" "aws4_request")

  echo "$k_signing"
}

# ---------------------------------------------------------------------------
# sign_request — Build AWS Sig V4 Authorization header
#   Matches the signing logic in amazon_asin.rs::sign_request()
# ---------------------------------------------------------------------------
sign_request() {
  local access_key="$1"
  local secret_key="$2"
  local region="$3"
  local host="$4"           # webservices.amazon.com (no scheme)
  local amz_date="$5"       # ISO8601 UTC: 20260101T120000Z
  local date_stamp="$6"     # YYYYMMDD
  local payload="$7"        # raw JSON body

  local method="POST"
  local uri="/paapi5/getitems"
  local query_string=""

  local payload_hash
  payload_hash=$(sha256_hex "$payload")

  local canonical_headers="content-encoding:amz-1.0
content-type:application/json; charset=utf-8
host:${host}
x-amz-date:${amz_date}
x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems
"
  local signed_headers="content-encoding;content-type;host;x-amz-date;x-amz-target"

  local canonical_request="${method}
${uri}
${query_string}
${canonical_headers}
${signed_headers}
${payload_hash}"

  local credential_scope="${date_stamp}/${region}/ProductAdvertisingAPI/aws4_request"
  local canonical_hash
  canonical_hash=$(sha256_hex "$canonical_request")

  local string_to_sign="AWS4-HMAC-SHA256
${amz_date}
${credential_scope}
${canonical_hash}"

  local signing_key
  signing_key=$(derive_signing_key "$secret_key" "$date_stamp" "$region")

  local signature
  signature=$(hmac_sha256_bin "$signing_key" "$string_to_sign")

  echo "AWS4-HMAC-SHA256 Credential=${access_key}/${credential_scope}, SignedHeaders=${signed_headers}, Signature=${signature}"
}

# ---------------------------------------------------------------------------
# parse_lookup_response — map PA API JSON to LOOKUP_* state variables
# ---------------------------------------------------------------------------
parse_lookup_response() {
  local asin="$1"
  local body="$2"
  local http_code="$3"

  LOOKUP_ASIN="$asin"
  LOOKUP_TITLE=""
  LOOKUP_BRAND=""
  LOOKUP_URL=""
  LOOKUP_STATUS="error"
  LOOKUP_MESSAGE=""

  if [[ "$http_code" == "200" ]]; then
    local item_count
    item_count=$(echo "$body" | jq -r '.ItemsResult.Items | length' 2>/dev/null || echo "0")

    if [[ "$item_count" -gt 0 ]]; then
      LOOKUP_TITLE=$(echo "$body" | jq -r '.ItemsResult.Items[0].ItemInfo.Title.DisplayValue // ""' 2>/dev/null)
      LOOKUP_BRAND=$(echo "$body" | jq -r '.ItemsResult.Items[0].ItemInfo.ByLineInfo.Brand.DisplayValue // ""' 2>/dev/null)
      LOOKUP_URL=$(echo "$body" | jq -r '.ItemsResult.Items[0].DetailPageURL // ""' 2>/dev/null)
      LOOKUP_ASIN=$(echo "$body" | jq -r '.ItemsResult.Items[0].ASIN // "'"$asin"'"' 2>/dev/null)
      LOOKUP_STATUS="success"
    else
      # Check for Errors array
      local err_code
      err_code=$(echo "$body" | jq -r '.Errors[0].Code // ""' 2>/dev/null)
      local err_msg
      err_msg=$(echo "$body" | jq -r '.Errors[0].Message // "No product found for ASIN"' 2>/dev/null)

      if [[ "$err_code" == "ItemNotAccessible" || "$err_code" == "InvalidParameterValue" ]]; then
        LOOKUP_STATUS="not_found"
        LOOKUP_MESSAGE="$err_msg"
      else
        LOOKUP_STATUS="not_found"
        LOOKUP_MESSAGE="No matching product was found in the Amazon catalog"
      fi
    fi
  elif [[ "$http_code" == "400" ]]; then
    local err_msg
    err_msg=$(echo "$body" | jq -r '.Errors[0].Message // "Bad request"' 2>/dev/null)
    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="HTTP 400: ${err_msg}"
  elif [[ "$http_code" == "401" || "$http_code" == "403" ]]; then
    LOOKUP_STATUS="credentials_required"
    LOOKUP_MESSAGE="Invalid or missing AWS credentials (HTTP ${http_code})"
  else
    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="HTTP ${http_code}: $(echo "$body" | jq -r '.Errors[0].Message // "Unknown error"' 2>/dev/null)"
  fi
}

# ---------------------------------------------------------------------------
# perform_lookup — sign and POST to PA API, populate REQ_* and parse result
# ---------------------------------------------------------------------------
perform_lookup() {
  local raw_asin="$1"
  local access_key="${2:-$AMAZON_ACCESS_KEY}"
  local secret_key="${3:-$AMAZON_SECRET_KEY}"
  local partner_tag="${4:-$AMAZON_PARTNER_TAG}"
  local marketplace="${5:-$AMAZON_MARKETPLACE}"

  # Validate credentials
  if [[ -z "$access_key" || -z "$secret_key" ]]; then
    LOOKUP_STATUS="credentials_required"
    LOOKUP_MESSAGE="AMAZON_PA_ACCESS_KEY and AMAZON_PA_SECRET_KEY are required"
    REQ_HTTP_CODE=""
    REQ_DURATION_MS=""
    REQ_RESPONSE_BODY=""
    return 0
  fi

  local asin
  asin=$(normalize_asin "$raw_asin") || return 1

  local host
  host=$(marketplace_endpoint "$marketplace")
  local region
  region=$(marketplace_region "$host")

  # Build timestamps
  local amz_date date_stamp
  amz_date=$(TZ=UTC date +"%Y%m%dT%H%M%SZ")
  date_stamp="${amz_date:0:8}"

  # Build request payload
  local payload
  payload=$(jq -nc \
    --arg pt "$partner_tag" \
    --arg mp "$marketplace" \
    --arg asin "$asin" \
    '{
      "ItemIds": [$asin],
      "ItemIdType": "ASIN",
      "Resources": [
        "ItemInfo.Title",
        "ItemInfo.ByLineInfo",
        "ItemInfo.ProductInfo",
        "Images.Primary.Medium",
        "Offers.Listings.Price"
      ],
      "PartnerTag": $pt,
      "PartnerType": "Associates",
      "Marketplace": $mp
    }')

  # Sign the request
  local auth_header
  auth_header=$(sign_request \
    "$access_key" "$secret_key" "$region" "$host" \
    "$amz_date" "$date_stamp" "$payload")

  # Execute the request
  local start_ms end_ms
  start_ms=$(date +%s%3N)

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://${host}/paapi5/getitems" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Content-Encoding: amz-1.0" \
    -H "X-Amz-Date: ${amz_date}" \
    -H "X-Amz-Target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems" \
    -H "Authorization: ${auth_header}" \
    -d "$payload" 2>/dev/null)

  end_ms=$(date +%s%3N)
  REQ_DURATION_MS=$(( end_ms - start_ms ))

  REQ_HTTP_CODE=$(echo "$response" | tail -n1)
  REQ_RESPONSE_BODY=$(echo "$response" | head -n -1)

  parse_lookup_response "$asin" "$REQ_RESPONSE_BODY" "$REQ_HTTP_CODE"
}

# ---------------------------------------------------------------------------
# print_lookup_payload_json — print SeedAsinLookup-equivalent JSON
# ---------------------------------------------------------------------------
print_lookup_payload_json() {
  jq -n \
    --arg asin          "$LOOKUP_ASIN" \
    --arg title         "$LOOKUP_TITLE" \
    --arg brand         "$LOOKUP_BRAND" \
    --arg url           "$LOOKUP_URL" \
    --arg status        "$LOOKUP_STATUS" \
    --arg message       "$LOOKUP_MESSAGE" \
    '{
      asin:          $asin,
      title:         (if $title   != "" then $title   else null end),
      brand:         (if $brand   != "" then $brand   else null end),
      product_url:   (if $url     != "" then $url     else null end),
      lookup_status: $status,
      message:       (if $message != "" then $message else null end)
    }'
}

# ---------------------------------------------------------------------------
# normalize_command
# ---------------------------------------------------------------------------
normalize_command() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    echo "${RED}Usage: normalize <asin>${RESET}" >&2
    return 1
  fi

  echo "${BOLD}Input:${RESET}      ${raw}"

  local normalised
  normalised=$(normalize_asin "$raw") || return 1

  echo "${BOLD}Normalized:${RESET} ${GREEN}${normalised}${RESET}"
  echo "${BOLD}Length:${RESET}     ${#normalised}"
}

# ---------------------------------------------------------------------------
# lookup_command
# ---------------------------------------------------------------------------
lookup_command() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    echo "${RED}Usage: lookup <asin>${RESET}" >&2
    return 1
  fi

  echo "${DIM}Looking up ASIN: ${raw}${RESET}"
  echo "${DIM}Marketplace:     ${AMAZON_MARKETPLACE}${RESET}"
  echo "${DIM}Access key:      $(mask_cred "$AMAZON_ACCESS_KEY")${RESET}"
  echo "${DIM}Partner tag:     $(mask_cred "$AMAZON_PARTNER_TAG")${RESET}"
  echo

  perform_lookup "$raw" || return 1

  local status_color
  status_color=$(lookup_status_color "$LOOKUP_STATUS")

  echo "${CYAN}${BOLD}━━━ PA API Lookup Result ━━━${RESET}"
  printf "Status:     %s%s%s\n"  "$status_color" "$LOOKUP_STATUS" "$RESET"
  printf "HTTP code:  %s\n"      "${REQ_HTTP_CODE:-(no request)}"
  printf "Duration:   %sms\n"    "${REQ_DURATION_MS:-—}"
  echo

  if [[ "$LOOKUP_STATUS" == "success" ]]; then
    printf "ASIN:       %s\n" "$LOOKUP_ASIN"
    printf "Title:      %s\n" "${LOOKUP_TITLE:-(none)}"
    printf "Brand:      %s\n" "${LOOKUP_BRAND:-(none)}"
    printf "URL:        %s\n" "${LOOKUP_URL:-(none)}"
  else
    printf "Message:    %s\n" "${LOOKUP_MESSAGE:-(none)}"
  fi

  echo
  echo "${DIM}${BOLD}JSON payload (SeedAsinLookup):${RESET}"
  print_lookup_payload_json
}

# ---------------------------------------------------------------------------
# interactive REPL
# ---------------------------------------------------------------------------
interactive() {
  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║   DirtOS — Amazon PA API ASIN Debugger      ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Credentials:"
  echo "  Access key:   $(mask_cred "$AMAZON_ACCESS_KEY")"
  echo "  Secret key:   $(mask_cred "$AMAZON_SECRET_KEY")"
  echo "  Partner tag:  $(mask_cred "$AMAZON_PARTNER_TAG")"
  echo "  Marketplace:  ${AMAZON_MARKETPLACE}"
  echo
  echo "Sample ASIN: ${SAMPLE_ASIN}"
  echo
  echo "Commands:"
  echo "  ${BOLD}normalize${RESET} <asin>     — Normalize and validate an ASIN"
  echo "  ${BOLD}lookup${RESET}    <asin>     — Lookup via Amazon PA API"
  echo "  ${BOLD}sample${RESET}               — Lookup sample ASIN (${SAMPLE_ASIN})"
  echo "  ${BOLD}creds${RESET}                — Show current credential state"
  echo "  ${BOLD}quit${RESET}                 — Exit"
  echo

  while true; do
    read -rp "${BLUE}asin> ${RESET}" line || break
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      normalize|n)
        normalize_command "${args[1]:-}" || true
        ;;
      lookup|l)
        lookup_command "${args[1]:-}" || true
        ;;
      sample)
        lookup_command "$SAMPLE_ASIN" || true
        ;;
      creds)
        echo "Access key:   $(mask_cred "$AMAZON_ACCESS_KEY")"
        echo "Secret key:   $(mask_cred "$AMAZON_SECRET_KEY")"
        echo "Partner tag:  $(mask_cred "$AMAZON_PARTNER_TAG")"
        echo "Marketplace:  ${AMAZON_MARKETPLACE}"
        ;;
      quit|q|exit)
        echo "Bye."
        break
        ;;
      "")
        continue
        ;;
      *)
        echo "${YELLOW}Unknown command: ${cmd}${RESET}"
        echo "  Try: normalize, lookup, sample, creds, quit"
        ;;
    esac

    echo
  done
}

# ---------------------------------------------------------------------------
# CLI dispatcher
# ---------------------------------------------------------------------------
case "${1:-}" in
  normalize|n)
    normalize_command "${*:2}"
    ;;
  lookup|l)
    lookup_command "${2:-}"
    ;;
  sample)
    lookup_command "$SAMPLE_ASIN"
    ;;
  "")
    interactive
    ;;
  *)
    echo "Usage: $0 [normalize <asin>|lookup <asin>|sample]"
    echo "       $0   # interactive mode"
    exit 1
    ;;
esac
