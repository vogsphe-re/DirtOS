# DirtOS User Guide

## First Launch

1. Start DirtOS.
2. Create your first environment in the welcome wizard.
3. Open Settings and add latitude and longitude if you want weather and sunlight features.
4. Use the Garden view to sketch plots, spaces, beds, paths, and structures.

## Core Workflow

1. Add plant species in the Plants area or use the built-in catalog.
2. Create individual plants and place them in garden locations.
3. Track issues, maintenance, and observations in Issues, Journal, and Schedules.
4. Connect sensors for live environmental readings and alert-driven issue creation.
5. Review dashboards, weather, and reports to monitor overall garden health.

## Backup And Restore

1. Open Settings.
2. Use Backups & Import/Export.
3. Choose `Export full backup` to save a portable JSON backup of the workspace.
4. Use `Load backup file` and `Import full backup` to restore it.

## Trefle — Plant Growing Data

DirtOS can enrich species with growing information (sun, water, soil pH, hardiness
zones, temperature ranges, and more) via [Trefle.io](https://trefle.io), a free
REST API backed by the USDA PLANTS database.

### Registering for a Trefle Access Token

1. Go to <https://trefle.io/users/sign_up> and create a free account.
2. Confirm your email address.
3. After signing in, visit <https://trefle.io/profile> to view your **Access Token**.
4. Copy the token (a long alphanumeric string).

### Adding the Token to DirtOS

1. Open **Settings** in DirtOS.
2. Find the **Trefle — Plant Data** card.
3. Click **Add key**, paste your access token, and click **Save**.

Once configured, the **Enrich from Trefle** button will appear on species detail
pages.  Trefle's free tier allows **120 requests per minute** with an effective
per-token limit of 60 requests per minute.

## Notes

- DirtOS stores its database and media locally in the application data directory.
- Weather falls back to cached data when the API is unavailable.
- The app follows your system light/dark preference by default, but you can override it in Settings.
