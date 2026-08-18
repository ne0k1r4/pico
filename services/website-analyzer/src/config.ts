import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  ANALYZER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  ANALYZER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  ANALYZER_MAX_BYTES: z.coerce.number().int().positive().default(2_000_000),
  ANALYZER_USER_AGENT: z.string().default("PICO-Analyzer/0.1")
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return EnvSchema.parse(env);
}
