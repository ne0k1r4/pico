use regex::Regex;

pub fn safe_identifier(input: &str) -> String {
    let lower = input.trim().to_ascii_lowercase();
    let invalid = Regex::new(r"[^a-z0-9_-]+").expect("regex compiles");
    let collapsed = invalid.replace_all(&lower, "-");
    let trimmed = collapsed.trim_matches('-').trim_matches('_');
    if trimmed.is_empty() {
        "web2native-app".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn safe_product_name(input: &str) -> String {
    let cleaned: String = input
        .chars()
        .filter(|ch| !ch.is_control())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.is_empty() {
        "Web2Native App".to_string()
    } else {
        cleaned.chars().take(80).collect()
    }
}
