use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json,
};
use serde::Deserialize;

use crate::db::{models::*, schedules};
use crate::services::scheduler;

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/schedules", get(list).post(create))
        .route(
            "/api/v1/schedules/{id}",
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
) -> ApiResult<Vec<Schedule>> {
    let rows = schedules::list_schedules(
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
) -> Result<Json<Schedule>, (StatusCode, Json<serde_json::Value>)> {
    match schedules::get_schedule(&s.pool, id).await {
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
    Json(body): Json<NewSchedule>,
) -> ApiResult<Schedule> {
    // Compute next_run_at from cron expression when not provided.
    let body = if body.next_run_at.is_none() {
        let next = body
            .cron_expression
            .as_deref()
            .and_then(scheduler::compute_next_run);
        NewSchedule { next_run_at: next, ..body }
    } else {
        body
    };
    let row = schedules::create_schedule(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateSchedule>,
) -> Result<Json<Schedule>, (StatusCode, Json<serde_json::Value>)> {
    // Recompute next_run_at when the cron expression changes.
    let next_run_at = body
        .cron_expression
        .as_deref()
        .and_then(scheduler::compute_next_run);
    match schedules::update_schedule(&s.pool, id, body, next_run_at).await {
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
    schedules::delete_schedule(&s.pool, id)
        .await
        .map_err(ApiError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
