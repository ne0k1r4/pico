import path from "node:path";
import { QueueEvents, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { BuildJobPayloadSchema } from "./queue/schema";
import { buildCommands, artifactExtensions } from "./platforms/commands";
import { BuildLogger } from "./logging/buildLogger";
import { S3Storage } from "./storage/s3";
import { sha256Buffer, sha256File } from "./checksum";
import { createWorkspace, extractSourceArchive, findArtifacts, removeWorkspace } from "./workspace";
import { runCommand } from "./processRunner";
import { contentTypeFor } from "./contentTypes";
import type { WorkerConfig } from "./config";
import type { BuildArtifact, BuildJobPayload, BuildResult } from "./types";

export function createBuildWorker(config: WorkerConfig): Worker<BuildJobPayload, BuildResult> {
  const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const storage = new S3Storage(config);

  const worker = new Worker<BuildJobPayload, BuildResult>(
    config.QUEUE_NAME,
    async (job) => processJob(job, config, storage),
    {
      connection,
      concurrency: config.WORKER_CONCURRENCY,
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: { age: 604_800, count: 5000 }
    }
  );

  const events = new QueueEvents(config.QUEUE_NAME, { connection });
  events.on("failed", ({ jobId, failedReason }) => {
    console.error(JSON.stringify({ level: "error", event: "build.failed", jobId, failedReason }));
  });
  events.on("completed", ({ jobId }) => {
    console.info(JSON.stringify({ level: "info", event: "build.completed", jobId }));
  });

  worker.on("error", (error) => {
    console.error(JSON.stringify({ level: "error", event: "worker.error", message: error.message }));
  });

  return worker;
}

async function processJob(
  job: Job<BuildJobPayload>,
  config: WorkerConfig,
  storage: S3Storage
): Promise<BuildResult> {
  const payload = BuildJobPayloadSchema.parse(job.data) as BuildJobPayload;
  if (payload.platform !== config.WORKER_PLATFORM) {
    throw new Error(`worker platform ${config.WORKER_PLATFORM} cannot process ${payload.platform}`);
  }

  const startedAt = Date.now();
  const workspace = await createWorkspace(config.WORKSPACE_ROOT, payload.buildId, payload.platform);
  const logger = new BuildLogger(payload.buildId, payload.platform, workspace);
  await logger.init();
  const logKey = `${payload.artifactPrefix.replace(/\/+$/, "")}/logs/${payload.platform}-${payload.architecture}.jsonl`;

  try {
    await logger.info(`starting build job ${job.id ?? payload.buildId}`);
    await job.updateProgress({ phase: "downloading-source" });
    const archive = await storage.download(payload.source.bucket, payload.source.key);
    const actualSha = sha256Buffer(archive);
    if (actualSha !== payload.source.sha256) {
      throw new Error("source archive checksum mismatch");
    }

    await job.updateProgress({ phase: "extracting-source" });
    const sourceDir = await extractSourceArchive(workspace, archive);

    await job.updateProgress({ phase: "building" });
    for (const command of buildCommands(payload.platform, payload.architecture)) {
      await runCommand(command, sourceDir, payload.environment ?? {}, config.BUILD_TIMEOUT_MS, logger);
    }

    await job.updateProgress({ phase: "collecting-artifacts" });
    const artifactPaths = await findArtifacts(
      path.join(sourceDir, "src-tauri", "target"),
      artifactExtensions(payload.platform)
    );
    if (artifactPaths.length === 0) {
      throw new Error("build completed without producing expected artifacts");
    }

    await job.updateProgress({ phase: "uploading-artifacts" });
    const artifacts: BuildArtifact[] = [];
    for (const localPath of artifactPaths) {
      const fileName = path.basename(localPath);
      const sha256 = await sha256File(localPath);
      const key = `${payload.artifactPrefix.replace(/\/+$/, "")}/${payload.platform}/${payload.architecture}/${fileName}`;
      const bytes = await storage.uploadFile(config.ARTIFACT_BUCKET, key, localPath, contentTypeFor(fileName), {
        buildId: payload.buildId,
        projectId: payload.projectId,
        platform: payload.platform,
        architecture: payload.architecture,
        sha256
      });
      artifacts.push({
        fileName,
        localPath,
        bucket: config.ARTIFACT_BUCKET,
        key,
        bytes,
        sha256,
        contentType: contentTypeFor(fileName)
      });
    }

    await logger.info(`uploaded ${artifacts.length} artifacts`);
    await uploadLog(storage, config, logger, logKey, payload);
    await job.updateProgress({ phase: "completed" });

    return {
      buildId: payload.buildId,
      projectId: payload.projectId,
      platform: payload.platform,
      architecture: payload.architecture,
      artifacts,
      logKey,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown build failure";
    await logger.error(message);
    await uploadLog(storage, config, logger, logKey, payload);
    throw error;
  } finally {
    await removeWorkspace(workspace);
  }
}

async function uploadLog(
  storage: S3Storage,
  config: WorkerConfig,
  logger: BuildLogger,
  logKey: string,
  payload: BuildJobPayload
): Promise<void> {
  const log = await logger.read();
  await storage.uploadBuffer(config.ARTIFACT_BUCKET, logKey, log, "application/x-ndjson", {
    buildId: payload.buildId,
    projectId: payload.projectId,
    platform: payload.platform,
    architecture: payload.architecture
  });
}
