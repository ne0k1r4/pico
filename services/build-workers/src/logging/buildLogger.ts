import { mkdir, appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { BuildLogEvent, BuildPlatform } from "../types";

export class BuildLogger {
  readonly filePath: string;
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(
    private readonly buildId: string,
    private readonly platform: BuildPlatform,
    workspace: string
  ) {
    this.filePath = path.join(workspace, "build.log.jsonl");
  }

  async init(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
  }

  async info(message: string): Promise<void> {
    await this.write({ level: "info", message });
  }

  async warn(message: string): Promise<void> {
    await this.write({ level: "warn", message });
  }

  async error(message: string): Promise<void> {
    await this.write({ level: "error", message });
  }

  async stream(stream: "stdout" | "stderr", message: string): Promise<void> {
    await this.write({
      level: stream === "stderr" ? "warn" : "info",
      stream,
      message
    });
  }

  async read(): Promise<Buffer> {
    await this.flush();
    return readFile(this.filePath);
  }

  async flush(): Promise<void> {
    await this.pendingWrite;
  }

  private write(event: Omit<BuildLogEvent, "timestamp" | "buildId" | "platform">): Promise<void> {
    const line: BuildLogEvent = {
      timestamp: new Date().toISOString(),
      buildId: this.buildId,
      platform: this.platform,
      ...event
    };
    this.pendingWrite = this.pendingWrite.then(() =>
      appendFile(this.filePath, `${JSON.stringify(line)}\n`)
    );
    return this.pendingWrite;
  }
}
