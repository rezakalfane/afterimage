import "server-only";
// Server-only Napster API client (X-Api-Key). Only documented endpoints are used:
// POST /public/agents/{id}/connections, DELETE /public/connections/{id}, GET /public/sessions[/{id}].
import { env } from "@/server/env";

export const NAPSTER_BASE = "https://companion-api.napster.com";

export class NapsterError extends Error {
  constructor(
    public status: number,
    public code: string | null,
    public retryAfter: number | null,
  ) {
    super(`Napster ${status}${code ? ` ${code}` : ""}`);
  }
}
/** The request may or may not have reached Napster (timeout / network): never blindly retry a create. */
export class NapsterUncertain extends Error {}

export async function napster<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number; apiKey?: string } = {}): Promise<T> {
  const key = init.apiKey ?? env().NAPSTER_API_KEY;
  if (!key) throw new NapsterError(401, "MissingApiKey", null);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  let res: Response;
  try {
    res = await fetch(`${NAPSTER_BASE}${path}`, {
      method: init.method ?? "GET",
      headers: { "X-Api-Key": key, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch {
    throw new NapsterUncertain("network");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    let code: string | null = null;
    try {
      const p = JSON.parse(text);
      code = (Array.isArray(p) ? p[0]?.code : p?.code) ?? null;
    } catch {
      /* not JSON */
    }
    const ra = res.headers.get("Retry-After");
    throw new NapsterError(res.status, code, ra ? Number(ra) : null);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export interface ConnectionResponse {
  token: string;
  connection: { id: string };
}
export interface SessionSummary {
  id: string;
  status: "pending" | "started" | "closed" | "failed";
  externalClientId?: string | null;
  createdAt?: number;
  cost?: number | null;
  closeReason?: string | null;
}
