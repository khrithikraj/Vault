import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  CLOUDFLARE_ACCOUNT_ID_VAR,
  CLOUDFLARE_API_TOKEN_VAR,
  DEFAULT_OLLAMA_BASE_URL,
  GEMINI_API_KEY_VAR,
  GLOBAL_ENV_VARS,
  loadConfig,
  MissingEnvironmentError,
  OPENAI_API_KEY_VAR,
  TMDB_API_KEY_VAR,
  type EnvVarName,
} from "./config";

function capture(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected the call to throw");
}

function withTempEnvFile(contents: string, fn: (filePath: string) => void): void {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ai-lab-config-"));
  const filePath = path.join(dir, ".env");
  writeFileSync(filePath, contents, "utf8");
  try {
    fn(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("loadConfig", () => {
  it("throws a named MissingEnvironmentError when no provider credentials are configured", () => {
    const err = capture(() => loadConfig({ env: {}, envFilePath: false }));
    expect(err).toBeInstanceOf(MissingEnvironmentError);
    expect(err.name).toBe("MissingEnvironmentError");
    const missing = (err as MissingEnvironmentError).missing;
    expect([...missing]).toEqual([
      GEMINI_API_KEY_VAR,
      OPENAI_API_KEY_VAR,
      CLOUDFLARE_ACCOUNT_ID_VAR,
      CLOUDFLARE_API_TOKEN_VAR,
    ]);
    expect(err.message).toContain(GEMINI_API_KEY_VAR);
    expect(err.message).toContain(CLOUDFLARE_API_TOKEN_VAR);
  });

  it("missing TMDB_API_KEY does not fail Phase 0 when a provider credential is present", () => {
    const config = loadConfig({ env: { GEMINI_API_KEY: "k-emulator" }, envFilePath: false });
    expect(config.geminiApiKey).toBe("k-emulator");
    expect(config.tmdbApiKey).toBeUndefined();
    expect(config.missing).toContain(TMDB_API_KEY_VAR);
  });

  it("cloudflare requires both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN together", () => {
    const err = capture(() => loadConfig({ env: { CLOUDFLARE_ACCOUNT_ID: "acct" }, envFilePath: false }));
    expect(err).toBeInstanceOf(MissingEnvironmentError);
    const missing = (err as MissingEnvironmentError).missing;
    expect([...missing]).toEqual([GEMINI_API_KEY_VAR, OPENAI_API_KEY_VAR, CLOUDFLARE_API_TOKEN_VAR]);
    expect(missing).not.toContain(CLOUDFLARE_ACCOUNT_ID_VAR);
  });

  it("exact requireVars mode lists exactly the missing variables", () => {
    const err = capture(() =>
      loadConfig({
        env: { GEMINI_API_KEY: "x" },
        envFilePath: false,
        requireVars: [GEMINI_API_KEY_VAR as EnvVarName, OPENAI_API_KEY_VAR as EnvVarName],
      }),
    );
    expect(err).toBeInstanceOf(MissingEnvironmentError);
    expect([...(err as MissingEnvironmentError).missing]).toEqual([OPENAI_API_KEY_VAR]);
  });

  it("never leaks secret values in the thrown error", () => {
    const secret = "s3cr3t-acct-value";
    const err = capture(() => loadConfig({ env: { CLOUDFLARE_ACCOUNT_ID: secret }, envFilePath: false }));
    expect(err.message).not.toContain(secret);
  });

  it("require: none returns a config without throwing", () => {
    const config = loadConfig({ env: {}, envFilePath: false, require: "none" });
    expect(config.ollamaBaseUrl).toBe(DEFAULT_OLLAMA_BASE_URL);
    expect(config.missing).toEqual(
      [...GLOBAL_ENV_VARS].filter((name) => name !== "OLLAMA_BASE_URL"),
    );
  });

  it("honours an explicit OLLAMA_BASE_URL", () => {
    const config = loadConfig({
      env: { GEMINI_API_KEY: "k", OLLAMA_BASE_URL: "http://ollama.local:8080" },
      envFilePath: false,
    });
    expect(config.ollamaBaseUrl).toBe("http://ollama.local:8080");
  });

  it("treats empty/whitespace values as missing", () => {
    expect(() => loadConfig({ env: { GEMINI_API_KEY: "   " }, envFilePath: false })).toThrow(
      MissingEnvironmentError,
    );
  });

  it("loads values from a .env file via dotenv", () => {
    withTempEnvFile(
      "GEMINI_API_KEY=from-file\nOLLAMA_BASE_URL=http://file.local:9999\n",
      (filePath) => {
        const config = loadConfig({ env: {}, envFilePath: filePath });
        expect(config.geminiApiKey).toBe("from-file");
        expect(config.ollamaBaseUrl).toBe("http://file.local:9999");
      },
    );
  });
});