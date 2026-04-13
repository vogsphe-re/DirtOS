#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

echo "Running lint checks..."

echo "- ESLint"
pnpm exec eslint .

echo "- Markdownlint"
pnpm dlx markdownlint-cli2 \
	"**/*.md" \
	"#node_modules" \
	"#dist" \
	"#site" \
	"#.vscode" \
	"#docs/.dev" \
	"#api/debug" \
	"#src-tauri/target" \
	"#src-tauri/gen" \
	"#inc/ha-dirtos"

echo "- Prettier"
pnpm dlx prettier --check \
	.markdownlint.json \
	.prettierrc \
	docmd.config.js \
	eslint.config.js \
	package.json \
	postcss.config.cjs \
	tsconfig.json \
	tsconfig.node.json \
	vite.config.ts

echo "Lint checks passed."
