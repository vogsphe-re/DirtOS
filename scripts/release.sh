#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

# ── Require clean working tree ────────────────────────────────────────────────
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean. Commit or stash your changes first." >&2
  exit 1
fi

# ── Read current version from package.json ───────────────────────────────────
CURRENT_VERSION="$(node -p "require('./package.json').version")"
echo "Current version: $CURRENT_VERSION"

# ── Increment the patch (build) number ───────────────────────────────────────
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
PATCH=$(( PATCH + 1 ))
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version:     $NEW_VERSION"

# ── Update package.json ──────────────────────────────────────────────────────
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# ── Update src-tauri/Cargo.toml ──────────────────────────────────────────────
sed -i "0,/^version = \"[^\"]*\"/{s/^version = \"[^\"]*\"/version = \"$NEW_VERSION\"/}" src-tauri/Cargo.toml

# ── Update src-tauri/tauri.conf.json ─────────────────────────────────────────
node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  conf.version = '$NEW_VERSION';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

echo "Version bumped to $NEW_VERSION in package.json, Cargo.toml, and tauri.conf.json"

# ── Clean build ───────────────────────────────────────────────────────────────
echo "Running clean build..."
rm -rf dist
pnpm build

# ── Commit version bump and tag ───────────────────────────────────────────────
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo ""
echo "Done. Tagged commit as v$NEW_VERSION"
echo "Push with: git push && git push --tags"
