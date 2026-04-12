#!/usr/bin/env bash
# ============================================================================
# wikipedia-debug.sh — Interactive Wikipedia API debugger for DirtOS
#
# Mirrors the API calls made by src-tauri/src/services/wikipedia.rs:
#   1. Summary    — REST page summary (extract, thumbnail, URLs)
#   2. Search     — OpenSearch fuzzy title search
#
# Usage:
#   ./scripts/wikipedia-debug.sh                          # interactive mode
#   ./scripts/wikipedia-debug.sh summary "Tomato"         # page summary
#   ./scripts/wikipedia-debug.sh search "solanum"         # search titles
# ============================================================================
set -euo pipefail

UA="DirtOS/1.0 (open-source plant tracking application; contact via GitHub)"
REST_BASE="https://en.wikipedia.org/api/rest_v1"
API_BASE="https://en.wikipedia.org/w/api.php"

# Colours (disabled if not a tty)
if [[ -t 1 ]]; then
  BOLD=$'\033[1m' DIM=$'\033[2m' GREEN=$'\033[32m'
  CYAN=$'\033[36m' YELLOW=$'\033[33m' RED=$'\033[31m'
  BLUE=$'\033[34m' RESET=$'\033[0m'
else
  BOLD="" DIM="" GREEN="" CYAN="" YELLOW="" RED="" BLUE="" RESET=""
fi

# Require curl & jq
for cmd in curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "${RED}Error: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Helper: convert slug (spaces → underscores, then URL-encode)
# ---------------------------------------------------------------------------
slug_encode() {
  local slug="${1// /_}"
  jq -Rr @uri <<< "$slug"
}

# ---------------------------------------------------------------------------
# 1. Page Summary (REST API)
# ---------------------------------------------------------------------------
wiki_summary() {
  local slug="${1:?Usage: wiki_summary <page_title_or_slug>}"
  local encoded
  encoded=$(slug_encode "$slug")

  echo "${CYAN}${BOLD}━━━ Wikipedia Page Summary ━━━${RESET}"
  echo "${DIM}GET ${REST_BASE}/page/summary/${encoded}${RESET}"
  echo

  local http_code raw
  raw=$(curl -sS --max-time 15 -w '\n%{http_code}' \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${REST_BASE}/page/summary/${encoded}")

  http_code=$(echo "$raw" | tail -1)
  raw=$(echo "$raw" | sed '$d')

  if [[ "$http_code" == "404" ]]; then
    echo "${RED}Page not found (HTTP 404): \"${slug}\"${RESET}"
    echo "${DIM}Try searching with: search <query>${RESET}"
    return 1
  fi

  if [[ "$http_code" != "200" ]]; then
    echo "${RED}HTTP ${http_code} error:${RESET}"
    echo "$raw" | head -c 500
    return 1
  fi

  # Extract key fields (mirrors wikipedia.rs WikiSummary)
  local title extract thumbnail page_url
  title=$(echo "$raw" | jq -r '.title // "—"')
  extract=$(echo "$raw" | jq -r '.extract // "—"')
  thumbnail=$(echo "$raw" | jq -r '.thumbnail.source // "—"')
  page_url=$(echo "$raw" | jq -r '.content_urls.desktop.page // "—"')

  echo "${GREEN}Page: ${title}${RESET}"
  echo
  echo "${BOLD}Extract:${RESET}"
  echo "$extract" | fold -s -w 100
  echo
  echo "${BOLD}Thumbnail:${RESET}  ${thumbnail}"
  echo "${BOLD}Page URL:${RESET}   ${page_url}"
  echo

  echo "${DIM}Response structure:${RESET}"
  echo "$raw" | jq '{
    title, type, description, extract_length: (.extract | length),
    has_thumbnail: (.thumbnail != null),
    has_originalimage: (.originalimage != null),
    content_urls_keys: (.content_urls | keys)
  }'
  echo

  # Optionally dump full raw
  read -rp "${YELLOW}Show full raw JSON? [y/N] ${RESET}" show_raw
  if [[ "${show_raw,,}" == "y" ]]; then
    echo "$raw" | jq .
  fi
}

# ---------------------------------------------------------------------------
# 2. Search (OpenSearch API)
# ---------------------------------------------------------------------------
wiki_search() {
  local query="${1:?Usage: wiki_search <query> [limit]}"
  local limit="${2:-10}"

  echo "${CYAN}${BOLD}━━━ Wikipedia OpenSearch ━━━${RESET}"
  echo "${DIM}GET ${API_BASE}?action=opensearch&search=${query}&limit=${limit}&namespace=0&format=json&redirects=resolve${RESET}"
  echo

  local raw
  raw=$(curl -sS --max-time 15 \
    -H "User-Agent: ${UA}" \
    -H "Accept: application/json" \
    "${API_BASE}?action=opensearch&search=$(jq -Rr @uri <<< "$query")&limit=${limit}&namespace=0&format=json&redirects=resolve")

  # OpenSearch returns a 4-element array: [query, [titles], [descriptions], [urls]]
  local arr_len
  arr_len=$(echo "$raw" | jq 'length')

  if [[ "$arr_len" != "4" ]]; then
    echo "${RED}Unexpected response structure (expected 4-element array, got ${arr_len}):${RESET}"
    echo "$raw" | jq . 2>/dev/null || echo "$raw" | head -c 500
    return 1
  fi

  local count
  count=$(echo "$raw" | jq '.[1] | length')
  echo "${GREEN}${count} result(s):${RESET}"
  echo

  # Zip titles, descriptions, URLs together (mirrors wikipedia.rs)
  echo "$raw" | jq -r '
    .[1] as $titles |
    .[2] as $descs |
    .[3] as $urls |
    [range(0; $titles | length)] |
    .[] |
    "  \(. + 1)) \($titles[.])
     slug: \($titles[.] | gsub(" "; "_"))
     desc: \($descs[.] // "—" | .[0:150])
     url:  \($urls[.] // "—")
"
  '

  LAST_SEARCH_RESULTS="$raw"
}

# ---------------------------------------------------------------------------
# Interactive loop
# ---------------------------------------------------------------------------
interactive() {
  LAST_SEARCH_RESULTS=""

  echo "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
  echo "${BOLD}${GREEN}║    DirtOS — Wikipedia API Debugger           ║${RESET}"
  echo "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
  echo
  echo "Commands:"
  echo "  ${BOLD}summary${RESET} <title_or_slug>  — Fetch page summary (extract + thumbnail)"
  echo "  ${BOLD}search${RESET}  <query> [limit]  — OpenSearch title search"
  echo "  ${BOLD}pick${RESET}    <n>              — Pick nth search result → summary"
  echo "  ${BOLD}all${RESET}     <query>          — Search → pick first → summary"
  echo "  ${BOLD}quit${RESET}                     — Exit"
  echo

  while true; do
    read -rp "${BLUE}wiki> ${RESET}" line || break
    read -ra args <<< "$line"
    local cmd="${args[0]:-}"

    case "$cmd" in
      summary|sum|g)
        wiki_summary "${args[*]:1}" || true
        ;;
      search|s)
        wiki_search "${args[1]:-}" "${args[2]:-10}" || true
        ;;
      pick)
        local n="${args[1]:-1}"
        if [[ -z "$LAST_SEARCH_RESULTS" ]]; then
          echo "${RED}No previous search results. Run 'search' first.${RESET}"
          continue
        fi
        local title
        title=$(echo "$LAST_SEARCH_RESULTS" | jq -r ".[1][$((n - 1))] // empty")
        if [[ -z "$title" ]]; then
          echo "${RED}No result at position ${n}.${RESET}"
          continue
        fi
        local slug="${title// /_}"
        echo "${GREEN}Picking result #${n} → \"${slug}\"${RESET}"
        echo
        wiki_summary "$slug" || true
        ;;
      all|a)
        local q="${args[*]:1}"
        if [[ -z "$q" ]]; then
          echo "${RED}Usage: all <query>${RESET}"
          continue
        fi
        wiki_search "$q" 5 || continue
        local first_title
        first_title=$(echo "$LAST_SEARCH_RESULTS" | jq -r '.[1][0] // empty')
        if [[ -z "$first_title" ]]; then
          echo "${RED}No results to pick from.${RESET}"
          continue
        fi
        local first_slug="${first_title// /_}"
        echo "${GREEN}Auto-picking first result → \"${first_slug}\"${RESET}"
        echo
        wiki_summary "$first_slug" || true
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
        echo "  Try: summary, search, pick, all, quit"
        ;;
    esac
    echo
  done
}

# ---------------------------------------------------------------------------
# CLI dispatch
# ---------------------------------------------------------------------------
case "${1:-}" in
  summary|sum|g)  wiki_summary "${*:2}" ;;
  search|s)       wiki_search "${2:-}" "${3:-10}" ;;
  "")             interactive ;;
  *)
    echo "Usage: $0 [summary <slug>|search <query>]"
    echo "       $0          # interactive mode"
    exit 1
    ;;
esac
