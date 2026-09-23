import type { JsonValue, ProviderId } from "../types";
import type { FieldType } from "./coerce";
import canonicalSchema from "../../schemas/vault-extraction-v1.json";

export type WireProvider = ProviderId;

export interface WireFieldType {
  type: FieldType;
  options?: readonly string[];
}

export interface WireSchemaOptions {
  allowedCategoryIds: readonly string[];
  allowedFieldKeys: readonly string[];
  fieldTypes: Readonly<Record<string, WireFieldType>>;
}

type JsonRecord = Record<string, JsonValue>;

const WIRE_PROVIDERS = ["gemini", "openai", "cloudflare", "ollama"] as const;

const FORBIDDEN_KEYS = new Set([
  "$ref",
  "$defs",
  "definitions",
  "const",
  "minLength",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
]);

const GEMINI_TYPES: Record<string, string> = {
  object: "OBJECT",
  string: "STRING",
  number: "NUMBER",
  integer: "NUMBER",
  array: "ARRAY",
  boolean: "BOOLEAN",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertProvider(provider: ProviderId): void {
  if (!WIRE_PROVIDERS.includes(provider)) {
    throw new Error(`unknown provider "${String(provider)}"; expected one of ${WIRE_PROVIDERS.join(", ")}`);
  }
}

function refName(ref: string): string {
  if (!ref.startsWith("#/")) {
    throw new Error(`unsupported $ref "${ref}": only local references such as "#/definitions/<name>" are supported`);
  }
  const segments = ref.slice(2).split("/");
  if (segments.length !== 2 || (segments[0] !== "definitions" && segments[0] !== "$defs")) {
    throw new Error(`unsupported $ref "${ref}": expected a single local definition reference`);
  }
  return segments[1];
}

function collectDefinitions(node: JsonValue, out: Map<string, JsonValue>): void {
  if (!isRecord(node)) return;
  for (const key of ["definitions", "$defs"]) {
    const defs = node[key];
    if (isRecord(defs)) {
      for (const [name, value] of Object.entries(defs)) out.set(name, value);
    }
  }
}

export function inlineLocalRefs(schema: JsonValue): JsonValue {
  const cloned: JsonValue = JSON.parse(JSON.stringify(schema));
  const definitions = new Map<string, JsonValue>();
  collectDefinitions(cloned, definitions);
  return resolveNode(cloned, definitions, new Set());
}

function resolveNode(node: JsonValue, definitions: Map<string, JsonValue>, active: Set<string>): JsonValue {
  if (Array.isArray(node)) return node.map((entry) => resolveNode(entry, definitions, active));
  if (!isRecord(node)) return node;

  const ref = node.$ref;
  if (typeof ref === "string") {
    const name = refName(ref);
    if (active.has(name)) {
      throw new Error(`circular $ref detected while inlining "#/definitions/${name}"`);
    }
    const target = definitions.get(name);
    if (target === undefined) {
      throw new Error(`unresolvable $ref "#/definitions/${name}"`);
    }
    active.add(name);
    const resolvedTarget = resolveNode(target, definitions, active);
    active.delete(name);
    const siblings: JsonRecord = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref") continue;
      siblings[key] = resolveNode(value, definitions, active);
    }
    return isRecord(resolvedTarget) ? { ...(resolvedTarget as JsonRecord), ...siblings } : resolvedTarget;
  }

  const out: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "definitions" || key === "$defs") continue;
    out[key] = resolveNode(value, definitions, active);
  }
  return out;
}

interface WireContext {
  allowedCategoryIds: readonly string[];
  allowedFieldKeys: readonly string[];
}

function recordAt(root: JsonRecord, path: readonly string[]): JsonRecord {
  let node: JsonRecord = root;
  for (const part of path) {
    const next = node[part];
    if (!isRecord(next)) throw new Error(`missing JsonRecord node "${part}"`);
    node = next;
  }
  return node;
}

function toWireSchema(node: JsonValue, key: string | undefined, context: WireContext): JsonValue {
  if (Array.isArray(node)) return node.map((entry) => toWireSchema(entry, undefined, context));
  if (!isRecord(node)) return node;

  if (key === "schema_version") return { type: "string", enum: ["1.0"] };
  if (key === "category_id") return { type: "string", enum: [...context.allowedCategoryIds] };
  if (key === "key") return { type: "string", enum: [...context.allowedFieldKeys] };
  if (key === "value") return { type: ["string", "null"] };

  const out: JsonRecord = {};
  for (const [entryKey, entryValue] of Object.entries(node)) {
    if (FORBIDDEN_KEYS.has(entryKey)) continue;
    out[entryKey] = toWireSchema(entryValue, entryKey, context);
  }
  return out;
}

function geminiType(typeValue: unknown): string {
  if (typeof typeValue !== "string") {
    throw new Error(`Gemini type must be a string, got ${JSON.stringify(typeValue)}`);
  }
  const converted = GEMINI_TYPES[typeValue.toLowerCase()];
  if (converted === undefined) {
    throw new Error(`Gemini cannot represent type "${typeValue}"`);
  }
  return converted;
}

function isNullTypeBranch(branch: JsonValue): boolean {
  return isRecord(branch) && branch.type === "null";
}

function toGemini(node: JsonValue): JsonValue {
  if (Array.isArray(node)) return node.map(toGemini);
  if (!isRecord(node)) return node;

  const out: JsonRecord = {};
  for (const [entryKey, entryValue] of Object.entries(node)) {
    if (entryKey === "type") {
      if (Array.isArray(entryValue)) {
        const entries = entryValue as JsonValue[];
        const nonNull = entries.filter((entry) => entry !== "null");
        const hasNull = entries.some((entry) => entry === "null");
        if (entries.length === 1) {
          out.type = geminiType(entries[0]);
        } else if (hasNull && nonNull.length === 1) {
          out.type = geminiType(nonNull[0]);
          out.nullable = true;
        } else {
          throw new Error(`Gemini cannot represent the type union ${JSON.stringify(entries)}`);
        }
      } else {
        out.type = geminiType(entryValue);
      }
      continue;
    }
    if (entryKey === "oneOf") {
      if (!Array.isArray(entryValue)) {
        throw new Error(`Gemini oneOf must be an array, got ${JSON.stringify(entryValue)}`);
      }
      const branches = entryValue as JsonValue[];
      const nonNull = branches.filter((branch) => !isNullTypeBranch(branch));
      const nullBranches = branches.filter(isNullTypeBranch);
      if (nullBranches.length === 0 || nonNull.length !== 1) {
        throw new Error(`Gemini cannot represent the oneOf structure ${JSON.stringify(entryValue)}`);
      }
      Object.assign(out, toGemini(nonNull[0]));
      out.nullable = true;
      continue;
    }
    out[entryKey] = toGemini(entryValue);
  }
  if (out.nullable === true && Array.isArray(out.enum)) {
    out.enum = (out.enum as readonly JsonValue[]).filter((entry) => entry !== null);
  }
  if (isRecord(out.properties)) {
    out.propertyOrdering = Object.keys(out.properties);
  }
  return out;
}

function toOpenAIStrict(node: JsonValue): JsonValue {
  if (Array.isArray(node)) return node.map(toOpenAIStrict);
  if (!isRecord(node)) return node;

  const out: JsonRecord = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = toOpenAIStrict(value);
  }
  if (isRecord(out.properties)) {
    out.additionalProperties = false;
    const propertyKeys = Object.keys(out.properties);
    const required = Array.isArray(out.required) ? out.required.map(String) : [];
    out.required = [...new Set([...required, ...propertyKeys])];
  }
  return out;
}

function selectValueSchema(field: WireFieldType): JsonRecord {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const option of field.options ?? []) {
    const trimmed = option.trim();
    if (trimmed !== "" && !seen.has(trimmed)) {
      seen.add(trimmed);
      options.push(trimmed);
    }
  }
  return { type: ["string", "null"], enum: [...options, null] };
}

function unrestrictedValueSchema(): JsonRecord {
  return { type: ["string", "null"] };
}

function branchClone(base: JsonRecord, keys: readonly string[], value: JsonRecord): JsonRecord {
  const clone: JsonRecord = JSON.parse(JSON.stringify(base));
  if (!isRecord(clone.properties)) {
    throw new Error("cannot build field branches: field-result schema has no properties");
  }
  clone.properties = { ...clone.properties, key: { type: "string", enum: [...keys] }, value };
  return clone;
}

function applyFieldBranches(generic: JsonRecord, options: WireSchemaOptions): void {
  const fieldsEntry = recordAt(generic, ["properties", "items", "items", "properties", "fields"]);
  if (!isRecord(fieldsEntry.items)) return;

  const selectFields: Array<{ key: string; field: WireFieldType }> = [];
  for (const key of options.allowedFieldKeys) {
    const field = options.fieldTypes[key];
    if (field !== undefined && field.type === "select") selectFields.push({ key, field });
  }
  if (selectFields.length === 0) return;

  const branches: JsonRecord[] = [];
  const selected = new Set(selectFields.map((entry) => entry.key));
  for (const { key, field } of selectFields) {
    branches.push(branchClone(fieldsEntry.items as JsonRecord, [key], selectValueSchema(field)));
  }
  const unrestrictedKeys = options.allowedFieldKeys.filter((key) => !selected.has(key));
  if (unrestrictedKeys.length > 0) {
    branches.push(branchClone(fieldsEntry.items as JsonRecord, unrestrictedKeys, unrestrictedValueSchema()));
  }

  fieldsEntry.items = { anyOf: branches };
}

export function buildWireSchema(provider: ProviderId, options: WireSchemaOptions): JsonRecord {
  assertProvider(provider);
  const context: WireContext = {
    allowedCategoryIds: options.allowedCategoryIds,
    allowedFieldKeys: options.allowedFieldKeys,
  };
  const inlined = inlineLocalRefs(canonicalSchema as unknown as JsonValue);
  const generic = toWireSchema(inlined, undefined, context) as JsonRecord;
  applyFieldBranches(generic, options);
  switch (provider) {
    case "gemini":
      return toGemini(generic) as JsonRecord;
    case "openai":
      return toOpenAIStrict(generic) as JsonRecord;
    case "cloudflare":
      return generic;
    case "ollama":
      return { ...generic, format: "json" };
  }
}