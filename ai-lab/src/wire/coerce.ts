export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "url",
  "boolean",
  "select",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type CoercedFieldValue = string | number | boolean | null;

const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})T/;

function trimStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || !DECIMAL_RE.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function isRealCalendarDate(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d;
}

function coerceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const dateOnly = DATE_ONLY_RE.exec(trimmed);
  if (dateOnly !== null) {
    return isRealCalendarDate(dateOnly[1], dateOnly[2], dateOnly[3])
      ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
      : null;
  }
  const isoPrefix = ISO_DATE_PREFIX_RE.exec(trimmed);
  if (isoPrefix !== null) {
    return isRealCalendarDate(isoPrefix[1], isoPrefix[2], isoPrefix[3])
      ? `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`
      : null;
  }
  return null;
}

export function coerceFieldValue(value: unknown, fieldType: FieldType): CoercedFieldValue {
  switch (fieldType) {
    case "text":
    case "textarea":
    case "url":
    case "select":
      return trimStringOrNull(value);
    case "number":
      return coerceNumber(value);
    case "boolean":
      return coerceBoolean(value);
    case "date":
      return coerceDate(value);
  }
}