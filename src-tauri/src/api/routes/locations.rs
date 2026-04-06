use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json,
};
use serde::Deserialize;

use crate::db::{locations, models::*};

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/locations", get(list).post(create))
        .route(
            "/api/v1/locations/{id}",
            get(get_one).put(update).delete(remove),
        )
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub environment_id: i64,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

async fn list(
    State(s): State<AppState>,
    Query(q): Query<ListQuery>,
) -> ApiResult<Vec<Location>> {
    let rows = locations::list_locations(
        &s.pool,
        q.environment_id,
        Pagination {
            limit: q.limit.unwrap_or(200),
            offset: q.offset.unwrap_or(0),
        },
    )
    .await?;
    Ok(Json(rows))
}

async fn get_one(
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Location>, (StatusCode, Json<serde_json::Value>)> {
    match locations::get_location(&s.pool, id).await {
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

async fn create(
    State(s): State<AppState>,
    Json(body): Json<NewLocation>,
) -> ApiResult<Location> {
    let row = locations::create_location(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateLocation>,
) -> Result<Json<Location>, (StatusCode, Json<serde_json::Value>)> {
    match locations::update_location(&s.pool, id, body).await {
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
    locations::delete_location(&s.pool, id)
        .await
        .map_err(ApiError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
