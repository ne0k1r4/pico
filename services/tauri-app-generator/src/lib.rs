mod profile;
mod render;
mod sanitize;

use std::fs;
use std::path::{Path, PathBuf};

use base64::Engine;
use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
use profile::WebsiteProfile;
use render::{
    render_build_all, render_build_platform, render_build_rs, render_cargo_toml, render_index_html,
    render_package_json, render_readme, render_tauri_conf, render_tauri_lib, render_tauri_main,
    render_tsconfig, render_vite_config,
};
use sanitize::{safe_identifier, safe_product_name};
use sha2::{Digest, Sha256};
use thiserror::Error;

pub use profile::{
    AppAsset, AppMetadata, AutoUpdateConfig, BuildTarget, DeepLinkConfig, GeneratedAppConfig,
    PlatformTarget, ProfileInput,
};

#[derive(Debug, Error)]
pub enum GeneratorError {
    #[error("invalid website profile: {0}")]
    InvalidProfile(String),
    #[error("invalid output directory: {0}")]
    InvalidOutput(String),
    #[error("failed to write generated project: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to encode image: {0}")]
    Image(#[from] image::ImageError),
    #[error("failed to serialize generated configuration: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, GeneratorError>;

#[derive(Debug, Clone)]
pub struct GenerationOptions {
    pub overwrite: bool,
}

impl Default for GenerationOptions {
    fn default() -> Self {
        Self { overwrite: false }
    }
}

#[derive(Debug, Clone)]
pub struct GeneratedProject {
    pub root: PathBuf,
    pub package_name: String,
    pub product_name: String,
    pub bundle_identifier: String,
    pub generated_files: Vec<PathBuf>,
}

pub fn generate_from_json_file(
    profile_path: impl AsRef<Path>,
    output_dir: impl AsRef<Path>,
    options: GenerationOptions,
) -> Result<GeneratedProject> {
    let profile_json = fs::read_to_string(profile_path)?;
    generate_from_json_str(&profile_json, output_dir, options)
}

pub fn generate_from_json_str(
    profile_json: &str,
    output_dir: impl AsRef<Path>,
    options: GenerationOptions,
) -> Result<GeneratedProject> {
    let input: ProfileInput = serde_json::from_str(profile_json).map_err(|err| {
        GeneratorError::InvalidProfile(format!("profile JSON could not be parsed: {err}"))
    })?;
    let profile = WebsiteProfile::try_from(input)?;
    generate_project(&profile, output_dir, options)
}

pub fn generate_project(
    profile: &WebsiteProfile,
    output_dir: impl AsRef<Path>,
    options: GenerationOptions,
) -> Result<GeneratedProject> {
    let output_dir = output_dir.as_ref();
    if output_dir.exists() && !output_dir.is_dir() {
        return Err(GeneratorError::InvalidOutput(format!(
            "{} is not a directory",
            output_dir.display()
        )));
    }

    let package_name = safe_identifier(&profile.app.name);
    let product_name = safe_product_name(&profile.app.title);
    let root = output_dir.join(&package_name);

    if root.exists() {
        if !options.overwrite {
            return Err(GeneratorError::InvalidOutput(format!(
                "{} already exists; pass --overwrite to replace generated files",
                root.display()
            )));
        }
        fs::remove_dir_all(&root)?;
    }

    let dirs = [
        root.as_path(),
        &root.join("src"),
        &root.join("src-tauri"),
        &root.join("src-tauri/src"),
        &root.join("src-tauri/icons"),
        &root.join("src-tauri/capabilities"),
        &root.join("scripts"),
    ];
    for dir in dirs {
        fs::create_dir_all(dir)?;
    }

    let icon_png = decode_or_generate_icon(profile)?;
    let icon_ico = encode_ico(&icon_png)?;
    let icon_icns = encode_icns(&icon_png)?;
    let splash_png = generate_splash(&product_name, profile.theme_color_rgba());
    let icon_hash = sha256_hex(&icon_png);
    let rust_crate_name = package_name.replace('-', "_");

    let mut generated = Vec::new();
    write(
        &root.join("package.json"),
        render_package_json(&package_name),
    )?;
    generated.push(root.join("package.json"));
    write(&root.join("tsconfig.json"), render_tsconfig())?;
    generated.push(root.join("tsconfig.json"));
    write(&root.join("vite.config.ts"), render_vite_config())?;
    generated.push(root.join("vite.config.ts"));
    write(&root.join("index.html"), render_index_html(&product_name))?;
    generated.push(root.join("index.html"));
    write(&root.join("src/main.ts"), render_frontend_main(profile))?;
    generated.push(root.join("src/main.ts"));
    write(&root.join("src/styles.css"), render_styles(profile))?;
    generated.push(root.join("src/styles.css"));
    write(
        &root.join("src-tauri/Cargo.toml"),
        render_cargo_toml(&package_name),
    )?;
    generated.push(root.join("src-tauri/Cargo.toml"));
    write(&root.join("src-tauri/build.rs"), render_build_rs())?;
    generated.push(root.join("src-tauri/build.rs"));
    write(
        &root.join("src-tauri/src/main.rs"),
        render_tauri_main(&rust_crate_name),
    )?;
    generated.push(root.join("src-tauri/src/main.rs"));
    write(
        &root.join("src-tauri/src/lib.rs"),
        render_tauri_lib(profile),
    )?;
    generated.push(root.join("src-tauri/src/lib.rs"));
    write(
        &root.join("src-tauri/tauri.conf.json"),
        render_tauri_conf(profile, &package_name, &product_name, &icon_hash)?,
    )?;
    generated.push(root.join("src-tauri/tauri.conf.json"));
    write(
        &root.join("scripts/build-platform.sh"),
        render_build_platform(),
    )?;
    generated.push(root.join("scripts/build-platform.sh"));
    write(&root.join("scripts/build-all.sh"), render_build_all())?;
    generated.push(root.join("scripts/build-all.sh"));
    write(
        &root.join("README.md"),
        render_readme(profile, &product_name),
    )?;
    generated.push(root.join("README.md"));

    write_bytes(&root.join("src-tauri/icons/icon.png"), &icon_png)?;
    generated.push(root.join("src-tauri/icons/icon.png"));
    write_bytes(
        &root.join("src-tauri/icons/128x128.png"),
        &resize_png(&icon_png, 128)?,
    )?;
    generated.push(root.join("src-tauri/icons/128x128.png"));
    write_bytes(
        &root.join("src-tauri/icons/128x128@2x.png"),
        &resize_png(&icon_png, 256)?,
    )?;
    generated.push(root.join("src-tauri/icons/128x128@2x.png"));
    write_bytes(
        &root.join("src-tauri/icons/32x32.png"),
        &resize_png(&icon_png, 32)?,
    )?;
    generated.push(root.join("src-tauri/icons/32x32.png"));
    write_bytes(&root.join("src-tauri/icons/icon.icns"), &icon_icns)?;
    generated.push(root.join("src-tauri/icons/icon.icns"));
    write_bytes(&root.join("src-tauri/icons/icon.ico"), &icon_ico)?;
    generated.push(root.join("src-tauri/icons/icon.ico"));
    write_bytes(&root.join("src-tauri/icons/splash.png"), &splash_png)?;
    generated.push(root.join("src-tauri/icons/splash.png"));

    set_executable(&root.join("scripts/build-platform.sh"))?;
    set_executable(&root.join("scripts/build-all.sh"))?;

    Ok(GeneratedProject {
        root,
        package_name,
        product_name,
        bundle_identifier: profile.app.bundle_identifier.clone(),
        generated_files: generated,
    })
}

fn write(path: &Path, contents: String) -> Result<()> {
    fs::write(path, contents)?;
    Ok(())
}

fn write_bytes(path: &Path, contents: &[u8]) -> Result<()> {
    fs::write(path, contents)?;
    Ok(())
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<()> {
    Ok(())
}

fn render_frontend_main(profile: &WebsiteProfile) -> String {
    let escaped_url = serde_json::to_string(profile.website_url.as_str()).expect("url serializes");
    let escaped_name = serde_json::to_string(profile.app.title.as_str()).expect("title serializes");
    format!(
        r##"import "./styles.css";

const targetUrl = {escaped_url};
const appName = {escaped_name};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {{
  throw new Error("Application root was not found");
}}

root.innerHTML = `
  <main class="splash">
    <div class="mark" aria-hidden="true">${{appName.slice(0, 1).toUpperCase()}}</div>
    <p>Opening ${{appName}}</p>
  </main>
`;

window.setTimeout(() => window.location.replace(targetUrl), 350);
"##
    )
}

fn render_styles(profile: &WebsiteProfile) -> String {
    let color = profile.app.theme_color.as_deref().unwrap_or("#171717");
    format!(
        r#":root {{
  color: #f8fafc;
  background: {color};
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}}

body {{
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}}

.splash {{
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: center;
  min-height: 100vh;
}}

.mark {{
  align-items: center;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 28px;
  display: flex;
  font-size: 64px;
  font-weight: 700;
  height: 128px;
  justify-content: center;
  width: 128px;
}}

.splash p {{
  font-size: 14px;
  margin: 0;
  opacity: 0.84;
}}
"#
    )
}

fn decode_or_generate_icon(profile: &WebsiteProfile) -> Result<Vec<u8>> {
    if let Some(asset) = profile.best_icon_asset() {
        if let Some(data_url) = &asset.data_url {
            if let Some(encoded) = data_url.strip_prefix("data:image/png;base64,") {
                let bytes = base64::engine::general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|err| {
                        GeneratorError::InvalidProfile(format!("invalid icon data URL: {err}"))
                    })?;
                image::load_from_memory_with_format(&bytes, ImageFormat::Png)?;
                return Ok(bytes);
            }
        }
    }

    let rgba = profile.theme_color_rgba();
    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(512, 512);
    for (x, y, pixel) in img.enumerate_pixels_mut() {
        let radius = (((x as i32 - 256).pow(2) + (y as i32 - 256).pow(2)) as f32).sqrt();
        let alpha = if radius > 244.0 { 0 } else { 255 };
        *pixel = Rgba([rgba[0], rgba[1], rgba[2], alpha]);
    }
    let initial = profile
        .app
        .title
        .chars()
        .find(|ch| ch.is_ascii_alphanumeric())
        .unwrap_or('W')
        .to_ascii_uppercase();

    draw_ascii_initial(&mut img, initial, Rgba([255, 255, 255, 255]));
    encode_png(DynamicImage::ImageRgba8(img))
}

fn generate_splash(product_name: &str, rgba: [u8; 4]) -> Vec<u8> {
    let mut img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(512, 512);
    for (x, y, pixel) in img.enumerate_pixels_mut() {
        let mix = ((x + y) as f32 / 1024.0 * 36.0) as u8;
        *pixel = Rgba([
            rgba[0].saturating_add(mix),
            rgba[1].saturating_add(mix),
            rgba[2].saturating_add(mix),
            255,
        ]);
    }
    let initial = product_name
        .chars()
        .find(|ch| ch.is_ascii_alphanumeric())
        .unwrap_or('W')
        .to_ascii_uppercase();
    draw_ascii_initial(&mut img, initial, Rgba([255, 255, 255, 255]));
    encode_png(DynamicImage::ImageRgba8(img)).unwrap_or_default()
}

fn draw_ascii_initial(img: &mut ImageBuffer<Rgba<u8>, Vec<u8>>, initial: char, color: Rgba<u8>) {
    const GLYPH_WIDTH: usize = 5;
    const GLYPH_HEIGHT: usize = 7;
    let glyph = glyph(initial);
    let scale = 42u32;
    let start_x = 256 - (GLYPH_WIDTH as u32 * scale / 2);
    let start_y = 256 - (GLYPH_HEIGHT as u32 * scale / 2);

    for (row, pattern) in glyph.iter().enumerate() {
        for col in 0..GLYPH_WIDTH {
            if pattern.as_bytes()[col] == b'1' {
                for dx in 0..scale {
                    for dy in 0..scale {
                        let x = start_x + col as u32 * scale + dx;
                        let y = start_y + row as u32 * scale + dy;
                        if x < img.width() && y < img.height() {
                            img.put_pixel(x, y, color);
                        }
                    }
                }
            }
        }
    }
}

fn glyph(c: char) -> [&'static str; 7] {
    match c {
        'A' => [
            "01110", "10001", "10001", "11111", "10001", "10001", "10001",
        ],
        'B' => [
            "11110", "10001", "10001", "11110", "10001", "10001", "11110",
        ],
        'C' => [
            "01111", "10000", "10000", "10000", "10000", "10000", "01111",
        ],
        'D' => [
            "11110", "10001", "10001", "10001", "10001", "10001", "11110",
        ],
        'E' => [
            "11111", "10000", "10000", "11110", "10000", "10000", "11111",
        ],
        'F' => [
            "11111", "10000", "10000", "11110", "10000", "10000", "10000",
        ],
        'G' => [
            "01111", "10000", "10000", "10111", "10001", "10001", "01111",
        ],
        'H' => [
            "10001", "10001", "10001", "11111", "10001", "10001", "10001",
        ],
        'I' => [
            "11111", "00100", "00100", "00100", "00100", "00100", "11111",
        ],
        'J' => [
            "00111", "00010", "00010", "00010", "10010", "10010", "01100",
        ],
        'K' => [
            "10001", "10010", "10100", "11000", "10100", "10010", "10001",
        ],
        'L' => [
            "10000", "10000", "10000", "10000", "10000", "10000", "11111",
        ],
        'M' => [
            "10001", "11011", "10101", "10101", "10001", "10001", "10001",
        ],
        'N' => [
            "10001", "11001", "10101", "10011", "10001", "10001", "10001",
        ],
        'O' => [
            "01110", "10001", "10001", "10001", "10001", "10001", "01110",
        ],
        'P' => [
            "11110", "10001", "10001", "11110", "10000", "10000", "10000",
        ],
        'Q' => [
            "01110", "10001", "10001", "10001", "10101", "10010", "01101",
        ],
        'R' => [
            "11110", "10001", "10001", "11110", "10100", "10010", "10001",
        ],
        'S' => [
            "01111", "10000", "10000", "01110", "00001", "00001", "11110",
        ],
        'T' => [
            "11111", "00100", "00100", "00100", "00100", "00100", "00100",
        ],
        'U' => [
            "10001", "10001", "10001", "10001", "10001", "10001", "01110",
        ],
        'V' => [
            "10001", "10001", "10001", "10001", "10001", "01010", "00100",
        ],
        'W' => [
            "10001", "10001", "10001", "10101", "10101", "10101", "01010",
        ],
        'X' => [
            "10001", "10001", "01010", "00100", "01010", "10001", "10001",
        ],
        'Y' => [
            "10001", "10001", "01010", "00100", "00100", "00100", "00100",
        ],
        'Z' => [
            "11111", "00001", "00010", "00100", "01000", "10000", "11111",
        ],
        '0' => [
            "01110", "10001", "10011", "10101", "11001", "10001", "01110",
        ],
        '1' => [
            "00100", "01100", "00100", "00100", "00100", "00100", "01110",
        ],
        '2' => [
            "01110", "10001", "00001", "00010", "00100", "01000", "11111",
        ],
        '3' => [
            "11110", "00001", "00001", "01110", "00001", "00001", "11110",
        ],
        '4' => [
            "00010", "00110", "01010", "10010", "11111", "00010", "00010",
        ],
        '5' => [
            "11111", "10000", "10000", "11110", "00001", "00001", "11110",
        ],
        '6' => [
            "01110", "10000", "10000", "11110", "10001", "10001", "01110",
        ],
        '7' => [
            "11111", "00001", "00010", "00100", "01000", "01000", "01000",
        ],
        '8' => [
            "01110", "10001", "10001", "01110", "10001", "10001", "01110",
        ],
        '9' => [
            "01110", "10001", "10001", "01111", "00001", "00001", "01110",
        ],
        _ => [
            "11111", "10001", "00010", "00100", "00100", "00000", "00100",
        ],
    }
}

fn resize_png(bytes: &[u8], size: u32) -> Result<Vec<u8>> {
    let image = image::load_from_memory_with_format(bytes, ImageFormat::Png)?;
    let resized = image.resize_exact(size, size, image::imageops::FilterType::Lanczos3);
    encode_png(resized)
}

fn encode_png(image: DynamicImage) -> Result<Vec<u8>> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    image.write_to(&mut cursor, ImageFormat::Png)?;
    Ok(cursor.into_inner())
}

fn encode_ico(png: &[u8]) -> Result<Vec<u8>> {
    let icon_png = resize_png(png, 256)?;
    let image = image::load_from_memory_with_format(&icon_png, ImageFormat::Png)?;
    let mut cursor = std::io::Cursor::new(Vec::new());
    image.write_to(&mut cursor, ImageFormat::Ico)?;
    Ok(cursor.into_inner())
}

fn encode_icns(png: &[u8]) -> Result<Vec<u8>> {
    let mut elements = Vec::new();
    for (code, size) in [
        (*b"icp4", 16),
        (*b"icp5", 32),
        (*b"icp6", 64),
        (*b"ic07", 128),
        (*b"ic08", 256),
        (*b"ic09", 512),
        (*b"ic10", 1024),
    ] {
        let data = resize_png(png, size)?;
        elements.extend_from_slice(&code);
        elements.extend_from_slice(&((data.len() + 8) as u32).to_be_bytes());
        elements.extend_from_slice(&data);
    }

    let mut out = Vec::with_capacity(elements.len() + 8);
    out.extend_from_slice(b"icns");
    out.extend_from_slice(&((elements.len() + 8) as u32).to_be_bytes());
    out.extend_from_slice(&elements);
    Ok(out)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

impl WebsiteProfile {
    fn theme_color_rgba(&self) -> [u8; 4] {
        let color = self.app.theme_color.as_deref().unwrap_or("#171717");
        if color.len() == 7 && color.starts_with('#') {
            let r = u8::from_str_radix(&color[1..3], 16).unwrap_or(23);
            let g = u8::from_str_radix(&color[3..5], 16).unwrap_or(23);
            let b = u8::from_str_radix(&color[5..7], 16).unwrap_or(23);
            [r, g, b, 255]
        } else {
            [23, 23, 23, 255]
        }
    }

    fn best_icon_asset(&self) -> Option<&AppAsset> {
        self.assets
            .iter()
            .find(|asset| asset.kind == "icon" && asset.data_url.is_some())
            .or_else(|| self.assets.iter().find(|asset| asset.data_url.is_some()))
    }
}
