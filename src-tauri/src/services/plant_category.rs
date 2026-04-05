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

use rand as _; // keep rand in scope so cargo doesn't drop it from the dep tree

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

/// Generate a unique asset tag for a plant.
///
/// Format: `PLA-YYRRRR`  e.g. `PLA-26a3f7`
///
/// This replaces the previous `{year}-{slug}-{6hex}` format.  The `growth_type`
/// argument is retained for API compatibility but no longer used in the tag
/// itself; callers that still want a category slug should call
/// [`growth_type_to_slug`] directly.
pub fn generate_asset_id(_growth_type: Option<&str>) -> String {
    crate::services::asset_tag::generate_tag("PLA")
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
