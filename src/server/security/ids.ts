import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

/** Opaque server-generated id, e.g. run_3f…; never derived from user input. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Napster externalClientId (memory identity): "ai_" + 28 hex of an HMAC over
 * env | tenant | user | run | character | generation → 31 chars, matches ^[A-Za-z0-9_-]{1,32}$.
 * Generated ONCE and stored in napster_bindings, so a secret rotation never changes a resumed run.
 */
export function memoryId(secret: string, parts: { env: string; tenantId: string; userId: string; runId: string; character: string; generation: number }): string {
  const msg = [parts.env, parts.tenantId, parts.userId, parts.runId, parts.character, String(parts.generation)].join("|");
  return "ai_" + createHmac("sha256", secret).update(msg).digest("hex").slice(0, 28);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
