import type { BuildArchitecture, BuildPlatform } from "../types";

export interface BuildCommand {
  command: string;
  args: string[];
}

export function platformBundles(platform: BuildPlatform): string[] {
  switch (platform) {
    case "windows":
      return ["nsis", "msi"];
    case "macos":
      return ["app", "dmg"];
    case "linux":
      return ["appimage", "deb", "rpm"];
  }
}

export function rustTarget(platform: BuildPlatform, architecture: BuildArchitecture): string {
  const targets: Record<BuildPlatform, Record<BuildArchitecture, string>> = {
    windows: {
      x86_64: "x86_64-pc-windows-msvc",
      aarch64: "aarch64-pc-windows-msvc"
    },
    macos: {
      x86_64: "x86_64-apple-darwin",
      aarch64: "aarch64-apple-darwin"
    },
    linux: {
      x86_64: "x86_64-unknown-linux-gnu",
      aarch64: "aarch64-unknown-linux-gnu"
    }
  };
  return targets[platform][architecture];
}

export function buildCommands(platform: BuildPlatform, architecture: BuildArchitecture): BuildCommand[] {
  const bundles = platformBundles(platform).join(",");
  const target = rustTarget(platform, architecture);
  return [
    { command: "bun", args: ["install", "--frozen-lockfile"] },
    { command: "rustup", args: ["target", "add", target] },
    {
      command: "bun",
      args: ["run", "tauri", "build", "--", "--target", target, "--bundles", bundles]
    }
  ];
}

export function artifactExtensions(platform: BuildPlatform): string[] {
  switch (platform) {
    case "windows":
      return [".exe", ".msi"];
    case "macos":
      return [".app.tar.gz", ".dmg"];
    case "linux":
      return [".AppImage", ".deb", ".rpm"];
  }
}
