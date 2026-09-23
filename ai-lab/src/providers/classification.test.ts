import { describe, expect, it } from "vitest";
import { classifyGeminiModel, classifyGeminiProbe } from "./gemini";
import { classifyOpenAIModel } from "./openai";
import { classifyCloudflareModel } from "./cloudflare";
import { classifyOllamaModel } from "./ollama";
import { normalizeModelRecord } from "../types";

describe("Gemini vision classification", () => {
  it("uses provider metadata inputModalities to confirm image input", () => {
    const decision = classifyGeminiModel({ inputModalities: ["TEXT", "IMAGE"] });
    expect(decision.capability).toBe("yes");
    expect(decision.source).toBe("provider_metadata");
  });

  it("marks a model 'no' when inputModalities is present without IMAGE", () => {
    const decision = classifyGeminiModel({ inputModalities: ["TEXT", "AUDIO"] });
    expect(decision.capability).toBe("no");
  });

  it("uses inputImageTokenLimit as authoritative metadata", () => {
    expect(classifyGeminiModel({ inputImageTokenLimit: 65536 }).capability).toBe("yes");
    expect(classifyGeminiModel({ inputImageTokenLimit: 0 }).capability).toBe("no");
  });

  it("uses boolean capability fields when present", () => {
    expect(classifyGeminiModel({ supportsVision: true }).capability).toBe("yes");
    expect(classifyGeminiModel({ supportsVision: false }).capability).toBe("no");
  });

  it("never guesses from the model name", () => {
    const decision = classifyGeminiModel({ name: "models/foo-vision-vl" });
    expect(decision.capability).toBe("unknown");
    expect(decision.source).toBe("unknown");
  });

  it("reports unknown when no authoritative metadata is exposed", () => {
    const decision = classifyGeminiModel({});
    expect(decision.capability).toBe("unknown");
  });
});

describe("Gemini capability probe classification", () => {
  it("treats a 2xx generateContent response as image-input accepted", () => {
    const decision = classifyGeminiProbe(200, JSON.stringify({ candidates: [{ content: {}, finishReason: "MAX_TOKENS" }] }));
    expect(decision.outcome).toBe("accepted");
    expect(decision.note).toContain("HTTP 200");
  });

  it("treats a 4xx image-modality error as image-input rejected", () => {
    const decision = classifyGeminiProbe(400, JSON.stringify({ error: { message: "This model only supports text input; image modality is unsupported" } }));
    expect(decision.outcome).toBe("rejected");
    expect(decision.note).toContain("only supports text");
  });

  it("never treats a deprecation 404 as a vision 'no'", () => {
    const decision = classifyGeminiProbe(404, JSON.stringify({ error: { message: "This model models/gemini-2.5-flash is no longer available to new users. Please update your code." } }));
    expect(decision.outcome).toBe("inconclusive");
    expect(decision.note).toContain("HTTP 404");
  });

  it("never treats quota or overload as a vision answer", () => {
    expect(classifyGeminiProbe(429, "You exceeded your current quota").outcome).toBe("inconclusive");
    expect(classifyGeminiProbe(503, "This model is currently experiencing high demand").outcome).toBe("inconclusive");
  });
});

describe("OpenAI vision classification", () => {
  it("never infers vision from the model id or name", () => {
    const decision = classifyOpenAIModel();
    expect(decision.capability).toBe("unknown");
    expect(decision.source).toBe("unknown");
  });
});

describe("Cloudflare Workers AI vision classification", () => {
  const cfTask = (name: string) => ({ id: "00000000-0000-0000-0000-000000000000", name });

  it("uses the catalog task name image-to-text as authority", () => {
    const decision = classifyCloudflareModel({
      id: "882a91d1-0000-0000-0000-000000000000",
      source: 1,
      name: "@cf/moondream/moondream3.1-9B-A2B",
      description: "Vision language model",
      task: cfTask("Image-to-Text"),
      created_at: "2025-08-05 10:27:29.131",
      tags: [],
      properties: [{ property_id: "context_window", value: "128000" }],
    });
    expect(decision.capability).toBe("yes");
    expect(decision.source).toBe("provider_model_schema");
    expect(decision.evidence).toContain("Image-to-Text");
  });

  it("marks text generation tasks 'no' (text input only)", () => {
    const decision = classifyCloudflareModel({ task: cfTask("Text Generation"), name: "@cf/openai/gpt-oss-120b" });
    expect(decision.capability).toBe("no");
    expect(decision.source).toBe("provider_model_schema");
  });

  it("marks text-to-image 'no' (image output, not image input)", () => {
    const decision = classifyCloudflareModel({ task: cfTask("Text-to-Image"), name: "@cf/black-forest-labs/flux-1-schnell" });
    expect(decision.capability).toBe("no");
    expect(decision.source).toBe("provider_model_schema");
  });

  it("marks image classification as image input (provider taxonomy)", () => {
    const decision = classifyCloudflareModel({ task: cfTask("Image Classification"), name: "@cf/microsoft/resnet-50" });
    expect(decision.capability).toBe("yes");
    expect(decision.source).toBe("provider_model_schema");
  });

  it("marks an unrecogized internal task 'unknown' instead of guessing", () => {
    const decision = classifyCloudflareModel({ task: cfTask("Dumb Pipe"), name: "@cf/pipecat-ai/smart-turn-v2" });
    expect(decision.capability).toBe("unknown");
    expect(decision.source).toBe("unknown");
    expect(decision.evidence).toContain("Dumb Pipe");
  });

  it("never guesses from the model name when the catalog is silent", () => {
    const decision = classifyCloudflareModel({ id: "@cf/meta/some-vision-model" });
    expect(decision.capability).toBe("unknown");
    expect(decision.source).toBe("unknown");
  });
});

describe("Ollama vision classification", () => {
  it("uses /api/show capabilities as an authoritative endpoint", () => {
    const yes = classifyOllamaModel({ capabilities: ["completion", "vision"] }, {});
    expect(yes.capability).toBe("yes");
    expect(yes.source).toBe("provider_capability_endpoint");

    const no = classifyOllamaModel({ capabilities: ["completion"] }, {});
    expect(no.capability).toBe("no");
    expect(no.source).toBe("provider_capability_endpoint");
  });

  it("uses structural model_info keys as provider model schema", () => {
    const decision = classifyOllamaModel({ model_info: { "clip.num_state_dicts": 1 } }, {});
    expect(decision.capability).toBe("yes");
    expect(decision.source).toBe("provider_model_schema");
  });

  it("uses the architecture family from metadata", () => {
    expect(classifyOllamaModel(undefined, { families: ["llama", "clip"] }).capability).toBe("yes");
    expect(classifyOllamaModel(undefined, { family: "qwen2vl" }).capability).toBe("yes");
  });

  it("never guesses from a 'vl' model name", () => {
    const decision = classifyOllamaModel(undefined, {});
    expect(decision.capability).toBe("unknown");
    expect(decision.source).toBe("unknown");
  });

  it("reports unknown when /api/show is unavailable or silent", () => {
    expect(classifyOllamaModel(undefined, { families: ["llama"] }).capability).toBe("unknown");
    expect(classifyOllamaModel({ details: { families: ["llama"] } }, {}).capability).toBe("unknown");
  });
});

describe("normalizeModelRecord", () => {
  const resolvedAt = "2026-09-23T00:00:00.000Z";

  it("builds a provider-independent record with the doc shape", () => {
    const record = normalizeModelRecord({
      provider: "gemini",
      model_id: " models/foo ",
      display_name: "Foo",
      vision_capability: "yes",
      capability_source: "provider_metadata",
      capability_evidence: "  evidence  ",
      metadata: { a: 1 },
      resolved_at: resolvedAt,
    });
    expect(record.provider).toBe("gemini");
    expect(record.model_id).toBe("models/foo");
    expect(record.display_name).toBe("Foo");
    expect(record.vision_capability).toBe("yes");
    expect(record.capability_source).toBe("provider_metadata");
    expect(record.capability_evidence).toBe("evidence");
    expect(record.metadata).toEqual({ a: 1 });
    expect(record.resolved_at).toBe(resolvedAt);
    expect(JSON.stringify(record).length).toBeGreaterThan(0);
  });

  it("omits display_name when it equals the model id", () => {
    const record = normalizeModelRecord({
      provider: "openai",
      model_id: "gpt-4o",
      vision_capability: "unknown",
      capability_source: "unknown",
      capability_evidence: "evidence",
      resolved_at: resolvedAt,
    });
    expect("display_name" in record).toBe(false);
  });

  it("truncates long metadata strings defensively", () => {
    const record = normalizeModelRecord({
      provider: "ollama",
      model_id: "m",
      vision_capability: "unknown",
      capability_source: "unknown",
      capability_evidence: "e",
      metadata: { description: "x".repeat(500) },
      resolved_at: resolvedAt,
    });
    expect((record.metadata?.description as string).length).toBeLessThan(300);
  });
});