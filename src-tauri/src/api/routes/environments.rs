use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json,
};
use serde::Deserialize;

use crate::db::{environments, models::*};

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/environments", get(list).post(create))
        .route(
            "/api/v1/environments/{id}",
            get(get_one).put(update).delete(remove),
        )
}

#[derive(Deserialize)]
pub struct Pagination {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

async fn list(
    State(s): State<AppState>,
    Query(p): Query<Pagination>,
) -> ApiResult<Vec<Environment>> {
    let rows = environments::list_environments(
        &s.pool,
        crate::db::models::Pagination {
            limit: p.limit.unwrap_or(100),
            offset: p.offset.unwrap_or(0),
        },
    )
    .await?;
    Ok(Json(rows))
}

async fn get_one(
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Environment>, (StatusCode, Json<serde_json::Value>)> {
    match environments::get_environment(&s.pool, id).await {
        Ok(Some(env)) => Ok(Json(env)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )),
    }
}

async fn create(
    State(s): State<AppState>,
    Json(body): Json<NewEnvironment>,
) -> ApiResult<Environment> {
    let row = environments::create_environment(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateEnvironment>,
) -> Result<Json<Environment>, (StatusCode, Json<serde_json::Value>)> {
    match environments::update_environment(&s.pool, id, body).await {
        Ok(Some(row)) => Ok(Json(row)),
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        )),
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )),
    }
}

async fn remove(
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    environments::delete_environment(&s.pool, id)
        .await
        .map_err(ApiError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
