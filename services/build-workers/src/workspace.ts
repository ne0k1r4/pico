import { mkdtemp, mkdir, rm, writeFile, readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import tar from "tar";
import type { BuildPlatform } from "./types";

export async function createWorkspace(root: string, buildId: string, platform: BuildPlatform): Promise<string> {
  await mkdir(root, { recursive: true });
  return mkdtemp(path.join(root, `${platform}-${buildId}-`));
}

export async function removeWorkspace(workspace: string): Promise<void> {
  if (workspace.startsWith(os.tmpdir()) || workspace.includes("web2native-builds")) {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function extractSourceArchive(workspace: string, archive: Uint8Array): Promise<string> {
  const archivePath = path.join(workspace, "source.tar.gz");
  const sourceDir = path.join(workspace, "source");
  await mkdir(sourceDir, { recursive: true });
  await writeFile(archivePath, archive);
  await tar.x({
    file: archivePath,
    cwd: sourceDir,
    strip: 0,
    preservePaths: false,
    strict: true
  });
  return sourceDir;
}

export async function findArtifacts(root: string, extensions: string[]): Promise<string[]> {
  const results: string[] = [];
  await walk(root, async (file) => {
    if (extensions.some((extension) => file.endsWith(extension))) {
      results.push(file);
    }
  });
  return results.sort();
}

async function walk(dir: string, onFile: (filePath: string) => Promise<void>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, onFile);
    } else if (entry.isFile()) {
      const info = await stat(fullPath);
      if (info.size > 0) await onFile(fullPath);
    }
  }
}
