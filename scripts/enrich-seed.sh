#!/usr/bin/env bash
# ============================================================================
# enrich-seed.sh — Enrich src-tauri/seed/species.json with temperature and
# image data from the Trefle API.
#
# Adds the following fields to each entry (only when absent or null):
#   min_temperature_c   — Trefle: main_species.growth.minimum_temperature.deg_c
#   max_temperature_c   — Trefle: main_species.growth.maximum_temperature.deg_c
#   image_url           — Trefle: image_url (first search result)
#
# Reads TREFLE_ACCESS_KEY from <project-root>/.env or the environment.
# Skips any entry whose scientific_name is absent or whose Trefle fields are
# already fully populated.
#
# Usage:
#   ./scripts/enrich-seed.sh            # enrich all entries in-place
#   ./scripts/enrich-seed.sh --dry-run  # show changes without writing
#   ./scripts/enrich-seed.sh --help
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SEED_FILE="${PROJECT_ROOT}/src-tauri/seed/species.json"
ENV_FILE="${PROJECT_ROOT}/.env"
UA="DirtOS/1.0 (open-source plant tracking application; contact via GitHub)"
TREFLE_BASE="https://trefle.io/api/v1"

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=1 ;;
    --help|-h)
      grep '^#' "$0" | head -22 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Requirements
# ---------------------------------------------------------------------------
for cmd in curl jq bc; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Load Trefle token
# ---------------------------------------------------------------------------
TREFLE_TOKEN=""
if [[ -f "$ENV_FILE" ]]; then
  TREFLE_TOKEN=$(grep -E '^TREFLE_ACCESS_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '[:space:]')
fi
TREFLE_TOKEN="${TREFLE_TOKEN:-${TREFLE_ACCESS_KEY:-}}"

if [[ -z "$TREFLE_TOKEN" ]]; then
  echo "Error: Trefle token not found." >&2
  echo "Set TREFLE_ACCESS_KEY in ${ENV_FILE} or export it as an env var." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Colours (disabled when not a TTY)
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  YELLOW=$'\033[33m' RED=$'\033[31m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" YELLOW="" RED="" RESET=""
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Pause 500 ms (be a courteous API consumer; Trefle asks for rate limiting)
_sleep_half() { sleep 0.5; }

# Search Trefle by scientific name, return the first plant id or empty.
trefle_first_id() {
  local query="$1"
  local encoded
  encoded=$(jq -Rr @uri <<< "$query")
  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${TREFLE_BASE}/plants/search?q=${encoded}&token=${TREFLE_TOKEN}" 2>/dev/null) || return
  echo "$raw" | jq -r '(.data // [])[0].id // empty'
}

# Fetch Trefle plant detail, return JSON object with enrichable fields.
# Output: {"min_temperature_c": X, "max_temperature_c": Y, "image_url": "..."}
# Any absent field will be JSON null.
trefle_detail_fields() {
  local plant_id="$1"
  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${TREFLE_BASE}/plants/${plant_id}?token=${TREFLE_TOKEN}" 2>/dev/null) || { echo "null"; return; }
  echo "$raw" | jq '{
    min_temperature_c: (.data.main_species.growth.minimum_temperature.deg_c // null),
    max_temperature_c: (.data.main_species.growth.maximum_temperature.deg_c // null),
    image_url:         (.data.image_url // null)
  }'
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
total=$(jq 'length' "$SEED_FILE")
echo "${BOLD}Enriching ${total} species in ${SEED_FILE}${RESET}"
[[ "$DRY_RUN" -eq 1 ]] && echo "${YELLOW}DRY RUN — no files will be modified${RESET}"
echo

json=$(cat "$SEED_FILE")
updated=0
skipped_complete=0
skipped_no_sci=0
not_found=0
no_new_data=0

for (( idx=0; idx<total; idx++ )); do
  common=$(echo "$json" | jq -r ".[${idx}].common_name")
  sci=$(echo "$json"    | jq -r ".[${idx}].scientific_name // empty")

  printf "${DIM}[%3d/%d]${RESET} %-38s" "$((idx+1))" "$total" "$common"

  if [[ -z "$sci" ]]; then
    echo "${YELLOW}(no scientific name — skip)${RESET}"
    (( skipped_no_sci++ )) || true
    continue
  fi

  # Check which enrichable fields are already present (non-null)
  has_min=$(echo "$json" | jq -r ".[${idx}].min_temperature_c // empty")
  has_max=$(echo "$json" | jq -r ".[${idx}].max_temperature_c // empty")
  has_img=$(echo "$json" | jq -r ".[${idx}].image_url // empty")

  if [[ -n "$has_min" && -n "$has_max" && -n "$has_img" ]]; then
    echo "${DIM}already enriched — skip${RESET}"
    (( skipped_complete++ )) || true
    continue
  fi

  # Search Trefle
  _sleep_half
  plant_id=$(trefle_first_id "$sci")

  if [[ -z "$plant_id" ]]; then
    echo "${YELLOW}no Trefle match${RESET}"
    (( not_found++ )) || true
    continue
  fi

  # Fetch detail
  _sleep_half
  fields=$(trefle_detail_fields "$plant_id")

  if [[ "$fields" == "null" ]]; then
    echo "${RED}detail fetch failed${RESET}"
    (( not_found++ )) || true
    continue
  fi

  # Build a patch: only include fields that are absent in the entry and
  # present (non-null) in the Trefle response.
  patch=$(echo "$fields" | jq --argjson entry "$(echo "$json" | jq ".[${idx}]")" '
    . as $trefle |
    {
      min_temperature_c: (if ($entry.min_temperature_c == null) then $trefle.min_temperature_c else null end),
      max_temperature_c: (if ($entry.max_temperature_c == null) then $trefle.max_temperature_c else null end),
      image_url:         (if ($entry.image_url         == null) then $trefle.image_url         else null end)
    } |
    with_entries(select(.value != null))
  ')

  if [[ $(echo "$patch" | jq 'length') -eq 0 ]]; then
    echo "${DIM}matched (id=${plant_id}) — no new fields${RESET}"
    (( no_new_data++ )) || true
    continue
  fi

  # Summarise changes
  summary=$(echo "$patch" | jq -r '
    to_entries | map(
      if   .key == "min_temperature_c" then "min_temp=\(.value)°C"
      elif .key == "max_temperature_c" then "max_temp=\(.value)°C"
      elif .key == "image_url"         then "image_url"
      else .key
      end
    ) | join(", ")
  ')
  echo "${GREEN}+${RESET} ${summary} ${DIM}(Trefle id=${plant_id})${RESET}"

  if [[ "$DRY_RUN" -eq 0 ]]; then
    json=$(echo "$json" | jq --argjson idx "$idx" --argjson patch "$patch" \
      '.[$idx] |= . + $patch')
    (( updated++ )) || true
  fi
done

echo
echo "${BOLD}Summary:${RESET}"
echo "  Updated    : ${GREEN}${updated}${RESET}"
echo "  Skipped    : ${skipped_complete} already complete, ${skipped_no_sci} missing sci name"
echo "  No match   : ${not_found}"
echo "  No new data: ${no_new_data}"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "${YELLOW}Dry run — no files modified.${RESET}"
elif [[ "$updated" -gt 0 ]]; then
  cp "${SEED_FILE}" "${SEED_FILE}.bak"
  echo "$json" | jq '.' > "${SEED_FILE}"
  echo
  echo "${GREEN}${BOLD}Wrote ${SEED_FILE}${RESET}  (backup: ${SEED_FILE}.bak)"
fi
