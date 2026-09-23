import { asRecord, fetchJson, safeArray } from "../net";
import { normalizeModelRecord, type CapabilitySource, type DiscoveredModel, type JsonValue, type VisionCapability } from "../types";

const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";

export interface VisionDecision {
  capability: VisionCapability;
  source: CapabilitySource;
  evidence: string;
}

export function classifyOpenAIModel(): VisionDecision {
  return {
    capability: "unknown",
    source: "unknown",
    evidence:
      "OpenAI /v1/models exposes no authoritative vision-capability field; " +
      "capability intentionally left unknown (never inferred from the model name or id)",
  };
}

function openaiMetadata(model: Record<string, unknown>): { [key: string]: JsonValue } {
  const metadata: { [key: string]: JsonValue } = {};
  if (typeof model.object === "string") metadata.object = model.object;
  if (typeof model.owned_by === "string") metadata.owned_by = model.owned_by;
  if (typeof model.created === "number") metadata.created = model.created;
  return metadata;
}

export async function discoverOpenAIModels(params: {
  openaiApiKey: string;
  resolvedAt: string;
  secrets: readonly (string | undefined)[];
}): Promise<DiscoveredModel[]> {
  const data = await fetchJson(
    OPENAI_MODELS_ENDPOINT,
    { headers: { Authorization: `Bearer ${params.openaiApiKey}` } },
    params.secrets,
  );
  const apiError = asRecord(data.error);
  if (apiError !== undefined) {
    const message = typeof apiError.message === "string" ? apiError.message : "unknown OpenAI API error";
    throw new Error(`OpenAI API error: ${message}`);
  }

  const models: DiscoveredModel[] = [];
  for (const entry of safeArray(data.data)) {
    const raw = asRecord(entry);
    if (raw === undefined) continue;
    const id = typeof raw.id === "string" ? raw.id.trim() : undefined;
    if (id === undefined || id === "") continue;
    const decision = classifyOpenAIModel();
    models.push(
      normalizeModelRecord({
        provider: "openai",
        model_id: id,
        vision_capability: decision.capability,
        capability_source: decision.source,
        capability_evidence: decision.evidence,
        metadata: openaiMetadata(raw),
        resolved_at: params.resolvedAt,
      }),
    );
  }

  return models.sort((a, b) => (a.model_id < b.model_id ? -1 : a.model_id > b.model_id ? 1 : 0));
}