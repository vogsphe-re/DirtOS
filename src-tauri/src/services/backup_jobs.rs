use std::io::Write;
use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::db::{
    integrations,
    models::{
        BackupDestinationKind, BackupFormat, BackupJob, BackupStrategy, CloudStorageProvider,
        ExportPayload, IntegrationConfig, IntegrationProvider,
    },
};
use crate::services::{export, export_import};

fn cron_schedule(expr: &str) -> Result<cron::Schedule, String> {
    let normalized = if expr.split_whitespace().count() == 5 {
        format!("0 {expr}")
    } else {
        expr.to_string()
    };

    normalized.parse::<cron::Schedule>().map_err(|e| e.to_string())
}

fn should_run_now(cron_expr: &str, last_run_at: Option<NaiveDateTime>, now: DateTime<Utc>) -> bool {
    let Ok(schedule) = cron_schedule(cron_expr) else {
        return false;
    };

    let baseline = last_run_at.unwrap_or_else(|| (now - Duration::days(1)).naive_utc());
    let baseline = DateTime::<Utc>::from_naive_utc_and_offset(baseline, Utc);

    schedule.after(&baseline).next().is_some_and(|next| next <= now)
}

fn to_yaml(json: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    serde_yaml::to_string(&value).map_err(|e| e.to_string())
}

fn to_archive(json: &str) -> Result<Vec<u8>, String> {
    let mut cursor = std::io::Cursor::new(Vec::<u8>::new());
    let mut zip = zip::ZipWriter::new(&mut cursor);
    let opts = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("garden/export.json", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    zip.finish().map_err(|e| e.to_string())?;

    Ok(cursor.into_inner())
}

fn payload_bytes(payload: &ExportPayload) -> Result<Vec<u8>, String> {
    if payload.is_base64 {
        STANDARD
            .decode(&payload.content)
            .map_err(|e| format!("Invalid base64 export payload: {e}"))
    } else {
        Ok(payload.content.as_bytes().to_vec())
    }
}

fn hex_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn is_secret_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    ["key", "token", "secret", "password", "auth", "credential"]
        .iter()
        .any(|needle| lower.contains(needle))
}

fn redact_full_export(json: &str) -> Result<String, String> {
    let mut root: Value = serde_json::from_str(json).map_err(|e| e.to_string())?;

    if let Some(tables) = root.get_mut("tables").and_then(|v| v.as_object_mut()) {
        if let Some(settings_rows) = tables.get_mut("app_settings").and_then(|v| v.as_array_mut()) {
            for row in settings_rows {
                let Some(obj) = row.as_object_mut() else {
                    continue;
                };

                let key = obj
                    .get("key")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                if is_secret_key(key) {
                    obj.insert("value".to_string(), Value::String("[REDACTED]".to_string()));
                }
            }
        }

        if let Some(config_rows) = tables
            .get_mut("integration_configs")
            .and_then(|v| v.as_array_mut())
        {
            for row in config_rows {
                let Some(obj) = row.as_object_mut() else {
                    continue;
                };

                obj.insert("auth_json".to_string(), Value::Null);

                let sanitized_settings = obj
                    .get("settings_json")
                    .and_then(|v| v.as_str())
                    .map(|text| export_import::sanitize_json(Some(text.to_string()), false))
                    .unwrap_or(None);

                match sanitized_settings {
                    Some(value) => {
                        obj.insert("settings_json".to_string(), Value::String(value));
                    }
                    None => {
                        obj.insert("settings_json".to_string(), Value::Null);
                    }
                }
            }
        }
    }

    serde_json::to_string_pretty(&root).map_err(|e| e.to_string())
}

fn lifecycle_max_keep(policy_json: &Option<String>) -> Option<usize> {
    #[derive(Deserialize)]
    struct LifecyclePolicy {
        keep_last: Option<usize>,
    }

    let Some(raw) = policy_json else {
        return None;
    };

    serde_json::from_str::<LifecyclePolicy>(raw)
        .ok()
        .and_then(|policy| policy.keep_last)
}

fn apply_local_lifecycle_policy(
    backup_job_id: Option<i64>,
    destination_root: &Path,
    max_keep: Option<usize>,
) -> Result<(), String> {
    let Some(max_keep) = max_keep else {
        return Ok(());
    };

    let mut candidates = std::fs::read_dir(destination_root)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            if let Some(job_id) = backup_job_id {
                let needle = format!("dirtos-backup-job-{job_id}-");
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with(&needle))
                    .unwrap_or(false)
            } else {
                true
            }
        })
        .collect::<Vec<_>>();

    candidates.sort_by(|a, b| {
        let a_meta = std::fs::metadata(a).and_then(|m| m.modified()).ok();
        let b_meta = std::fs::metadata(b).and_then(|m| m.modified()).ok();
        b_meta.cmp(&a_meta)
    });

    let remove_count = candidates.len().saturating_sub(max_keep);
    for path in candidates.into_iter().skip(max_keep).take(remove_count) {
        let _ = std::fs::remove_file(path);
    }

    Ok(())
}

fn resolve_backup_kind(strategy: BackupStrategy, has_recent_full: bool) -> BackupStrategy {
    match strategy {
        BackupStrategy::Full => BackupStrategy::Full,
        BackupStrategy::Incremental => BackupStrategy::Incremental,
        BackupStrategy::Hybrid => {
            if has_recent_full {
                BackupStrategy::Incremental
            } else {
                BackupStrategy::Full
            }
        }
    }
}

fn cloud_integration_provider(provider: CloudStorageProvider) -> IntegrationProvider {
    match provider {
        CloudStorageProvider::Dropbox => IntegrationProvider::Dropbox,
        CloudStorageProvider::GoogleDrive => IntegrationProvider::GoogleDrive,
        CloudStorageProvider::OneDrive => IntegrationProvider::OneDrive,
    }
}

fn parse_access_token(cfg: &IntegrationConfig) -> Result<String, String> {
    let auth = cfg
        .auth_json
        .as_ref()
        .ok_or_else(|| format!("{} auth_json is empty", format!("{:?}", cfg.provider).to_lowercase()))?;

    let parsed: Value = serde_json::from_str(auth).map_err(|e| e.to_string())?;
    let token = parsed
        .get("access_token")
        .or_else(|| parsed.get("token"))
        .or_else(|| parsed.get("bearer_token"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "Missing access token in auth_json".to_string())?;

    Ok(token.to_string())
}

fn configured_cloud_prefix(job: &BackupJob, cfg: &IntegrationConfig) -> Option<String> {
    if let Some(prefix) = job.cloud_path_prefix.clone().filter(|v| !v.trim().is_empty()) {
        return Some(prefix);
    }

    cfg.settings_json
        .as_ref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .and_then(|json| {
            json.get("remote_path")
                .or_else(|| json.get("path_prefix"))
                .or_else(|| json.get("folder"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
}

async fn upload_to_dropbox(
    client: &Client,
    token: &str,
    remote_path: &str,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let api_arg = serde_json::json!({
        "path": remote_path,
        "mode": "add",
        "autorename": true,
        "mute": false,
        "strict_conflict": false
    });

    let response = client
        .post("https://content.dropboxapi.com/2/files/upload")
        .header("Authorization", format!("Bearer {token}"))
        .header("Dropbox-API-Arg", api_arg.to_string())
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Dropbox upload failed ({status}): {body}"));
    }

    let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let path_display = parsed
        .get("path_display")
        .and_then(|v| v.as_str())
        .unwrap_or(remote_path);

    Ok(format!("dropbox://{path_display}"))
}

async fn upload_to_onedrive(
    client: &Client,
    token: &str,
    remote_path: &str,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let clean = remote_path.trim_start_matches('/');
    let encoded = urlencoding::encode(clean);
    let url = format!(
        "https://graph.microsoft.com/v1.0/me/drive/root:/{encoded}:/content"
    );

    let response = client
        .put(url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Content-Type", "application/octet-stream")
        .body(bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("OneDrive upload failed ({status}): {body}"));
    }

    let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let web_url = parsed.get("webUrl").and_then(|v| v.as_str()).unwrap_or(clean);
    Ok(format!("onedrive://{web_url}"))
}

async fn upload_to_google_drive(
    client: &Client,
    token: &str,
    filename: &str,
    cloud_prefix: Option<String>,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let mut metadata = serde_json::json!({ "name": filename });

    if let Some(prefix) = cloud_prefix.filter(|v| !v.trim().is_empty()) {
        metadata["parents"] = serde_json::json!([prefix]);
    }

    let boundary = format!("dirtos-boundary-{}", uuid::Uuid::new_v4());
    let mut body = Vec::<u8>::new();

    write!(
        body,
        "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n",
        metadata
    )
    .map_err(|e| e.to_string())?;
    write!(
        body,
        "--{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n"
    )
    .map_err(|e| e.to_string())?;
    body.extend_from_slice(&bytes);
    write!(body, "\r\n--{boundary}--\r\n").map_err(|e| e.to_string())?;

    let response = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .header("Authorization", format!("Bearer {token}"))
        .header(
            "Content-Type",
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Google Drive upload failed ({status}): {body}"));
    }

    let parsed: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let file_id = parsed.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
    Ok(format!("gdrive://{file_id}"))
}

async fn upload_payload_to_cloud(
    pool: &SqlitePool,
    provider: CloudStorageProvider,
    job: &BackupJob,
    filename: &str,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let integration_provider = cloud_integration_provider(provider.clone());
    let cfg = integrations::get_integration_config(pool, integration_provider)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Cloud provider {:?} is not configured", provider))?;

    if !cfg.enabled {
        return Err(format!("Cloud provider {:?} is disabled", provider));
    }

    let token = parse_access_token(&cfg)?;
    let prefix = configured_cloud_prefix(job, &cfg)
        .unwrap_or_else(|| "DirtOS/Backups".to_string());
    let remote_path = format!("{}/{}", prefix.trim_end_matches('/'), filename);

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| e.to_string())?;

    match provider {
        CloudStorageProvider::Dropbox => {
            let dropbox_path = format!("/{}", remote_path.trim_start_matches('/'));
            upload_to_dropbox(&client, &token, &dropbox_path, bytes).await
        }
        CloudStorageProvider::OneDrive => {
            upload_to_onedrive(&client, &token, &remote_path, bytes).await
        }
        CloudStorageProvider::GoogleDrive => {
            upload_to_google_drive(&client, &token, filename, Some(prefix), bytes).await
        }
    }
}

fn build_payload(
    format: BackupFormat,
    backup_kind: BackupStrategy,
    include_secrets: bool,
    encryption_password: Option<String>,
    full_export_json: &str,
    backup_job_id: Option<i64>,
) -> Result<ExportPayload, String> {
    let json_payload = if include_secrets {
        full_export_json.to_string()
    } else {
        redact_full_export(full_export_json)?
    };

    let date_tag = Utc::now().format("%Y%m%d-%H%M%S");
    let kind_tag = match backup_kind {
        BackupStrategy::Full => "full",
        BackupStrategy::Incremental => "incremental",
        BackupStrategy::Hybrid => "hybrid",
    };
    let name_prefix = if let Some(job_id) = backup_job_id {
        format!("dirtos-backup-job-{job_id}-{kind_tag}-{date_tag}")
    } else {
        format!("dirtos-backup-{kind_tag}-{date_tag}")
    };

    let mut payload = match format {
        BackupFormat::Json => ExportPayload {
            format,
            filename: format!("{name_prefix}.json"),
            content: json_payload.clone(),
            is_base64: false,
        },
        BackupFormat::Yaml => ExportPayload {
            format,
            filename: format!("{name_prefix}.yaml"),
            content: to_yaml(&json_payload)?,
            is_base64: false,
        },
        BackupFormat::Archive => {
            let archive = to_archive(&json_payload)?;
            ExportPayload {
                format,
                filename: format!("{name_prefix}.zip"),
                content: STANDARD.encode(archive),
                is_base64: true,
            }
        }
    };

    if include_secrets {
        if let Some(password) = encryption_password.filter(|v| !v.trim().is_empty()) {
            if payload.is_base64 {
                return Err(
                    "Encrypted archive output is not supported yet. Use JSON or YAML for encrypted exports."
                        .to_string(),
                );
            }
            payload.content = export_import::encrypt_text(&payload.content, &password)?;
        }
    }

    Ok(payload)
}

fn resolve_local_destination(job: &BackupJob, default_backup_dir: &Path) -> Result<PathBuf, String> {
    match job.destination_kind {
        BackupDestinationKind::Local | BackupDestinationKind::Network => {
            let root = job
                .destination_path
                .as_ref()
                .filter(|v| !v.trim().is_empty())
                .map(PathBuf::from)
                .unwrap_or_else(|| default_backup_dir.to_path_buf());
            std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
            Ok(root)
        }
        BackupDestinationKind::Cloud => Ok(default_backup_dir.to_path_buf()),
    }
}

pub async fn run_backup_job_with_config(
    pool: &SqlitePool,
    job: BackupJob,
    backup_job_id: Option<i64>,
    data_dir: &Path,
    default_backup_dir: &Path,
    encryption_password: Option<String>,
) -> Result<ExportPayload, String> {
    let recent_full = if matches!(job.backup_strategy, BackupStrategy::Hybrid) {
        if let Some(job_id) = backup_job_id {
            integrations::latest_successful_full_backup_run(pool, job_id)
                .await
                .map_err(|e| e.to_string())?
                .map(|run| {
                    let started = DateTime::<Utc>::from_naive_utc_and_offset(run.started_at, Utc);
                    Utc::now().signed_duration_since(started) < Duration::days(7)
                })
                .unwrap_or(false)
        } else {
            false
        }
    } else {
        false
    };

    let backup_kind = resolve_backup_kind(job.backup_strategy.clone(), recent_full);

    let run_id = integrations::create_backup_run(
        pool,
        backup_job_id,
        job.format.clone(),
        backup_kind.clone(),
    )
    .await
    .map_err(|e| e.to_string())?;

    let execution: Result<ExportPayload, String> = async {
        let full_export_json = export::export_garden_data_json(pool, data_dir).await?;
        let payload = build_payload(
            job.format.clone(),
            backup_kind.clone(),
            job.include_secrets,
            encryption_password,
            &full_export_json,
            backup_job_id,
        )?;

        let bytes = payload_bytes(&payload)?;
        let content_hash = hex_sha256(&bytes);

        if job.dedupe_enabled {
            if let Some(job_id) = backup_job_id {
                let duplicate = integrations::find_successful_run_by_hash(pool, job_id, &content_hash)
                    .await
                    .map_err(|e| e.to_string())?;

                if let Some(previous) = duplicate {
                    integrations::complete_backup_run(
                        pool,
                        run_id,
                        "success",
                        previous.output_ref,
                        previous.destination_ref,
                        Some(content_hash),
                        true,
                        Some(0),
                        None,
                    )
                    .await
                    .map_err(|e| e.to_string())?;
                    return Ok(payload);
                }
            }
        }

        let (destination_ref, bytes_written) = match job.destination_kind {
            BackupDestinationKind::Local | BackupDestinationKind::Network => {
                let destination_root = resolve_local_destination(&job, default_backup_dir)?;
                let target = destination_root.join(&payload.filename);
                std::fs::write(&target, &bytes).map_err(|e| e.to_string())?;

                apply_local_lifecycle_policy(
                    backup_job_id,
                    &destination_root,
                    lifecycle_max_keep(&job.lifecycle_policy_json),
                )?;

                (Some(target.to_string_lossy().into_owned()), bytes.len() as i64)
            }
            BackupDestinationKind::Cloud => {
                let cloud_provider = job
                    .cloud_provider
                    .clone()
                    .ok_or_else(|| "cloud_provider is required when destination_kind=cloud".to_string())?;
                let uploaded_to = upload_payload_to_cloud(
                    pool,
                    cloud_provider,
                    &job,
                    &payload.filename,
                    bytes,
                )
                .await?;
                (Some(uploaded_to), payload.content.len() as i64)
            }
        };

        integrations::complete_backup_run(
            pool,
            run_id,
            "success",
            Some(payload.filename.clone()),
            destination_ref,
            Some(content_hash),
            false,
            Some(bytes_written),
            None,
        )
        .await
        .map_err(|e| e.to_string())?;

        Ok(payload)
    }
    .await;

    if let Err(err) = &execution {
        let _ = integrations::complete_backup_run(
            pool,
            run_id,
            "error",
            None,
            None,
            None,
            false,
            None,
            Some(err.clone()),
        )
        .await;
    }

    execution
}

pub async fn run_backup_job_by_id(
    pool: &SqlitePool,
    backup_job_id: i64,
    data_dir: &Path,
    default_backup_dir: &Path,
    encryption_password: Option<String>,
) -> Result<ExportPayload, String> {
    let job = integrations::get_backup_job(pool, backup_job_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Backup job {backup_job_id} not found"))?;

    run_backup_job_with_config(
        pool,
        job,
        Some(backup_job_id),
        data_dir,
        default_backup_dir,
        encryption_password,
    )
    .await
}

pub async fn run_due_backup_jobs(
    pool: &SqlitePool,
    data_dir: &Path,
    default_backup_dir: &Path,
) -> Result<(), String> {
    let now = Utc::now();
    let jobs = integrations::list_active_scheduled_backup_jobs(pool)
        .await
        .map_err(|e| e.to_string())?;

    for job in jobs {
        let Some(expr) = job.schedule_cron.clone() else {
            continue;
        };

        if !should_run_now(&expr, job.last_run_at, now) {
            continue;
        }

        let backup_job_id = job.id;
        if let Err(err) = run_backup_job_with_config(
            pool,
            job,
            Some(backup_job_id),
            data_dir,
            default_backup_dir,
            None,
        )
        .await
        {
            tracing::warn!("Scheduled backup job {} failed: {}", backup_job_id, err);
        }
    }

    Ok(())
}

pub fn start_backup_job_scheduler(
    data_dir: PathBuf,
    backup_output_dir: PathBuf,
    pool: SqlitePool,
) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        interval.tick().await;

        loop {
            interval.tick().await;
            if let Err(err) = run_due_backup_jobs(&pool, &data_dir, &backup_output_dir).await {
                tracing::warn!("Scheduled backup polling failed: {}", err);
            }
        }
    });
}
