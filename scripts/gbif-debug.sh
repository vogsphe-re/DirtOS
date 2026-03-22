#!/usr/bin/env bash
# ============================================================================
# gbif-debug.sh — Interactive GBIF API debugger for DirtOS
#
# Mirrors the API calls made by src-tauri/src/services/gbif.rs:
#   1. Match    — fuzzy backbone match (species/match)
#   2. Search   — free-text search filtered to Plantae (species/search)
#   3. Detail   — full enrichment: detail + vernacularNames + speciesProfiles + distributions
#
# Usage:
#   ./scripts/gbif-debug.sh                              # interactive mode
#   ./scripts/gbif-debug.sh match "Solanum lycopersicum" # fuzzy match
#   ./scripts/gbif-debug.sh search "tomato"              # search directly
#   ./scripts/gbif-debug.sh detail 2930137               # full detail
# ============================================================================
set -euo pipefail

UA="DirtOS/1.0 (open-source plant tracking application; contact via GitHub)"
BASE="https://api.gbif.org/v1"

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

# ---------------------------------------------------------------------------
# Helper: build classification breadcrumb from a GBIF object
# ---------------------------------------------------------------------------
build_classification() {
  local json="$1"
  echo "$json" | jq -r '
    [.kingdom, .phylum, .class, .order, .family, .genus]
    | map(select(. != null and . != ""))
    | join(" > ")
  '
}

# ---------------------------------------------------------------------------
# 1. Match (fuzzy backbone matching)
# ---------------------------------------------------------------------------
gbif_match() {
  local name="${1:?Usage: gbif_match <scientific_name>}"

  echo "${CYAN}${BOLD}━━━ GBIF Match ━━━${RESET}"
  echo "${DIM}GET ${BASE}/species/match?name=${name}&kingdom=Plantae&strict=false${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 10 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/species/match?name=$(jq -Rr @uri <<< "$name")&kingdom=Plantae&strict=false")

  local match_type
  match_type=$(echo "$raw" | jq -r '.matchType // "NONE"')

  if [[ "$match_type" == "NONE" ]]; then
    echo "${RED}No match found (matchType=NONE).${RESET}"
    echo "$raw" | jq '{matchType, confidence, note}'
    return 1
  fi

  local usage_key confidence scientific canonical rank status
  usage_key=$(echo "$raw" | jq -r '.usageKey // "—"')
  confidence=$(echo "$raw" | jq -r '.confidence // "—"')
  scientific=$(echo "$raw" | jq -r '.scientificName // "—"')
  canonical=$(echo "$raw" | jq -r '.canonicalName // "—"')
  rank=$(echo "$raw" | jq -r '.rank // "—"')
  status=$(echo "$raw" | jq -r '.status // "—"')
  local classification
  classification=$(build_classification "$raw")

  echo "${GREEN}Match found! (${match_type})${RESET}"
  echo "  ${BOLD}usageKey:${RESET}    ${usage_key}"
  echo "  ${BOLD}confidence:${RESET}  ${confidence}%"
  echo "  ${BOLD}scientific:${RESET}  ${scientific}"
  echo "  ${BOLD}canonical:${RESET}   ${canonical}"
  echo "  ${BOLD}rank:${RESET}        ${rank}"
  echo "  ${BOLD}status:${RESET}      ${status}"
  echo "  ${BOLD}taxonomy:${RESET}    ${classification}"
  echo "  ${DIM}https://www.gbif.org/species/${usage_key}${RESET}"
  echo

  echo "${DIM}Raw JSON:${RESET}"
  echo "$raw" | jq '{usageKey, confidence, matchType, scientificName, canonicalName, rank, status, kingdom, phylum, class, order, family, genus}'

  LAST_MATCH_KEY="$usage_key"
}

# ---------------------------------------------------------------------------
# 2. Search (free-text, Plantae-filtered)
# ---------------------------------------------------------------------------
gbif_search() {
  local query="${1:?Usage: gbif_search <query> [limit]}"
  local limit="${2:-10}"

  echo "${CYAN}${BOLD}━━━ GBIF Search ━━━${RESET}"
  echo "${DIM}GET ${BASE}/species/search?q=${query}&rank=SPECIES&highertaxonKey=6&status=ACCEPTED&limit=${limit}${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/species/search?q=$(jq -Rr @uri <<< "$query")&rank=SPECIES&highertaxonKey=6&status=ACCEPTED&limit=${limit}")

  local count
  count=$(echo "$raw" | jq '.results | length')
  local total
  total=$(echo "$raw" | jq '.count // 0')

  echo "${GREEN}${count} result(s) returned (${total} total matching):${RESET}"
  echo

  echo "$raw" | jq -r '
    .results | to_entries[] |
    "  \(.key + 1)) [\(.value.key // .value.nubKey // "?")] \(.value.scientificName // "—")\n     canonical: \(.value.canonicalName // "—")  rank: \(.value.rank // "?")  status: \(.value.taxonomicStatus // "?")\n     \([.value.kingdom, .value.phylum, .value.class, .value.order, .value.family, .value.genus] | map(select(. != null)) | join(" > "))\n"
  '

  LAST_SEARCH_RESULTS="$raw"
}

# ---------------------------------------------------------------------------
# 3. Detail (concurrent fetch of 4 sub-endpoints)
# ---------------------------------------------------------------------------
gbif_detail() {
  local key="${1:?Usage: gbif_detail <usage_key>}"

  echo "${CYAN}${BOLD}━━━ GBIF Detail (key=${key}) ━━━${RESET}"
  echo

  # --- Core detail ---
  echo "${BOLD}[1/4] Species detail:${RESET}"
  echo "${DIM}GET ${BASE}/species/${key}${RESET}"
  local detail
  detail=$(curl -sS --max-time 10 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/species/${key}")

  echo "$detail" | jq '{
    key, scientificName, canonicalName, authorship,
    rank, taxonomicStatus,
    kingdom, phylum, class, order, family, genus
  }'
  echo

  # --- Vernacular names ---
  echo "${BOLD}[2/4] Vernacular names:${RESET}"
  echo "${DIM}GET ${BASE}/species/${key}/vernacularNames?limit=50${RESET}"
  local vernaculars
  vernaculars=$(curl -sS --max-time 10 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/species/${key}/vernacularNames?limit=50" 2>/dev/null || echo '{"results":[]}')

  local vern_count
  vern_count=$(echo "$vernaculars" | jq '.results | length')
  echo "  Total names: ${vern_count}"

  echo "  ${GREEN}English names:${RESET}"
  echo "$vernaculars" | jq -r '
    [.results[] | select(.language == "eng" or .language == "en")]
    | to_entries[]
    | "    \(.key + 1)) \(.value.vernacularName) (lang=\(.value.language))"
  ' 2>/dev/null || echo "    (none)"
  echo

  # --- Species profiles ---
  echo "${BOLD}[3/4] Species profiles:${RESET}"
  echo "${DIM}GET ${BASE}/species/${key}/speciesProfiles?limit=50${RESET}"
  local profiles
  profiles=$(curl -sS --max-time 10 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/species/${key}/speciesProfiles?limit=50" 2>/dev/null || echo '{"results":[]}')

  local prof_count
  prof_count=$(echo "$profiles" | jq '.results | length')
  echo "  Total profiles: ${prof_count}"

  echo "$profiles" | jq -r '
    .results | to_entries[] |
    "  [\(.key + 1)] habitat: \(.value.habitat // "—")  terrestrial: \(.value.terrestrial // "—")  freshwater: \(.value.freshwater // "—")  marine: \(.value.marine // "—")"
  ' 2>/dev/null || echo "  (none)"

  # Summarize habitat
  local habitat
  habitat=$(echo "$profiles" | jq -r '
    (.results | map(select(.habitat != null and .habitat != "")) | .[0].habitat) // (
      [
        if (.results | any(.terrestrial == true)) then "terrestrial" else empty end,
        if (.results | any(.freshwater == true)) then "freshwater" else empty end,
        if (.results | any(.marine == true)) then "marine" else empty end
      ] | join(", ")
    ) // "—"
  ')
  echo "  ${GREEN}→ Resolved habitat: ${habitat}${RESET}"
  echo

  # --- Distributions ---
  echo "${BOLD}[4/4] Distributions:${RESET}"
  echo "${DIM}GET ${BASE}/species/${key}/distributions?limit=100${RESET}"
  local distrib
  distrib=$(curl -sS --max-time 10 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/species/${key}/distributions?limit=100" 2>/dev/null || echo '{"results":[]}')

  local dist_count
  dist_count=$(echo "$distrib" | jq '.results | length')
  echo "  Total distribution records: ${dist_count}"
  echo

  echo "  ${GREEN}Native ranges (establishmentMeans=NATIVE):${RESET}"
  echo "$distrib" | jq -r '
    [.results[]
     | select(.establishmentMeans == "NATIVE")
     | .locality // .country // "—"
     | .[0:80]]
    | unique
    | to_entries[]
    | "    \(.key + 1)) \(.value)"
  ' 2>/dev/null || echo "    (none)"
  echo

  echo "  ${YELLOW}Establishment means (all):${RESET}"
  echo "$distrib" | jq -r '
    [.results[]
     | .establishmentMeans // empty]
    | map(ascii_downcase)
    | unique
    | .[]
    | "    • \(.)"
  ' 2>/dev/null || echo "    (none)"
  echo

  echo "${DIM}GBIF URL: https://www.gbif.org/species/${key}${RESET}"
}

# ---------------------------------------------------------------------------
# Interactive loop
# ---------------------------------------------------------------------------
interactive() {
  LAST_MATCH_KEY=""
  LAST_SEARCH_RESULTS=""

  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║    DirtOS — GBIF API Debugger               ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Commands:"
  echo "  ${BOLD}match${RESET}  <scientific_name>  — Fuzzy backbone match"
  echo "  ${BOLD}search${RESET} <query> [limit]    — Free-text search (Plantae only)"
  echo "  ${BOLD}detail${RESET} <usage_key>        — Full detail + profiles + distributions"
  echo "  ${BOLD}pick${RESET}   <n>                — Pick nth search result → detail"
  echo "  ${BOLD}all${RESET}    <scientific_name>   — Match → detail (full pipeline)"
  echo "  ${BOLD}quit${RESET}                      — Exit"
  echo

  while true; do
    read -rp "${MAGENTA}gbif> ${RESET}" line || break
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      match|m)
        gbif_match "${args[*]:1}" || true
        ;;
      search|s)
        gbif_search "${args[1]:-}" "${args[2]:-10}" || true
        ;;
      detail|d)
        gbif_detail "${args[1]:-}" || true
        ;;
      pick)
        local n="${args[1]:-1}"
        if [[ -z "$LAST_SEARCH_RESULTS" ]]; then
          echo "${RED}No previous search results. Run 'search' first.${RESET}"
          continue
        fi
        local pk
        pk=$(echo "$LAST_SEARCH_RESULTS" | jq -r ".results[$((n - 1))].key // .results[$((n - 1))].nubKey // empty")
        if [[ -z "$pk" ]]; then
          echo "${RED}No result at position ${n}.${RESET}"
          continue
        fi
        echo "${GREEN}Picking result #${n} → key=${pk}${RESET}"
        echo
        gbif_detail "$pk" || true
        ;;
      all|a)
        local name="${args[*]:1}"
        if [[ -z "$name" ]]; then
          echo "${RED}Usage: all <scientific_name>${RESET}"
          continue
        fi
        gbif_match "$name" || continue
        if [[ -n "$LAST_MATCH_KEY" && "$LAST_MATCH_KEY" != "—" ]]; then
          echo
          gbif_detail "$LAST_MATCH_KEY" || true
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
        echo "  Try: match, search, detail, pick, all, quit"
        ;;
    esac
    echo
  done
}

# ---------------------------------------------------------------------------
# CLI dispatch
# ---------------------------------------------------------------------------
case "${1:-}" in
  match|m)    gbif_match "${*:2}" ;;
  search|s)   gbif_search "${2:-}" "${3:-10}" ;;
  detail|d)   gbif_detail "${2:-}" ;;
  "")         interactive ;;
  *)
    echo "Usage: $0 [match <name>|search <query>|detail <key>]"
    echo "       $0          # interactive mode"
    exit 1
    ;;
esac
