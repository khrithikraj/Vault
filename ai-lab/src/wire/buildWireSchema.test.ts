import { describe, expect, it } from "vitest";
import canonicalSchema from "../../schemas/vault-extraction-v1.json";
import { buildWireSchema, inlineLocalRefs, type WireSchemaOptions } from "./buildWireSchema";
import type { JsonValue } from "../types";

const PROVIDERS = ["gemini", "openai", "cloudflare", "ollama"] as const;
type Provider = (typeof PROVIDERS)[number];

const CATALOG_A: WireSchemaOptions = {
  allowedCategoryIds: ["movies"],
  allowedFieldKeys: ["title", "director", "genre"],
  fieldTypes: {
    title: { type: "text" },
    director: { type: "text" },
    genre: { type: "select", options: ["action", "drama", "comedy"] },
  },
};

const CATALOG_B: WireSchemaOptions = {
  allowedCategoryIds: ["food"],
  allowedFieldKeys: ["title", "cuisine", "restaurant_url"],
  fieldTypes: {
    title: { type: "text" },
    cuisine: { type: "select", options: ["italian", "japanese", "indian"] },
    restaurant_url: { type: "url" },
  },
};

const NO_SELECT_CATALOG: WireSchemaOptions = {
  allowedCategoryIds: ["books"],
  allowedFieldKeys: ["title", "isbn"],
  fieldTypes: {
    title: { type: "text" },
    isbn: { type: "text" },
  },
};

const TWO_SELECT_CATALOG: WireSchemaOptions = {
  allowedCategoryIds: ["movies"],
  allowedFieldKeys: ["title", "director", "genre", "certification"],
  fieldTypes: {
    title: { type: "text" },
    director: { type: "text" },
    genre: { type: "select", options: ["action", "drama", "comedy"] },
    certification: { type: "select", options: ["PG", "PG-13", "R"] },
  },
};

const SCHEMA_VERSION_PATH = ["properties", "schema_version"];
const CATEGORY_ID_PATH = [
  "properties",
  "items",
  "items",
  "properties",
  "category_candidates",
  "items",
  "properties",
  "category_id",
];
const VALUE_PATH = ["properties", "items", "items", "properties", "fields", "items", "properties", "value"];
const FIELD_ITEMS_PATH = ["properties", "items", "items", "properties", "fields", "items"];

type JsonRecord = Record<string, JsonValue>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nodeAt(schema: JsonValue, path: readonly string[]): JsonValue {
  let node = schema;
  for (const part of path) {
    if (!isRecord(node)) throw new Error(`expected an object at "${part}"`);
    const child = node[part];
    if (child === undefined) throw new Error(`missing schema node "${part}"`);
    node = child;
  }
  return node;
}

function fieldItems(schema: JsonValue): JsonValue {
  return nodeAt(schema, FIELD_ITEMS_PATH);
}

function keyNodeOf(branch: JsonValue): JsonRecord {
  return isRecord(branch) && isRecord(branch.properties) && isRecord(branch.properties.key)
    ? branch.properties.key
    : {};
}

function branchesOf(schema: JsonValue): JsonRecord[] {
  const items = fieldItems(schema);
  if (isRecord(items) && Array.isArray(items.anyOf)) return items.anyOf as JsonRecord[];
  return isRecord(items) ? [items] : [];
}

function fieldKeyEnums(schema: JsonValue): string[] {
  const out: string[] = [];
  for (const branch of branchesOf(schema)) {
    out.push(...keyEnum(branch));
  }
  return out;
}

function keyEnum(branch: JsonValue): string[] {
  const enumValue = keyNodeOf(branch).enum;
  return Array.isArray(enumValue) ? enumValue.map(String) : [];
}

function branchForKey(schema: JsonValue, key: string): JsonRecord | undefined {
  return branchesOf(schema).find((branch) => keyEnum(branch).includes(key));
}

function selectValueExpected(provider: Provider, options: readonly string[]): JsonRecord {
  return provider === "gemini"
    ? { type: "STRING", nullable: true, enum: [...options] }
    : { type: ["string", "null"], enum: [...options, null] };
}

function collectObjectNodes(schema: JsonValue, out: JsonRecord[] = []): JsonRecord[] {
  if (Array.isArray(schema)) {
    for (const entry of schema) collectObjectNodes(entry, out);
    return out;
  }
  if (!isRecord(schema)) return out;
  out.push(schema);
  for (const value of Object.values(schema)) collectObjectNodes(value, out);
  return out;
}

function collectTypeValues(schema: JsonValue): string[] {
  const out: string[] = [];
  const push = (value: JsonValue): void => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const type = (value as JsonRecord).type;
      if (typeof type === "string") out.push(type);
      else if (Array.isArray(type)) for (const entry of type) out.push(String(entry));
    }
  };
  const walk = (value: JsonValue): void => {
    push(value);
    if (Array.isArray(value)) for (const entry of value) walk(entry);
    else if (typeof value === "object" && value !== null)
      for (const entry of Object.values(value)) walk(entry);
  };
  walk(schema);
  return out;
}

const DRAFT07_TYPES = new Set(["string", "number", "integer", "boolean", "object", "array", "null"]);
const MODERN_KEYWORDS = [
  "$ref",
  "$defs",
  "prefixItems",
  "contains",
  "if",
  "then",
  "else",
  "allOf",
  "nullable",
  "propertyOrdering",
  "const",
  "minContains",
  "maxContains",
  "unevaluatedProperties",
  "dependentRequired",
  "dependentSchemas",
];

function assertDraft07(schema: JsonValue, path = "$"): void {
  if (Array.isArray(schema)) {
    schema.forEach((entry, index) => assertDraft07(entry, `${path}/${index}`));
    return;
  }
  if (!isRecord(schema)) return;
  for (const key of Object.keys(schema)) {
    if (MODERN_KEYWORDS.includes(key)) throw new Error(`modern schema keyword "${key}" at ${path}`);
  }
  if ("type" in schema) {
    const type = schema.type;
    if (typeof type === "string") {
      if (!DRAFT07_TYPES.has(type)) throw new Error(`unsupported draft-07 type "${type}" at ${path}`);
    } else if (Array.isArray(type)) {
      for (const entry of type) {
        if (typeof entry !== "string" && entry !== null) throw new Error(`invalid type member at ${path}`);
        if (typeof entry === "string" && !DRAFT07_TYPES.has(entry))
          throw new Error(`unsupported draft-07 type "${entry}" at ${path}`);
      }
    } else {
      throw new Error(`type must be a string or array at ${path}`);
    }
  }
  for (const [key, value] of Object.entries(schema)) assertDraft07(value, `${path}/${key}`);
}

function maskDynamic(schema: JsonValue): JsonValue {
  if (Array.isArray(schema)) return schema.map((entry) => maskDynamic(entry));
  if (!isRecord(schema)) return schema;
  const out: JsonRecord = {};
  for (const [key, value] of Object.entries(schema)) {
    const enumValue = schema.enum;
    out[key] = key === "enum" && Array.isArray(enumValue) ? [`<${enumValue.length} values>`] : maskDynamic(value);
  }
  return out;
}

describe("buildWireSchema universal conversions", () => {
  it("produces a result that round-trips through JSON.stringify / JSON.parse for every provider", () => {
    for (const provider of PROVIDERS) {
      const wire = buildWireSchema(provider, CATALOG_A);
      expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
    }
  });

  it("contains zero \"$ref\" for every provider", () => {
    for (const provider of PROVIDERS) {
      expect(JSON.stringify(buildWireSchema(provider, CATALOG_A))).not.toContain("$ref");
    }
  });

  it("contains no const for every provider", () => {
    for (const provider of PROVIDERS) {
      expect(JSON.stringify(buildWireSchema(provider, CATALOG_A))).not.toContain('"const"');
    }
  });

  it("represents schema_version as enum [\"1.0\"] for every provider", () => {
    for (const provider of PROVIDERS) {
      const node = nodeAt(buildWireSchema(provider, CATALOG_A), SCHEMA_VERSION_PATH);
      expect(node).toEqual(provider === "gemini" ? { type: "STRING", enum: ["1.0"] } : { type: "string", enum: ["1.0"] });
    }
  });

  it("collapses FieldResult.value to string|null for every provider", () => {
    for (const provider of PROVIDERS) {
      const value = nodeAt(buildWireSchema(provider, NO_SELECT_CATALOG), VALUE_PATH);
      expect(value).toEqual(provider === "gemini" ? { type: "STRING", nullable: true } : { type: ["string", "null"] });
    }
  });

  it("constrains category_id enum to allowedCategoryIds for every provider and every catalog", () => {
    for (const provider of PROVIDERS) {
      expect(nodeAt(buildWireSchema(provider, CATALOG_A), CATEGORY_ID_PATH)).toMatchObject({
        enum: [...CATALOG_A.allowedCategoryIds],
      });
      expect(nodeAt(buildWireSchema(provider, CATALOG_B), CATEGORY_ID_PATH)).toMatchObject({
        enum: [...CATALOG_B.allowedCategoryIds],
      });
    }
  });

  it("covers every allowed field key exactly once across field-key enums", () => {
    for (const provider of PROVIDERS) {
      expect(fieldKeyEnums(buildWireSchema(provider, CATALOG_A)).sort()).toEqual(
        [...CATALOG_A.allowedFieldKeys].sort(),
      );
      expect(fieldKeyEnums(buildWireSchema(provider, CATALOG_B)).sort()).toEqual(
        [...CATALOG_B.allowedFieldKeys].sort(),
      );
    }
  });

  it("keeps non-select field values unrestricted while select fields exist", () => {
    for (const provider of PROVIDERS) {
      const branches = branchesOf(buildWireSchema(provider, CATALOG_A));
      const unrestricted = branches.filter((branch) => {
        const keys = keyEnum(branch);
        return keys.length > 0 && !keys.includes("genre");
      });
      expect(unrestricted).toHaveLength(1);
      const value = isRecord(unrestricted[0].properties) ? unrestricted[0].properties.value : undefined;
      expect(value).toEqual(
        provider === "gemini" ? { type: "STRING", nullable: true } : { type: ["string", "null"] },
      );
    }
  });

  it("constrains each select field value to its own options", () => {
    for (const provider of PROVIDERS) {
      const genre = branchForKey(buildWireSchema(provider, CATALOG_A), "genre");
      expect(isRecord(genre)).toBe(true);
      const value = isRecord(genre) && isRecord(genre.properties) ? genre.properties.value : undefined;
      expect(value).toEqual(selectValueExpected(provider, ["action", "drama", "comedy"]));

      const cuisine = branchForKey(buildWireSchema(provider, CATALOG_B), "cuisine");
      expect(isRecord(cuisine)).toBe(true);
      const cuisineValue = isRecord(cuisine) && isRecord(cuisine.properties) ? cuisine.properties.value : undefined;
      expect(cuisineValue).toEqual(selectValueExpected(provider, ["italian", "japanese", "indian"]));
    }
  });

  it("does not merge two different select fields into one shared enum", () => {
    for (const provider of PROVIDERS) {
      const branches = branchesOf(buildWireSchema(provider, TWO_SELECT_CATALOG));
      const genre = branchForKey(buildWireSchema(provider, TWO_SELECT_CATALOG), "genre");
      const certification = branchForKey(buildWireSchema(provider, TWO_SELECT_CATALOG), "certification");
      const genreValue = isRecord(genre) && isRecord(genre.properties) ? genre.properties.value : {};
      const certificationValue =
        isRecord(certification) && isRecord(certification.properties) ? certification.properties.value : {};
      expect(branches).toHaveLength(3);
      expect(genreValue).toEqual(selectValueExpected(provider, ["action", "drama", "comedy"]));
      expect(certificationValue).toEqual(selectValueExpected(provider, ["PG", "PG-13", "R"]));
      expect(JSON.stringify(genreValue)).not.toContain("PG");
      expect(JSON.stringify(certificationValue)).not.toContain("comedy");
    }
  });

  it("emits a single unrestricted field-result schema when a catalog has no select fields", () => {
    for (const provider of PROVIDERS) {
      const items = fieldItems(buildWireSchema(provider, NO_SELECT_CATALOG));
      expect(Array.isArray(isRecord(items) ? items.anyOf : undefined)).toBe(false);
      const keyNode = keyNodeOf(items);
      expect(keyNode.enum).toEqual([...NO_SELECT_CATALOG.allowedFieldKeys]);
    }
  });

  it("uses the plain string|null value schema when a catalog has no select fields", () => {
    for (const provider of PROVIDERS) {
      const value = nodeAt(buildWireSchema(provider, NO_SELECT_CATALOG), VALUE_PATH);
      expect(value).toEqual(provider === "gemini" ? { type: "STRING", nullable: true } : { type: ["string", "null"] });
    }
  });

  it("removes minLength, minimum, maximum, minItems and maxItems for every provider", () => {
    const keywords = ["minLength", "minimum", "maximum", "minItems", "maxItems"];
    for (const provider of PROVIDERS) {
      const serialized = JSON.stringify(buildWireSchema(provider, CATALOG_A));
      for (const keyword of keywords) {
        expect(serialized, `${provider} must not contain ${keyword}`).not.toContain(`"${keyword}"`);
      }
    }
  });

  it("keeps the canonical nullable oneOf present on a non-Gemini verification", () => {
    for (const provider of ["openai", "cloudflare", "ollama"] as const) {
      const items = fieldItems(buildWireSchema(provider, CATALOG_A));
      const firstBranch =
        isRecord(items) && Array.isArray(items.anyOf) ? (items.anyOf[0] as JsonRecord) : items;
      const node = nodeAt(firstBranch, ["properties", "verification"]);
      expect(isRecord(node)).toBe(true);
      const oneOf = isRecord(node) ? node.oneOf : undefined;
      expect(Array.isArray(oneOf)).toBe(true);
      expect(JSON.stringify(oneOf)).not.toContain("$ref");
    }
  });

  it("rejects an unknown provider", () => {
    expect(() => buildWireSchema("bogus" as Provider, CATALOG_A)).toThrow(/unknown provider/i);
  });

  it("never leaks fieldTypes entries whose key is not an allowed field key", () => {
    const withForeignSelect: WireSchemaOptions = {
      allowedCategoryIds: ["movies"],
      allowedFieldKeys: ["title", "director", "genre"],
      fieldTypes: {
        title: { type: "text" },
        director: { type: "text" },
        genre: { type: "select", options: ["action", "drama", "comedy"] },
        deleted_key: { type: "select", options: ["leaked-option"] },
      },
    };
    for (const provider of PROVIDERS) {
      expect(JSON.stringify(buildWireSchema(provider, withForeignSelect))).not.toContain("leaked-option");
    }
  });
});

describe("Gemini conversion", () => {
  it("uses uppercase JSON schema type names everywhere", () => {
    const wire = buildWireSchema("gemini", CATALOG_A);
    const types = collectTypeValues(wire);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(type).toBe(type.toUpperCase());
    }
  });

  it("uses a nullable STRING for unrestricted and select field values", () => {
    const wire = buildWireSchema("gemini", CATALOG_A);
    const unrestricted = branchesOf(wire).find((branch) => {
      const keys = keyEnum(branch);
      return keys.length > 0 && !keys.includes("genre");
    });
    const genre = branchForKey(wire, "genre");
    const unrestrictedValue =
      isRecord(unrestricted) && isRecord(unrestricted.properties) ? unrestricted.properties.value : undefined;
    const genreValue = isRecord(genre) && isRecord(genre.properties) ? genre.properties.value : undefined;
    expect(unrestrictedValue).toEqual({ type: "STRING", nullable: true });
    expect(genreValue).toEqual({ type: "STRING", nullable: true, enum: ["action", "drama", "comedy"] });
  });

  it("keeps Gemini select value enums to configured string options only", () => {
    const wire = buildWireSchema("gemini", CATALOG_A);
    const genre = branchForKey(wire, "genre");
    const value = isRecord(genre) && isRecord(genre.properties) ? genre.properties.value : undefined;
    expect(isRecord(value)).toBe(true);
    const enumValue = isRecord(value) ? value.enum : undefined;
    expect(enumValue).toEqual(["action", "drama", "comedy"]);
    expect(enumValue).not.toContain(null);
    expect(isRecord(value) ? value.nullable : undefined).toBe(true);
    expect(isRecord(value) ? value.type : undefined).toBe("STRING");
  });

  it("keeps null in the select value enum for non-Gemini providers", () => {
    for (const provider of ["openai", "cloudflare", "ollama"] as const) {
      const genre = branchForKey(buildWireSchema(provider, CATALOG_A), "genre");
      const value = isRecord(genre) && isRecord(genre.properties) ? genre.properties.value : undefined;
      expect(value).toEqual({ type: ["string", "null"], enum: ["action", "drama", "comedy", null] });
    }
  });

  it("keeps Gemini non-select values as an unrestricted nullable STRING", () => {
    const wire = buildWireSchema("gemini", CATALOG_A);
    const unrestricted = branchesOf(wire).find((branch) => {
      const keys = keyEnum(branch);
      return keys.length > 0 && !keys.includes("genre");
    });
    const value =
      isRecord(unrestricted) && isRecord(unrestricted.properties) ? unrestricted.properties.value : undefined;
    expect(value).toEqual({ type: "STRING", nullable: true });
    expect(JSON.stringify(value)).not.toContain("enum");
  });

  it("uses nullable instead of multi-type unions", () => {
    const wire = buildWireSchema("gemini", CATALOG_A);
    const serialized = JSON.stringify(wire);
    expect(serialized).toContain('"nullable":true');
    // no draft-07-style type unions survive
    expect(serialized).not.toContain('"type":["');
  });

  it("emits propertyOrdering on the top-level object", () => {
    const wire = buildWireSchema("gemini", CATALOG_A);
    expect(wire.propertyOrdering).toEqual([
      "schema_version",
      "prompt_version",
      "ocr_version",
      "model_id",
      "category_schema_version",
      "result_status",
      "items",
      "warnings",
    ]);
  });

  it("contains zero $ref", () => {
    expect(JSON.stringify(buildWireSchema("gemini", CATALOG_A))).not.toContain("$ref");
  });
});

describe("OpenAI strict conversion", () => {
  it("marks every object schema with additionalProperties: false", () => {
    const wire = buildWireSchema("openai", CATALOG_A);
    const objects = collectObjectNodes(wire).filter((node) => {
      if (isRecord(node.properties)) return true;
      const type = node.type;
      return type === "object" || (Array.isArray(type) && type.includes("object"));
    });
    expect(objects.length).toBeGreaterThan(0);
    for (const node of objects) {
      expect(node.additionalProperties, JSON.stringify(node)).toBe(false);
    }
  });

  it("lists every property in required", () => {
    const wire = buildWireSchema("openai", CATALOG_A);
    const objects = collectObjectNodes(wire);
    const withProperties = objects.filter((node) => isRecord(node.properties));
    expect(withProperties.length).toBeGreaterThan(0);
    for (const node of withProperties) {
      const required = Array.isArray(node.required) ? node.required.map(String) : [];
      for (const key of Object.keys(node.properties as JsonRecord)) {
        expect(required, `property "${key}" must be required`).toContain(key);
      }
    }
  });

  it("contains zero $ref", () => {
    expect(JSON.stringify(buildWireSchema("openai", CATALOG_A))).not.toContain("$ref");
  });
});

describe("Cloudflare conversion", () => {
  it("emits only a draft-07-compatible subset", () => {
    expect(() => assertDraft07(buildWireSchema("cloudflare", CATALOG_A))).not.toThrow();
  });

  it("contains zero $ref", () => {
    expect(JSON.stringify(buildWireSchema("cloudflare", CATALOG_A))).not.toContain("$ref");
  });
});

describe("Ollama conversion", () => {
  it("emits only a draft-07-compatible subset with format json", () => {
    const wire = buildWireSchema("ollama", CATALOG_A);
    expect(wire.format).toBe("json");
    expect(() => assertDraft07(wire)).not.toThrow();
  });

  it("contains zero $ref", () => {
    expect(JSON.stringify(buildWireSchema("ollama", CATALOG_A))).not.toContain("$ref");
  });
});

describe("dynamic catalog behavior", () => {
  it("keeps the schema shape structurally identical across two materially different catalogs", () => {
    for (const provider of PROVIDERS) {
      const maskedA = maskDynamic(buildWireSchema(provider, CATALOG_A));
      const maskedB = maskDynamic(buildWireSchema(provider, CATALOG_B));
      expect(maskedA).toEqual(maskedB);
    }
  });

  it("never hard-codes catalog enum values into the provider output", () => {
    for (const provider of PROVIDERS) {
      const wireA = buildWireSchema(provider, CATALOG_A);
      const wireB = buildWireSchema(provider, CATALOG_B);
      expect(nodeAt(wireA, CATEGORY_ID_PATH)).toMatchObject({ enum: ["movies"] });
      expect(nodeAt(wireB, CATEGORY_ID_PATH)).toMatchObject({ enum: ["food"] });
      const genreA = branchForKey(wireA, "genre");
      const cuisineB = branchForKey(wireB, "cuisine");
      expect(isRecord(genreA)).toBe(true);
      expect(isRecord(cuisineB)).toBe(true);
      expect(isRecord(genreA) ? keyNodeOf(genreA).enum : undefined).toEqual(["genre"]);
      expect(isRecord(cuisineB) ? keyNodeOf(cuisineB).enum : undefined).toEqual(["cuisine"]);
      expect(JSON.stringify(wireA)).not.toContain("italian");
      expect(JSON.stringify(wireB)).not.toContain("comedy");
    }
  });

  it("pins the masked structural shape for each provider", () => {
    for (const provider of PROVIDERS) {
      expect(maskDynamic(buildWireSchema(provider, CATALOG_A))).toMatchSnapshot(provider);
    }
  });
});

describe("reference inlining", () => {
  it("inlines nested references and removes definitions without leaving $ref", () => {
    const inlined = inlineLocalRefs(canonicalSchema as unknown as JsonValue);
    const serialized = JSON.stringify(inlined);
    expect(serialized).not.toContain("$ref");
    expect(serialized).not.toContain('"definitions"');
    expect(serialized).not.toContain('"$defs"');
  });

  it("resolves nested references all the way down", () => {
    const inlined = inlineLocalRefs(canonicalSchema as unknown as JsonValue);
    const fields = nodeAt(inlined, ["properties", "items", "items", "properties", "fields"]);
    const fieldItem = isRecord(fields) ? fields.items : undefined;
    expect(isRecord(fieldItem)).toBe(true);
    // The canonical status enum must be inline rather than a $ref.
    const status = isRecord(fieldItem) ? nodeAt(fieldItem, ["properties", "status"]) : undefined;
    expect(status).toMatchObject({ enum: ["present", "missing", "unreadable", "not_applicable", "unverified"] });

    const verification = isRecord(fieldItem) ? nodeAt(fieldItem, ["properties", "verification"]) : undefined;
    expect(Array.isArray(isRecord(verification) ? verification.oneOf : undefined)).toBe(true);
  });

  it("detects reference cycles instead of recursing forever", () => {
    const cyclic = {
      $ref: "#/definitions/a",
      definitions: {
        a: { $ref: "#/definitions/b" },
        b: { $ref: "#/definitions/a" },
      },
    };
    expect(() => inlineLocalRefs(cyclic)).toThrow(/circular|cycle/i);
  });

  it("does not mutate the original canonical schema", () => {
    const before = JSON.stringify(canonicalSchema);
    inlineLocalRefs(canonicalSchema as unknown as JsonValue);
    buildWireSchema("openai", CATALOG_A);
    buildWireSchema("gemini", CATALOG_A);
    expect(JSON.stringify(canonicalSchema)).toBe(before);
  });
});