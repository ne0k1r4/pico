import { z } from "zod";
import type { BuildPlatform } from "./types";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("production"),
  WORKER_PLATFORM: z.enum(["windows", "macos", "linux"]),
  REDIS_URL: z.string().url(),
  QUEUE_NAME: z.string().default("pico-builds"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(4).default(1),
  WORKSPACE_ROOT: z.string().default("/tmp/pico-builds"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  ARTIFACT_BUCKET: z.string().min(3),
  BUILD_TIMEOUT_MS: z.coerce.number().int().positive().default(1_800_000),
  LOG_FLUSH_BYTES: z.coerce.number().int().positive().default(262_144)
});

export type WorkerConfig = z.infer<typeof EnvSchema> & {
  WORKER_PLATFORM: BuildPlatform;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return EnvSchema.parse(env) as WorkerConfig;
}
