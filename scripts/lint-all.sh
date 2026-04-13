#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

echo "Running lint checks..."

echo "- ESLint"
pnpm exec eslint . --max-warnings 0

echo "- Markdownlint"
pnpm dlx markdownlint-cli2 "**/*.md" "#node_modules" "#dist" "#site" "#src-tauri/target"

echo "- Prettier"
pnpm dlx prettier --check .

echo "Lint checks passed."
