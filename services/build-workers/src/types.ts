export type BuildPlatform = "windows" | "macos" | "linux";
export type BuildArchitecture = "x86_64" | "aarch64";

export interface BuildJobPayload {
  buildId: string;
  projectId: string;
  appVersion: string;
  platform: BuildPlatform;
  architecture: BuildArchitecture;
  source: {
    bucket: string;
    key: string;
    sha256: string;
  };
  artifactPrefix: string;
  environment?: Record<string, string>;
}

export interface BuildArtifact {
  fileName: string;
  localPath: string;
  bucket: string;
  key: string;
  bytes: number;
  sha256: string;
  contentType: string;
}

export interface BuildResult {
  buildId: string;
  projectId: string;
  platform: BuildPlatform;
  architecture: BuildArchitecture;
  artifacts: BuildArtifact[];
  logKey: string;
  durationMs: number;
}

export interface BuildLogEvent {
  timestamp: string;
  buildId: string;
  platform: BuildPlatform;
  level: "info" | "warn" | "error";
  message: string;
  stream?: "stdout" | "stderr";
}
