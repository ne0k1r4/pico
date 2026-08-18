use std::path::PathBuf;

use clap::Parser;
use tauri_app_generator::{generate_from_json_file, GenerationOptions};

#[derive(Debug, Parser)]
#[command(name = "tauri-app-generator")]
#[command(about = "Generate production Tauri projects from PICO website profiles")]
struct Cli {
    #[arg(long, value_name = "FILE")]
    profile: PathBuf,
    #[arg(long, value_name = "DIR")]
    output: PathBuf,
    #[arg(long)]
    overwrite: bool,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let generated = generate_from_json_file(
        cli.profile,
        cli.output,
        GenerationOptions {
            overwrite: cli.overwrite,
        },
    )?;

    println!(
        "{}",
        serde_json::json!({
            "root": generated.root,
            "packageName": generated.package_name,
            "productName": generated.product_name,
            "bundleIdentifier": generated.bundle_identifier,
            "generatedFiles": generated.generated_files
        })
    );

    Ok(())
}
