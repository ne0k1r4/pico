# PICO Build Workers

Queue-based Tauri build workers for Windows, macOS, and Linux.

## Queue Contract

Queue name defaults to `pico-builds`.

```json
{
  "buildId": "018fdc2a-65f7-7b11-8ec8-bd77678f9a10",
  "projectId": "018fdc2a-65f7-7b11-8ec8-bd77678f9a11",
  "appVersion": "1.2.3",
  "platform": "linux",
  "architecture": "x86_64",
  "source": {
    "bucket": "pico-sources",
    "key": "projects/example/source.tar.gz",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "artifactPrefix": "projects/example/builds/018fdc2a-65f7-7b11-8ec8-bd77678f9a10"
}
```

Recommended BullMQ producer options:

```ts
{
  attempts: 3,
  backoff: { type: "exponential", delay: 30000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800, count: 5000 }
}
```

## Runtime

```bash
WORKER_PLATFORM=linux \
REDIS_URL=redis://redis:6379 \
ARTIFACT_BUCKET=pico-artifacts \
bun src/main.ts
```

The worker downloads the source archive, verifies SHA-256, extracts into an ephemeral workspace, runs fixed platform build commands, uploads build logs, uploads artifacts, and returns artifact metadata as the BullMQ job result.

Commit `bun.lock` after the first dependency install in a connected development environment. Worker Docker images and CI are configured to bootstrap from `package.json` when the lockfile is not present.

## Platform Notes

Linux workers run well in Kubernetes with `Dockerfile.linux`.

Windows workers should run on isolated Windows containers or ephemeral Windows VMs using `Dockerfile.windows`.

macOS workers must run on Apple macOS hosts because Apple licensing and signing/notarization require macOS. Use the GitHub Actions macOS job or a self-hosted macOS runner with the same package entrypoint.
