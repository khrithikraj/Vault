import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { CLOUDFLARE_ACCOUNT_ID_VAR, GEMINI_API_KEY_VAR, loadConfig, OPENAI_API_KEY_VAR } from "../config";
import type { DiscoveredModel, ModelReport } from "../types";
import {
  buildInventory,
  buildUnconfiguredReports,
  runDiscovery,
  serializeInventory,
  writeInventory,
  type VaultModelInventory,
} from "./listModels";

const now = "2026-09-23T00:00:00.000Z";

function model(
  provider: DiscoveredModel["provider"],
  modelId: string,
  capability: DiscoveredModel["vision_capability"],
): DiscoveredModel {
  return {
    provider,
    model_id: modelId,
    vision_capability: capability,
    capability_source: "provider_metadata",
    capability_evidence: "test fixture",
    resolved_at: now,
  };
}

describe("buildInventory", () => {
  it("counts capabilities and marks the plan target met with 3+ vision-capable ids", () => {
    const reports: ModelReport[] = [
      { provider: "gemini", status: "ok", model_count: 2, models: [model("gemini", "g-vision", "yes"), model("gemini", "g-text", "unknown")] },
      { provider: "cloudflare", status: "ok", model_count: 1, models: [model("cloudflare", "c-vision", "yes")] },
      { provider: "openai", status: "ok", model_count: 1, models: [model("openai", "o-vision", "yes")] },
    ];

    const inventory = buildInventory(reports, { resolvedAt: now, missing: [] });

    expect(inventory.summary.total_models).toBe(4);
    expect(inventory.summary.vision_yes).toBe(3);
    expect(inventory.summary.vision_no).toBe(0);
    expect(inventory.summary.vision_unknown).toBe(1);
    expect(inventory.summary.providers_ok).toEqual(["gemini", "cloudflare", "openai"]);
    expect([...inventory.vision_capable_model_ids]).toEqual(["c-vision", "g-vision", "o-vision"]);
    expect(inventory.plan_target.met).toBe(true);
    expect(inventory.plan_target.required).toBe(3);
    expect(inventory.plan_target.resolved).toBe(3);
  });

  it("reports honestly when the plan target is not met and names the missing credentials", () => {
    const reports: ModelReport[] = [
      { provider: "gemini", status: "ok", model_count: 1, models: [model("gemini", "g-vision", "yes")] },
      { provider: "ollama", status: "ok", model_count: 1, models: [model("ollama", "local-x", "unknown")] },
    ];

    const inventory = buildInventory(reports, { resolvedAt: now, missing: [OPENAI_API_KEY_VAR] });

    expect(inventory.plan_target.met).toBe(false);
    expect(inventory.plan_target.note).toContain(OPENAI_API_KEY_VAR);
    expect(inventory.plan_target.note).toContain("never guessed");
    expect(inventory.summary.providers_skipped).toEqual([]);
    expect(inventory.summary.providers_failed).toEqual([]);
    expect([...inventory.vision_capable_model_ids]).toEqual(["g-vision"]);
  });

  it("serializes to stable pretty JSON", () => {
    const reports: ModelReport[] = [
      { provider: "ollama", status: "skipped", model_count: 0, reason: "configuration error: missing X", models: [] },
    ];
    const inventory = buildInventory(reports, { resolvedAt: now, missing: [OPENAI_API_KEY_VAR] });
    const first = serializeInventory(inventory);
    expect(first.endsWith("\n")).toBe(true);

    const reparsed = JSON.parse(first) as VaultModelInventory;
    const rebuilt = buildInventory(reparsed.providers as ModelReport[], {
      resolvedAt: reparsed.resolved_at,
      missing: reparsed.missing_credentials,
    });
    expect(serializeInventory(rebuilt)).toBe(first);
  });

  it("writes a valid JSON file without secrets", () => {
    const reports: ModelReport[] = [
      { provider: "openai", status: "skipped", model_count: 0, reason: "credential not configured: OPENAI_API_KEY", models: [] },
    ];
    const inventory = buildInventory(reports, { resolvedAt: now, missing: [OPENAI_API_KEY_VAR] });

    const dir = mkdtempSync(path.join(os.tmpdir(), "ai-lab-inventory-"));
    const filePath = path.join(dir, "models.json");
    try {
      writeInventory(filePath, inventory);
      const text = readFileSync(filePath, "utf8");
      expect(text).toContain('"phase": 0');
      expect(text).not.toContain("not-configured-secret");
      expect((JSON.parse(text) as VaultModelInventory).summary.total_models).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runDiscovery", () => {
  it("preserves skipped providers and scrubs errors for failed providers", async () => {
    const reports = await runDiscovery(
      [
        { provider: "openai", reason: `credential not configured: ${OPENAI_API_KEY_VAR}` },
        {
          provider: "ollama",
          run: () => {
            throw new Error("auth rejected for sk-abc123xyz");
          },
        },
      ],
      ["sk-abc123xyz"],
    );

    const openai = reports.find((report) => report.provider === "openai");
    expect(openai?.status).toBe("skipped");
    expect(openai?.reason).toContain(OPENAI_API_KEY_VAR);

    const ollama = reports.find((report) => report.provider === "ollama");
    expect(ollama?.status).toBe("error");
    expect(ollama?.error).not.toContain("sk-abc123xyz");
    expect(ollama?.error).toContain("[redacted]");
  });
});

describe("buildUnconfiguredReports", () => {
  it("marks every provider skipped with the exact missing variables", () => {
    const config = loadConfig({ env: {}, envFilePath: false, require: "none" });
    const reports = buildUnconfiguredReports(config);

    expect(reports).toHaveLength(4);
    for (const report of reports) {
      expect(report.status).toBe("skipped");
    }

    const gemini = reports.find((report) => report.provider === "gemini");
    expect(gemini?.reason).toContain(GEMINI_API_KEY_VAR);

    const cloudflare = reports.find((report) => report.provider === "cloudflare");
    expect(cloudflare?.reason).toContain(CLOUDFLARE_ACCOUNT_ID_VAR);

    const ollama = reports.find((report) => report.provider === "ollama");
    expect(ollama?.reason).toContain("no provider credentials configured");
  });
});