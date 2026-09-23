import { asRecord, fetchJson, safeArray } from "../net";
import {
  normalizeModelRecord,
  type CapabilitySource,
  type DiscoveredModel,
  type JsonValue,
  type VisionCapability,
} from "../types";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

function normalizeTaskName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ").replace(/ {2,}/g, " ").trim();
  return normalized === "" ? undefined : normalized;
}

/**
 * Task names taken from Cloudflare Workers AI's own catalog taxonomy. These are
 * provider-defined functional roles; a task in this set requires image input.
 */
const IMAGE_INPUT_TASK_NAMES = new Set([
  "image-to-text",
  "image classification",
  "visual question answering",
  "image captioning",
]);

/**
 * Provider-defined functional roles whose input is text or audio only (no image
 * input). Includes image *generation* ("text-to-image"), whose input is text.
 */
const NON_IMAGE_INPUT_TASK_NAMES = new Set([
  "text generation",
  "text embeddings",
  "text classification",
  "automatic speech recognition",
  "text-to-speech",
  "translation",
  "text-to-image",
]);

export interface VisionDecision {
  capability: VisionCapability;
  source: CapabilitySource;
  evidence: string;
}

export function classifyCloudflareModel(model: Record<string, unknown> | undefined): VisionDecision {
  if (model === undefined) {
    return { capability: "unknown", source: "unknown", evidence: "no Cloudflare catalog metadata available" };
  }

  const taskRecord = asRecord(model.task);
  const rawTaskName = typeof taskRecord?.name === "string" ? taskRecord.name : typeof model.task === "string" ? model.task : undefined;
  const taskName = normalizeTaskName(rawTaskName);

  if (taskName !== undefined && IMAGE_INPUT_TASK_NAMES.has(taskName)) {
    return {
      capability: "yes",
      source: "provider_model_schema",
      evidence: `Cloudflare catalog task "${rawTaskName}" takes image input and produces non-image output`,
    };
  }

  if (taskName !== undefined && NON_IMAGE_INPUT_TASK_NAMES.has(taskName)) {
    return {
      capability: "no",
      source: "provider_model_schema",
      evidence: `Cloudflare catalog task "${rawTaskName}" does not accept image input`,
    };
  }

  return {
    capability: "unknown",
    source: "unknown",
    evidence:
      `Cloudflare catalog exposed no authoritative image-input signal${taskName !== undefined ? ` (task "${rawTaskName}")` : ""}; ` +
      "no inference from the model name",
  };
}

function cloudflareMetadata(model: Record<string, unknown>): { [key: string]: JsonValue } {
  const metadata: { [key: string]: JsonValue } = {};
  if (typeof model.id === "string") metadata.catalog_id = model.id;
  if (typeof model.created_at === "string") {
    const date = new Date(model.created_at.replace(" ", "T"));
    if (!Number.isNaN(date.getTime())) metadata.created_at = date.toISOString();
  }
  const taskRecord = asRecord(model.task);
  if (typeof taskRecord?.id === "string") metadata.task_id = taskRecord.id;
  if (typeof taskRecord?.name === "string") metadata.task_name = taskRecord.name;
  if (typeof model.description === "string" && model.description.trim() !== "") {
    metadata.description = model.description.trim();
  }
  return metadata;
}

function extractModelList(data: Record<string, unknown>): unknown[] {
  const direct = safeArray(data.result);
  if (direct.length > 0) return direct;
  const result = asRecord(data.result);
  if (result !== undefined) {
    const nested = safeArray(result.models);
    if (nested.length > 0) return nested;
  }
  return safeArray(data.models);
}

function cloudflareApiError(data: Record<string, unknown>): Error | undefined {
  const errors = safeArray(data.errors);
  if (data.success === false || errors.length > 0) {
    const first = asRecord(errors[0]);
    const message =
      typeof first?.message === "string"
        ? first.message
        : errors.length > 0
          ? String(errors[0])
          : "unknown Cloudflare API error";
    return new Error(`Cloudflare Workers AI API error: ${message}`);
  }
  return undefined;
}

export async function discoverCloudflareModels(params: {
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  resolvedAt: string;
  secrets: readonly (string | undefined)[];
}): Promise<DiscoveredModel[]> {
  const models: DiscoveredModel[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(`${CLOUDFLARE_API_BASE}/accounts/${params.cloudflareAccountId}/ai/models/search`);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));

    const data = await fetchJson(
      url,
      {
        headers: { Authorization: `Bearer ${params.cloudflareApiToken}`, "Content-Type": "application/json" },
      },
      params.secrets,
    );

    const apiError = cloudflareApiError(data);
    if (apiError !== undefined) throw apiError;

    const list = extractModelList(data);
    for (const entry of list) {
      const raw = asRecord(entry);
      if (raw === undefined) continue;
      const name = typeof raw.name === "string" ? raw.name.trim() : "";
      const catalogId = typeof raw.id === "string" ? raw.id.trim() : "";
      const modelId = name !== "" ? name : catalogId;
      if (modelId === "") continue;
      const decision = classifyCloudflareModel(raw);
      models.push(
        normalizeModelRecord({
          provider: "cloudflare",
          model_id: modelId,
          vision_capability: decision.capability,
          capability_source: decision.source,
          capability_evidence: decision.evidence,
          metadata: cloudflareMetadata(raw),
          resolved_at: params.resolvedAt,
        }),
      );
    }

    if (list.length < PAGE_SIZE) break;
  }

  return models.sort((a, b) => (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0));
}