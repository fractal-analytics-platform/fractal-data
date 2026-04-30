import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import log4js from "log4js";

describe("logger configuration", () => {
  let tmpDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "fractal-data-logger-"));
    delete process.env.LOG_CONFIG_FILE;
    delete process.env.LOG_FILE;
    delete process.env.LOG_LEVEL_CONSOLE;
    delete process.env.LOG_LEVEL_FILE;
    vi.resetModules();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => log4js.shutdown(() => resolve()));
    rmSync(tmpDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("uses default env-var configuration when LOG_CONFIG_FILE is unset", async () => {
    const { getLogger } = await import("../src/logger");
    const logger = getLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
  });

  it("loads log4js configuration from LOG_CONFIG_FILE when set", async () => {
    const logFile = join(tmpDir, "from-config.log");
    const configFile = join(tmpDir, "log4js.json");
    writeFileSync(
      configFile,
      JSON.stringify({
        appenders: {
          file: { type: "file", filename: logFile, layout: { type: "messagePassThrough" } }
        },
        categories: {
          default: { appenders: ["file"], level: "warn" }
        }
      })
    );
    process.env.LOG_CONFIG_FILE = configFile;

    const { getLogger } = await import("../src/logger");
    const logger = getLogger();

    expect(logger.level.toString().toLowerCase()).toBe("warn");
  });

  it("throws if LOG_CONFIG_FILE points to a missing file", async () => {
    process.env.LOG_CONFIG_FILE = join(tmpDir, "does-not-exist.json");
    const { getLogger } = await import("../src/logger");
    expect(() => getLogger()).toThrow();
  });
});
