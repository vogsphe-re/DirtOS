pub mod environments;
pub mod harvests;
pub mod health;
pub mod issues;
pub mod journal;
pub mod locations;
pub mod plants;
pub mod schedules;
pub mod sensors;
pub mod species;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use sqlx::SqlitePool;

// ---------------------------------------------------------------------------
// Shared state injected into every handler
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
}

// ---------------------------------------------------------------------------
// Shared error type
// ---------------------------------------------------------------------------

pub struct ApiError(String);

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        Self(e.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        #[derive(Serialize)]
        struct Body {
            error: String,
        }
        (StatusCode::INTERNAL_SERVER_ERROR, Json(Body { error: self.0 })).into_response()
    }
}

pub type ApiResult<T> = Result<Json<T>, ApiError>;
