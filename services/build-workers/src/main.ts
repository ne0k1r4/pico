import { loadConfig } from "./config";
import { createBuildWorker } from "./worker";

const config = loadConfig();
const worker = createBuildWorker(config);

console.info(
  JSON.stringify({
    level: "info",
    event: "worker.started",
    platform: config.WORKER_PLATFORM,
    queue: config.QUEUE_NAME,
    concurrency: config.WORKER_CONCURRENCY
  })
);

const shutdown = async (signal: string) => {
  console.info(JSON.stringify({ level: "info", event: "worker.shutdown", signal }));
  await worker.close();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
