#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
GIT_URL="https://code.dev.nativeit.net/sdavis/DirtOS.git"
GIT_BRANCH="main"



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

# ── Determine documentation release version ──────────────────────────────────
# Docs can be versioned independently by overriding DOCS_VERSION_ID/LABEL.
CURRENT_DOCS_VERSION="$(node -p "require('./docs.versions.json').current.id")"
DOCS_VERSION_ID="${DOCS_VERSION_ID:-$NEW_VERSION}"
DOCS_VERSION_LABEL="${DOCS_VERSION_LABEL:-$DOCS_VERSION_ID}"
DOCS_ARCHIVE_DIR=""

echo "Current docs:    $CURRENT_DOCS_VERSION"
echo "New docs:        $DOCS_VERSION_LABEL ($DOCS_VERSION_ID)"

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

# ── Update VERSION file ─────────────────────────────────────────────────────
echo "$NEW_VERSION" > VERSION

echo "Version bumped to $NEW_VERSION in package.json, Cargo.toml, tauri.conf.json, and VERSION"

# ── Version documentation when needed ────────────────────────────────────────
if [[ "$CURRENT_DOCS_VERSION" != "$DOCS_VERSION_ID" ]]; then
  echo "Archiving documentation version $CURRENT_DOCS_VERSION..."
  pnpm docsmd:snapshot -- "$DOCS_VERSION_ID" "$DOCS_VERSION_LABEL"
  DOCS_ARCHIVE_DIR="docs-$CURRENT_DOCS_VERSION"
else
  echo "Documentation already targets $DOCS_VERSION_ID. Skipping docs snapshot."
fi

# ── Clean build ───────────────────────────────────────────────────────────────
echo "Building documentation..."
pnpm docsmd
echo "Running clean build..."
rm -rf dist
pnpm build

# ── Commit version bump and tag ───────────────────────────────────────────────
GIT_ADD_PATHS=(
  package.json
  src-tauri/Cargo.toml
  src-tauri/tauri.conf.json
  VERSION
  docs.versions.json
)

if [[ -n "$DOCS_ARCHIVE_DIR" ]]; then
  GIT_ADD_PATHS+=("$DOCS_ARCHIVE_DIR")
fi

git add "${GIT_ADD_PATHS[@]}"
git commit -m "chore: bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo ""
echo "Done. Tagged commit as v$NEW_VERSION"
echo "Push with: git push && git push --tags"
