use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use crate::db::{
    canvas,
    models::{Location, LocationType, NewLocation, UpdateLocation},
};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CreatePlotGroupInput {
    pub environment_id: i64,
    pub parent_id: Option<i64>,
    pub name: String,
    pub label_prefix: Option<String>,
    pub rows: i64,
    pub cols: i64,
    pub origin_x: Option<f64>,
    pub origin_y: Option<f64>,
    pub cell_width: Option<f64>,
    pub cell_height: Option<f64>,
    pub gap_x: Option<f64>,
    pub gap_y: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PlotGroupCreateResult {
    pub group: Location,
    pub spaces: Vec<Location>,
}

fn to_grid_row_label(index: i64) -> String {
    let mut label = String::new();
    let mut current = index;

    loop {
        let remainder = (current % 26) as u8;
        label.insert(0, (b'A' + remainder) as char);
        current = (current / 26) - 1;
        if current < 0 {
            break;
        }
    }

    label
}

fn is_valid_parent_child(parent: &LocationType, child: &LocationType) -> bool {
    match parent {
        // Explicit new hierarchy rules.
        LocationType::OutdoorSite => matches!(child, LocationType::PlotGroup | LocationType::Shed | LocationType::Plot | LocationType::Space),
        LocationType::IndoorSite => matches!(child, LocationType::Tent | LocationType::SeedlingArea | LocationType::Tray | LocationType::Pot),
        LocationType::PlotGroup => matches!(child, LocationType::Space),
        LocationType::Tent => matches!(child, LocationType::Tray | LocationType::Pot),
        LocationType::Tray => matches!(child, LocationType::Pot),
        // Legacy hierarchy kept permissive for existing data.
        LocationType::Plot => matches!(child, LocationType::Space),
        _ => true,
    }
}

async fn validate_location_parent(
    pool: &SqlitePool,
    parent_id: Option<i64>,
    child_type: &LocationType,
) -> Result<(), String> {
    let Some(parent_id) = parent_id else {
        return Ok(());
    };

    let parent = canvas::get_location(pool, parent_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Parent location {} not found", parent_id))?;

    if is_valid_parent_child(&parent.location_type, child_type) {
        Ok(())
    } else {
        Err(format!(
            "Invalid hierarchy: cannot place {:?} under {:?}",
            child_type, parent.location_type
        ))
    }
}

async fn move_descendants(
    pool: &SqlitePool,
    root_parent_id: i64,
    dx: f64,
    dy: f64,
) -> Result<(), String> {
    let mut stack = vec![root_parent_id];

    while let Some(parent_id) = stack.pop() {
        let children = canvas::list_child_locations(pool, parent_id)
            .await
            .map_err(|e| e.to_string())?;

        for child in children {
            let next_x = child.position_x.unwrap_or(0.0) + dx;
            let next_y = child.position_y.unwrap_or(0.0) + dy;

            canvas::update_location(
                pool,
                child.id,
                UpdateLocation {
                    parent_id: None,
                    location_type: None,
                    name: None,
                    label: None,
                    position_x: Some(next_x),
                    position_y: Some(next_y),
                    width: None,
                    height: None,
                    canvas_data_json: None,
                    notes: None,
                    grid_rows: None,
                    grid_cols: None,
                },
            )
            .await
            .map_err(|e| e.to_string())?;

            stack.push(child.id);
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Canvas state
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn save_canvas(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
    canvas_json: String,
) -> Result<(), String> {
    canvas::save_canvas(&pool, environment_id, &canvas_json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn load_canvas(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Option<String>, String> {
    canvas::load_canvas(&pool, environment_id)
        .await
        .map(|opt| opt.map(|s| s.canvas_json))
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Location CRUD
// ---------------------------------------------------------------------------

#[tauri::command]
#[specta::specta]
pub async fn list_locations(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Location>, String> {
    canvas::list_locations_for_env(&pool, environment_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn get_location(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<Option<Location>, String> {
    canvas::get_location(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_location(
    pool: State<'_, SqlitePool>,
    input: NewLocation,
) -> Result<Location, String> {
    validate_location_parent(&pool, input.parent_id, &input.location_type).await?;

    canvas::create_location(&pool, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn update_location(
    pool: State<'_, SqlitePool>,
    id: i64,
    input: UpdateLocation,
) -> Result<Option<Location>, String> {
    if input.parent_id.is_some() || input.location_type.is_some() {
        let current = canvas::get_location(&pool, id)
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("Location {} not found", id))?;

        let parent_id = input.parent_id.or(current.parent_id);
        let next_type = input
            .location_type
            .clone()
            .unwrap_or(current.location_type);

        validate_location_parent(&pool, parent_id, &next_type).await?;
    }

    canvas::update_location(&pool, id, input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_location(
    pool: State<'_, SqlitePool>,
    id: i64,
) -> Result<bool, String> {
    canvas::delete_location(&pool, id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn list_child_locations(
    pool: State<'_, SqlitePool>,
    parent_id: i64,
) -> Result<Vec<Location>, String> {
    canvas::list_child_locations(&pool, parent_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn create_plot_group(
    pool: State<'_, SqlitePool>,
    input: CreatePlotGroupInput,
) -> Result<PlotGroupCreateResult, String> {
    if input.rows <= 0 || input.cols <= 0 {
        return Err("Rows and columns must be greater than zero".to_string());
    }

    let origin_x = input.origin_x.unwrap_or(0.0);
    let origin_y = input.origin_y.unwrap_or(0.0);
    let cell_width = input.cell_width.unwrap_or(40.0).max(1.0);
    let cell_height = input.cell_height.unwrap_or(40.0).max(1.0);
    let gap_x = input.gap_x.unwrap_or(0.0).max(0.0);
    let gap_y = input.gap_y.unwrap_or(0.0).max(0.0);
    let label_prefix = input
        .label_prefix
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| input.name.clone());

    let width = input.cols as f64 * cell_width + ((input.cols - 1) as f64 * gap_x);
    let height = input.rows as f64 * cell_height + ((input.rows - 1) as f64 * gap_y);

    validate_location_parent(&pool, input.parent_id, &LocationType::PlotGroup).await?;

    let group = canvas::create_location(
        &pool,
        NewLocation {
            environment_id: input.environment_id,
            parent_id: input.parent_id,
            location_type: LocationType::PlotGroup,
            name: input.name,
            label: Some(label_prefix.clone()),
            position_x: Some(origin_x),
            position_y: Some(origin_y),
            width: Some(width),
            height: Some(height),
            canvas_data_json: None,
            notes: input.notes,
            grid_rows: Some(input.rows),
            grid_cols: Some(input.cols),
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut spaces = Vec::with_capacity((input.rows * input.cols) as usize);

    for row_index in 0..input.rows {
        for col_index in 0..input.cols {
            let space_label = format!(
                "{} {}{}",
                label_prefix,
                to_grid_row_label(row_index),
                col_index + 1
            );
            let space_x = origin_x + (col_index as f64 * (cell_width + gap_x));
            let space_y = origin_y + (row_index as f64 * (cell_height + gap_y));

            let space = canvas::create_location(
                &pool,
                NewLocation {
                    environment_id: group.environment_id,
                    parent_id: Some(group.id),
                    location_type: LocationType::Space,
                    name: space_label.clone(),
                    label: Some(space_label),
                    position_x: Some(space_x),
                    position_y: Some(space_y),
                    width: Some(cell_width),
                    height: Some(cell_height),
                    canvas_data_json: None,
                    notes: None,
                    grid_rows: None,
                    grid_cols: None,
                },
            )
            .await
            .map_err(|e| e.to_string())?;

            spaces.push(space);
        }
    }

    Ok(PlotGroupCreateResult { group, spaces })
}

#[tauri::command]
#[specta::specta]
pub async fn list_plot_groups(
    pool: State<'_, SqlitePool>,
    environment_id: i64,
) -> Result<Vec<Location>, String> {
    canvas::list_locations_by_type(&pool, environment_id, LocationType::PlotGroup)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn move_plot_group(
    pool: State<'_, SqlitePool>,
    id: i64,
    position_x: f64,
    position_y: f64,
) -> Result<Location, String> {
    let current = canvas::get_location(&pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Location {} not found", id))?;

    if !matches!(current.location_type, LocationType::PlotGroup) {
        return Err(format!("Location {} is not a plot group", id));
    }

    let old_x = current.position_x.unwrap_or(0.0);
    let old_y = current.position_y.unwrap_or(0.0);
    let dx = position_x - old_x;
    let dy = position_y - old_y;

    canvas::update_location(
        &pool,
        id,
        UpdateLocation {
            parent_id: None,
            location_type: None,
            name: None,
            label: None,
            position_x: Some(position_x),
            position_y: Some(position_y),
            width: None,
            height: None,
            canvas_data_json: None,
            notes: None,
            grid_rows: None,
            grid_cols: None,
        },
    )
    .await
    .map_err(|e| e.to_string())?;

    move_descendants(&pool, id, dx, dy).await?;

    canvas::get_location(&pool, id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Location {} not found after update", id))
}
