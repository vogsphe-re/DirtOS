/// Plant category slugs and asset ID generation.
///
/// Each high-level plant category maps to a short 4-char slug used in asset IDs.
///
/// | Category   | Slug | Example growth_type values              |
/// |------------|------|-----------------------------------------|
/// | Tree       | tree | "tree", "deciduous tree"                |
/// | Shrub      | shrb | "shrub"                                 |
/// | Sub-shrub  | sshr | "subshrub"                              |
/// | Vine       | vine | "vine", "climbing vine"                 |
/// | Grass      | gras | "grass", "graminoid"                    |
/// | Herb/Forb  | herb | "herb", "forb", "herbaceous"            |
/// | Fern       | fern | "fern", "fernlike"                      |
/// | Aquatic    | aqua | "aquatic", "submerged"                  |
/// | Succulent  | succ | "succulent"                             |
/// | Bulb       | bulb | "bulb", "geophyte"                      |
/// | Generic    | genr | any other recognized value              |
/// | Unknown    | unkn | no species / growth_type not set        |

use chrono::Datelike;
use rand::Rng;

/// Derive a short 4-char category slug from a normalized `growth_type` string.
///
/// Matching is substring-based and case-insensitive to handle the varied
/// free-text values stored by the EoL and Trefle enrichment services.
pub fn growth_type_to_slug(growth_type: Option<&str>) -> &'static str {
    let Some(g) = growth_type else { return "unkn" };
    let lower = g.to_lowercase();

    // Order matters: more-specific patterns first.
    if lower.contains("subshrub") || lower.contains("sub-shrub") {
        return "sshr";
    }
    if lower.contains("tree") {
        return "tree";
    }
    if lower.contains("shrub") {
        return "shrb";
    }
    if lower.contains("vine") || lower.contains("climber") || lower.contains("climbing") {
        return "vine";
    }
    if lower.contains("fern") {
        return "fern";
    }
    if lower.contains("aquat") || lower.contains("submerged") || lower.contains("emergent") {
        return "aqua";
    }
    if lower.contains("succu") || lower.contains("cactus") || lower.contains("cacti") {
        return "succ";
    }
    if lower.contains("bulb") || lower.contains("geophyte") || lower.contains("corm") {
        return "bulb";
    }
    if lower.contains("grass") || lower.contains("gramin") || lower.contains("sedge") {
        return "gras";
    }
    if lower.contains("forb") || lower.contains("herb") {
        return "herb";
    }
    "genr"
}

/// Generate a unique asset ID for a plant.
///
/// Format: `{year}-{slug}-{6-hex-chars}`  e.g. `2026-herb-a3f5b2`
///
/// The six hex digits come from a cryptographically random source via the
/// `rand` crate, giving ~16 million distinct IDs per year per category.
pub fn generate_asset_id(growth_type: Option<&str>) -> String {
    let year = chrono::Utc::now().year();
    let slug = growth_type_to_slug(growth_type);
    let hash: u32 = rand::thread_rng().gen_range(0x000000..=0xFFFFFF);
    format!("{year}-{slug}-{hash:06x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_known_types() {
        assert_eq!(growth_type_to_slug(Some("tree")), "tree");
        assert_eq!(growth_type_to_slug(Some("deciduous tree")), "tree");
        assert_eq!(growth_type_to_slug(Some("shrub")), "shrb");
        assert_eq!(growth_type_to_slug(Some("subshrub")), "sshr");
        assert_eq!(growth_type_to_slug(Some("vine")), "vine");
        assert_eq!(growth_type_to_slug(Some("grass")), "gras");
        assert_eq!(growth_type_to_slug(Some("herb")), "herb");
        assert_eq!(growth_type_to_slug(Some("forb")), "herb");
        assert_eq!(growth_type_to_slug(Some("fern")), "fern");
        assert_eq!(growth_type_to_slug(Some("aquatic")), "aqua");
        assert_eq!(growth_type_to_slug(Some("succulent")), "succ");
        assert_eq!(growth_type_to_slug(Some("bulb")), "bulb");
        assert_eq!(growth_type_to_slug(None), "unkn");
        assert_eq!(growth_type_to_slug(Some("mystery plant")), "genr");
    }

    #[test]
    fn asset_id_format() {
        let id = generate_asset_id(Some("tree"));
        let parts: Vec<&str> = id.split('-').collect();
        assert_eq!(parts.len(), 3);
        assert_eq!(parts[1], "tree");
        assert_eq!(parts[2].len(), 6);
        assert!(parts[2].chars().all(|c| c.is_ascii_hexdigit()));
    }
}
