#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIRTOS_DOCS_VERSION=$(date -u +"%Y-%m-%d")
export DIRTOS_DOCS_VERSION

cd "$SCRIPT_DIR/.."

pnpm docsmd:snapshot -- "$DIRTOS_DOCS_VERSION" > docs.versions.json