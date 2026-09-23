import { asRecord, asStringArray, fetchJson, flattenText, safeArray, safeErrorMessage, truncateText } from "../net";
import {
  normalizeModelRecord,
  type CapabilitySource,
  type DiscoveredModel,
  type JsonValue,
  type VisionCapability,
} from "../types";

export interface VisionDecision {
  capability: VisionCapability;
  source: CapabilitySource;
  evidence: string;
}

const INPUT_MODALITIES_FIELDS = ["inputModalities", "input_modalities", "inputModalitiesList"] as const;
const IMAGE_TOKEN_LIMIT_FIELDS = ["inputImageTokenLimit", "input_image_token_limit", "imageInputTokenLimit"] as const;
const IMAGE_BOOLEAN_FIELDS = ["supportsImageInput", "supports_image_input", "supportsVision", "image_support"] as const;

function firstField(record: Record<string, unknown> | undefined, keys: readonly string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

export function classifyGeminiModel(model: Record<string, unknown> | undefined): VisionDecision {
  const modalities = asStringArray(firstField(model, INPUT_MODALITIES_FIELDS));
  if (modalities !== undefined) {
    const upper = modalities.map((value) => value.toUpperCase());
    if (upper.includes("IMAGE")) {
      return {
        capability: "yes",
        source: "provider_metadata",
        evidence: `Gemini model metadata inputModalities includes IMAGE (${modalities.join(", ")})`,
      };
    }
    return {
      capability: "no",
      source: "provider_metadata",
      evidence: `Gemini model metadata inputModalities present without IMAGE (${modalities.join(", ")})`,
    };
  }

  const imageTokenLimit = firstField(model, IMAGE_TOKEN_LIMIT_FIELDS);
  if (typeof imageTokenLimit === "number") {
    if (imageTokenLimit > 0) {
      return {
        capability: "yes",
        source: "provider_metadata",
        evidence: `Gemini model metadata inputImageTokenLimit=${imageTokenLimit} (>0) indicates image input is supported`,
      };
    }
    return {
      capability: "no",
      source: "provider_metadata",
      evidence: `Gemini model metadata inputImageTokenLimit=0 indicates image input is not supported`,
    };
  }

  for (const key of IMAGE_BOOLEAN_FIELDS) {
    const value = firstField(model, [key]);
    if (typeof value === "boolean") {
      return {
        capability: value ? "yes" : "no",
        source: "provider_metadata",
        evidence: `Gemini model metadata ${key}=${String(value)}`,
      };
    }
  }

  return {
    capability: "unknown",
    source: "unknown",
    evidence:
      "Gemini model-list metadata exposed no authoritative image-input signal " +
      "(checked inputModalities, inputImageTokenLimit, supportsImageInput); no inference from model name",
  };
}

function geminiMetadata(model: Record<string, unknown>): { [key: string]: JsonValue } {
  const metadata: { [key: string]: JsonValue } = {};
  if (typeof model.version === "string") metadata.version = model.version;
  if (typeof model.inputTokenLimit === "number") metadata.input_token_limit = model.inputTokenLimit;
  if (typeof model.outputTokenLimit === "number") metadata.output_token_limit = model.outputTokenLimit;
  const methods = model.supportedGenerationMethods;
  if (Array.isArray(methods)) {
    const strings = methods.filter((value): value is string => typeof value === "string");
    if (strings.length > 0) metadata.supported_generation_methods = strings;
  }
  const imageTokenLimit = firstField(model, IMAGE_TOKEN_LIMIT_FIELDS);
  if (typeof imageTokenLimit === "number") metadata.input_image_token_limit = imageTokenLimit;
  return metadata;
}

const MAX_GEMINI_PAGES = 50;

export const GEMINI_PROBE_1PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
export const GEMINI_PROBE_PROMPT = "If you can see an image, reply with the single word ACCEPTED.";
const GEMINI_PROBE_MAX_ATTEMPTS = 20;
const GEMINI_PROBE_TARGET_CONFIRMED = 3;
const GEMINI_PROBE_TIMEOUT_MS = 30_000;

export type GeminiProbeOutcome = "accepted" | "rejected" | "inconclusive";

export interface GeminiProbeDecision {
  outcome: GeminiProbeOutcome;
  note: string;
}

/**
 * Classifies a Models.generateContent probe response.
 * - accepted: the request succeeded (2xx), so an inline image was accepted.
 * - rejected: a 4xx whose error message states the model does not accept image
 *   input. Anything else (model deprecation, quota, overload, network) is
 *   inconclusive and must not be treated as a vision answer.
 */
export function classifyGeminiProbe(status: number, body: string): GeminiProbeDecision {
  const flat = flattenText(body);
  if (status >= 200 && status < 300) {
    return {
      outcome: "accepted",
      note: `Models.generateContent accepted an inline 1x1 PNG (HTTP ${status}); image input verified`,
    };
  }
  if (
    status >= 400 &&
    status < 500 &&
    /image|vision|visual|modal|multimodal|inline[_-]data|pixel|does not (support|accept)|only .* text|text[ -]only/i.test(flat)
  ) {
    return {
      outcome: "rejected",
      note: `Models.generateContent rejected inline image input (HTTP ${status}): ${truncateText(flat, 300)}`,
    };
  }
  return {
    outcome: "inconclusive",
    note: `Models.generateContent image-input probe inconclusive (HTTP ${status}): ${truncateText(flat, 300)}`,
  };
}

export async function probeGeminiVision(
  modelId: string,
  apiKey: string,
  secrets: readonly (string | undefined)[],
): Promise<GeminiProbeDecision> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: GEMINI_PROBE_PROMPT },
          { inline_data: { mime_type: "image/png", data: GEMINI_PROBE_1PX_PNG_BASE64 } },
        ],
      },
    ],
    generationConfig: { maxOutputTokens: 4, temperature: 0 },
  });

  let status = 0;
  let text = "";
  try {
    const timeoutSignal =
      typeof globalThis !== "undefined" && globalThis.AbortSignal?.timeout !== undefined
        ? globalThis.AbortSignal.timeout(GEMINI_PROBE_TIMEOUT_MS)
        : undefined;
    const response = await globalThis.fetch(url, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body,
      signal: timeoutSignal,
    });
    status = response.status;
    text = await response.text();
  } catch (err) {
    return {
      outcome: "inconclusive",
      note: `Models.generateContent image-input probe failed on the network (${safeErrorMessage(err, secrets)})`,
    };
  }
  return classifyGeminiProbe(status, text);
}

export async function discoverGeminiModels(params: {
  geminiApiKey: string;
  resolvedAt: string;
  secrets: readonly (string | undefined)[];
}): Promise<DiscoveredModel[]> {
  const entries: Array<{ raw: Record<string, unknown>; modelId: string }> = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "100");
    if (pageToken !== undefined) url.searchParams.set("pageToken", pageToken);

    const data = await fetchJson(url, { headers: { "x-goog-api-key": params.geminiApiKey } }, params.secrets);
    const apiError = asRecord(data.error);
    if (apiError !== undefined) {
      const message = typeof apiError.message === "string" ? apiError.message : "unknown Gemini API error";
      throw new Error(`Gemini API error: ${truncateText(message, 300)}`);
    }

    for (const entry of safeArray(data.models)) {
      const raw = asRecord(entry);
      if (raw === undefined) continue;
      const name = typeof raw.name === "string" ? raw.name.trim() : undefined;
      if (name === undefined || name === "") continue;
      const modelId = name.startsWith("models/") ? name.slice("models/".length) : name;
      entries.push({ raw, modelId });
    }

    pageToken = typeof data.nextPageToken === "string" && data.nextPageToken !== "" ? data.nextPageToken : undefined;
    pages += 1;
    if (pages > MAX_GEMINI_PAGES) {
      throw new Error(`Gemini model-list pagination exceeded ${MAX_GEMINI_PAGES} pages; aborting`);
    }
  } while (pageToken !== undefined);

  const models: DiscoveredModel[] = [];
  const probeCandidates: number[] = [];

  for (const { raw, modelId } of entries) {
    const decision = classifyGeminiModel(raw);
    models.push(
      normalizeModelRecord({
        provider: "gemini",
        model_id: modelId,
        display_name: typeof raw.displayName === "string" ? raw.displayName : undefined,
        vision_capability: decision.capability,
        capability_source: decision.source,
        capability_evidence: decision.evidence,
        metadata: geminiMetadata(raw),
        resolved_at: params.resolvedAt,
      }),
    );
    const methods = asStringArray(raw.supportedGenerationMethods);
    if (decision.capability === "unknown" && methods !== undefined && methods.includes("generateContent")) {
      probeCandidates.push(models.length - 1);
    }
  }

  let attempts = 0;
  let confirmed = 0;
  for (const index of probeCandidates) {
    if (attempts >= GEMINI_PROBE_MAX_ATTEMPTS || confirmed >= GEMINI_PROBE_TARGET_CONFIRMED) break;
    attempts += 1;

    const prior = models[index];
    const probe = await probeGeminiVision(prior.model_id, params.geminiApiKey, params.secrets);

    const capability: VisionCapability =
      probe.outcome === "accepted" ? "yes" : probe.outcome === "rejected" ? "no" : "unknown";
    const metadata: { [key: string]: JsonValue } = { ...(prior.metadata ?? {}) };
    metadata.probe = { method: "generateContent_1x1_png", status: probe.outcome };

    models[index] = normalizeModelRecord({
      provider: "gemini",
      model_id: prior.model_id,
      display_name: prior.display_name,
      vision_capability: capability,
      capability_source: "provider_capability_probe",
      capability_evidence: probe.note,
      metadata,
      resolved_at: params.resolvedAt,
    });

    if (probe.outcome === "accepted") {
      confirmed += 1;
    }
  }

  return models.sort((a, b) => (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0));
}