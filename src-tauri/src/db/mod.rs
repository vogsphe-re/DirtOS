use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::Path;

pub mod environments;
pub mod custom_fields;
pub mod harvests;
pub mod indoor;
pub mod issues;
pub mod journal;
pub mod locations;
pub mod models;
pub mod plants;
pub mod schedules;
pub mod seed;
pub mod sensors;
pub mod species;

/// Initialise the SQLite connection pool and run any pending migrations.
/// The database file is created at `{app_data_dir}/dirtos.db`.
pub async fn init_db(app_data_dir: &Path) -> Result<SqlitePool, sqlx::Error> {
    // Ensure the data directory exists.
    std::fs::create_dir_all(app_data_dir)
        .expect("Failed to create app data directory");

    let db_path = app_data_dir.join("dirtos.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    tracing::info!("Connecting to database at {}", db_url);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Enable WAL mode for better concurrent read performance.
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(&pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(&pool)
        .await?;

    // Run all pending migrations from the `migrations/` directory.
    sqlx::migrate!("./migrations").run(&pool).await?;

    tracing::info!("Migrations complete");

    // Seed reference data on first run (idempotent).
    if let Err(e) = seed::seed_initial_data(&pool).await {
        tracing::warn!("Seed data load failed: {:?}", e);
    } else {
        tracing::info!("Seed data loaded");
    }

    Ok(pool)
}
