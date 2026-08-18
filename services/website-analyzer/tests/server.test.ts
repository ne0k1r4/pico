import { describe, expect, test } from "bun:test";
import { buildServer } from "../src/server";
import { MemoryCacheStore } from "../src/cache";
import type { WebsiteProfile } from "../src/types";

const profile: WebsiteProfile = {
  url: "https://example.com/",
  finalUrl: "https://example.com/",
  origin: "https://example.com",
  title: "Example",
  name: "Example",
  description: "Example description",
  themeColor: "#155EEF",
  favicon: "https://example.com/favicon.ico",
  assets: [],
  frameworks: [],
  pwa: {
    manifestUrl: null,
    manifest: null,
    serviceWorkerDetected: false,
    serviceWorkerEvidence: [],
    pushNotificationsDetected: false
  },
  security: {
    https: true,
    contentSecurityPolicy: false,
    xFrameOptions: false
  },
  analyzedAt: "2026-06-13T00:00:00.000Z"
};

describe("server", () => {
  test("POST /v1/analyze returns profile and caches by URL", async () => {
    let calls = 0;
    const app = await buildServer({
      config: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: 0,
        ANALYZER_CACHE_TTL_SECONDS: 60,
        ANALYZER_TIMEOUT_MS: 1000,
        ANALYZER_MAX_BYTES: 100_000,
        ANALYZER_USER_AGENT: "test"
      },
      cache: new MemoryCacheStore(),
      repository: { save: async () => undefined },
      analyzer: {
        analyze: async () => {
          calls += 1;
          return profile;
        }
      } as never
    });

    const first = await app.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { url: "https://example.com" }
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/analyze",
      payload: { url: "https://example.com" }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(JSON.parse(first.body).cache.hit).toBe(false);
    expect(JSON.parse(second.body).cache.hit).toBe(true);
    expect(calls).toBe(1);
    await app.close();
  });
});
