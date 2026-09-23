import * as process from "node:process";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import type { ProviderId } from "./types";

export const GEMINI_API_KEY_VAR = "GEMINI_API_KEY" as const;
export const OPENAI_API_KEY_VAR = "OPENAI_API_KEY" as const;
export const CLOUDFLARE_ACCOUNT_ID_VAR = "CLOUDFLARE_ACCOUNT_ID" as const;
export const CLOUDFLARE_API_TOKEN_VAR = "CLOUDFLARE_API_TOKEN" as const;
export const TMDB_API_KEY_VAR = "TMDB_API_KEY" as const;
export const OLLAMA_BASE_URL_VAR = "OLLAMA_BASE_URL" as const;

export const GLOBAL_ENV_VARS = [
  GEMINI_API_KEY_VAR,
  OPENAI_API_KEY_VAR,
  CLOUDFLARE_ACCOUNT_ID_VAR,
  CLOUDFLARE_API_TOKEN_VAR,
  TMDB_API_KEY_VAR,
  OLLAMA_BASE_URL_VAR,
] as const;

export type EnvVarName = (typeof GLOBAL_ENV_VARS)[number];

export const PHASE0_PROVIDER_CREDENTIAL_VARS = [
  GEMINI_API_KEY_VAR,
  OPENAI_API_KEY_VAR,
  CLOUDFLARE_ACCOUNT_ID_VAR,
  CLOUDFLARE_API_TOKEN_VAR,
] as const;

export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export const PROVIDER_CREDENTIAL_GROUPS: readonly {
  provider: ProviderId;
  vars: readonly EnvVarName[];
}[] = [
  { provider: "gemini", vars: [GEMINI_API_KEY_VAR] },
  { provider: "openai", vars: [OPENAI_API_KEY_VAR] },
  { provider: "cloudflare", vars: [CLOUDFLARE_ACCOUNT_ID_VAR, CLOUDFLARE_API_TOKEN_VAR] },
];

export interface AiLabConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  tmdbApiKey?: string;
  ollamaBaseUrl: string;
  present: Readonly<Record<EnvVarName, boolean>>;
  missing: readonly EnvVarName[];
}

export type LoadRequirement = "at-least-one-provider" | "none";

export interface LoadConfigOptions {
  env?: Readonly<Record<string, string | undefined>>;
  envFilePath?: string | false;
  require?: LoadRequirement;
  requireVars?: readonly EnvVarName[];
}

export class MissingEnvironmentError extends Error {
  override readonly name = "MissingEnvironmentError";
  readonly missing: readonly EnvVarName[];

  constructor(missing: readonly EnvVarName[]) {
    const list = missing.join(", ");
    super(
      `Missing required environment variable(s): ${list}. ` +
        `Copy ai-lab/.env.example to ai-lab/.env and set the required values. ` +
        `Secret values are never logged by ai-lab.`,
    );
    this.missing = missing;
  }
}

function defaultEnvFilePath(): URL {
  return new URL("../.env", import.meta.url);
}

function isFileNotFound(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "ENOENT"
  );
}

function readDotEnvFile(path: string | URL): Record<string, string> {
  try {
    const text = readFileSync(path, "utf8");
    return parse(text);
  } catch (err) {
    if (isFileNotFound(err)) return {};
    throw err;
  }
}

function firstDefined(record: Readonly<Record<string, string | undefined>>, name: EnvVarName): string | undefined {
  const value = record[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function loadConfig(options: LoadConfigOptions = {}): AiLabConfig {
  const fileEnv: Record<string, string> =
    options.envFilePath === false
      ? {}
      : readDotEnvFile(options.envFilePath !== undefined ? options.envFilePath : defaultEnvFilePath());

  const raw: Readonly<Record<string, string | undefined>> =
    options.env !== undefined
      ? { ...fileEnv, ...options.env }
      : { ...fileEnv, ...process.env };

  const geminiApiKey = firstDefined(raw, GEMINI_API_KEY_VAR);
  const openaiApiKey = firstDefined(raw, OPENAI_API_KEY_VAR);
  const cloudflareAccountId = firstDefined(raw, CLOUDFLARE_ACCOUNT_ID_VAR);
  const cloudflareApiToken = firstDefined(raw, CLOUDFLARE_API_TOKEN_VAR);
  const tmdbApiKey = firstDefined(raw, TMDB_API_KEY_VAR);
  const ollamaBaseUrl = firstDefined(raw, OLLAMA_BASE_URL_VAR) ?? DEFAULT_OLLAMA_BASE_URL;

  const present = Object.fromEntries(
    GLOBAL_ENV_VARS.map((name) => [name, firstDefined(raw, name) !== undefined]),
  ) as Readonly<Record<EnvVarName, boolean>>;
  const missing = GLOBAL_ENV_VARS.filter(
    (name) => present[name] === false && name !== OLLAMA_BASE_URL_VAR,
  );

  const requireName: LoadRequirement = options.require ?? "at-least-one-provider";
  if (options.requireVars !== undefined && options.requireVars.length > 0) {
    const absent = [...new Set(options.requireVars)].filter((name) => !present[name]);
    if (absent.length > 0) throw new MissingEnvironmentError(absent);
  } else if (requireName !== "none") {
    const hasCompleteGroup = PROVIDER_CREDENTIAL_GROUPS.some((group) => group.vars.every((name) => present[name]));
    if (!hasCompleteGroup) {
      const absent = PHASE0_PROVIDER_CREDENTIAL_VARS.filter((name) => !present[name]);
      throw new MissingEnvironmentError(absent);
    }
  }

  return {
    geminiApiKey,
    openaiApiKey,
    cloudflareAccountId,
    cloudflareApiToken,
    tmdbApiKey,
    ollamaBaseUrl,
    present,
    missing,
  };
}