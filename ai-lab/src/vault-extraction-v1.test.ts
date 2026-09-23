import { describe, expect, it } from "vitest";
import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import schema from "../schemas/vault-extraction-v1.json";

/**
 * Valid fixture that exercises every required envelope property, an item with
 * candidate categories, a field with evidence and a nullable verification.
 */
const VALID_FIXTURE = {
  schema_version: "1.0",
  prompt_version: "vault-prompt-2026-09",
  ocr_version: "tesseract-5.3.0",
  model_id: "gemini-2.5-flash",
  category_schema_version: 1,
  result_status: "ok",
  items: [
    {
      category_candidates: [
        { category_id: "shows", confidence: 0.92 },
        { category_id: "books", confidence: 0.7 },
        { category_id: "music", confidence: 0.55 },
      ],
      fields: [
        {
          key: "title",
          value: "The Great Gatsby",
          status: "present",
          confidence: 0.95,
          source: "image",
          evidence: { kind: "ocr_text", text: "The Great Gatsby" },
          verification: {
            method: "exact",
            score: 1,
            outcome: "accepted",
            reason: null,
          },
        },
        {
          key: "isbn",
          value: null,
          status: "missing",
          confidence: 0,
          source: "image",
          evidence: { kind: "none", text: null },
          verification: null,
        },
      ],
    },
  ],
  warnings: [],
} as const;

const ajv = new Ajv({ allErrors: true });
let cachedValidate: ValidateFunction | undefined;

function getValidate(): ValidateFunction {
  if (cachedValidate === undefined) cachedValidate = ajv.compile(schema);
  return cachedValidate;
}

function withItems(items: unknown): unknown {
  return { ...VALID_FIXTURE, items };
}

function withExtraProperty(key: string, value: unknown): unknown {
  return { ...VALID_FIXTURE, [key]: value };
}

function without(key: keyof typeof VALID_FIXTURE): unknown {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(VALID_FIXTURE)) {
    if (k !== key) next[k] = v;
  }
  return next;
}

function candidateItem(candidates: unknown): unknown {
  return { category_candidates: candidates, fields: [] };
}

function fieldItem(value: unknown): unknown {
  return {
    category_candidates: [{ category_id: "shows", confidence: 0.9 }],
    fields: [
      {
        key: "title",
        value,
        status: "present",
        confidence: 0.9,
        source: "image",
        evidence: { kind: "none", text: null },
        verification: null,
      },
    ],
  };
}

type ErrorExpectation = {
  path?: string;
  keyword?: string;
  missingProperty?: string;
  additionalProperty?: string;
};

function expectRejected(data: unknown, expected: ErrorExpectation): void {
  const validate = getValidate();
  const valid = validate(data);
  const errors: ErrorObject[] = validate.errors ?? [];
  const matches = errors.filter((e) => {
    const params = e.params as { missingProperty?: string; additionalProperty?: string };
    return (
      (expected.path === undefined || e.instancePath === expected.path) &&
      (expected.keyword === undefined || e.keyword === expected.keyword) &&
      (expected.missingProperty === undefined || params.missingProperty === expected.missingProperty) &&
      (expected.additionalProperty === undefined || params.additionalProperty === expected.additionalProperty)
    );
  });
  expect(valid, "expected the fixture to be rejected").toBe(false);
  expect(matches.length, JSON.stringify(errors, null, 2)).toBeGreaterThan(0);
}

describe("vault-extraction-v1.json", () => {
  it("compiles successfully under AJV without hiding compile errors", () => {
    expect(() => getValidate()).not.toThrow();
  });

  it("a complete valid fixture passes", () => {
    expect(getValidate()(VALID_FIXTURE)).toBe(true);
  });
});

describe("vault-extraction-v1.json rejects malformed envelopes at the expected paths", () => {
  it("rejects an illegal result_status", () => {
    expectRejected({ ...VALID_FIXTURE, result_status: "bogus" }, {
      path: "/result_status",
      keyword: "enum",
    });
  });

  it("rejects candidate confidence outside 0..1", () => {
    expectRejected(withItems([candidateItem([{ category_id: "shows", confidence: 1.4 }])]), {
      path: "/items/0/category_candidates/0/confidence",
      keyword: "maximum",
    });
  });

  it("rejects an empty category_candidates array", () => {
    expectRejected(withItems([candidateItem([])]), {
      path: "/items/0/category_candidates",
      keyword: "minItems",
    });
  });

  it("rejects an envelope missing prompt_version", () => {
    expectRejected(without("prompt_version"), {
      path: "",
      keyword: "required",
      missingProperty: "prompt_version",
    });
  });

  it("rejects an envelope missing category_schema_version", () => {
    expectRejected(without("category_schema_version"), {
      path: "",
      keyword: "required",
      missingProperty: "category_schema_version",
    });
  });

  it("rejects an extra/unknown envelope property", () => {
    expectRejected(withExtraProperty("unexpected", true), {
      path: "",
      keyword: "additionalProperties",
      additionalProperty: "unexpected",
    });
  });

  it("rejects a field value that is an object", () => {
    expectRejected(withItems([fieldItem({ foo: "bar" })]), {
      path: "/items/0/fields/0/value",
      keyword: "type",
    });
  });
});