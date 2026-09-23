const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
export const REDACTED = "[redacted]";

export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

export function flattenText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((item): item is string => typeof item === "string");
  return out.length > 0 ? out : undefined;
}

export function scrubSecrets(text: string, secrets: readonly (string | undefined)[]): string {
  if (typeof text !== "string" || text === "") return "";
  let out = text;
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 4) {
      out = out.split(secret).join(REDACTED);
    }
  }
  return out;
}

export function safeErrorMessage(err: unknown, secrets: readonly (string | undefined)[]): string {
  const message = err instanceof Error ? err.message : String(err);
  return truncateText(scrubSecrets(message, secrets), 500);
}

export async function fetchJson(
  url: string | URL,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  secrets: readonly (string | undefined)[],
): Promise<Record<string, unknown>> {
  const timeoutSignal =
    typeof globalThis !== "undefined" && globalThis.AbortSignal?.timeout !== undefined
      ? globalThis.AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS)
      : undefined;

  let response: Response;
  try {
    response = await globalThis.fetch(url, { ...init, signal: timeoutSignal });
  } catch (err) {
    throw new Error(`provider request failed: ${safeErrorMessage(err, secrets)}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${truncateText(scrubSecrets(flattenText(text), secrets), 400)}`,
    );
  }
  if (text === "") return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("expected a JSON object response");
  } catch (err) {
    if (err instanceof SyntaxError || (err instanceof Error && err.message === "expected a JSON object response")) {
      throw new Error(`invalid JSON response: ${truncateText(scrubSecrets(flattenText(text), secrets), 200)}`);
    }
    throw err;
  }
}