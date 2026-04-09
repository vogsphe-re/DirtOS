use std::collections::HashSet;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Utc;
use reqwest::Client;
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::{
    db::{
        self,
        integrations,
        models::{
            AutomationEvent, BackupExportData, BackupFormat, BackupJob, BackupRun,
            EnvironmentMapSetting, ImportPayload, IntegrationConfig, IntegrationProvider,
            IntegrationSyncRun, IntegrationWebhookToken, NewBackupJob, OSMPlaceResult,
            Species, SpeciesExternalSource, SyncSpeciesResult, UpdateBackupJob,
            UpsertEnvironmentMapSetting, UpsertIntegrationConfig,
        },
        sensors, species,
    },
    services::{backup_jobs, export_import, inaturalist, osm, wikipedia},
    AppStorageState,
};

fn build_http_client() -> Result<Client, String> {
    Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())
}

fn sanitize_wiki_extract(input: Option<String>) -> Option<String> {
    let clean = input
        .map(|s| s.replace('\n', " ").replace('\r', " "))
        .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" "))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    clean.map(|s| {
        if s.len() > 1800 {
            format!("{}…", &s[..1800])
        } else {
            s
        }
    })
}

async fn execute_export(
    pool: &SqlitePool,
    format: BackupFormat,
    include_secrets: bool,
    encryption_password: Option<String>,
) -> Result<crate::db::models::ExportPayload, String> {
    let mut app_settings = integrations::list_app_settings(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut integration_configs = integrations::list_integration_configs(pool)
        .await
        .map_err(|e| e.to_string())?;

    if !include_secrets {
        app_settings = export_import::redact_settings(&app_settings);
        for cfg in &mut integration_configs {
            cfg.auth_json = export_import::sanitize_json(cfg.auth_json.clone(), false);
            cfg.settings_json = export_import::sanitize_json(cfg.settings_json.clone(), false);
        }
    }

    let export_data = BackupExportData {
        version: "10a.1".to_string(),
        exported_at: Utc::now().to_rfc3339(),
        app_settings,
        integration_configs,
        map_settings: integrations::list_map_settings(pool)
            .await
            .map_err(|e| e.to_string())?,
        backup_jobs: integrations::list_backup_jobs(pool)
            .await
            .map_err(|e| e.to_string())?,
    };

    let mut json_payload = export_import::to_json(&export_data)?;
    let mut yaml_payload = export_import::to_yaml(&export_data)?;

    if include_secrets {
        if let Some(password) = encryption_password {
            json_payload = export_import::encrypt_text(&json_payload, &password)?;
            yaml_payload = export_import::encrypt_text(&yaml_payload, &password)?;
        }
    }

    match format {
        BackupFormat::Json => Ok(crate::db::models::ExportPayload {
            format,
            filename: format!("dirtos-export-{}.json", Utc::now().format("%Y%m%d-%H%M%S")),
            content: json_payload,
            is_base64: false,
        }),
        BackupFormat::Yaml => Ok(crate::db::models::ExportPayload {
            format,
            filename: format!("dirtos-export-{}.yaml", Utc::now().format("%Y%m%d-%H%M%S")),
            content: yaml_payload,
            is_base64: false,
        }),
        BackupFormat::Archive => {
            let app_settings_rows = integrations::list_csv_from_query(
                pool,
                "SELECT key, COALESCE(value, '') FROM app_settings ORDER BY key ASC",
            )
            .await
            .map_err(|e| e.to_string())?;

            let integration_rows = integrations::list_csv_from_query(
                pool,
                "SELECT provider, enabled, COALESCE(sync_interval_minutes, ''),
                        COALESCE(cache_ttl_minutes, ''), COALESCE(rate_limit_per_minute, ''),
                        COALESCE(last_synced_at, ''), COALESCE(last_error, '')
                 FROM integration_configs
                 ORDER BY provider ASC",
            )
            .await
            .map_err(|e| e.to_string())?;

            let app_settings_csv = export_import::csv_string(&["key", "value"], app_settings_rows)?;
            let integration_csv = export_import::csv_string(
                &[
                    "provider",
                    "enabled",
                    "sync_interval_minutes",
                    "cache_ttl_minutes",
                    "rate_limit_per_minute",
                    "last_synced_at",
                    "last_error",
                ],
                integration_rows,
            )?;

            let schema_sql = integrations::sqlite_schema_sql(pool)
                .await
                .map_err(|e| e.to_string())?;

            let archive_bytes = export_import::build_archive(
                &json_payload,
                &yaml_payload,
                &schema_sql,
                &app_settings_csv,
                &integration_csv,
            )?;

            Ok(crate::db::models::ExportPayload {
                format,
                filename: format!("dirtos-export-{}.zip", Utc::now().format("%Y%m%d-%H%M%S")),
                content: STANDARD.encode(archive_bytes),
                is_base64: true,
            })
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn list_integration_configs(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<IntegrationConfig>, String> {
    integrations::list_integration_configs(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_integration_config(
    pool: State<'_, SqlitePool>,
    provider: IntegrationProvider,
    input: UpsertIntegrationConfig,
) -> Result<IntegrationConfig, String> {
    integrations::upsert_integration_config(&pool, provider, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_species_external_sources(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<Vec<SpeciesExternalSource>, String> {
    integrations::list_species_sources(&pool, species_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn sync_species_external_sources(
    pool: State<'_, SqlitePool>,
    species_id: i64,
) -> Result<SyncSpeciesResult, String> {
    let sp = species::get_species(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Species {species_id} not found"))?;

    let client = build_http_client()?;
    let now = Utc::now().naive_utc();

    let mut result = SyncSpeciesResult {
        species: None,
        synced_providers: Vec::new(),
        skipped_providers: Vec::new(),
        errors: Vec::new(),
    };

    let existing_sources = integrations::list_species_sources(&pool, species_id)
        .await
        .map_err(|e| e.to_string())?;

    let source_provider_set: HashSet<String> = existing_sources
        .iter()
        .map(|s| format!("{:?}", s.provider).to_ascii_lowercase())
        .collect();

    for provider in [IntegrationProvider::Inaturalist, IntegrationProvider::Wikipedia] {
        let cfg = integrations::get_integration_config(&pool, provider.clone())
            .await
            .map_err(|e| e.to_string())?;

        if let Some(cfg) = cfg {
            if !cfg.enabled {
                result
                    .skipped_providers
                    .push(format!("{:?}", provider).to_ascii_lowercase());
                continue;
            }

            if let Some(interval) = cfg.sync_interval_minutes {
                if let Some(prev) = existing_sources
                    .iter()
                    .find(|s| s.provider == provider)
                    .map(|s| s.last_synced_at)
                {
                    let elapsed = now - prev;
                    if elapsed.num_minutes() < interval {
                        result
                            .skipped_providers
                            .push(format!("{:?}", provider).to_ascii_lowercase());
                        continue;
                    }
                }
            }
        }

        match provider {
            IntegrationProvider::Inaturalist => {
                let run_id = integrations::create_sync_run(&pool, "inaturalist", "species_sync")
                    .await
                    .map_err(|e| e.to_string())?;

                let taxon_id = sp.inaturalist_id;
                let sync_result: Result<(), String> = async {
                    let detail = if let Some(id) = taxon_id {
                        inaturalist::get_taxon(&client, id).await?
                    } else {
                        let query = sp
                            .scientific_name
                            .as_deref()
                            .filter(|s| !s.is_empty())
                            .unwrap_or(sp.common_name.as_str());
                        let match_result = inaturalist::search_taxa(&client, query)
                            .await?
                            .into_iter()
                            .next()
                            .ok_or_else(|| {
                                format!("No iNaturalist results for '{query}' while syncing")
                            })?;
                        inaturalist::get_taxon(&client, match_result.id).await?
                    };

                    let updated = species::update_species_inaturalist(
                        &pool,
                        species_id,
                        detail.id,
                        Some(detail.name.clone()),
                        detail.family.clone(),
                        detail.genus.clone(),
                        detail.default_photo_url.clone(),
                        None,
                        detail.raw_json.clone(),
                    )
                    .await
                    .map_err(|e| e.to_string())?;

                    integrations::upsert_species_source(
                        &pool,
                        species_id,
                        IntegrationProvider::Inaturalist,
                        Some(detail.id.to_string()),
                        Some(format!("https://www.inaturalist.org/taxa/{}", detail.id)),
                        Some("iNaturalist data and media are provided under iNaturalist licensing terms".to_string()),
                        None,
                        None,
                        Some(detail.raw_json),
                    )
                    .await
                    .map_err(|e| e.to_string())?;

                    integrations::update_sync_outcome(&pool, IntegrationProvider::Inaturalist, None)
                        .await
                        .map_err(|e| e.to_string())?;

                    result.species = updated;
                    Ok(())
                }
                .await;

                match sync_result {
                    Ok(_) => {
                        integrations::complete_sync_run(&pool, run_id, "success", Some(1), Some(1), None)
                            .await
                            .map_err(|e| e.to_string())?;
                        result.synced_providers.push("inaturalist".to_string());
                    }
                    Err(err) => {
                        integrations::complete_sync_run(
                            &pool,
                            run_id,
                            "error",
                            Some(1),
                            Some(0),
                            Some(err.clone()),
                        )
                        .await
                        .map_err(|e| e.to_string())?;
                        integrations::update_sync_outcome(
                            &pool,
                            IntegrationProvider::Inaturalist,
                            Some(err.clone()),
                        )
                        .await
                        .map_err(|e| e.to_string())?;
                        result.errors.push(format!("inaturalist: {err}"));
                    }
                }
            }
            IntegrationProvider::Wikipedia => {
                let run_id = integrations::create_sync_run(&pool, "wikipedia", "species_sync")
                    .await
                    .map_err(|e| e.to_string())?;

                let sync_result: Result<(), String> = async {
                    let slug = sp
                        .wikipedia_slug
                        .clone()
                        .filter(|s| !s.is_empty())
                        .or_else(|| sp.scientific_name.clone().map(|s| s.replace(' ', "_")))
                        .unwrap_or_else(|| sp.common_name.replace(' ', "_"));

                    let summary = wikipedia::get_summary(&client, &slug).await?;
                    let sanitized = sanitize_wiki_extract(summary.extract.clone());

                    let updated = species::update_species_wikipedia(
                        &pool,
                        species_id,
                        summary.slug.clone(),
                        sanitized,
                        summary.thumbnail_url.clone(),
                        summary.raw_json.clone(),
                    )
                    .await
                    .map_err(|e| e.to_string())?;

                    integrations::upsert_species_source(
                        &pool,
                        species_id,
                        IntegrationProvider::Wikipedia,
                        Some(summary.slug.clone()),
                        summary.page_url.clone(),
                        Some("Wikipedia content is licensed under CC BY-SA".to_string()),
                        None,
                        None,
                        Some(summary.raw_json),
                    )
                    .await
                    .map_err(|e| e.to_string())?;

                    integrations::update_sync_outcome(&pool, IntegrationProvider::Wikipedia, None)
                        .await
                        .map_err(|e| e.to_string())?;

                    result.species = updated;
                    Ok(())
                }
                .await;

                match sync_result {
                    Ok(_) => {
                        integrations::complete_sync_run(&pool, run_id, "success", Some(1), Some(1), None)
                            .await
                            .map_err(|e| e.to_string())?;
                        result.synced_providers.push("wikipedia".to_string());
                    }
                    Err(err) => {
                        integrations::complete_sync_run(
                            &pool,
                            run_id,
                            "error",
                            Some(1),
                            Some(0),
                            Some(err.clone()),
                        )
                        .await
                        .map_err(|e| e.to_string())?;
                        integrations::update_sync_outcome(
                            &pool,
                            IntegrationProvider::Wikipedia,
                            Some(err.clone()),
                        )
                        .await
                        .map_err(|e| e.to_string())?;
                        result.errors.push(format!("wikipedia: {err}"));
                    }
                }
            }
            _ => {}
        }
    }

    if result.species.is_none() {
        result.species = species::get_species(&pool, species_id)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Use this set to avoid compiler warning if no config table entries exist yet.
    if source_provider_set.is_empty() && result.synced_providers.is_empty() {
        let _ = db::weather::get_setting(&pool, "_noop").await;
    }

    Ok(result)
}

#[tauri::command]
#[specta::specta]
pub async fn list_integration_sync_runs(
    pool: State<'_, SqlitePool>,
    provider: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<IntegrationSyncRun>, String> {
    integrations::list_sync_runs(&pool, provider, limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn search_osm_places(
    query: String,
    limit: Option<i64>,
) -> Result<Vec<OSMPlaceResult>, String> {
    let client = build_http_client()?;
    let bounded = limit.unwrap_or(10).clamp(1, 30) as usize;
    osm::search_places(&client, &query, bounded).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_environment_map_setting(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Option<EnvironmentMapSetting>, String> {
    integrations::get_map_setting(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn upsert_environment_map_setting(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    input: UpsertEnvironmentMapSetting,
) -> Result<EnvironmentMapSetting, String> {
    integrations::upsert_map_setting(&pool, environment_id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_integration_webhook_token(
    pool: State<'_, SqlitePool>,
    provider: String,
    name: String,
) -> Result<IntegrationWebhookToken, String> {
    let token = Uuid::new_v4().to_string();
    integrations::create_webhook_token(&pool, &provider, &name, &token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_integration_webhook_tokens(
    pool: State<'_, SqlitePool>,
    provider: Option<String>,
) -> Result<Vec<IntegrationWebhookToken>, String> {
    integrations::list_webhook_tokens(&pool, provider)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn process_integration_callback(
    pool: State<'_, SqlitePool>,
    provider: String,
    token: String,
    payload_json: String,
) -> Result<String, String> {
    let is_valid = integrations::find_active_webhook_token(&pool, &provider, &token)
        .await
        .map_err(|e| e.to_string())?;
    if !is_valid {
        return Err("Invalid webhook token".to_string());
    }

    let event_id = integrations::create_automation_event(
        &pool,
        &provider,
        "workflow_callback",
        "inbound",
        Some(payload_json.clone()),
    )
    .await
    .map_err(|e| e.to_string())?;

    let process_result: Result<String, String> = async {
        let payload: Value = serde_json::from_str(&payload_json)
            .map_err(|e| format!("Invalid callback JSON payload: {e}"))?;

        let sensor_id = payload.get("sensor_id").and_then(Value::as_i64);
        let value = payload.get("value").and_then(Value::as_f64);
        let unit = payload
            .get("unit")
            .and_then(Value::as_str)
            .map(ToString::to_string);

        if let (Some(sensor_id), Some(value)) = (sensor_id, value) {
            sensors::record_reading(&pool, sensor_id, value, unit)
                .await
                .map_err(|e| format!("Failed to store callback reading: {e}"))?;
            Ok(format!("Reading recorded for sensor {sensor_id}"))
        } else {
            Ok("Callback accepted (no telemetry fields found)".to_string())
        }
    }
    .await;

    match process_result {
        Ok(msg) => {
            integrations::complete_automation_event(&pool, event_id, "processed", None)
                .await
                .map_err(|e| e.to_string())?;
            Ok(msg)
        }
        Err(err) => {
            integrations::complete_automation_event(&pool, event_id, "error", Some(err.clone()))
                .await
                .map_err(|e| e.to_string())?;
            Err(err)
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn list_automation_events(
    pool: State<'_, SqlitePool>,
    provider: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<AutomationEvent>, String> {
    integrations::list_automation_events(&pool, provider, limit.unwrap_or(100))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_backup_job(
    pool: State<'_, SqlitePool>,
    input: NewBackupJob,
) -> Result<BackupJob, String> {
    integrations::create_backup_job(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_backup_jobs(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<BackupJob>, String> {
    integrations::list_backup_jobs(&pool)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_backup_job(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateBackupJob,
) -> Result<Option<BackupJob>, String> {
    integrations::update_backup_job(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_backup_runs(
    pool: State<'_, SqlitePool>,
    backup_job_id: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<BackupRun>, String> {
    integrations::list_backup_runs(&pool, backup_job_id, limit.unwrap_or(100))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn export_configuration(
    pool: State<'_, SqlitePool>,
    format: BackupFormat,
    include_secrets: bool,
    encryption_password: Option<String>,
) -> Result<crate::db::models::ExportPayload, String> {
    let run_id = integrations::create_backup_run(
        &pool,
        None,
        format.clone(),
        crate::db::models::BackupStrategy::Full,
    )
    .await
    .map_err(|e| e.to_string())?;

    let export_res = execute_export(&pool, format, include_secrets, encryption_password).await;

    match &export_res {
        Ok(payload) => {
            integrations::complete_backup_run(
                &pool,
                run_id,
                "success",
                Some(payload.filename.clone()),
                None,
                None,
                false,
                Some(payload.content.len() as i64),
                None,
            )
            .await
            .map_err(|e| e.to_string())?;
        }
        Err(err) => {
            integrations::complete_backup_run(
                &pool,
                run_id,
                "error",
                None,
                None,
                None,
                false,
                None,
                Some(err.clone()),
            )
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    export_res
}

#[tauri::command]
#[specta::specta]
pub async fn run_backup_job(
    pool: State<'_, SqlitePool>,
    storage: State<'_, AppStorageState>,
    _app: AppHandle,
    backup_job_id: i64,
    encryption_password: Option<String>,
) -> Result<crate::db::models::ExportPayload, String> {
    let runtime = storage.get_paths();
    backup_jobs::run_backup_job_by_id(
        &pool,
        backup_job_id,
        &runtime.data_dir,
        &runtime.backup_output_dir,
        encryption_password,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn import_configuration(
    pool: State<'_, SqlitePool>,
    payload: ImportPayload,
    encryption_password: Option<String>,
) -> Result<String, String> {
    let raw = match payload.format {
        BackupFormat::Json | BackupFormat::Yaml => payload.content,
        BackupFormat::Archive => {
            let bytes = if payload.is_base64 {
                STANDARD
                    .decode(payload.content)
                    .map_err(|e| format!("Invalid base64 archive payload: {e}"))?
            } else {
                return Err("Archive imports require base64 content".to_string());
            };

            let reader = std::io::Cursor::new(bytes);
            let mut archive = zip::ZipArchive::new(reader)
                .map_err(|e| format!("Invalid ZIP archive: {e}"))?;
            let mut file = archive
                .by_name("config/export.json")
                .map_err(|e| format!("Archive missing config/export.json: {e}"))?;
            let mut text = String::new();
            use std::io::Read;
            file.read_to_string(&mut text)
                .map_err(|e| format!("Failed reading archive config file: {e}"))?;
            text
        }
    };

    let clear_text = if let Some(password) = encryption_password {
        if raw.contains("\"algorithm\": \"aes-256-gcm-siv\"") {
            export_import::decrypt_text(&raw, &password)?
        } else {
            raw
        }
    } else {
        raw
    };

    let backup: BackupExportData = if matches!(payload.format, BackupFormat::Yaml) {
        serde_yaml::from_str(&clear_text)
            .map_err(|e| format!("Invalid YAML import payload: {e}"))?
    } else {
        serde_json::from_str(&clear_text)
            .map_err(|e| format!("Invalid JSON import payload: {e}"))?
    };

    for (key, value) in backup.app_settings {
        integrations::upsert_app_setting(&pool, &key, value)
            .await
            .map_err(|e| e.to_string())?;
    }

    for cfg in backup.integration_configs {
        let input = UpsertIntegrationConfig {
            enabled: cfg.enabled,
            auth_json: cfg.auth_json,
            settings_json: cfg.settings_json,
            sync_interval_minutes: cfg.sync_interval_minutes,
            cache_ttl_minutes: cfg.cache_ttl_minutes,
            rate_limit_per_minute: cfg.rate_limit_per_minute,
        };
        integrations::upsert_integration_config(&pool, cfg.provider, input)
            .await
            .map_err(|e| e.to_string())?;
    }

    for map in backup.map_settings {
        let input = UpsertEnvironmentMapSetting {
            latitude: map.latitude,
            longitude: map.longitude,
            zoom_level: map.zoom_level,
            geocode_json: map.geocode_json,
            weather_overlay: map.weather_overlay,
            soil_overlay: map.soil_overlay,
            boundaries_geojson: map.boundaries_geojson,
            privacy_level: map.privacy_level,
            allow_sharing: map.allow_sharing,
        };
        integrations::upsert_map_setting(&pool, map.environment_id, input)
            .await
            .map_err(|e| e.to_string())?;
    }

    for job in backup.backup_jobs {
        let existing = integrations::list_backup_jobs(&pool)
            .await
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|j| j.name == job.name);

        if let Some(existing) = existing {
            integrations::update_backup_job(
                &pool,
                existing.id,
                UpdateBackupJob {
                    name: Some(job.name),
                    schedule_cron: job.schedule_cron,
                    format: Some(job.format),
                    backup_strategy: Some(job.backup_strategy),
                    destination_kind: Some(job.destination_kind),
                    destination_path: job.destination_path,
                    cloud_provider: job.cloud_provider,
                    cloud_path_prefix: job.cloud_path_prefix,
                    lifecycle_policy_json: job.lifecycle_policy_json,
                    include_secrets: Some(job.include_secrets),
                    dedupe_enabled: Some(job.dedupe_enabled),
                    is_active: Some(job.is_active),
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        } else {
            integrations::create_backup_job(
                &pool,
                NewBackupJob {
                    name: job.name,
                    schedule_cron: job.schedule_cron,
                    format: job.format,
                    backup_strategy: job.backup_strategy,
                    destination_kind: job.destination_kind,
                    destination_path: job.destination_path,
                    cloud_provider: job.cloud_provider,
                    cloud_path_prefix: job.cloud_path_prefix,
                    lifecycle_policy_json: job.lifecycle_policy_json,
                    include_secrets: job.include_secrets,
                    dedupe_enabled: job.dedupe_enabled,
                    is_active: job.is_active,
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    Ok("Configuration import completed".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_species_for_integration(
    pool: State<'_, SqlitePool>,
    limit: Option<i64>,
) -> Result<Vec<Species>, String> {
    species::list_species(
        &pool,
        crate::db::models::Pagination {
            limit: limit.unwrap_or(200),
            offset: 0,
        },
    )
    .await
    .map_err(|e| e.to_string())
}
