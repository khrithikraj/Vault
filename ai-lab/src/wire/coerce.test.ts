import { describe, expect, it } from "vitest";
import { coerceFieldValue, FIELD_TYPES } from "./coerce";

describe("coerceFieldValue", () => {
  it("exposes the closed Phase 2 field-type set", () => {
    expect([...FIELD_TYPES]).toEqual(["text", "textarea", "number", "date", "url", "boolean", "select"]);
  });

  describe("text / textarea", () => {
    it("returns a string for a normal value", () => {
      expect(coerceFieldValue("The Great Gatsby", "text")).toBe("The Great Gatsby");
      expect(coerceFieldValue("Long form notes\nwith a second line", "textarea")).toBe(
        "Long form notes\nwith a second line",
      );
    });

    it("trims surrounding whitespace", () => {
      expect(coerceFieldValue("  The Great Gatsby  ", "text")).toBe("The Great Gatsby");
    });

    it("returns null for null", () => {
      expect(coerceFieldValue(null, "text")).toBeNull();
      expect(coerceFieldValue(null, "textarea")).toBeNull();
    });

    it("returns null for an empty or whitespace-only string", () => {
      expect(coerceFieldValue("", "text")).toBeNull();
      expect(coerceFieldValue("   ", "textarea")).toBeNull();
    });

    it("returns null for a non-string raw value", () => {
      expect(coerceFieldValue(42, "text")).toBeNull();
      expect(coerceFieldValue(true, "textarea")).toBeNull();
    });
  });

  describe("url", () => {
    it("returns a string for a normal value", () => {
      expect(coerceFieldValue("https://example.com/item/1", "url")).toBe("https://example.com/item/1");
    });

    it("trims surrounding whitespace", () => {
      expect(coerceFieldValue("  https://example.com  ", "url")).toBe("https://example.com");
    });

    it("returns null for null, empty and non-string values", () => {
      expect(coerceFieldValue(null, "url")).toBeNull();
      expect(coerceFieldValue("", "url")).toBeNull();
      expect(coerceFieldValue(123, "url")).toBeNull();
    });
  });

  describe("select", () => {
    it("returns a string for a normal value", () => {
      expect(coerceFieldValue("action", "select")).toBe("action");
    });

    it("trims surrounding whitespace", () => {
      expect(coerceFieldValue("  comedy  ", "select")).toBe("comedy");
    });

    it("returns null for null, empty and non-string values", () => {
      expect(coerceFieldValue(null, "select")).toBeNull();
      expect(coerceFieldValue("", "select")).toBeNull();
      expect(coerceFieldValue(["action"], "select")).toBeNull();
    });
  });

  describe("number", () => {
    it("returns a number for a numeric raw value", () => {
      expect(coerceFieldValue(42, "number")).toBe(42);
      expect(coerceFieldValue(-3.5, "number")).toBe(-3.5);
    });

    it("parses numeric strings", () => {
      expect(coerceFieldValue("42", "number")).toBe(42);
      expect(coerceFieldValue("42.5", "number")).toBe(42.5);
      expect(coerceFieldValue("-3.25", "number")).toBe(-3.25);
      expect(coerceFieldValue("0.5", "number")).toBe(0.5);
      expect(coerceFieldValue("1e3", "number")).toBe(1000);
      expect(coerceFieldValue("  7  ", "number")).toBe(7);
      expect(coerceFieldValue("+4", "number")).toBe(4);
    });

    it("returns null for null and non-numeric values", () => {
      expect(coerceFieldValue(null, "number")).toBeNull();
      expect(coerceFieldValue("", "number")).toBeNull();
      expect(coerceFieldValue("   ", "number")).toBeNull();
      expect(coerceFieldValue("abc", "number")).toBeNull();
      expect(coerceFieldValue("42 px", "number")).toBeNull();
    });

    it("returns null for ambiguous or non-decimal strings", () => {
      expect(coerceFieldValue("0x10", "number")).toBeNull();
      expect(coerceFieldValue("1,000", "number")).toBeNull();
      expect(coerceFieldValue("Infinity", "number")).toBeNull();
    });

    it("returns null for ambiguous raw values", () => {
      expect(coerceFieldValue(Number.NaN, "number")).toBeNull();
      expect(coerceFieldValue(Number.POSITIVE_INFINITY, "number")).toBeNull();
      expect(coerceFieldValue(true, "number")).toBeNull();
    });
  });

  describe("boolean", () => {
    it("returns a boolean for real booleans", () => {
      expect(coerceFieldValue(true, "boolean")).toBe(true);
      expect(coerceFieldValue(false, "boolean")).toBe(false);
    });

    it("parses boolean strings", () => {
      expect(coerceFieldValue("true", "boolean")).toBe(true);
      expect(coerceFieldValue("TRUE", "boolean")).toBe(true);
      expect(coerceFieldValue("false", "boolean")).toBe(false);
      expect(coerceFieldValue("False", "boolean")).toBe(false);
      expect(coerceFieldValue("1", "boolean")).toBe(true);
      expect(coerceFieldValue("0", "boolean")).toBe(false);
      expect(coerceFieldValue(" true ", "boolean")).toBe(true);
    });

    it("returns null for ambiguous/invalid boolean strings", () => {
      expect(coerceFieldValue("yes", "boolean")).toBeNull();
      expect(coerceFieldValue("no", "boolean")).toBeNull();
      expect(coerceFieldValue("on", "boolean")).toBeNull();
      expect(coerceFieldValue("maybe", "boolean")).toBeNull();
      expect(coerceFieldValue("", "boolean")).toBeNull();
      expect(coerceFieldValue("  ", "boolean")).toBeNull();
    });

    it("returns null for non-boolean raw values", () => {
      expect(coerceFieldValue(null, "boolean")).toBeNull();
      expect(coerceFieldValue(1, "boolean")).toBeNull();
      expect(coerceFieldValue(0, "boolean")).toBeNull();
    });
  });

  describe("date", () => {
    it("returns the canonical YYYY-MM-DD representation", () => {
      expect(coerceFieldValue("2026-09-23", "date")).toBe("2026-09-23");
      expect(coerceFieldValue("2024-02-29", "date")).toBe("2024-02-29");
    });

    it("extracts the date portion of ISO datetime strings", () => {
      expect(coerceFieldValue("2026-09-23T04:00:00Z", "date")).toBe("2026-09-23");
      expect(coerceFieldValue("2026-09-23T12:34:56.000Z", "date")).toBe("2026-09-23");
    });

    it("returns null for calendar-invalid dates", () => {
      expect(coerceFieldValue("2026-02-30", "date")).toBeNull();
      expect(coerceFieldValue("2026-04-31", "date")).toBeNull();
      expect(coerceFieldValue("2023-02-29", "date")).toBeNull();
      expect(coerceFieldValue("2026-13-01", "date")).toBeNull();
      expect(coerceFieldValue("2026-00-10", "date")).toBeNull();
    });

    it("returns null for unparseable date strings", () => {
      expect(coerceFieldValue("not-a-date", "date")).toBeNull();
      expect(coerceFieldValue("23/09/2026", "date")).toBeNull();
      expect(coerceFieldValue("2026-1-1", "date")).toBeNull();
      expect(coerceFieldValue("", "date")).toBeNull();
      expect(coerceFieldValue("   ", "date")).toBeNull();
    });

    it("returns null for non-string raw values", () => {
      expect(coerceFieldValue(null, "date")).toBeNull();
      expect(coerceFieldValue(12345, "date")).toBeNull();
    });
  });
});