#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

# ── Clean build ───────────────────────────────────────────────────────────────
echo "Running clean build..."
rm -rf dist
pnpm build

echo ""
echo "Done."

