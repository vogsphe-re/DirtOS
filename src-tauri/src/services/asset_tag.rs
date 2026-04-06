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
/// | PLA    | Individual plant                 |
/// | SED    | Seed lot / seed package          |
/// | LOT    | Harvest lot                      |
///
/// ## Harvest tags
///
/// Harvest asset tags use the `LOT-` prefix with a freshly-generated random
/// suffix.  The plant relationship is stored in `harvests.plant_id`.
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

/// Generate a unique harvest asset tag.
///
/// Always returns a freshly-generated `LOT-` tag. The plant relationship is
/// stored in `harvests.plant_id`; encoding it in the tag suffix caused UNIQUE
/// constraint violations when a plant had more than one harvest.
pub fn harvest_tag_from_plant(_plant_asset_id: Option<&str>) -> String {
    generate_tag("LOT")
}

/// Return the asset-tag prefix for a `LocationType` variant.
///
/// The `location_type` string follows the `snake_case` serialisation used in
/// the database (`plot`, `space`, `tent`, `tray`, `pot`, `shed`).
pub fn prefix_for_location_type(location_type: &str) -> &'static str {
    match location_type {
        "plot"  => "PLT",
        "space" => "SPC",
        "tent"  => "TNT",
        "tray"  => "TRY",
        "pot"   => "POT",
        "shed"  => "SHD",
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
    fn harvest_tag_is_unique_lot() {
        let t1 = harvest_tag_from_plant(Some("PLA-26a3f7"));
        let t2 = harvest_tag_from_plant(Some("PLA-26a3f7"));
        assert!(t1.starts_with("LOT-"));
        assert!(t2.starts_with("LOT-"));
        // Two harvests for the same plant must get different tags.
        assert_ne!(t1, t2);
    }
}
