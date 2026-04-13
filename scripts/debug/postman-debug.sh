#!/usr/bin/env bash
# Syncs integration tokens from .env into the Postman debug environment.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_PATH="${PROJECT_ROOT}/.env"
POSTMAN_ENV="${PROJECT_ROOT}/api/debug/DirtOS.integrations.postman_environment.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required." >&2
  exit 1
fi

if [[ ! -f "${POSTMAN_ENV}" ]]; then
  echo "Error: missing ${POSTMAN_ENV}" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  if [[ -f "${ENV_PATH}" ]]; then
    grep -E "^${key}=" "${ENV_PATH}" | tail -n1 | cut -d= -f2- | sed 's/^"//; s/"$//' | tr -d '\r' || true
  fi
}

TREFLE_ACCESS_KEY="${TREFLE_ACCESS_KEY:-$(read_env_value TREFLE_ACCESS_KEY)}"
EAN_SEARCH_API_TOKEN="${EAN_SEARCH_API_TOKEN:-$(read_env_value EAN_SEARCH_API_TOKEN)}"
EAN_SEARCH_TOKEN="${EAN_SEARCH_TOKEN:-$(read_env_value EAN_SEARCH_TOKEN)}"

EAN_TOKEN="${EAN_SEARCH_API_TOKEN}"
if [[ -z "${EAN_TOKEN}" ]]; then
  EAN_TOKEN="${EAN_SEARCH_TOKEN}"
fi

TMP_FILE="$(mktemp)"
jq \
  --arg trefle "${TREFLE_ACCESS_KEY}" \
  --arg ean "${EAN_TOKEN}" \
  '
    .values = (
      .values
      | map(
          if .key == "trefleToken" then .value = $trefle
          elif .key == "eanToken" then .value = $ean
          else .
          end
        )
    )
  ' "${POSTMAN_ENV}" > "${TMP_FILE}"

mv "${TMP_FILE}" "${POSTMAN_ENV}"

echo "Synced tokens into ${POSTMAN_ENV}"
if [[ -n "${TREFLE_ACCESS_KEY}" ]]; then
  echo "- trefleToken: set"
else
  echo "- trefleToken: empty"
fi
if [[ -n "${EAN_TOKEN}" ]]; then
  echo "- eanToken: set"
else
  echo "- eanToken: empty"
fi
