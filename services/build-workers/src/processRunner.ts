import { spawn } from "node:child_process";
import type { BuildCommand } from "./platforms/commands";
import type { BuildLogger } from "./logging/buildLogger";

export async function runCommand(
  command: BuildCommand,
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  logger: BuildLogger
): Promise<void> {
  await logger.info(`running: ${command.command} ${command.args.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd,
      env: {
        ...process.env,
        ...env,
        CI: "true"
      },
      shell: false,
      windowsHide: true
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`command timed out after ${timeoutMs}ms: ${command.command}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      void logger.stream("stdout", chunk.toString("utf8").trimEnd());
    });
    child.stderr.on("data", (chunk: Buffer) => {
      void logger.stream("stderr", chunk.toString("utf8").trimEnd());
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      void logger.flush().then(() => {
        if (code === 0) resolve();
        else reject(new Error(`command failed with exit code ${code}: ${command.command}`));
      }, reject);
    });
  });
}
