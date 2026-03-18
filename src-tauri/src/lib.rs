use tauri::Manager;
use tauri_specta::{collect_commands, Builder};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub mod commands;
pub mod db;
pub mod events;
pub mod services;

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
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
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            tracing::info!("DirtOS starting. Data dir: {:?}", app_data_dir);

            // Database initialisation runs async; spawn onto the tokio runtime.
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match db::init_db(&app_data_dir).await {
                    Ok(pool) => {
                        tracing::info!("Database initialised successfully");
                        app_handle.manage(pool);
                    }
                    Err(e) => {
                        tracing::error!("Failed to initialise database: {:?}", e);
                    }
                }
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
