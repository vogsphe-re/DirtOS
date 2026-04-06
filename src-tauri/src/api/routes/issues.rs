use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json,
};
use serde::Deserialize;

use crate::db::{issues, models::*};

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/issues", get(list).post(create))
        .route(
            "/api/v1/issues/{id}",
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
) -> ApiResult<Vec<Issue>> {
    let rows = issues::list_issues(
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
) -> Result<Json<Issue>, (StatusCode, Json<serde_json::Value>)> {
    match issues::get_issue(&s.pool, id).await {
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
    Json(body): Json<NewIssue>,
) -> ApiResult<Issue> {
    let row = issues::create_issue(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateIssue>,
) -> Result<Json<Issue>, (StatusCode, Json<serde_json::Value>)> {
    match issues::update_issue(&s.pool, id, body).await {
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
    issues::delete_issue(&s.pool, id)
        .await
        .map_err(ApiError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
