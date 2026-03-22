use std::sync::RwLock;

use tauri::Manager;
use tauri_specta::{collect_commands, Builder};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub mod commands;
pub mod db;
pub mod events;
pub mod services;

use commands::app::AppStartupStatus;

pub struct AppStartupState {
    status: RwLock<AppStartupStatus>,
}

impl Default for AppStartupState {
    fn default() -> Self {
        Self {
            status: RwLock::new(AppStartupStatus {
                ready: false,
                recovering: false,
                recovered_from_backup: false,
                message: Some("Initializing local database".to_string()),
            }),
        }
    }
}

impl AppStartupState {
    pub fn get_status(&self) -> AppStartupStatus {
        self.status
            .read()
            .map(|status| status.clone())
            .unwrap_or(AppStartupStatus {
                ready: false,
                recovering: false,
                recovered_from_backup: false,
                message: Some("Startup state unavailable".to_string()),
            })
    }

    pub fn set_status(&self, status: AppStartupStatus) {
        if let Ok(mut current) = self.status.write() {
            *current = status;
        }
    }
}

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::get_app_startup_status,
        commands::export_full_garden_data,
        commands::import_full_garden_data,
        commands::greet,
        // Environment
        commands::list_environments,
        commands::get_environment,
        commands::create_environment,
        commands::update_environment,
        commands::delete_environment,
        // Species
        commands::list_species,
        commands::get_species,
        commands::create_species,
        commands::update_species,
        commands::delete_species,
        commands::search_inaturalist,
        commands::enrich_species_inaturalist,
        commands::search_wikipedia,
        commands::enrich_species_wikipedia,
        commands::search_wikipedia_candidates,
        commands::enrich_species_wikipedia_by_slug,
        commands::search_eol_candidates,
        commands::enrich_species_eol_by_id,
        commands::search_gbif_candidates,
        commands::enrich_species_gbif_by_key,
        commands::search_trefle_candidates,
        commands::enrich_species_trefle_by_id,
        commands::preview_enrich_inaturalist,
        commands::preview_enrich_wikipedia,
        commands::preview_enrich_eol,
        commands::preview_enrich_gbif,
        commands::preview_enrich_trefle,
        commands::apply_enrichment_preview,
        commands::auto_enrich_trefle,
        // Integrations & extensions
        commands::list_integration_configs,
        commands::upsert_integration_config,
        commands::list_species_external_sources,
        commands::sync_species_external_sources,
        commands::list_integration_sync_runs,
        commands::search_osm_places,
        commands::get_environment_map_setting,
        commands::upsert_environment_map_setting,
        commands::create_integration_webhook_token,
        commands::list_integration_webhook_tokens,
        commands::process_integration_callback,
        commands::list_automation_events,
        commands::create_backup_job,
        commands::list_backup_jobs,
        commands::update_backup_job,
        commands::list_backup_runs,
        commands::export_configuration,
        commands::run_backup_job,
        commands::import_configuration,
        commands::list_species_for_integration,
        // Indoor
        commands::create_indoor_environment,
        commands::update_indoor_environment,
        commands::get_indoor_environment,
        commands::list_indoor_environments,
        commands::log_indoor_reading,
        commands::list_indoor_readings,
        commands::log_nutrient_addition,
        commands::list_nutrient_logs,
        commands::log_water_change,
        commands::get_reservoir_status,
        commands::get_indoor_dashboard_summary,
        commands::get_indoor_reservoir_target,
        commands::upsert_indoor_reservoir_target,
        commands::calculate_vpd,
        commands::calculate_dli,
        commands::list_grow_methods,
        // Plants
        commands::list_plants,
        commands::list_all_plants,
        commands::list_plants_by_species,
        commands::list_plants_by_status,
        commands::list_plants_by_location,
        commands::get_plant,
        commands::create_plant,
        commands::update_plant,
        commands::delete_plant,
        commands::change_plant_status,
        commands::transition_plant_status,
        // Seedling observations
        commands::list_seedling_observations,
        commands::create_seedling_observation,
        commands::delete_seedling_observation,
        // Plant groups
        commands::list_plant_groups,
        commands::get_plant_group,
        commands::create_plant_group,
        commands::update_plant_group,
        commands::delete_plant_group,
        commands::add_plant_to_group,
        commands::remove_plant_from_group,
        commands::list_plant_group_plants,
        // Custom fields
        commands::list_custom_fields,
        commands::create_custom_field,
        commands::update_custom_field,
        commands::delete_custom_field,
        // Canvas
        commands::save_canvas,
        commands::load_canvas,
        commands::list_locations,
        commands::get_location,
        commands::create_location,
        commands::update_location,
        commands::delete_location,
        commands::list_child_locations,
        // Issues
        commands::list_issues,
        commands::get_issue,
        commands::create_issue,
        commands::update_issue,
        commands::delete_issue,
        commands::transition_issue_status,
        // Labels
        commands::list_labels,
        commands::create_label,
        commands::update_label,
        commands::delete_label,
        commands::list_issue_labels,
        commands::assign_issue_label,
        commands::remove_issue_label,
        // Comments
        commands::list_issue_comments,
        commands::add_issue_comment,
        commands::delete_issue_comment,
        // Journal
        commands::list_journal_entries,
        commands::get_journal_entry,
        commands::create_journal_entry,
        commands::update_journal_entry,
        commands::delete_journal_entry,
        // Media
        commands::upload_media,
        commands::list_media,
        commands::delete_media,
        commands::read_media_base64,
        // Schedules
        commands::list_schedules,
        commands::get_schedule,
        commands::create_schedule,
        commands::update_schedule,
        commands::delete_schedule,
        commands::toggle_schedule,
        commands::list_schedule_runs,
        commands::get_calendar_events,
        commands::list_additives,
        commands::get_schedule_suggestions,
        // Weather
        commands::get_weather,
        commands::refresh_weather,
        commands::get_weather_api_key,
        commands::set_weather_api_key,
        commands::get_trefle_api_key,
        commands::set_trefle_api_key,
        // Sensors
        commands::list_sensors,
        commands::get_sensor,
        commands::create_sensor,
        commands::update_sensor,
        commands::delete_sensor,
        commands::start_sensor,
        commands::stop_sensor,
        commands::list_sensor_readings,
        commands::get_latest_reading,
        commands::record_manual_reading,
        commands::get_sensor_limits,
        commands::set_sensor_limits,
        commands::create_soil_test,
        commands::list_soil_tests,
        commands::delete_soil_test,
        // Harvests & seed lots
        commands::list_harvests,
        commands::list_all_harvests,
        commands::create_harvest,
        commands::delete_harvest,
        commands::get_harvest_summary,
        commands::list_seed_lots,
        commands::get_seed_lot,
        commands::create_seed_lot,
        // Seedling trays
        commands::list_seedling_trays,
        commands::get_seedling_tray,
        commands::create_seedling_tray,
        commands::update_seedling_tray,
        commands::delete_seedling_tray,
        commands::list_seedling_tray_cells,
        commands::assign_seedling_tray_cell,
        commands::clear_seedling_tray_cell,
        // Seed store
        commands::list_seed_store,
        commands::get_seed_store_item,
        commands::create_seed_store_item,
        commands::update_seed_store_item,
        commands::delete_seed_store_item,
        commands::sow_seed_to_tray,
        // Reports & seasons
        commands::list_seasons,
        commands::create_season,
        commands::delete_season,
        commands::get_report_data,
        commands::get_recommendations,
        // Dashboards
        commands::list_dashboards,
        commands::get_dashboard,
        commands::create_dashboard,
        commands::update_dashboard,
        commands::delete_dashboard,
    ])
}

/// Export TypeScript bindings for all Tauri commands.
/// Called automatically in debug mode and via `pnpm generate-bindings`.
#[cfg(debug_assertions)]
pub fn export_bindings() {
    specta_builder()
        .export(
            specta_typescript::Typescript::default()
                .header("/* eslint-disable */\n// @ts-nocheck\n")
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/lib/bindings.ts",
        )
        .expect("Failed to export TypeScript bindings");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize structured logging. RUST_LOG env var controls verbosity.
    // Default: info for dirtos, warn for everything else.
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            EnvFilter::new("dirtos=info,warn")
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Export TS bindings on every debug run so src/lib/bindings.ts stays in sync.
    #[cfg(debug_assertions)]
    export_bindings();

    let invoke_handler = specta_builder().invoke_handler();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(AppStartupState::default());

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            tracing::info!("DirtOS starting. Data dir: {:?}", app_data_dir);

            // Database initialisation runs async; spawn onto the tokio runtime.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let startup = app_handle.state::<AppStartupState>();

                let mut recovered_from_backup = false;
                let pool = match db::init_db(&app_data_dir).await {
                    Ok(pool) => pool,
                    Err(error) => {
                        tracing::error!("Failed to initialise database: {:?}", error);
                        startup.set_status(AppStartupStatus {
                            ready: false,
                            recovering: true,
                            recovered_from_backup: false,
                            message: Some("Database startup failed. Attempting backup recovery.".to_string()),
                        });

                        match services::backup::restore_latest_backup(&app_data_dir) {
                            Ok(Some(path)) => {
                                tracing::warn!("Restored database from backup {:?}", path);
                                recovered_from_backup = true;
                                match db::init_db(&app_data_dir).await {
                                    Ok(pool) => pool,
                                    Err(recovery_error) => {
                                        tracing::error!("Backup recovery failed: {:?}", recovery_error);
                                        startup.set_status(AppStartupStatus {
                                            ready: false,
                                            recovering: false,
                                            recovered_from_backup: false,
                                            message: Some(format!(
                                                "Database recovery failed: {}",
                                                recovery_error
                                            )),
                                        });
                                        return;
                                    }
                                }
                            }
                            Ok(None) => {
                                startup.set_status(AppStartupStatus {
                                    ready: false,
                                    recovering: false,
                                    recovered_from_backup: false,
                                    message: Some(format!("Database initialization failed: {}", error)),
                                });
                                return;
                            }
                            Err(recovery_error) => {
                                startup.set_status(AppStartupStatus {
                                    ready: false,
                                    recovering: false,
                                    recovered_from_backup: false,
                                    message: Some(format!(
                                        "Database recovery failed: {}",
                                        recovery_error
                                    )),
                                });
                                return;
                            }
                        }
                    }
                };

                tracing::info!("Database initialised successfully");
                services::backup::start_periodic_backups(app_data_dir.clone(), pool.clone());

                // Start the cron scheduler before managing the pool
                let sched_pool = pool.clone();
                let sched_app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    services::scheduler::start(sched_app, sched_pool).await;
                });
                // Start the sensor polling service
                let sensor_pool = pool.clone();
                let sensor_app = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    services::sensors::poller::start(sensor_app, sensor_pool).await;
                });
                app_handle.manage(pool);

                startup.set_status(AppStartupStatus {
                    ready: true,
                    recovering: false,
                    recovered_from_backup,
                    message: if recovered_from_backup {
                        Some("Recovered from the latest healthy backup.".to_string())
                    } else {
                        Some("Ready".to_string())
                    },
                });
            });

            Ok(())
        })
        .invoke_handler(invoke_handler)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn export_bindings() {
        super::export_bindings();
    }
}
