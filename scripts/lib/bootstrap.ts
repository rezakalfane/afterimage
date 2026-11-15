// One-time owner invitation for the public tenant, created from the command line only
// (never by a public /setup route). Prints a link; the owner then sets their own password.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { PUBLIC_TENANT } from "./db";

export async function createBootstrapInvitation(client: Client, appUrl: string, email: string, tenantId = PUBLIC_TENANT.id): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await client.execute({
    sql: `INSERT INTO invitations (id, tenant_id, token_hash, email_normalized, role, created_by, expires_at, created_at) VALUES (?,?,?,?, 'owner', 'cli', ?, ?)`,
    args: [`inv_${randomUUID().replace(/-/g, "")}`, tenantId, createHash("sha256").update(token).digest("hex"), email.trim().toLowerCase(), now + 24 * 3600_000, now],
  });
  return `${appUrl.replace(/\/$/, "")}/invitation/${token}?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}
