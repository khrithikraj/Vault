import { asRecord, asStringArray, fetchJson, safeArray, safeErrorMessage } from "../net";
import { normalizeModelRecord, type CapabilitySource, type DiscoveredModel, type JsonValue, type VisionCapability } from "../types";

export interface OllamaTagDetails {
  family?: string;
  families?: readonly string[];
}

const VISION_FAMILIES = new Set(["clip", "mllama", "qwen2vl", "llava", "internvl", "moondream", "smolvlm"]);

export interface VisionDecision {
  capability: VisionCapability;
  source: CapabilitySource;
  evidence: string;
}

function collectShowFamilies(show: Record<string, unknown> | undefined): readonly string[] {
  const out: string[] = [];
  if (show === undefined) return out;
  if (typeof show.family === "string") out.push(show.family);
  for (const family of asStringArray(show.families) ?? []) out.push(family);
  const details = asRecord(show.details);
  if (details !== undefined) {
    if (typeof details.family === "string") out.push(details.family);
    for (const family of asStringArray(details.families) ?? []) out.push(family);
  }
  return out;
}

export function classifyOllamaModel(
  show: Record<string, unknown> | undefined,
  tagDetails: OllamaTagDetails,
): VisionDecision {
  const capabilities = asStringArray(show?.capabilities);
  if (capabilities !== undefined && capabilities.length > 0) {
    const lower = capabilities.map((value) => value.toLowerCase());
    if (lower.includes("vision") || lower.includes("image")) {
      return {
        capability: "yes",
        source: "provider_capability_endpoint",
        evidence: `Ollama /api/show capabilities include "vision" (${capabilities.join(", ")})`,
      };
    }
    return {
      capability: "no",
      source: "provider_capability_endpoint",
      evidence: `Ollama /api/show capabilities list present without vision (${capabilities.join(", ")})`,
    };
  }

  const modelInfo = asRecord(show?.model_info);
  if (modelInfo !== undefined) {
    const visionKey = Object.keys(modelInfo).find(
      (key) =>
        key.startsWith("clip.") ||
        key.startsWith("vision.") ||
        key.startsWith("projector.") ||
        key.startsWith("mmproj.") ||
        key.includes(".vision.") ||
        key.includes(".clip."),
    );
    if (visionKey !== undefined) {
      return {
        capability: "yes",
        source: "provider_model_schema",
        evidence: `Ollama model_info contains vision architecture key "${visionKey}"`,
      };
    }
  }

  const families = [
    ...(tagDetails.family !== undefined ? [tagDetails.family] : []),
    ...(tagDetails.families ?? []),
    ...collectShowFamilies(show),
  ];
  const visionFamily = [...VISION_FAMILIES].find((family) => families.includes(family));
  if (visionFamily !== undefined) {
    return {
      capability: "yes",
      source: "provider_model_schema",
      evidence: `Ollama model architecture family "${visionFamily}" is a vision-capable architecture`,
    };
  }

  return {
    capability: "unknown",
    source: "unknown",
    evidence:
      `Ollama /api/show exposed no capabilities array and no vision architecture metadata` +
      `${families.length > 0 ? ` (declared families: ${families.join(", ")})` : ""}; no inference from model name`,
  };
}

function tagDetailsFrom(raw: Record<string, unknown>): OllamaTagDetails {
  const details = asRecord(raw.details);
  const families = asStringArray(details?.families);
  const family = typeof details?.family === "string" ? details.family : undefined;
  return { family, families };
}

function ollamaMetadata(raw: Record<string, unknown>, show: Record<string, unknown> | undefined): { [key: string]: JsonValue } {
  const metadata: { [key: string]: JsonValue } = {};
  const details = asRecord(raw.details);
  const families = asStringArray(details?.families);
  if (details !== undefined) {
    if (typeof details.family === "string") metadata.family = details.family;
    if (families !== undefined) metadata.families = families;
    if (typeof details.parameter_size === "string") metadata.parameter_size = details.parameter_size;
    if (typeof details.quantization_level === "string") metadata.quantization_level = details.quantization_level;
  }
  if (typeof raw.size === "number") metadata.size = raw.size;
  if (typeof raw.modified_at === "string") metadata.modified_at = raw.modified_at;

  if (show !== undefined) {
    const capabilities = asStringArray(show.capabilities);
    if (capabilities !== undefined) metadata.capabilities = capabilities;
    const results = classifyOllamaModel(show, { family: undefined, families: [] });
    if (results.source === "provider_model_schema") {
      metadata.vision_tower_in_model_info = true;
    }
  }
  return metadata;
}

export async function discoverOllamaModels(params: {
  baseUrl: string;
  resolvedAt: string;
  secrets: readonly (string | undefined)[];
}): Promise<DiscoveredModel[]> {
  const base = params.baseUrl.replace(/\/+$/, "");

  const tagsData = await fetchJson(`${base}/api/tags`, {}, params.secrets);
  const models: DiscoveredModel[] = [];

  for (const entry of safeArray(tagsData.models)) {
    const raw = asRecord(entry);
    if (raw === undefined) continue;
    const name =
      typeof raw.name === "string" && raw.name.trim() !== ""
        ? raw.name.trim()
        : typeof raw.model === "string" && raw.model.trim() !== ""
          ? raw.model.trim()
          : undefined;
    if (name === undefined) continue;

    const tagDetails = tagDetailsFrom(raw);
    let show: Record<string, unknown> | undefined;
    let decision: VisionDecision;
    try {
      const showData = await fetchJson(
        `${base}/api/show`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: name }) },
        params.secrets,
      );
      show = showData;
      decision = classifyOllamaModel(showData, tagDetails);
    } catch (err) {
      decision = {
        capability: "unknown",
        source: "unknown",
        evidence: `Ollama /api/show failed for this model: ${safeErrorMessage(err, params.secrets)}`,
      };
      show = undefined;
    }

    models.push(
      normalizeModelRecord({
        provider: "ollama",
        model_id: name,
        vision_capability: decision.capability,
        capability_source: decision.source,
        capability_evidence: decision.evidence,
        metadata: ollamaMetadata(raw, show),
        resolved_at: params.resolvedAt,
      }),
    );
  }

  return models.sort((a, b) => (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0));
}