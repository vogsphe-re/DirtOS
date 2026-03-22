#!/usr/bin/env bash
# ============================================================================
# inat-debug.sh — Interactive iNaturalist API debugger for DirtOS
#
# Mirrors the API calls made by src-tauri/src/services/inaturalist.rs:
#   1. Search  — search taxa by common or scientific name
#   2. Detail  — fetch full taxon detail with ancestors (family, genus)
#
# Note: The Rust service enforces a 500ms rate limit between calls.
# This script adds a brief sleep to be a polite API citizen.
#
# Usage:
#   ./scripts/inat-debug.sh                        # interactive mode
#   ./scripts/inat-debug.sh search "tomato"         # search taxa
#   ./scripts/inat-debug.sh detail 55986            # taxon detail
# ============================================================================
set -euo pipefail

UA="DirtOS/1.0 (open-source plant tracking application)"
BASE="https://api.inaturalist.org/v1"
RATE_LIMIT_MS=500

# Colours (disabled if not a tty)
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  WHITE=$'\033[37m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" WHITE="" RESET=""
fi

# Require curl & jq
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Helper: rate-limit sleep (mirrors the 500ms sleep in inaturalist.rs)
# ---------------------------------------------------------------------------
rate_limit() {
  sleep "$(echo "scale=3; ${RATE_LIMIT_MS}/1000" | bc)"
}

# ---------------------------------------------------------------------------
# 1. Search Taxa
# ---------------------------------------------------------------------------
inat_search() {
  local query="${1:?Usage: inat_search <query>}"

  echo "${CYAN}${BOLD}━━━ iNaturalist Taxa Search ━━━${RESET}"
  echo "${DIM}GET ${BASE}/taxa?q=${query}&per_page=20&rank=species,subspecies,variety&locale=en${RESET}"
  echo

  rate_limit

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/taxa?q=$(jq -Rr @uri <<< "$query")&per_page=20&rank=species,subspecies,variety&locale=en")

  local count total
  count=$(echo "$raw" | jq '.results | length')
  total=$(echo "$raw" | jq '.total_results // 0')

  echo "${GREEN}${count} result(s) returned (${total} total matching):${RESET}"
  echo

  echo "$raw" | jq -r '
    .results | to_entries[] |
    "  \(.key + 1)) [\(.value.id)] \(.value.name // "—")
     common: \(.value.preferred_common_name // "—")
     rank: \(.value.rank // "?")  matched: \(.value.matched_term // "—")
     photo: \(.value.default_photo.medium_url // .value.default_photo.url // "—")
     wikipedia: \(.value.wikipedia_url // "—")
"
  '

  LAST_SEARCH_RESULTS="$raw"
}

# ---------------------------------------------------------------------------
# 2. Taxon Detail
# ---------------------------------------------------------------------------
inat_detail() {
  local taxon_id="${1:?Usage: inat_detail <taxon_id>}"

  echo "${CYAN}${BOLD}━━━ iNaturalist Taxon Detail (id=${taxon_id}) ━━━${RESET}"
  echo "${DIM}GET ${BASE}/taxa/${taxon_id}${RESET}"
  echo

  rate_limit

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/taxa/${taxon_id}")

  local count
  count=$(echo "$raw" | jq '.results | length')

  if [[ "$count" -eq 0 ]]; then
    echo "${RED}Taxon not found (id=${taxon_id}).${RESET}"
    return 1
  fi

  local taxon
  taxon=$(echo "$raw" | jq '.results[0]')

  # Core fields
  local name common rank photo wiki_url
  name=$(echo "$taxon" | jq -r '.name // "—"')
  common=$(echo "$taxon" | jq -r '.preferred_common_name // "—"')
  rank=$(echo "$taxon" | jq -r '.rank // "—"')
  photo=$(echo "$taxon" | jq -r '.default_photo.medium_url // .default_photo.url // "—"')
  wiki_url=$(echo "$taxon" | jq -r '.wikipedia_url // "—"')

  echo "${GREEN}Taxon: ${name}${RESET}"
  echo "  ${BOLD}common name:${RESET}  ${common}"
  echo "  ${BOLD}rank:${RESET}         ${rank}"
  echo "  ${BOLD}photo:${RESET}        ${photo}"
  echo "  ${BOLD}wikipedia:${RESET}    ${wiki_url}"
  echo "  ${BOLD}iNat URL:${RESET}     https://www.inaturalist.org/taxa/${taxon_id}"
  echo

  # Ancestors (mirrors the family/genus extraction in inaturalist.rs)
  echo "${BOLD}Ancestors:${RESET}"
  local family genus
  family=$(echo "$taxon" | jq -r '[.ancestors // [] | .[] | select(.rank == "family") | .name] | first // "—"')
  genus=$(echo "$taxon" | jq -r '[.ancestors // [] | .[] | select(.rank == "genus") | .name] | first // "—"')

  echo "$taxon" | jq -r '
    [.ancestors // [] | .[] | "\(.rank): \(.name)"] | .[] | "  \(.)"
  ' 2>/dev/null || echo "  (none — ancestors may not be included in response)"
  echo

  echo "  ${GREEN}→ family: ${family}${RESET}"
  echo "  ${GREEN}→ genus:  ${genus}${RESET}"
  echo

  # Conservation status
  echo "${BOLD}Conservation status:${RESET}"
  echo "$taxon" | jq -r '
    if .conservation_status then
      "  \(.conservation_status.status // "—") (\(.conservation_status.authority // "?"))"
    else
      "  (none)"
    end
  '
  echo

  # Taxonomy summary
  echo "${BOLD}Full taxonomy:${RESET}"
  echo "$taxon" | jq '{
    id, name, preferred_common_name, rank,
    is_active: .is_active,
    observations_count,
    ancestor_count: (.ancestors // [] | length),
    has_photo: (.default_photo != null),
    wikipedia_slug: (.wikipedia_url // "" | split("/") | last)
  }'
  echo

  echo "${DIM}JSON size: $(echo "$raw" | wc -c | tr -d ' ') bytes${RESET}"

  # Optionally dump full raw
  read -rp "${YELLOW}Show full raw JSON? [y/N] ${RESET}" show_raw
  if [[ "${show_raw,,}" == "y" ]]; then
    echo "$taxon" | jq .
  fi
}

# ---------------------------------------------------------------------------
# Interactive loop
# ---------------------------------------------------------------------------
interactive() {
  LAST_SEARCH_RESULTS=""

  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║    DirtOS — iNaturalist API Debugger        ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Commands:"
  echo "  ${BOLD}search${RESET} <query>    — Search taxa by name"
  echo "  ${BOLD}detail${RESET} <taxon_id> — Fetch full taxon detail + ancestors"
  echo "  ${BOLD}pick${RESET}   <n>        — Pick nth search result → detail"
  echo "  ${BOLD}all${RESET}    <query>    — Search → pick first → detail"
  echo "  ${BOLD}quit${RESET}             — Exit"
  echo
  echo "${DIM}(Rate limit: ${RATE_LIMIT_MS}ms between API calls)${RESET}"
  echo

  while true; do
    read -rp "${WHITE}inat> ${RESET}" line || break
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      search|s)
        inat_search "${args[*]:1}" || true
        ;;
      detail|d)
        inat_detail "${args[1]:-}" || true
        ;;
      pick)
        local n="${args[1]:-1}"
        if [[ -z "$LAST_SEARCH_RESULTS" ]]; then
          echo "${RED}No previous search results. Run 'search' first.${RESET}"
          continue
        fi
        local tid
        tid=$(echo "$LAST_SEARCH_RESULTS" | jq -r ".results[$((n - 1))].id // empty")
        if [[ -z "$tid" ]]; then
          echo "${RED}No result at position ${n}.${RESET}"
          continue
        fi
        echo "${GREEN}Picking result #${n} → taxon_id=${tid}${RESET}"
        echo
        inat_detail "$tid" || true
        ;;
      all|a)
        local q="${args[*]:1}"
        if [[ -z "$q" ]]; then
          echo "${RED}Usage: all <query>${RESET}"
          continue
        fi
        inat_search "$q" || continue
        local first_id
        first_id=$(echo "$LAST_SEARCH_RESULTS" | jq -r '.results[0].id // empty')
        if [[ -z "$first_id" ]]; then
          echo "${RED}No results to pick from.${RESET}"
          continue
        fi
        echo "${GREEN}Auto-picking first result → taxon_id=${first_id}${RESET}"
        echo
        inat_detail "$first_id" || true
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
  search|s)   inat_search "${*:2}" ;;
  detail|d)   inat_detail "${2:-}" ;;
  "")         interactive ;;
  *)
    echo "Usage: $0 [search <query>|detail <taxon_id>]"
    echo "       $0          # interactive mode"
    exit 1
    ;;
esac
