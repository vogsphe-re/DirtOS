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
