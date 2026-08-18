import Fastify from "fastify";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { WebsiteAnalyzer } from "./analyzer";
import { loadConfig, type AppConfig } from "./config";
import { MemoryCacheStore, RedisCacheStore, type CacheStore } from "./cache";
import {
  NoopAnalysisRepository,
  PostgresAnalysisRepository,
  type AnalysisRepository
} from "./repository";
import type { AnalyzeResponse } from "./types";

const AnalyzeSchema = z.object({
  url: z.string().url(),
  forceRefresh: z.boolean().optional().default(false)
});

export interface ServerDependencies {
  analyzer?: WebsiteAnalyzer;
  cache?: CacheStore;
  repository?: AnalysisRepository;
  config?: AppConfig;
}

export async function buildServer(dependencies: ServerDependencies = {}) {
  const config = dependencies.config ?? loadConfig();
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      redact: ["req.headers.authorization", "req.headers.cookie"]
    }
  });

  await app.register(sensible);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  const analyzer =
    dependencies.analyzer ??
    new WebsiteAnalyzer({
      timeoutMs: config.ANALYZER_TIMEOUT_MS,
      maxBytes: config.ANALYZER_MAX_BYTES,
      userAgent: config.ANALYZER_USER_AGENT
    });
  const cache =
    dependencies.cache ??
    (config.REDIS_URL ? new RedisCacheStore(config.REDIS_URL) : new MemoryCacheStore());
  const repository =
    dependencies.repository ??
    (config.DATABASE_URL
      ? new PostgresAnalysisRepository(config.DATABASE_URL)
      : new NoopAnalysisRepository());

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/v1/analyze", async (request, reply): Promise<AnalyzeResponse> => {
    const parsed = AnalyzeSchema.safeParse(request.body);
    if (!parsed.success) {
      throw app.httpErrors.badRequest(parsed.error.message);
    }

    const normalizedUrl = new URL(parsed.data.url).toString();
    const cacheKey = `website-analysis:v1:${normalizedUrl}`;
    if (!parsed.data.forceRefresh) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return {
          profile: cached,
          cache: { hit: true, ttlSeconds: config.ANALYZER_CACHE_TTL_SECONDS }
        };
      }
    }

    try {
      const profile = await analyzer.analyze(normalizedUrl);
      await repository.save(profile);
      await cache.set(cacheKey, profile, config.ANALYZER_CACHE_TTL_SECONDS);
      return {
        profile,
        cache: { hit: false, ttlSeconds: config.ANALYZER_CACHE_TTL_SECONDS }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "analysis failed";
      request.log.warn({ error: message, url: normalizedUrl }, "website analysis failed");
      return reply.code(422).send({
        error: {
          code: "ANALYSIS_FAILED",
          message
        }
      }) as never;
    }
  });

  return app;
}

if (import.meta.main) {
  const config = loadConfig();
  const app = await buildServer({ config });
  await app.listen({ host: config.HOST, port: config.PORT });
}
