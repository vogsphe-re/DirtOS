#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

# ── Clean previous build   ──────────────────────────────────────────────────
rm -rf dist
rm -rf src-tauri/target/release
cd src-tauri && cargo clean
