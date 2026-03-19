use crate::db::models::{Plant, ScheduleSuggestion, ScheduleType, Species};

/// Generate schedule suggestions for a plant based on species attributes.
pub fn suggest_schedules(plant: &Plant, species: Option<&Species>) -> Vec<ScheduleSuggestion> {
    let mut suggestions = Vec::new();

    // --- Watering suggestion from water_requirement ---
    let water_cron = species
        .and_then(|s| s.water_requirement.as_deref())
        .and_then(|req| match req.to_lowercase().as_str() {
            "high" => Some(("0 8 * * *", "Daily")),
            "medium" | "moderate" => Some(("0 8 */2 * *", "Every 2 days")),
            "low" | "minimal" => Some(("0 8 * * 1", "Weekly")),
            _ => None,
        });

    if let Some((cron, label)) = water_cron {
        suggestions.push(ScheduleSuggestion {
            schedule_type: ScheduleType::Water,
            title: format!("Water {}", plant.name),
            cron_expression: cron.to_string(),
            cron_label: label.to_string(),
            notes: species
                .and_then(|s| s.water_requirement.as_deref())
                .map(|r| format!("Based on {} water requirement", r)),
        });
    } else {
        // Default watering suggestion when species is unknown
        suggestions.push(ScheduleSuggestion {
            schedule_type: ScheduleType::Water,
            title: format!("Water {}", plant.name),
            cron_expression: "0 8 */2 * *".to_string(),
            cron_label: "Every 2 days".to_string(),
            notes: None,
        });
    }

    // --- Feeding suggestion (weekly for most plants) ---
    suggestions.push(ScheduleSuggestion {
        schedule_type: ScheduleType::Feed,
        title: format!("Feed {}", plant.name),
        cron_expression: "0 8 * * 1".to_string(),
        cron_label: "Weekly (Mondays)".to_string(),
        notes: None,
    });

    // --- Maintenance check (biweekly) ---
    suggestions.push(ScheduleSuggestion {
        schedule_type: ScheduleType::Maintenance,
        title: format!("Inspect {}", plant.name),
        cron_expression: "0 8 1,15 * *".to_string(),
        cron_label: "Biweekly (1st & 15th)".to_string(),
        notes: Some("Check for pests, prune dead leaves, check pH".to_string()),
    });

    suggestions
}
