#!/usr/bin/env bash
# assign-asset-tags.sh
# Back-fills asset_id values for existing records that were created before the
# inventory system was added.  Safe to run multiple times — only updates rows
# where asset_id IS NULL.
#
# Usage:
#   ./scripts/assign-asset-tags.sh [path-to-db]
#
# If no path is supplied the script attempts to find the DirtOS database in the
# default Tauri app-data directory.

set -euo pipefail

# ── Locate the database ──────────────────────────────────────────────────────

DEFAULT_DB_PATH="$HOME/.local/share/dirtos/dirtos.db"
DB_PATH="${1:-$DEFAULT_DB_PATH}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: Database not found at: $DB_PATH"
  echo "Usage: $0 [path-to-dirtos.db]"
  exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
  echo "ERROR: sqlite3 is required but not installed."
  exit 1
fi

echo "Using database: $DB_PATH"

# ── Tag generator (SQLite expression) ───────────────────────────────────────
# Produces PREFIX-YYRRRR where YY = last 2 digits of current year and
# RRRR = 4 random lowercase hex characters (from two random bytes).

YEAR=$(date +%y)

# SQLite doesn't have a strftime('%y') that zero-pads and gives last 2 digits
# on all platforms, so we pass YY from the shell and embed it in the SQL.

sqlite3 "$DB_PATH" <<SQL
-- Environments → GDN-YYRRRR
UPDATE environments
SET asset_id = 'GDN-${YEAR}' || lower(hex(randomblob(2)))
WHERE asset_id IS NULL;

-- Locations → prefix depends on type column
UPDATE locations
SET asset_id = CASE type
  WHEN 'plot'  THEN 'PLT-${YEAR}'
  WHEN 'space' THEN 'SPC-${YEAR}'
  WHEN 'tent'  THEN 'TNT-${YEAR}'
  WHEN 'tray'  THEN 'TRY-${YEAR}'
  WHEN 'pot'   THEN 'POT-${YEAR}'
  WHEN 'shed'  THEN 'SHD-${YEAR}'
  ELSE              'LOC-${YEAR}'
  END || lower(hex(randomblob(2)))
WHERE asset_id IS NULL;

-- Individual plants → PLA-YYRRRR
-- (plants already had asset_id before this migration, but the old format was
--  different; only update rows that genuinely have NULL)
UPDATE plants
SET asset_id = 'PLA-${YEAR}' || lower(hex(randomblob(2)))
WHERE asset_id IS NULL;

-- Seed lots → SED-YYRRRR
UPDATE seed_lots
SET asset_id = 'SED-${YEAR}' || lower(hex(randomblob(2)))
WHERE asset_id IS NULL;

-- Seedling trays → TRY-YYRRRR
UPDATE seedling_trays
SET asset_id = 'TRY-${YEAR}' || lower(hex(randomblob(2)))
WHERE asset_id IS NULL;

-- Harvests → LOT-YY<plant-suffix> when the parent plant has a PLA- tag,
-- otherwise LOT-YYRRRR with fresh random hex.
UPDATE harvests
SET asset_id = CASE
  WHEN (SELECT asset_id FROM plants WHERE id = harvests.plant_id) LIKE 'PLA-%'
  THEN 'LOT-' || substr((SELECT asset_id FROM plants WHERE id = harvests.plant_id), 5)
  ELSE 'LOT-${YEAR}' || lower(hex(randomblob(2)))
  END
WHERE asset_id IS NULL;
SQL

echo "Done.  Summary of assigned tags:"
sqlite3 "$DB_PATH" <<'SQL'
SELECT 'environments'   AS tbl, count(*) AS total, sum(asset_id IS NOT NULL) AS tagged FROM environments
UNION ALL
SELECT 'locations',     count(*), sum(asset_id IS NOT NULL) FROM locations
UNION ALL
SELECT 'plants',        count(*), sum(asset_id IS NOT NULL) FROM plants
UNION ALL
SELECT 'seed_lots',     count(*), sum(asset_id IS NOT NULL) FROM seed_lots
UNION ALL
SELECT 'seedling_trays',count(*), sum(asset_id IS NOT NULL) FROM seedling_trays
UNION ALL
SELECT 'harvests',      count(*), sum(asset_id IS NOT NULL) FROM harvests;
SQL
