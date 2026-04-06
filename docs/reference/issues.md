---
title: "Issues"
description: "Reference for issue tracking, labels, comments, and workflow states."
---

# Issues

## Issue fields

| Field | Type | Notes |
|---|---|---|
| `environment_id` | integer/null | Scope |
| `plant_id` | integer/null | Optional plant link |
| `location_id` | integer/null | Optional location link |
| `title` | string | Summary |
| `description` | string/null | Diagnostic details |
| `status` | enum | `new`, `open`, `in_progress`, `closed` |
| `priority` | enum | `low`, `medium`, `high`, `critical` |
| `closed_at` | timestamp/null | Close marker |

## Label fields

| Field | Type | Notes |
|---|---|---|
| `name` | string | Label name |
| `color` | string/null | Visual grouping |
| `icon` | string/null | UI icon identifier |

## Comment fields

| Field | Type | Notes |
|---|---|---|
| `issue_id` | integer | Parent issue |
| `body` | string | Action note or update |
| `created_at` | timestamp | Timeline ordering |

## Workflow guideline

1. Create with clear scope (plant/location/environment).
2. Add labels and priority at creation time.
3. Record actions in comments.
4. Close only after validation.

> [SCREENSHOT:issue-detail-with-comments] Capture an issue detail page with labels, status, and comment timeline.

## Keywords

- [Issue](glossary.md#issue)
- [Issue Status](glossary.md#issue-status)
- [Issue Priority](glossary.md#issue-priority)
