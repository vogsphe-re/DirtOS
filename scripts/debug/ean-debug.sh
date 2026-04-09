#!/usr/bin/env bash
# ============================================================================
# ean-debug.sh — Interactive EAN-Search API debugger for DirtOS
#
# Mirrors key behavior in:
#   - src-tauri/src/services/ean_search.rs
#   - src-tauri/src/commands/seed_store.rs (scan_seed_packet_ean)
#
# Features:
#   1. Barcode normalization (digits only; 8/12/13/14 length)
#   2. Lookup in public mode or with API token
#   3. Burst requests for rate-limit debugging
#
# Token sources (first non-empty wins):
#   1) CLI arg (for lookup/burst auth mode)
#   2) EAN_SEARCH_API_TOKEN / EAN_SEARCH_TOKEN env var
#   3) .env in repo root (EAN_SEARCH_API_TOKEN or EAN_SEARCH_TOKEN)
#
# Usage:
#   ./scripts/debug/ean-debug.sh
#   ./scripts/debug/ean-debug.sh normalize " 5099750442227 "
#   ./scripts/debug/ean-debug.sh lookup 5099750442227
#   ./scripts/debug/ean-debug.sh lookup 5099750442227 "<token>"
#   ./scripts/debug/ean-debug.sh public 5099750442227
#   ./scripts/debug/ean-debug.sh burst 5099750442227 8 250 public
# ============================================================================
set -euo pipefail

UA="DirtOS/1.0 (EAN lookup integration debug script)"
BASE="https://api.ean-search.org/api"
REQUEST_TIMEOUT_SEC=12
PUBLIC_RATE_LIMIT_PER_MINUTE=6
SAMPLE_BARCODE="5099750442227"

# Colours (disabled if not a tty)
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  BLUE=$'\033[34m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" BLUE="" RESET=""
fi

# Require curl, jq, awk
for cmd in curl jq awk; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Request + parse state
REQ_NORMALIZED=""
REQ_QUERY_KEY=""
REQ_HTTP_CODE=""
REQ_BODY=""
LOOKUP_STATUS=""
LOOKUP_EAN_CODE=""
LOOKUP_PRODUCT_NAME=""
LOOKUP_CATEGORY_NAME=""
LOOKUP_ISSUING_COUNTRY=""
LOOKUP_MESSAGE=""

trim() {
  local s="${1-}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

mask_token() {
  local token="${1-}"
  local len=${#token}

  if [[ "$len" -eq 0 ]]; then
    printf '%s' "none"
    return
  fi

  if [[ "$len" -le 8 ]]; then
    printf '%s' "****"
    return
  fi

  printf '%s...%s' "${token:0:4}" "${token: -4}"
}

load_token_from_env_file() {
  local env_file="${1:?Usage: load_token_from_env_file <file>}"
  [[ -f "$env_file" ]] || return 0

  local line raw
  line=$(grep -E '^(EAN_SEARCH_API_TOKEN|EAN_SEARCH_TOKEN)=' "$env_file" | tail -n 1 || true)
  [[ -n "$line" ]] || return 0

  raw="${line#*=}"
  raw="$(trim "$raw")"
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="$(trim "$raw")"

  if [[ -n "$raw" ]]; then
    printf '%s' "$raw"
  fi
}

DEFAULT_TOKEN="${EAN_SEARCH_API_TOKEN:-${EAN_SEARCH_TOKEN:-}}"
if [[ -z "$DEFAULT_TOKEN" ]]; then
  DEFAULT_TOKEN="$(load_token_from_env_file "$ENV_FILE")"
fi
DEFAULT_TOKEN="$(trim "$DEFAULT_TOKEN")"

reset_lookup_state() {
  REQ_NORMALIZED=""
  REQ_QUERY_KEY=""
  REQ_HTTP_CODE=""
  REQ_BODY=""
  LOOKUP_STATUS=""
  LOOKUP_EAN_CODE=""
  LOOKUP_PRODUCT_NAME=""
  LOOKUP_CATEGORY_NAME=""
  LOOKUP_ISSUING_COUNTRY=""
  LOOKUP_MESSAGE=""
}

normalize_barcode() {
  local input="${1-}"
  local normalized
  normalized=$(tr -cd '0-9' <<< "$input")

  case "${#normalized}" in
    8|12|13|14)
      printf '%s' "$normalized"
      ;;
    *)
      return 1
      ;;
  esac
}

effective_rate_limit() {
  local token="${1-}"
  local configured_limit="${2-}"

  if [[ -n "$configured_limit" ]]; then
    if [[ "$configured_limit" =~ ^[0-9]+$ ]] && [[ "$configured_limit" -gt 0 ]]; then
      printf '%s' "$configured_limit"
      return
    fi
    printf '%s' "unlimited"
    return
  fi

  if [[ -n "$token" ]]; then
    printf '%s' "unlimited"
  else
    printf '%s' "$PUBLIC_RATE_LIMIT_PER_MINUTE"
  fi
}

numeric_limit_for_messages() {
  local effective_limit="${1-}"
  if [[ "$effective_limit" =~ ^[0-9]+$ ]]; then
    printf '%s' "$effective_limit"
  else
    printf '%s' "$PUBLIC_RATE_LIMIT_PER_MINUTE"
  fi
}

lookup_status_color() {
  case "$1" in
    success) echo "$GREEN" ;;
    not_found|rate_limited|token_required|skipped) echo "$YELLOW" ;;
    *) echo "$RED" ;;
  esac
}

parse_lookup_response() {
  local barcode="${1:?Usage: parse_lookup_response <barcode> <body> <token_present> <limit_per_minute>}"
  local body="${2:?Usage: parse_lookup_response <barcode> <body> <token_present> <limit_per_minute>}"
  local token_present="${3:?Usage: parse_lookup_response <barcode> <body> <token_present> <limit_per_minute>}"
  local limit_per_minute="${4:?Usage: parse_lookup_response <barcode> <body> <token_present> <limit_per_minute>}"

  local rows first api_error lower

  if ! rows=$(echo "$body" | jq -c '
      if type == "array" then .
      elif type == "object" then [.]
      else []
      end
    ' 2>/dev/null); then
    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="Failed to parse EAN-Search response"
    return
  fi

  if [[ "$(echo "$rows" | jq 'length')" -eq 0 ]]; then
    LOOKUP_STATUS="not_found"
    LOOKUP_MESSAGE="No matching product was found in EAN-Search"
    return
  fi

  first=$(echo "$rows" | jq '.[0]')
  api_error=$(echo "$first" | jq -r '(.error // "" | gsub("^\\s+|\\s+$"; ""))')

  if [[ -n "$api_error" ]]; then
    lower="${api_error,,}"

    if [[ "$lower" == *rate* && "$lower" == *limit* ]]; then
      LOOKUP_STATUS="rate_limited"
      LOOKUP_MESSAGE="${api_error} (limit: ${limit_per_minute}/min)"
      return
    fi

    if [[ "$lower" == *"invalid token"* || ( "$lower" == *token* && "$token_present" == "0" ) ]]; then
      LOOKUP_STATUS="token_required"
      LOOKUP_MESSAGE="EAN-Search rejected anonymous access. Add an API token in Settings to enable enrichment."
      return
    fi

    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="$api_error"
    return
  fi

  LOOKUP_PRODUCT_NAME=$(echo "$first" | jq -r '(.name // "" | gsub("^\\s+|\\s+$"; ""))')
  if [[ -z "$LOOKUP_PRODUCT_NAME" ]]; then
    LOOKUP_STATUS="not_found"
    LOOKUP_MESSAGE="No matching product was found in EAN-Search"
    return
  fi

  LOOKUP_STATUS="success"
  LOOKUP_EAN_CODE=$(echo "$first" | jq -r '(.ean // "" | gsub("^\\s+|\\s+$"; ""))')
  [[ -z "$LOOKUP_EAN_CODE" ]] && LOOKUP_EAN_CODE="$barcode"
  LOOKUP_CATEGORY_NAME=$(echo "$first" | jq -r '(.categoryName // "" | gsub("^\\s+|\\s+$"; ""))')
  LOOKUP_ISSUING_COUNTRY=$(echo "$first" | jq -r '(.issuingCountry // "" | gsub("^\\s+|\\s+$"; ""))')
  LOOKUP_MESSAGE=""
}

perform_lookup() {
  local raw_input="${1:?Usage: perform_lookup <barcode> [token] [configured_limit]}"
  local token="${2-}"
  local configured_limit="${3-}"

  reset_lookup_state

  token="$(trim "$token")"

  if ! REQ_NORMALIZED=$(normalize_barcode "$raw_input"); then
    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="EAN/UPC must contain 8, 12, 13, or 14 digits"
    return 1
  fi

  REQ_QUERY_KEY="ean"
  [[ "${#REQ_NORMALIZED}" -eq 12 ]] && REQ_QUERY_KEY="upc"

  local effective_limit
  effective_limit=$(effective_rate_limit "$token" "$configured_limit")
  local limit_for_messages
  limit_for_messages=$(numeric_limit_for_messages "$effective_limit")
  local token_present="0"
  [[ -n "$token" ]] && token_present="1"

  local -a curl_args
  curl_args=(
    -sS
    --max-time "$REQUEST_TIMEOUT_SEC"
    -G "$BASE"
    -H "User-Agent: ${UA}"
    -H "Accept: application/json"
    --data-urlencode "op=barcode-lookup"
    --data-urlencode "format=json"
    --data-urlencode "${REQ_QUERY_KEY}=${REQ_NORMALIZED}"
  )

  if [[ -n "$token" ]]; then
    curl_args+=(--data-urlencode "token=${token}")
  fi

  local response
  if ! response=$(curl "${curl_args[@]}" -w '\n%{http_code}' 2>&1); then
    REQ_HTTP_CODE="000"
    REQ_BODY=""
    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="EAN-Search request failed: ${response}"
    return 1
  fi

  REQ_HTTP_CODE=$(echo "$response" | tail -1)
  REQ_BODY=$(echo "$response" | sed '$d')

  if [[ "$REQ_HTTP_CODE" == "429" ]]; then
    LOOKUP_STATUS="rate_limited"
    LOOKUP_MESSAGE="EAN-Search returned HTTP 429 (too many requests) (limit: ${limit_for_messages}/min)"
    return 0
  fi

  if [[ ! "$REQ_HTTP_CODE" =~ ^2[0-9][0-9]$ ]]; then
    LOOKUP_STATUS="error"
    LOOKUP_MESSAGE="EAN-Search returned HTTP ${REQ_HTTP_CODE}"
    return 0
  fi

  parse_lookup_response "$REQ_NORMALIZED" "$REQ_BODY" "$token_present" "$limit_for_messages"
  return 0
}

print_lookup_payload_json() {
  jq -n \
    --arg ean "$LOOKUP_EAN_CODE" \
    --arg product "$LOOKUP_PRODUCT_NAME" \
    --arg category "$LOOKUP_CATEGORY_NAME" \
    --arg country "$LOOKUP_ISSUING_COUNTRY" \
    --arg status "$LOOKUP_STATUS" \
    --arg message "$LOOKUP_MESSAGE" \
    '{
      ean_code: $ean,
      product_name: (if ($product | length) == 0 then null else $product end),
      category_name: (if ($category | length) == 0 then null else $category end),
      issuing_country: (if ($country | length) == 0 then null else $country end),
      lookup_status: $status,
      message: (if ($message | length) == 0 then null else $message end)
    }'
}

normalize_command() {
  local raw_input="${1:?Usage: normalize <barcode>}"

  echo "${CYAN}${BOLD}━━━ EAN Normalize ━━━${RESET}"
  echo "input:      ${raw_input}"

  local normalized
  if ! normalized=$(normalize_barcode "$raw_input"); then
    echo "${RED}error: EAN/UPC must contain 8, 12, 13, or 14 digits${RESET}"
    return 1
  fi

  local kind="EAN"
  [[ "${#normalized}" -eq 12 ]] && kind="UPC"

  echo "normalized: ${normalized}"
  echo "length:     ${#normalized} (${kind})"
}

lookup_command() {
  local raw_input="${1:?Usage: lookup <barcode> [token]}"
  local token="${2-}"
  local configured_limit="${3-}"

  token="$(trim "$token")"
  local mode="public"
  [[ -n "$token" ]] && mode="auth"

  local effective_limit
  effective_limit=$(effective_rate_limit "$token" "$configured_limit")

  perform_lookup "$raw_input" "$token" "$configured_limit" || true

  local status_color
  status_color=$(lookup_status_color "$LOOKUP_STATUS")

  echo "${CYAN}${BOLD}━━━ EAN Lookup ━━━${RESET}"
  echo "mode:               ${mode}"
  echo "token:              $(mask_token "$token")"
  echo "effective limit:    ${effective_limit}/min"
  echo "request base:       ${BASE}"
  [[ -n "$REQ_NORMALIZED" ]] && echo "normalized barcode: ${REQ_NORMALIZED} (${REQ_QUERY_KEY})"
  [[ -n "$REQ_HTTP_CODE" ]] && echo "HTTP status:        ${REQ_HTTP_CODE}"
  echo

  echo "${status_color}${BOLD}lookup_status: ${LOOKUP_STATUS}${RESET}"
  if [[ -n "$LOOKUP_MESSAGE" ]]; then
    echo "message:       ${LOOKUP_MESSAGE}"
  fi

  if [[ "$LOOKUP_STATUS" == "success" ]]; then
    echo "ean_code:      ${LOOKUP_EAN_CODE}"
    echo "product_name:  ${LOOKUP_PRODUCT_NAME}"
    echo "category_name: ${LOOKUP_CATEGORY_NAME:-<none>}"
    echo "issuing_country: ${LOOKUP_ISSUING_COUNTRY:-<none>}"
  fi

  echo
  echo "${DIM}SeedEanLookup-equivalent payload:${RESET}"
  print_lookup_payload_json | jq .

  if [[ -n "$REQ_BODY" ]]; then
    echo
    echo "${DIM}Raw response:${RESET}"
    echo "$REQ_BODY" | jq . 2>/dev/null || echo "$REQ_BODY"
  fi
}

public_lookup_command() {
  local raw_input="${1:?Usage: public <barcode>}"
  lookup_command "$raw_input" ""
}

burst_command() {
  local raw_input="${1:?Usage: burst <barcode> [count] [delay_ms] [public|auth] [token]}"
  local count="${2:-8}"
  local delay_ms="${3:-250}"
  local mode="${4:-auto}"
  local token_arg="${5-}"

  if [[ ! "$count" =~ ^[0-9]+$ ]] || [[ "$count" -lt 1 ]]; then
    echo "${RED}Error: count must be a positive integer.${RESET}" >&2
    return 1
  fi

  if [[ ! "$delay_ms" =~ ^[0-9]+$ ]]; then
    echo "${RED}Error: delay_ms must be an integer.${RESET}" >&2
    return 1
  fi

  local token=""
  case "$mode" in
    public)
      token=""
      ;;
    auth)
      token="${token_arg:-$DEFAULT_TOKEN}"
      ;;
    auto|"")
      token="${token_arg:-$DEFAULT_TOKEN}"
      ;;
    *)
      echo "${RED}Error: mode must be one of: public, auth, auto.${RESET}" >&2
      return 1
      ;;
  esac

  token="$(trim "$token")"
  local mode_label="public"
  [[ -n "$token" ]] && mode_label="auth"

  local delay_s
  delay_s=$(awk -v ms="$delay_ms" 'BEGIN { printf "%.3f", ms / 1000 }')

  local success_count=0
  local not_found_count=0
  local rate_limited_count=0
  local token_required_count=0
  local error_count=0

  echo "${CYAN}${BOLD}━━━ EAN Burst Lookup ━━━${RESET}"
  echo "barcode:       ${raw_input}"
  echo "requests:      ${count}"
  echo "delay:         ${delay_ms}ms"
  echo "mode:          ${mode_label}"
  echo "token:         $(mask_token "$token")"
  echo

  local i
  for ((i = 1; i <= count; i++)); do
    perform_lookup "$raw_input" "$token" || true

    local status_color
    status_color=$(lookup_status_color "$LOOKUP_STATUS")

    case "$LOOKUP_STATUS" in
      success) ((success_count += 1)) ;;
      not_found) ((not_found_count += 1)) ;;
      rate_limited) ((rate_limited_count += 1)) ;;
      token_required) ((token_required_count += 1)) ;;
      *) ((error_count += 1)) ;;
    esac

    local summary="$LOOKUP_STATUS"
    if [[ "$LOOKUP_STATUS" == "success" ]]; then
      summary+=" :: ${LOOKUP_PRODUCT_NAME}"
    elif [[ -n "$LOOKUP_MESSAGE" ]]; then
      summary+=" :: ${LOOKUP_MESSAGE}"
    fi

    printf "%s[%02d/%02d] HTTP %s  %s%s%s\n" \
      "$BLUE" "$i" "$count" "${REQ_HTTP_CODE:----}" "$status_color" "$summary" "$RESET"

    if [[ "$i" -lt "$count" ]] && [[ "$delay_ms" -gt 0 ]]; then
      sleep "$delay_s"
    fi
  done

  echo
  echo "${BOLD}Burst summary:${RESET}"
  echo "  success:        ${success_count}"
  echo "  not_found:      ${not_found_count}"
  echo "  rate_limited:   ${rate_limited_count}"
  echo "  token_required: ${token_required_count}"
  echo "  error:          ${error_count}"
}

interactive() {
  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║    DirtOS — EAN-Search API Debugger         ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Detected token: $(mask_token "$DEFAULT_TOKEN")"
  echo "Sample barcode: ${SAMPLE_BARCODE}"
  echo
  echo "Commands:"
  echo "  ${BOLD}normalize${RESET} <barcode>                          — Normalize and validate"
  echo "  ${BOLD}lookup${RESET}    <barcode> [token]                  — Lookup (token optional)"
  echo "  ${BOLD}public${RESET}    <barcode>                          — Force public mode"
  echo "  ${BOLD}burst${RESET}     <barcode> [n] [delay_ms] [mode] [token]"
  echo "                                             mode: public|auth|auto"
  echo "  ${BOLD}sample${RESET}                                      — Lookup sample barcode"
  echo "  ${BOLD}quit${RESET}                                        — Exit"
  echo

  while true; do
    read -rp "${BLUE}ean> ${RESET}" line || break
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      normalize|n)
        normalize_command "${args[1]:-}" || true
        ;;
      lookup|l)
        local token="${args[2]:-$DEFAULT_TOKEN}"
        lookup_command "${args[1]:-}" "$token" || true
        ;;
      public|p)
        public_lookup_command "${args[1]:-}" || true
        ;;
      burst|b)
        burst_command \
          "${args[1]:-}" \
          "${args[2]:-8}" \
          "${args[3]:-250}" \
          "${args[4]:-auto}" \
          "${args[5]:-}" || true
        ;;
      sample)
        lookup_command "$SAMPLE_BARCODE" "$DEFAULT_TOKEN" || true
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
        echo "  Try: normalize, lookup, public, burst, sample, quit"
        ;;
    esac

    echo
  done
}

case "${1:-}" in
  normalize|n)
    normalize_command "${*:2}"
    ;;
  lookup|l)
    lookup_command "${2:-}" "${3:-$DEFAULT_TOKEN}"
    ;;
  public|p)
    public_lookup_command "${2:-}"
    ;;
  burst|b)
    burst_command "${2:-}" "${3:-8}" "${4:-250}" "${5:-auto}" "${6:-}"
    ;;
  sample)
    lookup_command "$SAMPLE_BARCODE" "$DEFAULT_TOKEN"
    ;;
  "")
    interactive
    ;;
  *)
    echo "Usage: $0 [normalize <barcode>|lookup <barcode> [token]|public <barcode>|burst <barcode> [count] [delay_ms] [public|auth|auto] [token]|sample]"
    echo "       $0   # interactive mode"
    exit 1
    ;;
esac