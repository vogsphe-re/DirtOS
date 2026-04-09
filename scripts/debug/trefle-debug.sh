#!/usr/bin/env bash
# ============================================================================
# trefle-debug.sh — Interactive Trefle API debugger for DirtOS
#
# Mirrors the API calls made by src-tauri/src/services/trefle.rs:
#   1. Search  — find candidate plants (plants/search)
#   2. Detail  — full enrichment: plant detail + growth + specifications
#
# Reads the Trefle access token from .env (TREFLE_ACCESS_KEY).
#
# Usage:
#   ./scripts/trefle-debug.sh                          # interactive mode
#   ./scripts/trefle-debug.sh search "tomato"          # search directly
#   ./scripts/trefle-debug.sh detail 834               # full detail
# ============================================================================
set -euo pipefail

UA="DirtOS/1.0 (open-source plant tracking application; contact via GitHub)"
BASE="https://trefle.io/api/v1"

# Colours (disabled if not a tty)
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  MAGENTA=$'\033[35m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" MAGENTA="" RESET=""
fi

# Require curl & jq
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# Load Trefle token from .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"

if [[ -f "$ENV_FILE" ]]; then
  TREFLE_TOKEN=$(grep -E '^TREFLE_ACCESS_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
fi

TREFLE_TOKEN="${TREFLE_TOKEN:-${TREFLE_ACCESS_KEY:-}}"

if [[ -z "$TREFLE_TOKEN" ]]; then
  echo "${RED}Error: Trefle access token not found.${RESET}" >&2
  echo "Set TREFLE_ACCESS_KEY in ${ENV_FILE} or export it as an env var." >&2
  exit 1
fi

echo "${DIM}Using token: ${TREFLE_TOKEN:0:12}...${RESET}"
echo

# ---------------------------------------------------------------------------
# Helper: map light value (0-10) to sun requirement label
# ---------------------------------------------------------------------------
map_sun() {
  local val="$1"
  if (( $(echo "$val <= 3" | bc -l) )); then echo "low_light"
  elif (( $(echo "$val <= 6" | bc -l) )); then echo "partial_shade"
  else echo "full_sun"
  fi
}

# ---------------------------------------------------------------------------
# Helper: map soil humidity (0-10) to water requirement label
# ---------------------------------------------------------------------------
map_water() {
  local val="$1"
  if (( $(echo "$val <= 3" | bc -l) )); then echo "low"
  elif (( $(echo "$val <= 6" | bc -l) )); then echo "moderate"
  else echo "high"
  fi
}

# ---------------------------------------------------------------------------
# 1. Search
# ---------------------------------------------------------------------------
trefle_search() {
  local query="${1:?Usage: trefle_search <query> [limit]}"
  local limit="${2:-10}"

  echo "${CYAN}${BOLD}━━━ Trefle Search ━━━${RESET}"
  echo "${DIM}GET ${BASE}/plants/search?q=${query}&token=...${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/plants/search?q=$(jq -Rr @uri <<< "$query")&token=${TREFLE_TOKEN}")

  local http_ok
  http_ok=$(echo "$raw" | jq -e '.data' &>/dev/null && echo "yes" || echo "no")

  if [[ "$http_ok" == "no" ]]; then
    echo "${RED}Search failed or returned unexpected JSON:${RESET}"
    echo "$raw" | jq . 2>/dev/null || echo "$raw"
    return 1
  fi

  local count
  count=$(echo "$raw" | jq '.data | length')
  local total
  total=$(echo "$raw" | jq '.meta.total // 0')

  echo "${GREEN}${count} result(s) shown (${total} total matching):${RESET}"
  echo

  echo "$raw" | jq -r '
    .data | to_entries[] |
    "  \(.key + 1)) [\(.value.id)] \(.value.scientific_name // "—")\n     common: \(.value.common_name // "—")  family: \(.value.family // "—")  genus: \(.value.genus // "—")\n     image: \(.value.image_url // "none")\n"
  '

  LAST_SEARCH_RESULTS="$raw"
}

# ---------------------------------------------------------------------------
# 2. Detail (plant detail with growth + specifications)
# ---------------------------------------------------------------------------
trefle_detail() {
  local plant_id="${1:?Usage: trefle_detail <plant_id>}"

  echo "${CYAN}${BOLD}━━━ Trefle Detail (id=${plant_id}) ━━━${RESET}"
  echo "${DIM}GET ${BASE}/plants/${plant_id}?token=...${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/plants/${plant_id}?token=${TREFLE_TOKEN}")

  local http_ok
  http_ok=$(echo "$raw" | jq -e '.data' &>/dev/null && echo "yes" || echo "no")

  if [[ "$http_ok" == "no" ]]; then
    echo "${RED}Detail fetch failed or returned unexpected JSON:${RESET}"
    echo "$raw" | jq . 2>/dev/null || echo "$raw"
    return 1
  fi

  # --- Basic info ---
  echo "${BOLD}Basic info:${RESET}"
  echo "$raw" | jq '{
    id: .data.id,
    scientific_name: .data.scientific_name,
    common_name: .data.common_name,
    family: .data.family,
    family_common_name: .data.family_common_name,
    genus: .data.genus,
    image_url: .data.image_url
  }'
  echo

  # --- Growth data ---
  echo "${BOLD}Growth data:${RESET}"
  local growth
  growth=$(echo "$raw" | jq '.data.main_species.growth // {}')
  echo "$growth" | jq '{
    light,
    atmospheric_humidity,
    soil_humidity,
    ph_minimum,
    ph_maximum,
    days_to_harvest,
    spread: .spread,
    minimum_temperature: .minimum_temperature,
    maximum_temperature: .maximum_temperature,
    minimum_precipitation: .minimum_precipitation,
    maximum_precipitation: .maximum_precipitation
  }'
  echo

  # Mapped values
  local light soil_hum
  light=$(echo "$growth" | jq -r '.light // empty')
  soil_hum=$(echo "$growth" | jq -r '.soil_humidity // empty')

  if [[ -n "$light" ]]; then
    echo "  ${GREEN}→ light=${light} → sun_requirement=$(map_sun "$light")${RESET}"
  fi
  if [[ -n "$soil_hum" ]]; then
    echo "  ${GREEN}→ soil_humidity=${soil_hum} → water_requirement=$(map_water "$soil_hum")${RESET}"
  fi

  local ph_min ph_max
  ph_min=$(echo "$growth" | jq -r '.ph_minimum // "—"')
  ph_max=$(echo "$growth" | jq -r '.ph_maximum // "—"')
  echo "  ${GREEN}→ soil pH: ${ph_min} – ${ph_max}${RESET}"

  local days_harvest
  days_harvest=$(echo "$growth" | jq -r '.days_to_harvest // "—"')
  echo "  ${GREEN}→ days_to_harvest: ${days_harvest}${RESET}"

  local spread_cm
  spread_cm=$(echo "$growth" | jq -r '.spread.cm // "—"')
  echo "  ${GREEN}→ spread (spacing_cm): ${spread_cm}${RESET}"

  local min_temp_c
  min_temp_c=$(echo "$growth" | jq -r '.minimum_temperature.deg_c // "—"')
  echo "  ${GREEN}→ minimum_temperature: ${min_temp_c}°C${RESET}"
  echo

  # --- Specifications ---
  echo "${BOLD}Specifications:${RESET}"
  echo "$raw" | jq '.data.main_species.specifications // {} | {
    growth_form,
    growth_habit,
    growth_rate,
    ligneous_type,
    average_height: .average_height,
    maximum_height: .maximum_height,
    toxicity
  }'
  echo

  # --- Images ---
  echo "${BOLD}Images:${RESET}"
  local img_count
  img_count=$(echo "$raw" | jq '[.data.main_species.images // {} | to_entries[].value[]] | length')
  echo "  Total images: ${img_count}"
  echo "$raw" | jq -r '
    .data.main_species.images // {} | to_entries[] |
    "  \(.key):" + (
      [.value[] | "    \(.image_url // "—")"] | join("\n")
    )
  ' 2>/dev/null | head -20
  echo

  echo "${DIM}Trefle URL: https://trefle.io/api/v1/plants/${plant_id}${RESET}"
}

# ---------------------------------------------------------------------------
# Interactive loop
# ---------------------------------------------------------------------------
interactive() {
  LAST_SEARCH_RESULTS=""

  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║    DirtOS — Trefle API Debugger              ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Commands:"
  echo "  ${BOLD}search${RESET} <query> [limit]  — Search for plants"
  echo "  ${BOLD}detail${RESET} <plant_id>       — Full plant detail + growth data"
  echo "  ${BOLD}pick${RESET}   <n>              — Pick nth search result → detail"
  echo "  ${BOLD}all${RESET}    <query>           — Search → detail first result"
  echo "  ${BOLD}quit${RESET}                    — Exit"
  echo

  while true; do
    read -rp "${MAGENTA}trefle> ${RESET}" line || break
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      search|s)
        trefle_search "${args[*]:1}" || true
        ;;
      detail|d)
        trefle_detail "${args[1]:-}" || true
        ;;
      pick)
        local n="${args[1]:-1}"
        if [[ -z "$LAST_SEARCH_RESULTS" ]]; then
          echo "${RED}No previous search results. Run 'search' first.${RESET}"
          continue
        fi
        local pk
        pk=$(echo "$LAST_SEARCH_RESULTS" | jq -r ".data[$((n - 1))].id // empty")
        if [[ -z "$pk" ]]; then
          echo "${RED}No result at position ${n}.${RESET}"
          continue
        fi
        echo "${GREEN}Picking result #${n} → id=${pk}${RESET}"
        echo
        trefle_detail "$pk" || true
        ;;
      all|a)
        local query="${args[*]:1}"
        if [[ -z "$query" ]]; then
          echo "${RED}Usage: all <query>${RESET}"
          continue
        fi
        trefle_search "$query" 5 || continue
        local first_id
        first_id=$(echo "$LAST_SEARCH_RESULTS" | jq -r '.data[0].id // empty')
        if [[ -n "$first_id" ]]; then
          echo
          trefle_detail "$first_id" || true
        else
          echo "${YELLOW}No results to detail.${RESET}"
        fi
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
        echo "  Try: search, detail, pick, all, quit"
        ;;
    esac
    echo
  done
}

# ---------------------------------------------------------------------------
# CLI dispatch
# ---------------------------------------------------------------------------
case "${1:-}" in
  search|s)   trefle_search "${2:-}" "${3:-10}" ;;
  detail|d)   trefle_detail "${2:-}" ;;
  "")         interactive ;;
  *)
    echo "Usage: $0 [search <query>|detail <plant_id>]"
    echo "       $0          # interactive mode"
    exit 1
    ;;
esac
