export type ProviderId = "gemini" | "openai" | "cloudflare" | "ollama";

export type VisionCapability = "yes" | "no" | "unknown";

export type CapabilitySource =
  | "provider_metadata"
  | "provider_model_schema"
  | "provider_capability_endpoint"
  | "provider_capability_probe"
  | "unknown";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface DiscoveredModel {
  provider: ProviderId;
  model_id: string;
  display_name?: string;
  vision_capability: VisionCapability;
  capability_source: CapabilitySource;
  capability_evidence: string;
  metadata?: { readonly [key: string]: JsonValue };
  resolved_at: string;
}

export type ProviderStatus = "ok" | "error" | "skipped";

export interface ModelReport {
  provider: ProviderId;
  status: ProviderStatus;
  model_count: number;
  reason?: string;
  error?: string;
  truncated?: boolean;
  models: readonly DiscoveredModel[];
}

export interface NormalizeModelInput {
  provider: ProviderId;
  model_id: string;
  display_name?: string;
  vision_capability: VisionCapability;
  capability_source: CapabilitySource;
  capability_evidence: string;
  metadata?: { readonly [key: string]: JsonValue };
  resolved_at: string;
  maxMetadataStringLength?: number;
}

const DEFAULT_METADATA_STRING_LENGTH = 200;

function truncateString(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}...`;
}

function truncateJsonStrings(value: JsonValue, max: number): JsonValue {
  if (typeof value === "string") return truncateString(value, max);
  if (Array.isArray(value)) return value.map((item) => truncateJsonStrings(item, max));
  if (typeof value === "object" && value !== null) {
    const out: { [key: string]: JsonValue } = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = truncateJsonStrings(item, max);
    }
    return out;
  }
  return value;
}

export function normalizeModelRecord(input: NormalizeModelInput): DiscoveredModel {
  const maxLen = input.maxMetadataStringLength ?? DEFAULT_METADATA_STRING_LENGTH;
  const modelId = String(input.model_id).trim();
  const metadata = input.metadata;
  return {
    provider: input.provider,
    model_id: modelId,
    ...(typeof input.display_name === "string" &&
    input.display_name.trim() !== "" &&
    input.display_name.trim() !== modelId
      ? { display_name: input.display_name.trim() }
      : {}),
    vision_capability: input.vision_capability,
    capability_source: input.capability_source,
    capability_evidence: input.capability_evidence.trim(),
    ...(metadata !== undefined
      ? { metadata: truncateJsonStrings(metadata, maxLen) as { [key: string]: JsonValue } }
      : {}),
    resolved_at: input.resolved_at,
  };
}