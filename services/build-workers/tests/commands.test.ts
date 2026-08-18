import { describe, expect, test } from "bun:test";
import { artifactExtensions, buildCommands, platformBundles, rustTarget } from "../src/platforms/commands";

describe("platform command planning", () => {
  test("maps Linux artifacts and Rust target", () => {
    expect(platformBundles("linux")).toEqual(["appimage", "deb", "rpm"]);
    expect(artifactExtensions("linux")).toEqual([".AppImage", ".deb", ".rpm"]);
    expect(rustTarget("linux", "x86_64")).toBe("x86_64-unknown-linux-gnu");
  });

  test("uses fixed command arrays", () => {
    const commands = buildCommands("windows", "x86_64");
    expect(commands).toHaveLength(3);
    expect(commands[2]?.command).toBe("bun");
    expect(commands[2]?.args).toContain("x86_64-pc-windows-msvc");
    expect(commands[2]?.args).toContain("nsis,msi");
  });
});
