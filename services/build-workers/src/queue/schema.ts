import { z } from "zod";

export const BuildJobPayloadSchema = z.object({
  buildId: z.string().uuid(),
  projectId: z.string().uuid(),
  appVersion: z.string().regex(/^\d+\.\d+\.\d+(\.\d+)?$/),
  platform: z.enum(["windows", "macos", "linux"]),
  architecture: z.enum(["x86_64", "aarch64"]),
  source: z.object({
    bucket: z.string().min(3),
    key: z.string().min(1).max(1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)
  }),
  artifactPrefix: z.string().min(1).max(900),
  environment: z.record(z.string()).optional()
});
