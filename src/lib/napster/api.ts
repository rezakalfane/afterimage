// Minimal Napster API client. SERVER ONLY: it reads NAPSTER_API_KEY. Never import from a client component.
export const NAPSTER_BASE = "https://companion-api.napster.com";

export class NapsterError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    public body: string,
  ) {
    super(`Napster API ${status}${code ? ` ${code}` : ""}: ${body.slice(0, 300)}`);
  }
}

function apiKey(): string {
  const key = process.env.NAPSTER_API_KEY;
  if (!key) throw new Error("NAPSTER_API_KEY is not set (see .env.example)");
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call the Napster API. Retries 429s (connection endpoints allow 1 request/second per key),
 * honouring Retry-After, up to `retries` times.
 */
export async function napster<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; retries?: number } = {},
): Promise<T> {
  const { method = "GET", body, retries = 3 } = init;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${NAPSTER_BASE}${path}`, {
      method,
      headers: { "X-Api-Key": apiKey(), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (res.status === 429 && attempt < retries) {
      const wait = Number(res.headers.get("Retry-After") ?? "1");
      await sleep(Math.max(1, wait) * 1000);
      continue;
    }
    const text = await res.text();
    if (!res.ok) {
      let code: string | null = null;
      try {
        const parsed = JSON.parse(text);
        code = (Array.isArray(parsed) ? parsed[0]?.code : parsed?.code) ?? null;
      } catch {
        /* non-JSON error body */
      }
      throw new NapsterError(res.status, code, text);
    }
    return (text ? JSON.parse(text) : null) as T;
  }
}

export interface ConnectionResponse {
  token: string;
  connection: { id: string };
}

export interface RecordingResponse {
  id: string;
  status: "pending" | "processing" | "uploading" | "completed" | "failed";
  previewUrl: string | null;
}
