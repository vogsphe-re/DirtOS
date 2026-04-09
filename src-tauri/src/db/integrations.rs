use chrono::NaiveDateTime;
use sqlx::{Row, SqlitePool};

use super::models::{
    AutomationEvent, BackupJob, BackupRun, EnvironmentMapSetting, IntegrationConfig,
    IntegrationProvider, IntegrationSyncRun, IntegrationWebhookToken, NewBackupJob,
    SpeciesExternalSource, UpdateBackupJob, UpsertEnvironmentMapSetting,
    UpsertIntegrationConfig,
};

pub async fn list_integration_configs(
    pool: &SqlitePool,
) -> Result<Vec<IntegrationConfig>, sqlx::Error> {
    sqlx::query_as::<_, IntegrationConfig>(
        "SELECT * FROM integration_configs ORDER BY provider ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_integration_config(
    pool: &SqlitePool,
    provider: IntegrationProvider,
) -> Result<Option<IntegrationConfig>, sqlx::Error> {
    sqlx::query_as::<_, IntegrationConfig>(
        "SELECT * FROM integration_configs WHERE provider = ?",
    )
    .bind(provider)
    .fetch_optional(pool)
    .await
}

pub async fn upsert_integration_config(
    pool: &SqlitePool,
    provider: IntegrationProvider,
    input: UpsertIntegrationConfig,
) -> Result<IntegrationConfig, sqlx::Error> {
    sqlx::query(
        "INSERT INTO integration_configs
            (provider, enabled, auth_json, settings_json, sync_interval_minutes,
             cache_ttl_minutes, rate_limit_per_minute, updated_at)
         VALUES (?,?,?,?,?,?,?,datetime('now'))
         ON CONFLICT(provider) DO UPDATE SET
            enabled               = excluded.enabled,
            auth_json             = excluded.auth_json,
            settings_json         = excluded.settings_json,
            sync_interval_minutes = excluded.sync_interval_minutes,
            cache_ttl_minutes     = excluded.cache_ttl_minutes,
            rate_limit_per_minute = excluded.rate_limit_per_minute,
            updated_at            = excluded.updated_at",
    )
    .bind(&provider)
    .bind(input.enabled)
    .bind(&input.auth_json)
    .bind(&input.settings_json)
    .bind(input.sync_interval_minutes)
    .bind(input.cache_ttl_minutes)
    .bind(input.rate_limit_per_minute)
    .execute(pool)
    .await?;

    get_integration_config(pool, provider)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn update_sync_outcome(
    pool: &SqlitePool,
    provider: IntegrationProvider,
    last_error: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE integration_configs SET
            last_synced_at = datetime('now'),
            last_error = ?,
            updated_at = datetime('now')
         WHERE provider = ?",
    )
    .bind(last_error)
    .bind(provider)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn upsert_species_source(
    pool: &SqlitePool,
    species_id: i64,
    provider: IntegrationProvider,
    external_id: Option<String>,
    source_url: Option<String>,
    attribution: Option<String>,
    revision_id: Option<String>,
    native_range_json: Option<String>,
    metadata_json: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO species_external_sources
            (species_id, provider, external_id, source_url, attribution, revision_id,
             native_range_json, metadata_json, retrieved_at, last_synced_at)
         VALUES (?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
         ON CONFLICT(species_id, provider) DO UPDATE SET
            external_id = excluded.external_id,
            source_url = excluded.source_url,
            attribution = excluded.attribution,
            revision_id = excluded.revision_id,
            native_range_json = excluded.native_range_json,
            metadata_json = excluded.metadata_json,
            retrieved_at = excluded.retrieved_at,
            last_synced_at = excluded.last_synced_at",
    )
    .bind(species_id)
    .bind(provider)
    .bind(external_id)
    .bind(source_url)
    .bind(attribution)
    .bind(revision_id)
    .bind(native_range_json)
    .bind(metadata_json)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_species_sources(
    pool: &SqlitePool,
    species_id: i64,
) -> Result<Vec<SpeciesExternalSource>, sqlx::Error> {
    sqlx::query_as::<_, SpeciesExternalSource>(
        "SELECT * FROM species_external_sources
         WHERE species_id = ?
         ORDER BY provider ASC",
    )
    .bind(species_id)
    .fetch_all(pool)
    .await
}

pub async fn create_sync_run(
    pool: &SqlitePool,
    provider: &str,
    operation: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO integration_sync_runs (provider, operation, status, started_at)
         VALUES (?, ?, 'started', datetime('now'))",
    )
    .bind(provider)
    .bind(operation)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn complete_sync_run(
    pool: &SqlitePool,
    run_id: i64,
    status: &str,
    records_fetched: Option<i64>,
    records_upserted: Option<i64>,
    error_message: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE integration_sync_runs SET
            status = ?,
            records_fetched = ?,
            records_upserted = ?,
            error_message = ?,
            finished_at = datetime('now')
         WHERE id = ?",
    )
    .bind(status)
    .bind(records_fetched)
    .bind(records_upserted)
    .bind(error_message)
    .bind(run_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_sync_runs(
    pool: &SqlitePool,
    provider: Option<String>,
    limit: i64,
) -> Result<Vec<IntegrationSyncRun>, sqlx::Error> {
    sqlx::query_as::<_, IntegrationSyncRun>(
        "SELECT * FROM integration_sync_runs
         WHERE (? IS NULL OR provider = ?)
         ORDER BY started_at DESC
         LIMIT ?",
    )
    .bind(&provider)
    .bind(&provider)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn get_map_setting(
    pool: &SqlitePool,
    environment_id: i64,
) -> Result<Option<EnvironmentMapSetting>, sqlx::Error> {
    sqlx::query_as::<_, EnvironmentMapSetting>(
        "SELECT * FROM environment_map_settings WHERE environment_id = ?",
    )
    .bind(environment_id)
    .fetch_optional(pool)
    .await
}

pub async fn list_map_settings(
    pool: &SqlitePool,
) -> Result<Vec<EnvironmentMapSetting>, sqlx::Error> {
    sqlx::query_as::<_, EnvironmentMapSetting>(
        "SELECT * FROM environment_map_settings ORDER BY environment_id ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn upsert_map_setting(
    pool: &SqlitePool,
    environment_id: i64,
    input: UpsertEnvironmentMapSetting,
) -> Result<EnvironmentMapSetting, sqlx::Error> {
    sqlx::query(
        "INSERT INTO environment_map_settings
            (environment_id, latitude, longitude, zoom_level, geocode_json,
             weather_overlay, soil_overlay, boundaries_geojson, privacy_level,
             allow_sharing, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
         ON CONFLICT(environment_id) DO UPDATE SET
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            zoom_level = excluded.zoom_level,
            geocode_json = excluded.geocode_json,
            weather_overlay = excluded.weather_overlay,
            soil_overlay = excluded.soil_overlay,
            boundaries_geojson = excluded.boundaries_geojson,
            privacy_level = excluded.privacy_level,
            allow_sharing = excluded.allow_sharing,
            updated_at = excluded.updated_at",
    )
    .bind(environment_id)
    .bind(input.latitude)
    .bind(input.longitude)
    .bind(input.zoom_level)
    .bind(input.geocode_json)
    .bind(input.weather_overlay)
    .bind(input.soil_overlay)
    .bind(input.boundaries_geojson)
    .bind(input.privacy_level)
    .bind(input.allow_sharing)
    .execute(pool)
    .await?;

    get_map_setting(pool, environment_id)
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn create_webhook_token(
    pool: &SqlitePool,
    provider: &str,
    name: &str,
    token: &str,
) -> Result<IntegrationWebhookToken, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO integration_webhook_tokens
            (provider, name, token, is_active, created_at)
         VALUES (?, ?, ?, 1, datetime('now'))",
    )
    .bind(provider)
    .bind(name)
    .bind(token)
    .execute(pool)
    .await?;

    sqlx::query_as::<_, IntegrationWebhookToken>(
        "SELECT * FROM integration_webhook_tokens WHERE id = ?",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(pool)
    .await
}

pub async fn list_webhook_tokens(
    pool: &SqlitePool,
    provider: Option<String>,
) -> Result<Vec<IntegrationWebhookToken>, sqlx::Error> {
    sqlx::query_as::<_, IntegrationWebhookToken>(
        "SELECT * FROM integration_webhook_tokens
         WHERE (? IS NULL OR provider = ?)
         ORDER BY created_at DESC",
    )
    .bind(&provider)
    .bind(&provider)
    .fetch_all(pool)
    .await
}

pub async fn find_active_webhook_token(
    pool: &SqlitePool,
    provider: &str,
    token: &str,
) -> Result<bool, sqlx::Error> {
    let row: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM integration_webhook_tokens
         WHERE provider = ? AND token = ? AND is_active = 1",
    )
    .bind(provider)
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

pub async fn create_automation_event(
    pool: &SqlitePool,
    provider: &str,
    event_type: &str,
    direction: &str,
    payload_json: Option<String>,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO automation_events
            (provider, event_type, direction, payload_json, status, created_at)
         VALUES (?, ?, ?, ?, 'received', datetime('now'))",
    )
    .bind(provider)
    .bind(event_type)
    .bind(direction)
    .bind(payload_json)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn complete_automation_event(
    pool: &SqlitePool,
    event_id: i64,
    status: &str,
    error_message: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE automation_events SET
            status = ?,
            error_message = ?,
            processed_at = datetime('now')
         WHERE id = ?",
    )
    .bind(status)
    .bind(error_message)
    .bind(event_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_automation_events(
    pool: &SqlitePool,
    provider: Option<String>,
    limit: i64,
) -> Result<Vec<AutomationEvent>, sqlx::Error> {
    sqlx::query_as::<_, AutomationEvent>(
        "SELECT * FROM automation_events
         WHERE (? IS NULL OR provider = ?)
         ORDER BY created_at DESC
         LIMIT ?",
    )
    .bind(&provider)
    .bind(&provider)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn create_backup_job(
    pool: &SqlitePool,
    input: NewBackupJob,
) -> Result<BackupJob, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO backup_jobs
            (name, schedule_cron, format, backup_strategy,
             destination_kind, destination_path, cloud_provider,
             cloud_path_prefix, lifecycle_policy_json,
             include_secrets, dedupe_enabled, is_active,
             created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    )
    .bind(input.name)
    .bind(input.schedule_cron)
    .bind(input.format)
    .bind(input.backup_strategy)
    .bind(input.destination_kind)
    .bind(input.destination_path)
    .bind(input.cloud_provider)
    .bind(input.cloud_path_prefix)
    .bind(input.lifecycle_policy_json)
    .bind(input.include_secrets)
    .bind(input.dedupe_enabled)
    .bind(input.is_active)
    .execute(pool)
    .await?;

    get_backup_job(pool, result.last_insert_rowid())
        .await?
        .ok_or(sqlx::Error::RowNotFound)
}

pub async fn get_backup_job(
    pool: &SqlitePool,
    id: i64,
) -> Result<Option<BackupJob>, sqlx::Error> {
    sqlx::query_as::<_, BackupJob>("SELECT * FROM backup_jobs WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_backup_jobs(pool: &SqlitePool) -> Result<Vec<BackupJob>, sqlx::Error> {
    sqlx::query_as::<_, BackupJob>("SELECT * FROM backup_jobs ORDER BY name ASC")
        .fetch_all(pool)
        .await
}

pub async fn update_backup_job(
    pool: &SqlitePool,
    id: i64,
    input: UpdateBackupJob,
) -> Result<Option<BackupJob>, sqlx::Error> {
    sqlx::query(
        "UPDATE backup_jobs SET
            name = COALESCE(?, name),
            schedule_cron = COALESCE(?, schedule_cron),
            format = COALESCE(?, format),
            backup_strategy = COALESCE(?, backup_strategy),
            destination_kind = COALESCE(?, destination_kind),
            destination_path = COALESCE(?, destination_path),
            cloud_provider = COALESCE(?, cloud_provider),
            cloud_path_prefix = COALESCE(?, cloud_path_prefix),
            lifecycle_policy_json = COALESCE(?, lifecycle_policy_json),
            include_secrets = COALESCE(?, include_secrets),
            dedupe_enabled = COALESCE(?, dedupe_enabled),
            is_active = COALESCE(?, is_active),
            updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(input.name)
    .bind(input.schedule_cron)
    .bind(input.format)
    .bind(input.backup_strategy)
    .bind(input.destination_kind)
    .bind(input.destination_path)
    .bind(input.cloud_provider)
    .bind(input.cloud_path_prefix)
    .bind(input.lifecycle_policy_json)
    .bind(input.include_secrets)
    .bind(input.dedupe_enabled)
    .bind(input.is_active)
    .bind(id)
    .execute(pool)
    .await?;

    get_backup_job(pool, id).await
}

pub async fn create_backup_run(
    pool: &SqlitePool,
    backup_job_id: Option<i64>,
    format: super::models::BackupFormat,
    backup_kind: super::models::BackupStrategy,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO backup_runs
            (backup_job_id, status, format, backup_kind, dedupe_skipped, started_at)
         VALUES (?, 'started', ?, ?, 0, datetime('now'))",
    )
    .bind(backup_job_id)
    .bind(format)
    .bind(backup_kind)
    .execute(pool)
    .await?;

    Ok(result.last_insert_rowid())
}

pub async fn complete_backup_run(
    pool: &SqlitePool,
    run_id: i64,
    status: &str,
    output_ref: Option<String>,
    destination_ref: Option<String>,
    content_hash: Option<String>,
    dedupe_skipped: bool,
    bytes_written: Option<i64>,
    error_message: Option<String>,
) -> Result<(), sqlx::Error> {
    let last_error = error_message.clone();

    sqlx::query(
        "UPDATE backup_runs SET
            status = ?,
            output_ref = ?,
            destination_ref = ?,
            content_hash = ?,
            dedupe_skipped = ?,
            bytes_written = ?,
            error_message = ?,
            finished_at = datetime('now')
         WHERE id = ?",
    )
    .bind(status)
    .bind(output_ref)
    .bind(destination_ref)
    .bind(content_hash)
    .bind(dedupe_skipped)
    .bind(bytes_written)
    .bind(error_message)
    .bind(run_id)
    .execute(pool)
    .await?;

    sqlx::query(
        "UPDATE backup_jobs SET
            last_run_status = ?,
            last_run_at = datetime('now'),
            last_error = ?,
            updated_at = datetime('now')
         WHERE id = (SELECT backup_job_id FROM backup_runs WHERE id = ?)",
    )
    .bind(status)
    .bind(last_error)
    .bind(run_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_backup_runs(
    pool: &SqlitePool,
    backup_job_id: Option<i64>,
    limit: i64,
) -> Result<Vec<BackupRun>, sqlx::Error> {
    sqlx::query_as::<_, BackupRun>(
        "SELECT * FROM backup_runs
         WHERE (? IS NULL OR backup_job_id = ?)
         ORDER BY started_at DESC
         LIMIT ?",
    )
    .bind(backup_job_id)
    .bind(backup_job_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn list_active_scheduled_backup_jobs(
    pool: &SqlitePool,
) -> Result<Vec<BackupJob>, sqlx::Error> {
    sqlx::query_as::<_, BackupJob>(
        "SELECT * FROM backup_jobs
         WHERE is_active = 1
           AND schedule_cron IS NOT NULL
           AND trim(schedule_cron) != ''
         ORDER BY id ASC",
    )
    .fetch_all(pool)
    .await
}

pub async fn latest_successful_backup_run(
    pool: &SqlitePool,
    backup_job_id: i64,
) -> Result<Option<BackupRun>, sqlx::Error> {
    sqlx::query_as::<_, BackupRun>(
        "SELECT * FROM backup_runs
         WHERE backup_job_id = ?
           AND status = 'success'
         ORDER BY started_at DESC
         LIMIT 1",
    )
    .bind(backup_job_id)
    .fetch_optional(pool)
    .await
}

pub async fn latest_successful_full_backup_run(
    pool: &SqlitePool,
    backup_job_id: i64,
) -> Result<Option<BackupRun>, sqlx::Error> {
    sqlx::query_as::<_, BackupRun>(
        "SELECT * FROM backup_runs
         WHERE backup_job_id = ?
           AND status = 'success'
           AND backup_kind = 'full'
         ORDER BY started_at DESC
         LIMIT 1",
    )
    .bind(backup_job_id)
    .fetch_optional(pool)
    .await
}

pub async fn find_successful_run_by_hash(
    pool: &SqlitePool,
    backup_job_id: i64,
    content_hash: &str,
) -> Result<Option<BackupRun>, sqlx::Error> {
    sqlx::query_as::<_, BackupRun>(
        "SELECT * FROM backup_runs
         WHERE backup_job_id = ?
           AND status = 'success'
           AND content_hash = ?
         ORDER BY started_at DESC
         LIMIT 1",
    )
    .bind(backup_job_id)
    .bind(content_hash)
    .fetch_optional(pool)
    .await
}

pub async fn list_app_settings(
    pool: &SqlitePool,
) -> Result<Vec<(String, Option<String>)>, sqlx::Error> {
    let rows = sqlx::query("SELECT key, value FROM app_settings ORDER BY key ASC")
        .fetch_all(pool)
        .await?;

    Ok(rows
        .into_iter()
        .map(|row| (row.get::<String, _>(0), row.get::<Option<String>, _>(1)))
        .collect())
}

pub async fn upsert_app_setting(
    pool: &SqlitePool,
    key: &str,
    value: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_csv_from_query(
    pool: &SqlitePool,
    sql: &str,
) -> Result<Vec<Vec<String>>, sqlx::Error> {
    let rows = sqlx::query(sql).fetch_all(pool).await?;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let mut cols = Vec::with_capacity(row.len());
        for idx in 0..row.len() {
            let value: Option<String> = row.try_get(idx)?;
            cols.push(value.unwrap_or_default());
        }
        out.push(cols);
    }
    Ok(out)
}

pub async fn sqlite_schema_sql(pool: &SqlitePool) -> Result<String, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT sql FROM sqlite_master
         WHERE sql IS NOT NULL
           AND type IN ('table','index')
           AND name NOT LIKE 'sqlite_%'
         ORDER BY type, name",
    )
    .fetch_all(pool)
    .await?;

    let mut statements = Vec::with_capacity(rows.len());
    for row in rows {
        let sql_stmt: String = row.get(0);
        statements.push(format!("{};", sql_stmt.trim_end_matches(';')));
    }
    Ok(statements.join("\n\n"))
}

pub fn now_utc_string(ts: NaiveDateTime) -> String {
    ts.format("%Y-%m-%dT%H:%M:%SZ").to_string()
}
