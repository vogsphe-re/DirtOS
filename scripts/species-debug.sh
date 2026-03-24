#!/usr/bin/env bash
# ============================================================================
# species-debug.sh — Combined species lookup across all DirtOS data sources
#
# Queries GBIF, iNaturalist, EoL, Trefle, and Wikipedia with a single
# species name and prints the top results from each source.
#
# Trefle requires TREFLE_ACCESS_KEY in .env (or exported env var); the source
# is skipped gracefully if the token is missing.
#
# Usage:
#   ./scripts/species-debug.sh "Solanum lycopersicum"
#   ./scripts/species-debug.sh "tomato" --details
#   ./scripts/species-debug.sh "basil" 3 --details   # top 3 + full enrichment
#   ./scripts/species-debug.sh "basil" 3              # search-only
#
# Flags:
#   --details, -d  Fetch full detail for the top result from each source
# ============================================================================
set -euo pipefail

# Parse optional --details / -d flag before positional args
DETAILS=0
_pos_args=()
for _arg in "$@"; do
  case "$_arg" in
    --details|-d) DETAILS=1 ;;
    *) _pos_args+=("$_arg") ;;
  esac
done
QUERY="${_pos_args[0]:?Usage: $0 [--details|-d] <species_name> [top_n]}"
TOP_N="${_pos_args[1]:-5}"

UA="DirtOS/1.0 (open-source plant tracking application; contact via GitHub)"

# ---------------------------------------------------------------------------
# Colours (disabled if stdout is not a tty)
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  MAGENTA=$'\033[35m' BLUE=$'\033[34m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" MAGENTA="" BLUE="" RESET=""
fi

# ---------------------------------------------------------------------------
# Require curl & jq
# ---------------------------------------------------------------------------
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Load Trefle token from .env (optional — source is skipped if absent)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="${PROJECT_ROOT}/.env"

TREFLE_TOKEN=""
if [[ -f "$ENV_FILE" ]]; then
  TREFLE_TOKEN=$(grep -E '^TREFLE_ACCESS_KEY=' "$ENV_FILE" \
    | cut -d= -f2- | tr -d '[:space:]' || true)
fi
TREFLE_TOKEN="${TREFLE_TOKEN:-${TREFLE_ACCESS_KEY:-}}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
section() {
  local label="$1" color="${2:-$CYAN}"
  echo
  echo "${color}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo "${color}${BOLD}  ${label}${RESET}"
  echo "${color}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo
}

# Trim a string to N chars and append "…" if truncated
trunc() {
  local s="$1" n="${2:-120}"
  if [[ "${#s}" -gt "$n" ]]; then
    echo "${s:0:$n}…"
  else
    echo "$s"
  fi
}

# Light value (0-10) → sun requirement label (matches trefle-debug.sh)
map_sun() {
  local val="$1"
  if (( $(echo "$val <= 3" | bc -l) )); then echo "low_light"
  elif (( $(echo "$val <= 6" | bc -l) )); then echo "partial_shade"
  else echo "full_sun"
  fi
}

# Soil humidity (0-10) → water requirement label
map_water() {
  local val="$1"
  if (( $(echo "$val <= 3" | bc -l) )); then echo "low"
  elif (( $(echo "$val <= 6" | bc -l) )); then echo "moderate"
  else echo "high"
  fi
}

# Print a detail sub-section header (visual indent below search results)
detail_header() {
  local label="$1" color="${2:-$DIM}"
  echo
  echo "  ${color}${BOLD}┄┄ ${label} ┄┄${RESET}"
  echo
}

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo
echo "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${RESET}"
echo "${BOLD}${GREEN}║        DirtOS — Combined Species Lookup              ║${RESET}"
echo "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${RESET}"
echo
echo "  ${BOLD}Query:${RESET}    \"${QUERY}\""
echo "  ${BOLD}Top N:${RESET}    ${TOP_N} per source"
echo "  ${BOLD}Sources:${RESET}  GBIF  ·  iNaturalist  ·  EoL  ·  Trefle  ·  Wikipedia"
if [[ "$DETAILS" -eq 1 ]]; then
  echo "  ${BOLD}Mode:${RESET}     search + detail  (top result enriched per source)"
else
  echo "  ${BOLD}Mode:${RESET}     search-only  (add --details or -d for full enrichment)"
fi
[[ -z "$TREFLE_TOKEN" ]] && \
  echo "  ${YELLOW}Trefle: no token found — will skip (set TREFLE_ACCESS_KEY in .env)${RESET}"

# ===========================================================================
# 1. GBIF — backbone match + species search
# ===========================================================================
section "1 / 5  GBIF" "$CYAN"

GBIF_BASE="https://api.gbif.org/v1"

# --- Backbone match ---
echo "${DIM}[match] ${GBIF_BASE}/species/match?name=${QUERY}&kingdom=Plantae&strict=false${RESET}"
gbif_match_raw=$(curl -sS --max-time 10 \
  -H "User-Agent: ${UA}" \
  -H "Accept: application/json" \
  "${GBIF_BASE}/species/match?name=$(jq -Rr @uri <<< "$QUERY")&kingdom=Plantae&strict=false" \
  2>/dev/null || echo '{}')

match_type=$(echo "$gbif_match_raw" | jq -r '.matchType // "NONE"')
if [[ "$match_type" != "NONE" ]]; then
  usage_key=$(echo "$gbif_match_raw" | jq -r '.usageKey // "—"')
  confidence=$(echo "$gbif_match_raw" | jq -r '.confidence // "—"')
  scientific=$(echo "$gbif_match_raw" | jq -r '.scientificName // "—"')
  canonical=$(echo "$gbif_match_raw" | jq -r '.canonicalName // "—"')
  rank=$(echo "$gbif_match_raw" | jq -r '.rank // "—"')
  echo "${GREEN}Backbone match: ${match_type} (${confidence}% confidence)${RESET}"
  echo "  ${BOLD}usageKey:${RESET}   ${usage_key}"
  echo "  ${BOLD}scientific:${RESET} ${scientific}"
  echo "  ${BOLD}canonical:${RESET}  ${canonical}"
  echo "  ${BOLD}rank:${RESET}       ${rank}"
  echo "  ${DIM}https://www.gbif.org/species/${usage_key}${RESET}"
else
  echo "${YELLOW}No backbone match (matchType=NONE)${RESET}"
fi
echo

# --- Free-text search ---
echo "${DIM}[search] ${GBIF_BASE}/species/search?q=${QUERY}&rank=SPECIES&highertaxonKey=6&status=ACCEPTED&limit=${TOP_N}${RESET}"
gbif_search_raw=$(curl -sS --max-time 15 \
  -H "User-Agent: ${UA}" \
  -H "Accept: application/json" \
  "${GBIF_BASE}/species/search?q=$(jq -Rr @uri <<< "$QUERY")&rank=SPECIES&highertaxonKey=6&status=ACCEPTED&limit=${TOP_N}" \
  2>/dev/null || echo '{"results":[],"count":0}')

gbif_count=$(echo "$gbif_search_raw" | jq '.results | length')
gbif_total=$(echo "$gbif_search_raw" | jq '.count // 0')
echo "${GREEN}Search: ${gbif_count} result(s) shown (${gbif_total} total):${RESET}"
echo "$gbif_search_raw" | jq -r '
  .results | to_entries[] |
  "  \(.key + 1)) [\(.value.key // "?")] \(.value.scientificName // "—")
     canonical: \(.value.canonicalName // "—")  rank: \(.value.rank // "?")
     taxonomy: \([.value.kingdom, .value.family, .value.genus] | map(select(. != null)) | join(" > "))
"
' 2>/dev/null || echo "  (parse error)"

if [[ "$DETAILS" -eq 1 ]]; then
  # Prefer the backbone match key; fall back to first search result
  _gbif_detail_key="${usage_key:-}"
  if [[ -z "$_gbif_detail_key" || "$_gbif_detail_key" == "—" ]]; then
    _gbif_detail_key=$(echo "$gbif_search_raw" | jq -r '.results[0].key // empty')
  fi

  if [[ -n "$_gbif_detail_key" ]]; then
    detail_header "GBIF Detail — key=${_gbif_detail_key}" "$CYAN"

    echo "${DIM}  [1/4] GET ${GBIF_BASE}/species/${_gbif_detail_key}${RESET}"
    _gbif_det=$(curl -sS --max-time 10 \
      -H "User-Agent: ${UA}" -H "Accept: application/json" \
      "${GBIF_BASE}/species/${_gbif_detail_key}" 2>/dev/null || echo '{}')
    echo "$_gbif_det" | jq '{
      key, scientificName, canonicalName, authorship,
      rank, taxonomicStatus, kingdom, phylum, class, order, family, genus
    }' 2>/dev/null || true
    echo

    echo "${DIM}  [2/4] GET ${GBIF_BASE}/species/${_gbif_detail_key}/vernacularNames?limit=50${RESET}"
    _gbif_vern=$(curl -sS --max-time 10 \
      -H "User-Agent: ${UA}" -H "Accept: application/json" \
      "${GBIF_BASE}/species/${_gbif_detail_key}/vernacularNames?limit=50" 2>/dev/null || echo '{"results":[]}')
    _gbif_vern_count=$(echo "$_gbif_vern" | jq '.results | length')
    echo "  Total vernacular names: ${_gbif_vern_count}"
    echo "  ${GREEN}English names:${RESET}"
    echo "$_gbif_vern" | jq -r '
      [.results[] | select(.language == "eng" or .language == "en")]
      | to_entries[]
      | "    \(.key + 1)) \(.value.vernacularName)"
    ' 2>/dev/null || echo "    (none)"
    echo

    echo "${DIM}  [3/4] GET ${GBIF_BASE}/species/${_gbif_detail_key}/speciesProfiles?limit=50${RESET}"
    _gbif_prof=$(curl -sS --max-time 10 \
      -H "User-Agent: ${UA}" -H "Accept: application/json" \
      "${GBIF_BASE}/species/${_gbif_detail_key}/speciesProfiles?limit=50" 2>/dev/null || echo '{"results":[]}')
    _gbif_habitat=$(echo "$_gbif_prof" | jq -r '
      (.results | map(select(.habitat != null and .habitat != "")) | .[0].habitat) //
      ([
        if (.results | any(.terrestrial == true)) then "terrestrial" else empty end,
        if (.results | any(.freshwater == true)) then "freshwater" else empty end,
        if (.results | any(.marine == true)) then "marine" else empty end
      ] | join(", ")) // "—"
    ' 2>/dev/null || echo "—")
    echo "  ${GREEN}→ habitat: ${_gbif_habitat}${RESET}"
    echo

    echo "${DIM}  [4/4] GET ${GBIF_BASE}/species/${_gbif_detail_key}/distributions?limit=100${RESET}"
    _gbif_dist=$(curl -sS --max-time 10 \
      -H "User-Agent: ${UA}" -H "Accept: application/json" \
      "${GBIF_BASE}/species/${_gbif_detail_key}/distributions?limit=100" 2>/dev/null || echo '{"results":[]}')
    _gbif_dist_count=$(echo "$_gbif_dist" | jq '.results | length')
    echo "  Distribution records: ${_gbif_dist_count}"
    echo "  ${GREEN}Native ranges:${RESET}"
    echo "$_gbif_dist" | jq -r '
      [.results[] | select(.establishmentMeans == "NATIVE") | .locality // .country // "—"]
      | unique | to_entries[] | "    \(.key + 1)) \(.value)"
    ' 2>/dev/null || echo "    (none)"
    echo "  ${DIM}https://www.gbif.org/species/${_gbif_detail_key}${RESET}"
  else
    echo "${DIM}  (no usageKey to detail)${RESET}"
  fi
fi

# ===========================================================================
# 2. iNaturalist — taxa search (500 ms rate limit respected)
# ===========================================================================
section "2 / 5  iNaturalist" "$GREEN"

INAT_BASE="https://api.inaturalist.org/v1"
echo "${DIM}${INAT_BASE}/taxa?q=${QUERY}&per_page=${TOP_N}&rank=species,subspecies,variety&locale=en${RESET}"
sleep 0.5

inat_raw=$(curl -sS --max-time 15 \
  -H "User-Agent: ${UA}" \
  -H "Accept: application/json" \
  "${INAT_BASE}/taxa?q=$(jq -Rr @uri <<< "$QUERY")&per_page=${TOP_N}&rank=species,subspecies,variety&locale=en" \
  2>/dev/null || echo '{"results":[],"total_results":0}')

inat_count=$(echo "$inat_raw" | jq '.results | length')
inat_total=$(echo "$inat_raw" | jq '.total_results // 0')
echo "${GREEN}${inat_count} result(s) shown (${inat_total} total):${RESET}"
echo "$inat_raw" | jq -r '
  .results | to_entries[] |
  "  \(.key + 1)) [\(.value.id)] \(.value.name // "—")
     common:    \(.value.preferred_common_name // "—")
     rank:      \(.value.rank // "?")
     photo:     \(.value.default_photo.medium_url // .value.default_photo.url // "—")
     wikipedia: \(.value.wikipedia_url // "—")
"
' 2>/dev/null || echo "  (parse error)"

if [[ "$DETAILS" -eq 1 ]]; then
  _inat_id=$(echo "$inat_raw" | jq -r '.results[0].id // empty')
  if [[ -n "$_inat_id" ]]; then
    detail_header "iNaturalist Detail — id=${_inat_id}" "$GREEN"
    sleep 0.5
    echo "${DIM}  GET ${INAT_BASE}/taxa/${_inat_id}${RESET}"
    _inat_det=$(curl -sS --max-time 15 \
      -H "User-Agent: ${UA}" -H "Accept: application/json" \
      "${INAT_BASE}/taxa/${_inat_id}" 2>/dev/null || echo '{"results":[]}')
    _inat_taxon=$(echo "$_inat_det" | jq '.results[0] // {}')

    echo "$_inat_taxon" | jq '{
      id, name, preferred_common_name, rank, is_active,
      observations_count,
      wikipedia_url,
      has_photo: (.default_photo != null)
    }' 2>/dev/null || true
    echo

    echo "  ${GREEN}Ancestors:${RESET}"
    echo "$_inat_taxon" | jq -r '
      [.ancestors // [] | .[] | "    \(.rank): \(.name)"] | .[]
    ' 2>/dev/null || echo "    (none)"

    _inat_family=$(echo "$_inat_taxon" | jq -r '[.ancestors // [] | .[] | select(.rank == "family") | .name] | first // "—"')
    _inat_genus=$(echo "$_inat_taxon" | jq -r '[.ancestors // [] | .[] | select(.rank == "genus") | .name] | first // "—"')
    echo "  ${GREEN}→ family: ${_inat_family}  genus: ${_inat_genus}${RESET}"

    _inat_cons=$(echo "$_inat_taxon" | jq -r '.conservation_status | if . then "\(.status // "—") (\(.authority // "?"))" else "(none)" end' 2>/dev/null || echo "(none)")
    echo "  ${GREEN}→ conservation status: ${_inat_cons}${RESET}"
    echo "  ${DIM}https://www.inaturalist.org/taxa/${_inat_id}${RESET}"
  else
    echo "${DIM}  (no taxon id to detail)${RESET}"
  fi
fi

# ===========================================================================
# 3. Encyclopedia of Life (EoL)
# ===========================================================================
section "3 / 5  Encyclopedia of Life (EoL)" "$MAGENTA"

EOL_BASE="https://eol.org"
NON_PLANT_RE='virus|viroid|phage|bacterium|bacteria|phytoplasma|mycoplasma|oomycete|nematode|prion|fungus|fungi'

echo "${DIM}${EOL_BASE}/api/search/1.0.json?q=${QUERY}&per_page=${TOP_N}&exact=false${RESET}"
eol_raw=$(curl -sS --max-time 15 \
  -H "User-Agent: ${UA}" \
  -H "Accept: application/json" \
  "${EOL_BASE}/api/search/1.0.json?q=$(jq -Rr @uri <<< "$QUERY")&page=1&per_page=${TOP_N}&exact=false" \
  2>/dev/null || echo '{"results":[]}')

eol_filtered=$(echo "$eol_raw" | jq --arg re "$NON_PLANT_RE" '
  [.results[] | select((.title // "" | ascii_downcase) | test($re) | not)]
' 2>/dev/null || echo '[]')

eol_total=$(echo "$eol_filtered" | jq 'length')
echo "${GREEN}${eol_total} candidate(s) after filtering non-plant results (showing top ${TOP_N}):${RESET}"
echo "$eol_filtered" | jq -r --argjson n "$TOP_N" '
  .[0:$n] | to_entries[] |
  "  \(.key + 1)) [\(.value.id)] \(.value.title // "—")
     link:    \(.value.link // "no link")
     snippet: \(.value.content // "" | gsub("<[^>]+>"; "") | .[0:120])
"
' 2>/dev/null || echo "  (parse error)"

if [[ "$DETAILS" -eq 1 ]]; then
  _eol_id=$(echo "$eol_filtered" | jq -r '.[0].id // empty')
  if [[ -n "$_eol_id" ]]; then
    detail_header "EoL Page Detail — id=${_eol_id}" "$MAGENTA"
    echo "${DIM}  GET ${EOL_BASE}/api/pages/1.0.json?id=${_eol_id}&details=true&taxonomy=true&...${RESET}"
    _eol_page=$(curl -sS --max-time 20 \
      -H "User-Agent: ${UA}" -H "Accept: application/json" \
      "${EOL_BASE}/api/pages/1.0.json?id=${_eol_id}&details=true&taxonomy=true&images_per_page=1&texts_per_page=3&language=en&videos_per_page=0&sounds_per_page=0&vetted=2" \
      2>/dev/null || echo '{}')

    if echo "$_eol_page" | jq -e '.taxonConcept' &>/dev/null; then
      echo "  ${GREEN}Text descriptions:${RESET}"
      echo "$_eol_page" | jq -r '
        [.taxonConcept.dataObjects // [] | .[]
         | select(.dataType // "" | test("Text"; "i"))]
        | to_entries[]
        | "  [\(.key + 1)] lang=\(.value.language // "?")  source=\(.value.dataType // "?")
      \(.value.description // "—" | gsub("<[^>]+>"; "") | .[0:250])…"
      ' 2>/dev/null || echo "    (none)"
      echo

      echo "  ${GREEN}Images:${RESET}"
      echo "$_eol_page" | jq -r '
        [.taxonConcept.dataObjects // [] | .[]
         | select(.mimeType // "" | startswith("image/"))]
        | to_entries[]
        | "    [\(.key + 1)] \(.value.mimeType)  \(.value.eolMediaURL // .value.mediaURL // "—")"
      ' 2>/dev/null || echo "    (none)"
      echo

      echo "  ${GREEN}Taxonomy hierarchy:${RESET}"
      echo "$_eol_page" | jq -r '
        [.taxonConcept.taxonConcepts // [] | .[0].sourceHierarchyEntry.ancestors // [] | .[]
         | "    \(.taxonRank // "?"): \(([.vernacularNames // [] | .[] | select(.language == "en") | .vernacularName] | first) // .scientificName // "—")"]
        | .[]
      ' 2>/dev/null || echo "    (none)"
      echo "  ${DIM}https://eol.org/pages/${_eol_id}${RESET}"

      # TraitBank (may return 401 — handled gracefully)
      detail_header "EoL TraitBank" "$MAGENTA"
      _eol_cypher="MATCH (t:Trait)<-[:trait]-(p:Page{page_id:${_eol_id}}) OPTIONAL MATCH (t)-[:predicate]->(pred:Term) OPTIONAL MATCH (t)-[:object_term]->(obj:Term) RETURN pred.name, t.measurement, t.units_name, obj.name LIMIT 200"
      echo "${DIM}  GET ${EOL_BASE}/service/cypher?query=...${RESET}"
      _eol_tb_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
        -H "User-Agent: ${UA}" \
        "${EOL_BASE}/service/cypher?query=$(jq -Rr @uri <<< "$_eol_cypher")" 2>/dev/null || echo "000")
      if [[ "$_eol_tb_code" == "200" ]]; then
        _eol_traits=$(curl -sS --max-time 10 \
          -H "User-Agent: ${UA}" -H "Accept: application/json" \
          "${EOL_BASE}/service/cypher?query=$(jq -Rr @uri <<< "$_eol_cypher")" 2>/dev/null || echo '{}')
        _eol_row_count=$(echo "$_eol_traits" | jq '.data | length' 2>/dev/null || echo 0)
        echo "  Trait rows: ${_eol_row_count}"
        echo "$_eol_traits" | jq -r '
          .data[] |
          "  \(.[0] // "—") = \(.[3] // .[1] // "—") \(if .[2] then "(\(.[2]))" else "" end)"
        ' 2>/dev/null | sort | uniq -c | sort -rn | head -20 || true
      elif [[ "$_eol_tb_code" == "401" ]]; then
        echo "  ${YELLOW}TraitBank returned 401 — API now requires auth (DirtOS falls back to empty defaults)${RESET}"
      else
        echo "  ${DIM}TraitBank HTTP ${_eol_tb_code} — no trait data${RESET}"
      fi
    else
      echo "  ${YELLOW}Unexpected page structure — no .taxonConcept wrapper.${RESET}"
      echo "$_eol_page" | jq 'keys' 2>/dev/null || true
    fi
  else
    echo "${DIM}  (no EoL page id to detail)${RESET}"
  fi
fi

# ===========================================================================
# 4. Trefle (requires TREFLE_ACCESS_KEY)
# ===========================================================================
section "4 / 5  Trefle" "$YELLOW"

if [[ -z "$TREFLE_TOKEN" ]]; then
  echo "${YELLOW}Skipped — no TREFLE_ACCESS_KEY found in .env or environment.${RESET}"
  echo "  Set TREFLE_ACCESS_KEY=${ENV_FILE} to enable this source."
else
  TREFLE_BASE="https://trefle.io/api/v1"
  echo "${DIM}Using token: ${TREFLE_TOKEN:0:12}...${RESET}"
  echo "${DIM}${TREFLE_BASE}/plants/search?q=${QUERY}&limit=${TOP_N}${RESET}"

  trefle_raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${TREFLE_BASE}/plants/search?q=$(jq -Rr @uri <<< "$QUERY")&token=${TREFLE_TOKEN}" \
    2>/dev/null || echo '{"data":[],"meta":{"total":0}}')

  trefle_count=$(echo "$trefle_raw" | jq '.data | length')
  trefle_total=$(echo "$trefle_raw" | jq '.meta.total // 0')
  echo "${GREEN}${trefle_count} result(s) shown (${trefle_total} total):${RESET}"
  echo "$trefle_raw" | jq -r '
    .data | to_entries[] |
    "  \(.key + 1)) [\(.value.id)] \(.value.scientific_name // "—")
       common: \(.value.common_name // "—")
       family: \(.value.family // "—")  genus: \(.value.genus // "—")
       image:  \(.value.image_url // "—")
"
  ' 2>/dev/null || echo "  (parse error)"

  if [[ "$DETAILS" -eq 1 ]]; then
    _trefle_id=$(echo "$trefle_raw" | jq -r '.data[0].id // empty')
    if [[ -n "$_trefle_id" ]]; then
      detail_header "Trefle Detail — id=${_trefle_id}" "$YELLOW"
      echo "${DIM}  GET ${TREFLE_BASE}/plants/${_trefle_id}?token=...${RESET}"
      _trefle_det=$(curl -sS --max-time 15 \
        -H "User-Agent: ${UA}" -H "Accept: application/json" \
        "${TREFLE_BASE}/plants/${_trefle_id}?token=${TREFLE_TOKEN}" 2>/dev/null || echo '{}')

      if echo "$_trefle_det" | jq -e '.data' &>/dev/null; then
        echo "  ${GREEN}Basic info:${RESET}"
        echo "$_trefle_det" | jq '{
          id: .data.id,
          scientific_name: .data.scientific_name,
          common_name: .data.common_name,
          family: .data.family,
          family_common_name: .data.family_common_name,
          genus: .data.genus,
          image_url: .data.image_url
        }' 2>/dev/null || true
        echo

        _trefle_growth=$(echo "$_trefle_det" | jq '.data.main_species.growth // {}')
        echo "  ${GREEN}Growth data:${RESET}"
        echo "$_trefle_growth" | jq '{
          light, atmospheric_humidity, soil_humidity,
          ph_minimum, ph_maximum, days_to_harvest,
          spread, minimum_temperature, maximum_temperature,
          minimum_precipitation, maximum_precipitation
        }' 2>/dev/null || true

        _trefle_light=$(echo "$_trefle_growth" | jq -r '.light // empty')
        _trefle_soil=$(echo "$_trefle_growth" | jq -r '.soil_humidity // empty')
        [[ -n "$_trefle_light" ]] && \
          echo "  ${GREEN}→ light=${_trefle_light} → sun_requirement=$(map_sun "$_trefle_light")${RESET}"
        [[ -n "$_trefle_soil" ]] && \
          echo "  ${GREEN}→ soil_humidity=${_trefle_soil} → water_requirement=$(map_water "$_trefle_soil")${RESET}"
        echo "  ${GREEN}→ soil pH: $(echo "$_trefle_growth" | jq -r '.ph_minimum // "—"') – $(echo "$_trefle_growth" | jq -r '.ph_maximum // "—"')${RESET}"
        echo "  ${GREEN}→ days_to_harvest: $(echo "$_trefle_growth" | jq -r '.days_to_harvest // "—"')${RESET}"
        echo "  ${GREEN}→ spread (cm): $(echo "$_trefle_growth" | jq -r '.spread.cm // "—"')${RESET}"
        echo "  ${GREEN}→ min temp (°C): $(echo "$_trefle_growth" | jq -r '.minimum_temperature.deg_c // "—"')${RESET}"
        echo

        echo "  ${GREEN}Specifications:${RESET}"
        echo "$_trefle_det" | jq '.data.main_species.specifications // {} | {
          growth_form, growth_habit, growth_rate, ligneous_type,
          average_height, maximum_height, toxicity
        }' 2>/dev/null || true
      else
        echo "  ${RED}Detail fetch returned unexpected structure.${RESET}"
        echo "$_trefle_det" | jq 'keys' 2>/dev/null || echo "$_trefle_det" | head -c 200
      fi
    else
      echo "${DIM}  (no plant id to detail)${RESET}"
    fi
  fi
fi

# ===========================================================================
# 5. Wikipedia — OpenSearch
# ===========================================================================
section "5 / 5  Wikipedia" "$BLUE"

WIKI_API="https://en.wikipedia.org/w/api.php"
echo "${DIM}${WIKI_API}?action=opensearch&search=${QUERY}&limit=${TOP_N}&namespace=0&format=json&redirects=resolve${RESET}"

wiki_raw=$(curl -sS --max-time 15 \
  -H "User-Agent: ${UA}" \
  -H "Accept: application/json" \
  "${WIKI_API}?action=opensearch&search=$(jq -Rr @uri <<< "$QUERY")&limit=${TOP_N}&namespace=0&format=json&redirects=resolve" \
  2>/dev/null || echo '["",[], [], []]')

WIKI_REST="https://en.wikipedia.org/api/rest_v1"
wiki_len=$(echo "$wiki_raw" | jq 'length')
if [[ "$wiki_len" == "4" ]]; then
  wiki_count=$(echo "$wiki_raw" | jq '.[1] | length')
  echo "${GREEN}${wiki_count} result(s):${RESET}"
  echo "$wiki_raw" | jq -r '
    .[1] as $titles |
    .[2] as $descs  |
    .[3] as $urls   |
    [range(0; $titles | length)] | .[] |
    "  \(. + 1)) \($titles[.])
     desc: \($descs[.] | if . == "" then "(no description)" else .[0:120] end)
     url:  \($urls[.])
"
  ' 2>/dev/null || echo "  (parse error)"

  if [[ "$DETAILS" -eq 1 ]]; then
    _wiki_title=$(echo "$wiki_raw" | jq -r '.[1][0] // empty')
    if [[ -n "$_wiki_title" ]]; then
      _wiki_slug=$(jq -Rr 'gsub(" "; "_") | @uri' <<< "$_wiki_title")
      detail_header "Wikipedia Page Summary — \"${_wiki_title}\"" "$BLUE"
      echo "${DIM}  GET ${WIKI_REST}/page/summary/${_wiki_slug}${RESET}"
      _wiki_code_raw=$(curl -sS --max-time 15 -w '\n%{http_code}' \
        -H "User-Agent: ${UA}" -H "Accept: application/json" \
        "${WIKI_REST}/page/summary/${_wiki_slug}" 2>/dev/null || echo '{}\'$'\n000')
      _wiki_http=$(echo "$_wiki_code_raw" | tail -1)
      _wiki_body=$(echo "$_wiki_code_raw" | sed '$d')

      if [[ "$_wiki_http" == "200" ]]; then
        _wiki_extract=$(echo "$_wiki_body" | jq -r '.extract // "—"')
        _wiki_thumb=$(echo "$_wiki_body" | jq -r '.thumbnail.source // "—"')
        _wiki_page_url=$(echo "$_wiki_body" | jq -r '.content_urls.desktop.page // "—"')
        echo "  ${GREEN}Extract:${RESET}"
        echo "$_wiki_extract" | fold -s -w 100 | sed 's/^/  /'
        echo
        echo "  ${GREEN}Thumbnail:${RESET}  ${_wiki_thumb}"
        echo "  ${GREEN}Page URL:${RESET}   ${_wiki_page_url}"
        echo
        echo "  ${GREEN}Enrichment fields available:${RESET}"
        echo "$_wiki_body" | jq '{
          title, type, description,
          extract_length: (.extract | length),
          has_thumbnail: (.thumbnail != null),
          has_originalimage: (.originalimage != null),
          content_urls_keys: (.content_urls | keys)
        }' 2>/dev/null || true
      elif [[ "$_wiki_http" == "404" ]]; then
        echo "  ${YELLOW}Page not found (404) for slug \"${_wiki_title}\".${RESET}"
      else
        echo "  ${RED}HTTP ${_wiki_http} from Wikipedia REST API.${RESET}"
      fi
    else
      echo "${DIM}  (no Wikipedia title to detail)${RESET}"
    fi
  fi
else
  echo "${RED}Unexpected response format from Wikipedia (got ${wiki_len}-element array).${RESET}"
fi

# ===========================================================================
# Summary footer
# ===========================================================================
echo
echo "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo "${BOLD}${GREEN}  Done  —  query: \"${QUERY}\"${RESET}"
echo "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo
