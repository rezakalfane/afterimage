import "server-only";
// Structured, redacted logs: correlation, code, duration, pseudonymous ids.
// Never log prompts, tokens, personal messages or raw provider responses.
const SECRET_KEYS = /token|secret|password|authorization|api[-_]?key|cookie|message|text|prompt|instructions|profile/i;
const SECRETISH = /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{40,})/g;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return { name: value.name, code: typeof code === "string" ? code : undefined, message: String(value.message).replace(SECRETISH, "[redacted]").slice(0, 200) };
  }
  if (typeof value === "string") return value.replace(SECRETISH, "[redacted]").slice(0, 200);
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEYS.test(k) ? "[redacted]" : redact(v, depth + 1);
    return out;
  }
  return value;
}

function write(level: "info" | "warn" | "error", event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...(redact(data) as object) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (process.env.APP_ENV !== "test") console.log(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => write("error", event, data),
};
