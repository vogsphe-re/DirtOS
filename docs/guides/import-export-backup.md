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

Recommended frequency: weekly for active gardens, daily during peak season.

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

## Keywords

- [Backup Export](../reference/glossary.md#backup-export)
- [Import](../reference/glossary.md#import)
- [Restore](../reference/glossary.md#restore)
