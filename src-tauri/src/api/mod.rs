/// DirtOS REST API
///
/// An embedded HTTP API server (axum) that exposes DirtOS data for plugins
/// and 3rd-party integrations. Binds to 127.0.0.1 on the port specified by
/// the `DIRTOS_API_PORT` environment variable (default 7272).
///
/// All routes are prefixed with `/api/v1/`.
pub mod routes;

use axum::{Router, routing::get};
use sqlx::SqlitePool;
use std::net::SocketAddr;
use tauri::AppHandle;
use tower_http::cors::{Any, CorsLayer};

pub use routes::AppState;

pub fn build_router(pool: SqlitePool, app_handle: AppHandle) -> Router {
    let state = AppState { pool, app_handle };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/v1/health", get(routes::health::health))
        .merge(routes::storage::router())
        .merge(routes::backups::router())
        .merge(routes::environments::router())
        .merge(routes::species::router())
        .merge(routes::plants::router())
        .merge(routes::locations::router())
        .merge(routes::schedules::router())
        .merge(routes::sensors::router())
        .merge(routes::issues::router())
        .merge(routes::journal::router())
        .merge(routes::harvests::router())
        .merge(routes::seed_store::router())
        .layer(cors)
        .with_state(state)
}

/// Start the API server. Intended to be spawned as a background task after
/// the database pool is ready.
pub async fn start(pool: SqlitePool, app_handle: AppHandle) {
    let port: u16 = std::env::var("DIRTOS_API_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(7272);

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let app = build_router(pool, app_handle);

    tracing::info!("DirtOS REST API listening on http://{}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind REST API on {}: {}", addr, e);
            return;
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("REST API server error: {}", e);
    }
}
