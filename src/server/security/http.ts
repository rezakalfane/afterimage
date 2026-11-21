import "server-only";
// Thin HTTP helpers for route handlers: bounded JSON bodies, Origin check on mutations,
// stable error codes with a correlation id, private/no-store caching. No stack or SQL leaks.
import { randomUUID } from "node:crypto";
import { env } from "@/server/env";
import { log } from "./log";
import { publicErrorMessage, localizeError } from "./error-texts";
import { requestLocale } from "./locale";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_ORIGIN"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_ARGUMENT"
  | "REVISION_CONFLICT"
  | "IDEMPOTENCY_MISMATCH"
  | "LEASE_INVALID"
  | "CONVERSATION_ACTIVE"
  | "CAPACITY_FULL"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "LIVE_DISABLED"
  | "QUOTA_EXCEEDED"
  | "RUN_FINISHED"
  | "VERSION_RETIRED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_ORIGIN: 403,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_ARGUMENT: 400,
  REVISION_CONFLICT: 409,
  IDEMPOTENCY_MISMATCH: 409,
  LEASE_INVALID: 409,
  CONVERSATION_ACTIVE: 409,
  CAPACITY_FULL: 503,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 502,
  LIVE_DISABLED: 409,
  QUOTA_EXCEEDED: 429,
  RUN_FINISHED: 409,
  VERSION_RETIRED: 409,
  INTERNAL: 500,
};

export class HttpError extends Error {
  constructor(
    public code: ErrorCode,
    public publicMessage?: string,
    public extra?: Record<string, unknown>,
    public retryAfter?: number,
  ) {
    super(code);
  }
}

export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } as const;

export function json(data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...PRIVATE_HEADERS, ...init.headers },
  });
}

/** Read a JSON body of at most `limit` bytes. */
export async function readJson(req: Request, limit = 16 * 1024): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > limit) throw new HttpError("PAYLOAD_TOO_LARGE");
  const text = await req.text();
  if (Buffer.byteLength(text) > limit) throw new HttpError("PAYLOAD_TOO_LARGE");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError("INVALID_ARGUMENT", "Corps JSON invalide.");
  }
}

/** Reject cross-site mutations: Origin (or Referer) must be the app's own origin. */
export function assertSameOrigin(req: Request) {
  const expected = new URL(env().APP_URL).origin;
  const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  if (origin !== expected) throw new HttpError("BAD_ORIGIN");
}

/** Wrap a route handler: maps HttpError to JSON, logs unexpected errors with a correlation id only. */
export function handler<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<Response>) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const correlationId = randomUUID();
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof HttpError) {
        const headers: Record<string, string> = { "X-Correlation-Id": correlationId };
        if (e.retryAfter) headers["Retry-After"] = String(e.retryAfter);
        return json({ ok: false, code: e.code, message: publicErrorMessage(e.code, e.publicMessage, requestLocale(req)), correlationId, ...e.extra }, { status: STATUS[e.code], headers });
      }
      log.error("route.unexpected", { correlationId, path: new URL(req.url).pathname, error: e });
      return json({ ok: false, code: "INTERNAL", message: localizeError("Une erreur inattendue est survenue.", requestLocale(req)), correlationId }, { status: 500, headers: { "X-Correlation-Id": correlationId } });
    }
  };
}
