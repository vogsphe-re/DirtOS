use crate::db::models::PlantStatus;

/// Validate that a plant status transition is legal.
/// Returns Ok(()) if the transition is allowed, Err with a message otherwise.
pub fn validate_transition(from: &PlantStatus, to: &PlantStatus) -> Result<(), String> {
    let allowed = match from {
        PlantStatus::Planned => matches!(to, PlantStatus::Seedling | PlantStatus::Active | PlantStatus::Removed | PlantStatus::Dead),
        PlantStatus::Seedling => matches!(to, PlantStatus::Active | PlantStatus::Removed | PlantStatus::Dead),
        PlantStatus::Active => matches!(to, PlantStatus::Harvested | PlantStatus::Removed | PlantStatus::Dead),
        PlantStatus::Harvested | PlantStatus::Removed | PlantStatus::Dead => false,
    };
    if allowed {
        Ok(())
    } else {
        Err(format!(
            "Cannot transition plant from {:?} to {:?}",
            from, to
        ))
    }
}

pub fn is_perennial(lifecycle: Option<&str>) -> bool {
    lifecycle
        .map(|value| value.eq_ignore_ascii_case("perennial"))
        .unwrap_or(false)
}

/// Validate transitions while allowing perennial plants to cycle from
/// harvested back to seedling.
pub fn validate_transition_with_lifecycle(
    from: &PlantStatus,
    to: &PlantStatus,
    lifecycle: Option<&str>,
) -> Result<(), String> {
    if matches!((from, to), (PlantStatus::Harvested, PlantStatus::Seedling)) && is_perennial(lifecycle) {
        return Ok(());
    }

    validate_transition(from, to)
}
