use serde::{Deserialize, Serialize};
use url::Url;

use crate::GeneratorError;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileInput {
    pub website_url: String,
    pub app: AppMetadata,
    #[serde(default)]
    pub assets: Vec<AppAsset>,
    #[serde(default)]
    pub features: FeatureSet,
    #[serde(default)]
    pub build_targets: Vec<BuildTarget>,
    pub auto_update: Option<AutoUpdateConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppMetadata {
    pub name: String,
    pub title: String,
    pub bundle_identifier: String,
    pub version: String,
    pub theme_color: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppAsset {
    pub kind: String,
    pub source_url: Option<String>,
    pub data_url: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureSet {
    #[serde(default)]
    pub notifications: bool,
    #[serde(default)]
    pub file_uploads: bool,
    #[serde(default)]
    pub downloads: bool,
    #[serde(default)]
    pub camera: bool,
    #[serde(default)]
    pub microphone: bool,
    #[serde(default)]
    pub clipboard: bool,
    #[serde(default)]
    pub tray: bool,
    #[serde(default)]
    pub startup_launch: bool,
    pub deep_links: Option<DeepLinkConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkConfig {
    pub schemes: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildTarget {
    pub platform: PlatformTarget,
    pub architectures: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlatformTarget {
    Windows,
    Macos,
    Linux,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoUpdateConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub public_key: String,
    pub channel: Option<String>,
}

#[derive(Debug, Clone)]
pub struct WebsiteProfile {
    pub website_url: Url,
    pub app: AppMetadata,
    pub assets: Vec<AppAsset>,
    pub features: FeatureSet,
    pub build_targets: Vec<BuildTarget>,
    pub auto_update: Option<AutoUpdateConfig>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedAppConfig {
    pub website_url: String,
    pub title: String,
    pub features: FeatureSet,
    pub auto_update: Option<AutoUpdateConfig>,
}

impl TryFrom<ProfileInput> for WebsiteProfile {
    type Error = GeneratorError;

    fn try_from(input: ProfileInput) -> Result<Self, Self::Error> {
        let website_url = Url::parse(&input.website_url).map_err(|err| {
            GeneratorError::InvalidProfile(format!("websiteUrl is invalid: {err}"))
        })?;

        match website_url.scheme() {
            "https" => {}
            "http" if is_local_dev_host(&website_url) => {}
            _ => {
                return Err(GeneratorError::InvalidProfile(
                    "websiteUrl must use https, except localhost development URLs".to_string(),
                ));
            }
        }

        if input.app.name.trim().is_empty() {
            return Err(GeneratorError::InvalidProfile(
                "app.name must not be empty".to_string(),
            ));
        }
        if input.app.title.trim().is_empty() {
            return Err(GeneratorError::InvalidProfile(
                "app.title must not be empty".to_string(),
            ));
        }
        if !is_valid_bundle_identifier(&input.app.bundle_identifier) {
            return Err(GeneratorError::InvalidProfile(
                "app.bundleIdentifier must be a reverse-DNS identifier".to_string(),
            ));
        }
        if !is_semver_like(&input.app.version) {
            return Err(GeneratorError::InvalidProfile(
                "app.version must use numeric dot-separated versioning".to_string(),
            ));
        }
        if let Some(color) = &input.app.theme_color {
            if !is_hex_color(color) {
                return Err(GeneratorError::InvalidProfile(
                    "app.themeColor must be a #RRGGBB value".to_string(),
                ));
            }
        }
        if let Some(update) = &input.auto_update {
            if update.enabled {
                let endpoint = Url::parse(&update.endpoint).map_err(|err| {
                    GeneratorError::InvalidProfile(format!("autoUpdate.endpoint is invalid: {err}"))
                })?;
                if endpoint.scheme() != "https" {
                    return Err(GeneratorError::InvalidProfile(
                        "autoUpdate.endpoint must use https".to_string(),
                    ));
                }
                if update.public_key.trim().len() < 32 {
                    return Err(GeneratorError::InvalidProfile(
                        "autoUpdate.publicKey is too short".to_string(),
                    ));
                }
            }
        }
        if let Some(deep_links) = &input.features.deep_links {
            for scheme in &deep_links.schemes {
                if !is_valid_scheme(scheme) {
                    return Err(GeneratorError::InvalidProfile(format!(
                        "deep link scheme `{scheme}` is invalid"
                    )));
                }
            }
        }

        Ok(Self {
            website_url,
            app: input.app,
            assets: input.assets,
            features: input.features,
            build_targets: if input.build_targets.is_empty() {
                default_build_targets()
            } else {
                input.build_targets
            },
            auto_update: input.auto_update,
        })
    }
}

fn default_build_targets() -> Vec<BuildTarget> {
    vec![
        BuildTarget {
            platform: PlatformTarget::Windows,
            architectures: vec!["x86_64".to_string()],
        },
        BuildTarget {
            platform: PlatformTarget::Macos,
            architectures: vec!["x86_64".to_string(), "aarch64".to_string()],
        },
        BuildTarget {
            platform: PlatformTarget::Linux,
            architectures: vec!["x86_64".to_string()],
        },
    ]
}

fn is_local_dev_host(url: &Url) -> bool {
    matches!(
        url.host_str(),
        Some("localhost") | Some("127.0.0.1") | Some("::1")
    )
}

fn is_valid_bundle_identifier(value: &str) -> bool {
    let parts: Vec<_> = value.split('.').collect();
    parts.len() >= 3
        && parts.iter().all(|part| {
            !part.is_empty()
                && part
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
                && part
                    .chars()
                    .next()
                    .map(|ch| ch.is_ascii_alphabetic())
                    .unwrap_or(false)
        })
}

fn is_semver_like(value: &str) -> bool {
    let parts: Vec<_> = value.split('.').collect();
    (2..=4).contains(&parts.len())
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|ch| ch.is_ascii_hexdigit())
}

fn is_valid_scheme(value: &str) -> bool {
    let mut chars = value.chars();
    matches!(chars.next(), Some(ch) if ch.is_ascii_alphabetic())
        && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '+' || ch == '-' || ch == '.')
}
