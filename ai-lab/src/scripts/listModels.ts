import { mkdirSync, writeFileSync } from "node:fs";
import * as process from "node:process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CLOUDFLARE_ACCOUNT_ID_VAR,
  CLOUDFLARE_API_TOKEN_VAR,
  GEMINI_API_KEY_VAR,
  OPENAI_API_KEY_VAR,
  loadConfig,
  MissingEnvironmentError,
  type AiLabConfig,
  type EnvVarName,
} from "../config";
import { safeErrorMessage } from "../net";
import { discoverGeminiModels } from "../providers/gemini";
import { discoverOpenAIModels } from "../providers/openai";
import { discoverCloudflareModels } from "../providers/cloudflare";
import { discoverOllamaModels } from "../providers/ollama";
import type { DiscoveredModel, ModelReport, ProviderId } from "../types";

const GENERATOR = "ai-lab/src/scripts/listModels.ts";
const MODELS_FILE = new URL("../../config/models.json", import.meta.url);
const MAX_MODELS_PER_PROVIDER = 2000;
export const PLAN_TARGET_VISION_MODELS = 3;

export interface InventorySummary {
  total_models: number;
  vision_yes: number;
  vision_no: number;
  vision_unknown: number;
  providers_ok: readonly string[];
  providers_failed: readonly string[];
  providers_skipped: readonly string[];
}

export interface VaultModelInventory {
  phase: 0;
  schema_version: 1;
  generator: string;
  note: string;
  resolved_at: string;
  summary: InventorySummary;
  vision_capable_model_ids: readonly string[];
  missing_credentials: readonly EnvVarName[];
  providers: readonly ModelReport[];
  plan_target: {
    required: number;
    resolved: number;
    met: boolean;
    note: string;
  };
}

export function buildInventory(
  reports: readonly ModelReport[],
  options: { resolvedAt: string; missing: readonly EnvVarName[] },
): VaultModelInventory {
  const allModels = reports.flatMap((report) => report.models);
  const visionYes = allModels.filter((model) => model.vision_capability === "yes");
  const visionNo = allModels.filter((model) => model.vision_capability === "no");
  const visionUnknown = allModels.filter((model) => model.vision_capability === "unknown");

  const visionCapableIds = [...new Set(visionYes.map((model) => model.model_id))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  const providersOk = reports.filter((report) => report.status === "ok").map((report) => report.provider);
  const providersFailed = reports.filter((report) => report.status === "error").map((report) => report.provider);
  const providersSkipped = reports.filter((report) => report.status === "skipped").map((report) => report.provider);

  const resolved = visionCapableIds.length;
  const planMet = resolved >= PLAN_TARGET_VISION_MODELS;
  const note = planMet
    ? `Plan target satisfied: ${resolved} vision-capable model id(s) resolved (target: ${PLAN_TARGET_VISION_MODELS}).`
    : `Plan target not satisfied: ${resolved} vision-capable model id(s) resolved (target: ${PLAN_TARGET_VISION_MODELS}); ` +
      `capability was never guessed from a model name and "unknown" is not converted to "yes". ` +
      `Missing credentials: ${options.missing.join(", ")}. ` +
      `Failed providers: ${providersFailed.join(", ") || "none"}. ` +
      `Skipped providers: ${providersSkipped.join(", ") || "none"}. ` +
      `Models with unknown capability: ${visionUnknown.length}.`;

  return {
    phase: 0,
    schema_version: 1,
    generator: GENERATOR,
    note: "Generated dynamically by `npm run ai:list-models`. Do not hand-edit.",
    resolved_at: options.resolvedAt,
    summary: {
      total_models: allModels.length,
      vision_yes: visionYes.length,
      vision_no: visionNo.length,
      vision_unknown: visionUnknown.length,
      providers_ok: providersOk,
      providers_failed: providersFailed,
      providers_skipped: providersSkipped,
    },
    vision_capable_model_ids: visionCapableIds,
    missing_credentials: options.missing,
    providers: reports,
    plan_target: {
      required: PLAN_TARGET_VISION_MODELS,
      resolved,
      met: planMet,
      note,
    },
  };
}

export function serializeInventory(inventory: VaultModelInventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

export function writeInventory(path: string | URL, inventory: VaultModelInventory): void {
  if (typeof path === "object" && "href" in path) {
    mkdirSync(new URL(".", path), { recursive: true });
  }
  writeFileSync(path, serializeInventory(inventory), "utf8");
}

interface ProviderTask {
  provider: ProviderId;
  reason?: string;
  run?: () => Promise<DiscoveredModel[]>;
}

export function providerTasks(config: AiLabConfig, resolvedAt: string, secrets: readonly (string | undefined)[]): ProviderTask[] {
  const geminiKey = config.geminiApiKey;
  const openaiKey = config.openaiApiKey;
  const cloudflareAccountId = config.cloudflareAccountId;
  const cloudflareApiToken = config.cloudflareApiToken;

  const geminiTask: ProviderTask = geminiKey
    ? { provider: "gemini", run: () => discoverGeminiModels({ geminiApiKey: geminiKey, resolvedAt, secrets }) }
    : { provider: "gemini", reason: `credential not configured: ${GEMINI_API_KEY_VAR}` };

  const openaiTask: ProviderTask = openaiKey
    ? { provider: "openai", run: () => discoverOpenAIModels({ openaiApiKey: openaiKey, resolvedAt, secrets }) }
    : { provider: "openai", reason: `credential not configured: ${OPENAI_API_KEY_VAR}` };

  const missingCloudflare: (EnvVarName | null)[] = [
    !cloudflareAccountId ? CLOUDFLARE_ACCOUNT_ID_VAR : null,
    !cloudflareApiToken ? CLOUDFLARE_API_TOKEN_VAR : null,
  ];
  const cloudflareTask: ProviderTask =
    cloudflareAccountId !== undefined && cloudflareApiToken !== undefined
      ? {
          provider: "cloudflare",
          run: () =>
            discoverCloudflareModels({
              cloudflareAccountId: cloudflareAccountId,
              cloudflareApiToken: cloudflareApiToken,
              resolvedAt,
              secrets,
            }),
        }
      : {
          provider: "cloudflare",
          reason: `credential not configured: ${missingCloudflare.filter((value): value is EnvVarName => value !== null).join(", ")}`,
        };

  const ollamaTask: ProviderTask = {
    provider: "ollama",
    run: () => discoverOllamaModels({ baseUrl: config.ollamaBaseUrl, resolvedAt, secrets }),
  };

  return [geminiTask, openaiTask, cloudflareTask, ollamaTask];
}

export async function runDiscovery(
  tasks: readonly ProviderTask[],
  secrets: readonly (string | undefined)[],
): Promise<ModelReport[]> {
  const reports: ModelReport[] = [];
  for (const task of tasks) {
    if (task.run === undefined) {
      reports.push({
        provider: task.provider,
        status: "skipped",
        model_count: 0,
        reason: task.reason ?? "not configured",
        models: [],
      });
      continue;
    }
    try {
      const discovered = await task.run();
      const available = discovered.slice(0, MAX_MODELS_PER_PROVIDER);
      reports.push({
        provider: task.provider,
        status: "ok",
        model_count: available.length,
        ...(discovered.length > MAX_MODELS_PER_PROVIDER ? { truncated: true } : {}),
        models: available,
      });
    } catch (err) {
      reports.push({
        provider: task.provider,
        status: "error",
        model_count: 0,
        error: safeErrorMessage(err, secrets),
        models: [],
      });
    }
  }
  return reports;
}

export function buildUnconfiguredReports(config: AiLabConfig): ModelReport[] {
  const providersByVar: readonly { provider: ProviderId; vars: readonly EnvVarName[] }[] = [
    { provider: "gemini", vars: [GEMINI_API_KEY_VAR] },
    { provider: "openai", vars: [OPENAI_API_KEY_VAR] },
    { provider: "cloudflare", vars: [CLOUDFLARE_ACCOUNT_ID_VAR, CLOUDFLARE_API_TOKEN_VAR] },
  ];

  const providerReports = providersByVar.map((entry) => {
    const absent = entry.vars.filter((name) => config.present[name] === false);
    return {
      provider: entry.provider,
      status: "skipped" as const,
      model_count: 0,
      reason: `configuration error: missing ${absent.join(", ")}`,
      models: [] as DiscoveredModel[],
    };
  });

  providerReports.push({
    provider: "ollama",
    status: "skipped",
    model_count: 0,
    reason:
      "configuration error: no provider credentials configured; " +
      "run with credentials or a reachable Ollama server and re-run",
    models: [],
  });

  return providerReports;
}

function printSummary(inventory: VaultModelInventory): void {
  const width = 10;
  console.log("");
  console.log("[ai-lab] Phase 0 provider model discovery");
  console.log(`[ai-lab] resolved_at: ${inventory.resolved_at}`);
  console.log("");
  for (const report of inventory.providers) {
    const status = report.status.padEnd(8);
    const tail =
      report.status === "error"
        ? ` error: ${report.error ?? "unknown"}`
        : report.status === "skipped"
          ? ` reason: ${report.reason ?? "skipped"}`
          : report.truncated === true
            ? " (truncated by cap)"
            : "";
    console.log(`  ${report.provider.padEnd(width)} ${status} models=${report.model_count}${tail}`);
  }
  console.log("");
  const summary = inventory.summary;
  console.log(
    `[ai-lab] total=${summary.total_models} vision=yes:${summary.vision_yes} vision=no:${summary.vision_no} vision=unknown:${summary.vision_unknown}`,
  );
  const sampleIds = inventory.vision_capable_model_ids.slice(0, 30).join(", ");
  if (inventory.vision_capable_model_ids.length > 0) {
    console.log(`[ai-lab] vision-capable ids: ${sampleIds}`);
    if (inventory.vision_capable_model_ids.length > 30) {
      console.log(`[ai-lab]   ... and ${inventory.vision_capable_model_ids.length - 30} more`);
    }
  }
  if (summary.providers_skipped.length > 0 || summary.providers_failed.length > 0) {
    console.log(`[ai-lab] skipped: ${summary.providers_skipped.join(", ") || "none"}`);
    console.log(`[ai-lab] failed:  ${summary.providers_failed.join(", ") || "none"}`);
  }
  if (inventory.missing_credentials.length > 0) {
    console.log(`[ai-lab] missing credentials: ${inventory.missing_credentials.join(", ")}`);
  }
  console.log(`[ai-lab] plan target (>=${inventory.plan_target.required} vision-capable): ${inventory.plan_target.met ? "MET" : "NOT MET"}`);
  console.log(`[ai-lab]   ${inventory.plan_target.note}`);
}

async function main(): Promise<number> {
  let config: AiLabConfig;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof MissingEnvironmentError) {
      const relaxed = loadConfig({ require: "none" });
      const resolvedAt = new Date().toISOString();
      const inventory = buildInventory(buildUnconfiguredReports(relaxed), {
        resolvedAt,
        missing: relaxed.missing,
      });
      writeInventory(MODELS_FILE, inventory);
      console.error(`[ai-lab] configuration error: ${err.message}`);
      console.error(`[ai-lab] model discovery aborted; wrote unconfigured state to config/models.json`);
      printSummary(inventory);
      return 1;
    }
    console.error(`[ai-lab] fatal: ${safeErrorMessage(err, [])}`);
    return 1;
  }

  const resolvedAt = new Date().toISOString();
  const secrets: readonly (string | undefined)[] = [
    config.geminiApiKey,
    config.openaiApiKey,
    config.cloudflareAccountId,
    config.cloudflareApiToken,
    config.tmdbApiKey,
    config.ollamaBaseUrl,
  ];

  const reports = await runDiscovery(providerTasks(config, resolvedAt, secrets), secrets);
  const inventory = buildInventory(reports, { resolvedAt, missing: config.missing });
  writeInventory(MODELS_FILE, inventory);
  printSummary(inventory);
  console.log(`[ai-lab] wrote model inventory to config/models.json`);
  return 0;
}

const IS_ENTRYPOINT =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

function setExitCode(code: number): void {
  const realProcess = (process as unknown as { default: { exitCode: number } }).default;
  realProcess.exitCode = code;
}

if (IS_ENTRYPOINT) {
  main()
    .then((exitCode) => {
      setExitCode(exitCode);
    })
    .catch((err) => {
      console.error(`[ai-lab] fatal: ${safeErrorMessage(err, [])}`);
      setExitCode(1);
    });
}