/// Inventory asset-tag generation.
///
/// Every entity that participates in inventory management receives a unique
/// asset tag generated at creation time.
///
/// ## Format
///
/// ```text
/// PREFIX-YYRRRR
/// ```
///
/// | Part   | Example | Meaning                                          |
/// |--------|---------|--------------------------------------------------|
/// | PREFIX | PLA     | 3-letter abbreviation of the entity type         |
/// | -      | -       | literal separator                                |
/// | YY     | 26      | last two digits of the current calendar year    |
/// | RRRR   | a3f7    | 4 random hex digits (≈ 65 536 IDs / year / type)|
///
/// ## Prefixes
///
/// | Prefix | Entity                           |
/// |--------|----------------------------------|
/// | GDN    | Garden / Environment             |
/// | PLT    | Plot location                    |
/// | SPC    | Space location                   |
/// | TNT    | Tent location                    |
/// | TRY    | Tray location or seedling tray   |
/// | POT    | Pot location                     |
/// | SHD    | Shed location                    |
/// | OST    | Outdoor site location            |
/// | IST    | Indoor site location             |
/// | PGR    | Plot-group location              |
/// | SDA    | Seedling-area location           |
/// | PLA    | Individual plant                 |
/// | SED    | Seed lot / seed package          |
/// | LOT    | Harvest lot (derived from plant) |
///
/// ## Harvest tags
///
/// Harvest asset tags keep the same 6-digit hex suffix as the parent plant's
/// tag but swap the `PLA-` prefix for `LOT-`.  This preserves the visible
/// link between plant and harvest without any extra DB join.
use chrono::Datelike;
use rand::Rng;

/// Generate a new unique asset tag.
///
/// `prefix` must be exactly 3 uppercase ASCII letters (e.g. `"PLA"`, `"GDN"`).
///
/// ```
/// let tag = generate_tag("PLA");
/// // "PLA-26a3f7"
/// ```
pub fn generate_tag(prefix: &str) -> String {
    let year = chrono::Utc::now().year() % 100; // 2026 → 26
    let suffix: u16 = rand::thread_rng().gen_range(0x0000..=0xFFFF);
    format!("{}-{:02x}{:04x}", prefix, year, suffix)
}

/// Derive a harvest tag from a plant's existing asset tag.
///
/// Swaps the leading `PLA-` for `LOT-`, keeping the hex suffix identical so
/// the plant↔harvest relationship is apparent from the tag alone.
///
/// Falls back to a freshly-generated `LOT-` tag if the plant has no tag or
/// if the tag doesn't start with `PLA-`.
pub fn harvest_tag_from_plant(plant_asset_id: Option<&str>) -> String {
    if let Some(tag) = plant_asset_id {
        if let Some(rest) = tag.strip_prefix("PLA-") {
            return format!("LOT-{rest}");
        }
    }
    generate_tag("LOT")
}

/// Return the asset-tag prefix for a `LocationType` variant.
///
/// The `location_type` string follows the `snake_case` serialisation used in
/// the database (`plot`, `space`, `tent`, `tray`, `pot`, `shed`,
/// `outdoor_site`, `indoor_site`, `plot_group`, `seedling_area`).
pub fn prefix_for_location_type(location_type: &str) -> &'static str {
    match location_type {
        "plot"  => "PLT",
        "space" => "SPC",
        "tent"  => "TNT",
        "tray"  => "TRY",
        "pot"   => "POT",
        "shed"  => "SHD",
        "outdoor_site" => "OST",
        "indoor_site" => "IST",
        "plot_group" => "PGR",
        "seedling_area" => "SDA",
        _       => "LOC",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tag_format() {
        let tag = generate_tag("PLA");
        let parts: Vec<&str> = tag.split('-').collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0], "PLA");
        assert_eq!(parts[1].len(), 6); // 2 year + 4 random hex
        assert!(parts[1].chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn harvest_tag_derived() {
        let plant_tag = "PLA-26a3f7";
        let harvest_tag = harvest_tag_from_plant(Some(plant_tag));
        assert_eq!(harvest_tag, "LOT-26a3f7");
    }

    #[test]
    fn harvest_tag_fallback() {
        let tag = harvest_tag_from_plant(None);
        assert!(tag.starts_with("LOT-"));
    }
}
