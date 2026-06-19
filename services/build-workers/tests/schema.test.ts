import { describe, expect, test } from "bun:test";
import { BuildJobPayloadSchema } from "../src/queue/schema";

describe("BuildJobPayloadSchema", () => {
  test("accepts a valid build job", () => {
    const result = BuildJobPayloadSchema.safeParse({
      buildId: "018fdc2a-65f7-7b11-8ec8-bd77678f9a10",
      projectId: "018fdc2a-65f7-7b11-8ec8-bd77678f9a11",
      appVersion: "1.2.3",
      platform: "macos",
      architecture: "aarch64",
      source: {
        bucket: "web2native-sources",
        key: "projects/example/source.tar.gz",
        sha256: "a".repeat(64)
      },
      artifactPrefix: "projects/example/builds/1"
    });
    expect(result.success).toBe(true);
  });

  test("rejects unsupported platforms", () => {
    const result = BuildJobPayloadSchema.safeParse({
      buildId: "018fdc2a-65f7-7b11-8ec8-bd77678f9a10",
      projectId: "018fdc2a-65f7-7b11-8ec8-bd77678f9a11",
      appVersion: "1.2.3",
      platform: "freebsd",
      architecture: "x86_64",
      source: {
        bucket: "web2native-sources",
        key: "source.tar.gz",
        sha256: "a".repeat(64)
      },
      artifactPrefix: "builds/1"
    });
    expect(result.success).toBe(false);
  });
});
