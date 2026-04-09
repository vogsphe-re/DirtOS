---
title: "Import, Export, Backup"
description: "Data safety procedures for backup, export, and restore."
---

## What full export includes

A full export captures:

- Application tables (except migration internals)
- Stored media references and files
- Serialized records for import replay

## Export procedure

1. Open backup/export UI.
2. Run full export.
3. Save JSON to a trusted local or cloud destination.

For scheduled backups, create a backup job with:

- Strategy: `full`, `incremental`, or `hybrid`.
- Destination: local disk, network share, or cloud provider (Dropbox, Google Drive, OneDrive).
- Optional lifecycle policy: `keep_last` to automatically prune old local backups.
- Optional dedupe: skip writing duplicates by content hash.

Recommended frequency: weekly for active gardens, daily during peak season.

Recommended topology:

- Keep the live DirtOS data directory and backup destination on different storage targets.
- Keep at least one off-device backup destination (cloud or remote NAS).

## Import procedure

1. Select a backup JSON file.
2. Confirm destructive replace behavior.
3. Execute import.
4. Validate key records (environments, plants, schedules, issues).

> [SCREENSHOT:backup-import-confirmation]
> Capture warning/confirmation step before full import.

## Safety practices

- Keep multiple dated backups.
- Test restore on a non-production profile before major upgrades.
- Export before migration-heavy updates.
- Avoid storing API keys/tokens in backups unless you explicitly need secret recovery.

## Keywords

- [Backup Export](../reference/glossary.md#backup-export)
- [Import](../reference/glossary.md#import)
- [Restore](../reference/glossary.md#restore)
