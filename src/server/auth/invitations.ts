import "server-only";
// Signed, single-use, expiring invitations bound to an email and a tenant.
// Only the SHA-256 of the token is stored. The plain token is shown once, to its creator.
import { createHash, randomBytes } from "node:crypto";
import { sqlClient, writeTx } from "@/server/db/client";
import { newId } from "@/server/security/ids";

export type InvitationRole = "owner" | "admin" | "player";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function createInvitation(input: { tenantId: string; email: string; role: InvitationRole; createdBy: string | null; ttlMs?: number }) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await sqlClient().execute({
    sql: `INSERT INTO invitations (id, tenant_id, token_hash, email_normalized, role, created_by, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    args: [newId("inv"), input.tenantId, hash(token), normalizeEmail(input.email), input.role, input.createdBy, now + (input.ttlMs ?? 72 * 3600_000), now],
  });
  return token;
}

export async function findValidInvitation(token: string, email: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const r = await sqlClient().execute({
    sql: `SELECT id, tenant_id, role FROM invitations WHERE token_hash = ? AND email_normalized = ? AND consumed_at IS NULL AND expires_at > ?`,
    args: [hash(token), normalizeEmail(email), Date.now()],
  });
  const row = r.rows[0];
  return row ? { id: String(row.id), tenantId: String(row.tenant_id), role: String(row.role) as InvitationRole } : null;
}

/** Atomically consume the invitation and create app user + membership. False if already used/expired. */
export async function consumeInvitationForUser(token: string, userId: string, email: string): Promise<boolean> {
  const now = Date.now();
  return writeTx(async (tx) => {
    const upd = await tx.execute({
      sql: `UPDATE invitations SET consumed_at = ?, consumed_by = ? WHERE token_hash = ? AND email_normalized = ? AND consumed_at IS NULL AND expires_at > ? RETURNING tenant_id, role`,
      args: [now, userId, hash(token), normalizeEmail(email), now],
    });
    const row = upd.rows[0];
    if (!row) return false;
    await tx.execute({ sql: `INSERT OR IGNORE INTO app_users (id, is_guest, created_at, last_seen_at) VALUES (?,0,?,?)`, args: [userId, now, now] });
    await tx.execute({ sql: `INSERT INTO memberships (tenant_id, user_id, role, created_at) VALUES (?,?,?,?)`, args: [row.tenant_id, userId, row.role, now] });
    await tx.execute({
      sql: `INSERT INTO audit_events (id, tenant_id, actor_ref, event_type, metadata_json, created_at) VALUES (?,?,?,?,?,?)`,
      args: [newId("aud"), row.tenant_id, userId, "invitation.consumed", JSON.stringify({ role: row.role }), now],
    });
    return true;
  });
}
