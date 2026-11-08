// Redact on the server, including JSON keys, before returning any public history.
export function redactText(text: string): string {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[removed]")
    .replace(/(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi, "[removed]")
    .replace(/(?:\+?\d[\d\s().-]{5,}\d)(?:\s*(?:ext\.?|x)\s*\d+)?/gi, (candidate) =>
      candidate.replace(/\D/g, "").length >= 7 ? "[removed]" : candidate);
}
export function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [redactText(key), redactValue(item)]));
  }
  // Numeric phone numbers must not leak through JSON output either.
  if (typeof value === "number" && Number.isInteger(value) && String(Math.abs(value)).length >= 7) return "[removed]";
  return value;
}
