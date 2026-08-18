use std::fs;

use serde_json::Value;
use tauri_app_generator::{generate_from_json_str, GenerationOptions};
use tempfile::tempdir;
use walkdir::WalkDir;

#[test]
fn generates_complete_tauri_project() {
    let profile = include_str!("fixtures/profile.json");
    let dir = tempdir().expect("tempdir");

    let generated = generate_from_json_str(profile, dir.path(), GenerationOptions::default())
        .expect("project generation succeeds");

    assert_eq!(generated.package_name, "example");
    assert_eq!(generated.product_name, "Example");
    assert!(generated.root.join("package.json").exists());
    assert!(generated.root.join("tsconfig.json").exists());
    assert!(generated.root.join("src-tauri/tauri.conf.json").exists());
    assert!(generated.root.join("src-tauri/build.rs").exists());
    assert!(generated.root.join("src-tauri/src/lib.rs").exists());
    assert!(generated.root.join("src-tauri/icons/icon.png").exists());
    assert!(generated.root.join("src-tauri/icons/icon.ico").exists());
    assert!(generated.root.join("src-tauri/icons/icon.icns").exists());
    assert!(generated.root.join("src-tauri/icons/splash.png").exists());
    assert!(generated.root.join("scripts/build-platform.sh").exists());

    let main_rs = fs::read_to_string(generated.root.join("src-tauri/src/main.rs")).unwrap();
    assert!(main_rs.contains("example_lib::run();"));

    let ico = fs::read(generated.root.join("src-tauri/icons/icon.ico")).unwrap();
    assert_eq!(&ico[0..4], &[0, 0, 1, 0]);

    let icns = fs::read(generated.root.join("src-tauri/icons/icon.icns")).unwrap();
    assert_eq!(&icns[0..4], b"icns");

    let config: Value = serde_json::from_str(
        &fs::read_to_string(generated.root.join("src-tauri/tauri.conf.json")).unwrap(),
    )
    .unwrap();

    assert_eq!(config["productName"], "Example");
    assert_eq!(config["identifier"], "com.pico.example");
    assert_eq!(config["bundle"]["targets"][0], "app");
    assert!(config["bundle"]["targets"]
        .as_array()
        .unwrap()
        .contains(&Value::String("msi".into())));
    assert!(config.get("pico").is_none());
}

#[test]
fn rejects_insecure_public_urls() {
    let profile = r#"{
      "websiteUrl": "http://example.com",
      "app": {
        "name": "Bad",
        "title": "Bad",
        "bundleIdentifier": "com.pico.bad",
        "version": "1.0.0"
      }
    }"#;

    let dir = tempdir().expect("tempdir");
    let err = generate_from_json_str(profile, dir.path(), GenerationOptions::default())
        .expect_err("http public URLs are rejected");
    assert!(err.to_string().contains("https"));
}

#[test]
fn overwrite_replaces_existing_generated_project() {
    let profile = include_str!("fixtures/profile.json");
    let dir = tempdir().expect("tempdir");

    generate_from_json_str(profile, dir.path(), GenerationOptions::default()).unwrap();
    let second =
        generate_from_json_str(profile, dir.path(), GenerationOptions { overwrite: true }).unwrap();

    let file_count = WalkDir::new(second.root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .count();
    assert!(file_count >= 15);
}
