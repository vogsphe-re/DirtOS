#!/usr/bin/env bash
# ============================================================================
# eol-debug.sh — Interactive EoL API debugger for DirtOS
#
# Mirrors the three API calls made by src-tauri/src/services/eol.rs:
#   1. Search API  — find candidate species
#   2. Pages API   — retrieve description, images, taxonomy
#   3. TraitBank   — fetch growing-info traits via Cypher
#
# Usage:
#   ./scripts/eol-debug.sh                  # interactive mode
#   ./scripts/eol-debug.sh search "tomato"  # search directly
#   ./scripts/eol-debug.sh page 392557      # fetch page directly
#   ./scripts/eol-debug.sh traits 392557    # fetch traits directly
# ============================================================================
set -euo pipefail

UA="DirtOS/1.0 (open-source plant tracking application; contact via GitHub)"
BASE="https://eol.org"

# Colours (disabled if not a tty)
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" RESET=""
fi

# Require curl & jq
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 1. Search
# ---------------------------------------------------------------------------
eol_search() {
  local query="${1:?Usage: eol_search <query> [limit]}"
  local limit="${2:-10}"

  echo "${CYAN}${BOLD}━━━ EoL Search ━━━${RESET}"
  echo "${DIM}GET ${BASE}/api/search/1.0.json?q=${query}&per_page=${limit}${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/api/search/1.0.json?q=$(jq -Rr @uri <<< "$query")&page=1&per_page=${limit}&exact=false")

  local http_ok
  http_ok=$(echo "$raw" | jq -e '.results' &>/dev/null && echo "yes" || echo "no")

  if [[ "$http_ok" == "no" ]]; then
    echo "${RED}Search failed or returned unexpected JSON:${RESET}"
    echo "$raw" | jq . 2>/dev/null || echo "$raw"
    return 1
  fi

  # Filter out non-plant results (mirrors NON_PLANT_KEYWORDS in eol.rs)
  local filtered
  filtered=$(echo "$raw" | jq '[
    .results[]
    | select(
        (.title // "" | ascii_downcase)
        | test("virus|viroid|phage|bacterium|bacteria|phytoplasma|mycoplasma|oomycete|nematode|prion|fungus|fungi")
        | not
      )
  ]')

  local count
  count=$(echo "$filtered" | jq 'length')
  echo "${GREEN}${count} candidate(s) after filtering non-plant results:${RESET}"
  echo

  echo "$filtered" | jq -r '
    to_entries[] |
    "  \(.key + 1)) [\(.value.id)] \(.value.title // "—")\n     \(.value.link // "no link")\n     \(.value.content // "no snippet" | gsub("<[^>]+>"; "") | .[0:120])\n"
  '

  echo "${DIM}Raw JSON (first result):${RESET}"
  echo "$filtered" | jq '.[0] // empty'

  # Return the filtered JSON for piping
  LAST_SEARCH_RESULTS="$filtered"
}

# ---------------------------------------------------------------------------
# 2. Page detail
# ---------------------------------------------------------------------------
eol_page() {
  local page_id="${1:?Usage: eol_page <page_id>}"

  echo "${CYAN}${BOLD}━━━ EoL Page Detail (id=${page_id}) ━━━${RESET}"
  echo "${DIM}GET ${BASE}/api/pages/1.0.json?id=${page_id}&details=true&taxonomy=true&...${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 20 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/api/pages/1.0.json?id=${page_id}&details=true&taxonomy=true&images_per_page=1&texts_per_page=5&language=en&videos_per_page=0&sounds_per_page=0&vetted=2")

  # Check for taxonConcept wrapper
  local has_wrapper
  has_wrapper=$(echo "$raw" | jq -e '.taxonConcept' &>/dev/null && echo "yes" || echo "no")

  if [[ "$has_wrapper" == "no" ]]; then
    echo "${RED}Unexpected response structure (no .taxonConcept wrapper):${RESET}"
    echo "$raw" | jq 'keys' 2>/dev/null || echo "$raw" | head -c 500
    echo
    echo "${YELLOW}Full response:${RESET}"
    echo "$raw" | jq . 2>/dev/null || echo "$raw"
    return 1
  fi

  echo "${GREEN}Response structure:${RESET}"
  echo "$raw" | jq '{
    top_keys: keys,
    taxonConcept_keys: .taxonConcept | keys,
    dataObjects_count: (.taxonConcept.dataObjects // [] | length),
    taxonConcepts_count: (.taxonConcept.taxonConcepts // [] | length)
  }'
  echo

  # --- Text descriptions ---
  echo "${BOLD}Text descriptions:${RESET}"
  echo "$raw" | jq -r '
    [.taxonConcept.dataObjects // [] | .[]
     | select(.dataType // "" | test("Text"; "i"))]
    | to_entries[]
    | "  [\(.key + 1)] lang=\(.value.language // "?")  type=\(.value.dataType // "?")\n      \(.value.description // "—" | gsub("<[^>]+>"; "") | .[0:200])…\n"
  ' 2>/dev/null || echo "  (none)"
  echo

  # --- Images ---
  echo "${BOLD}Images:${RESET}"
  echo "$raw" | jq -r '
    [.taxonConcept.dataObjects // [] | .[]
     | select(.mimeType // "" | startswith("image/"))]
    | to_entries[]
    | "  [\(.key + 1)] mime=\(.value.mimeType)  eolMediaURL=\(.value.eolMediaURL // "—")  mediaURL=\(.value.mediaURL // "—")"
  ' 2>/dev/null || echo "  (none)"
  echo

  # --- Taxonomy tags ---
  echo "${BOLD}Taxonomy hierarchy:${RESET}"
  echo "$raw" | jq -r '
    [.taxonConcept.taxonConcepts // [] | .[0].sourceHierarchyEntry.ancestors // [] | .[]
     | {
         rank: .taxonRank,
         scientific: .scientificName,
         vernacular: ([.vernacularNames // [] | .[] | select(.language == "en") | .vernacularName] | first // null)
       }]
    | to_entries[]
    | "  \(.value.rank // "?"): \(.value.vernacular // .value.scientific // "—")"
  ' 2>/dev/null || echo "  (none)"
  echo

  echo "${DIM}Page URL: https://eol.org/pages/${page_id}${RESET}"
  echo "${DIM}Raw JSON size: $(echo "$raw" | wc -c | tr -d ' ') bytes${RESET}"

  # Optionally dump full raw
  read -rp "${YELLOW}Show full raw JSON? [y/N] ${RESET}" show_raw
  if [[ "${show_raw,,}" == "y" ]]; then
    echo "$raw" | jq .
  fi
}

# ---------------------------------------------------------------------------
# 3. TraitBank (Cypher API)
# ---------------------------------------------------------------------------
eol_traits() {
  local page_id="${1:?Usage: eol_traits <page_id>}"

  echo "${CYAN}${BOLD}━━━ EoL TraitBank / Cypher (page_id=${page_id}) ━━━${RESET}"

  local cypher_query="MATCH (t:Trait)<-[:trait]-(p:Page{page_id:${page_id}}) OPTIONAL MATCH (t)-[:predicate]->(pred:Term) OPTIONAL MATCH (t)-[:object_term]->(obj:Term) RETURN pred.name, t.measurement, t.units_name, obj.name LIMIT 200"

  echo "${DIM}GET ${BASE}/service/cypher?query=...${RESET}"
  echo "${DIM}Cypher: ${cypher_query}${RESET}"
  echo

  local http_code raw
  raw=$(curl -sS --max-time 10 -w '\n%{http_code}' \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${BASE}/service/cypher?query=$(jq -Rr @uri <<< "$cypher_query")")

  http_code=$(echo "$raw" | tail -1)
  raw=$(echo "$raw" | sed '$d')

  echo "HTTP status: ${http_code}"

  if [[ "$http_code" == "401" ]]; then
    echo "${YELLOW}⚠  TraitBank returned 401 Unauthorized.${RESET}"
    echo "${DIM}The Cypher API now requires authentication — DirtOS gracefully falls back to empty trait defaults.${RESET}"
    return 0
  fi

  if [[ "$http_code" != "200" ]]; then
    echo "${RED}TraitBank returned HTTP ${http_code}:${RESET}"
    echo "$raw" | head -c 500
    return 1
  fi

  local col_count row_count
  col_count=$(echo "$raw" | jq '.columns | length')
  row_count=$(echo "$raw" | jq '.data | length')
  echo "${GREEN}Columns: ${col_count}, Rows: ${row_count}${RESET}"
  echo

  if [[ "$row_count" -gt 0 ]]; then
    echo "${BOLD}Trait rows (pred → value):${RESET}"
    echo "$raw" | jq -r '
      .data[]
      | "  \(.[0] // "—") = \(.[3] // .[1] // "—") \(if .[2] then "(\(.[2]))" else "" end)"
    ' | sort | uniq -c | sort -rn | head -40
    echo

    # Classify into DirtOS categories
    echo "${BOLD}Mapped to DirtOS fields:${RESET}"
    echo "$raw" | jq -r '
      def lower: ascii_downcase;
      .data[] |
      (.[0] // "" | lower) as $pred |
      (.[3] // .[1] // null) as $val |
      if   ($pred | test("growth habit|growth form|plant growth form"))     then "  growth_type:        \($val)"
      elif ($pred | test("shade tolerance"))                                then "  sun_requirement:    \($val)"
      elif ($pred | test("light req|light pref|sun.*shade|sun exposure"))   then "  sun_requirement:    \($val)"
      elif ($pred | test("moisture use|water use|water req|moisture req"))   then "  water_requirement:  \($val)"
      elif ($pred | test("drought tolerance"))                              then "  water_requirement:  \($val) (inverted)"
      elif ($pred | test("ph|soil acidity"))                                then "  soil_ph:            \($val)"
      elif ($pred | test("cold hardiness|hardiness zone"))                  then "  hardiness_zone:     \($val)"
      elif ($pred | test("habitat"))                                        then "  habitat:            \($val)"
      elif ($pred | test("temperature"))                                    then "  temperature:        \($val)"
      elif ($pred | test("rooting depth"))                                  then "  rooting_depth:      \($val)"
      elif ($pred | test("use"))                                            then "  uses:               \($val)"
      else empty end
    ' | sort -u
  else
    echo "${DIM}No trait rows returned.${RESET}"
  fi
}

# ---------------------------------------------------------------------------
# Interactive loop
# ---------------------------------------------------------------------------
interactive() {
  LAST_SEARCH_RESULTS=""

  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║    DirtOS — EoL API Debugger                ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Commands:"
  echo "  ${BOLD}search${RESET} <query> [limit]  — Search EoL for species"
  echo "  ${BOLD}page${RESET}   <page_id>        — Fetch page detail + taxonomy"
  echo "  ${BOLD}traits${RESET} <page_id>        — Fetch TraitBank traits"
  echo "  ${BOLD}pick${RESET}   <n>              — Pick nth search result → run page + traits"
  echo "  ${BOLD}all${RESET}    <query>          — Search → pick first → page + traits"
  echo "  ${BOLD}quit${RESET}                    — Exit"
  echo

  while true; do
    read -rp "${CYAN}eol> ${RESET}" line || break
    # Split into words
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      search|s)
        eol_search "${args[1]:-}" "${args[2]:-10}" || true
        ;;
      page|p)
        eol_page "${args[1]:-}" || true
        ;;
      traits|t)
        eol_traits "${args[1]:-}" || true
        ;;
      pick)
        local n="${args[1]:-1}"
        if [[ -z "$LAST_SEARCH_RESULTS" ]]; then
          echo "${RED}No previous search results. Run 'search' first.${RESET}"
          continue
        fi
        local pid
        pid=$(echo "$LAST_SEARCH_RESULTS" | jq -r ".[$((n - 1))].id // empty")
        if [[ -z "$pid" ]]; then
          echo "${RED}No result at position ${n}.${RESET}"
          continue
        fi
        echo "${GREEN}Picking result #${n} → page_id=${pid}${RESET}"
        echo
        eol_page "$pid" || true
        echo
        eol_traits "$pid" || true
        ;;
      all|a)
        local q="${args[1]:-}"
        if [[ -z "$q" ]]; then
          echo "${RED}Usage: all <query>${RESET}"
          continue
        fi
        eol_search "$q" 5 || continue
        local first_id
        first_id=$(echo "$LAST_SEARCH_RESULTS" | jq -r '.[0].id // empty')
        if [[ -z "$first_id" ]]; then
          echo "${RED}No results to pick from.${RESET}"
          continue
        fi
        echo "${GREEN}Auto-picking first result → page_id=${first_id}${RESET}"
        echo
        eol_page "$first_id" || true
        echo
        eol_traits "$first_id" || true
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
        echo "  Try: search, page, traits, pick, all, quit"
        ;;
    esac
    echo
  done
}

# ---------------------------------------------------------------------------
# CLI dispatch
# ---------------------------------------------------------------------------
case "${1:-}" in
  search|s)   eol_search "${2:-}" "${3:-10}" ;;
  page|p)     eol_page "${2:-}" ;;
  traits|t)   eol_traits "${2:-}" ;;
  "")         interactive ;;
  *)
    echo "Usage: $0 [search <query>|page <id>|traits <id>]"
    echo "       $0          # interactive mode"
    exit 1
    ;;
esac
