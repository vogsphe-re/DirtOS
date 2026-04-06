use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
    Json,
};
use serde::Deserialize;

use crate::db::{models::*, species};

use super::{ApiError, ApiResult, AppState};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/species", get(list).post(create))
        .route(
            "/api/v1/species/{id}",
            get(get_one).put(update).delete(remove),
        )
}

#[derive(Deserialize)]
pub struct ListQuery {
    pub query: Option<String>,
    pub sun_requirement: Option<String>,
    pub water_requirement: Option<String>,
    pub growth_type: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

async fn list(
    State(s): State<AppState>,
    Query(q): Query<ListQuery>,
) -> ApiResult<Vec<Species>> {
    let rows = species::list_species_filtered(
        &s.pool,
        SpeciesFilters {
            query: q.query,
            sun_requirement: q.sun_requirement,
            water_requirement: q.water_requirement,
            growth_type: q.growth_type,
        },
        Pagination {
            limit: q.limit.unwrap_or(100),
            offset: q.offset.unwrap_or(0),
        },
    )
    .await?;
    Ok(Json(rows))
}

async fn get_one(
    State(s): State<AppState>,
    Path(id): Path<i64>,
) -> Result<Json<Species>, (StatusCode, Json<serde_json::Value>)> {
    match species::get_species(&s.pool, id).await {
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
    Json(body): Json<NewSpecies>,
) -> ApiResult<Species> {
    let row = species::create_species(&s.pool, body)
        .await
        .map_err(ApiError::from)?;
    Ok(Json(row))
}

async fn update(
    State(s): State<AppState>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateSpecies>,
) -> Result<Json<Species>, (StatusCode, Json<serde_json::Value>)> {
    match species::update_species(&s.pool, id, body).await {
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
    species::delete_species(&s.pool, id)
        .await
        .map_err(ApiError::from)?;
    Ok(StatusCode::NO_CONTENT)
}
