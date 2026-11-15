import "server-only";
// Controlled onboarding: every Better Auth user gets exactly one app_users row, created here.
import { sqlClient, writeTx } from "@/server/db/client";
import { env } from "@/server/env";

export async function publicTenantId(): Promise<string> {
  const r = await sqlClient().execute({ sql: `SELECT id FROM tenants WHERE slug = ? AND is_public = 1 AND status = 'active'`, args: [env().PUBLIC_TENANT_SLUG] });
  const id = r.rows[0]?.id;
  if (!id) throw new Error("Public tenant missing: run `npm run db:seed`.");
  return String(id);
}

/** Guest (anonymous plugin): app user + player membership in the public tenant only. */
export async function onboardGuest(userId: string) {
  const tenantId = await publicTenantId();
  const now = Date.now();
  await writeTx(async (tx) => {
    await tx.execute({ sql: `INSERT OR IGNORE INTO app_users (id, is_guest, created_at, last_seen_at) VALUES (?,1,?,?)`, args: [userId, now, now] });
    await tx.execute({ sql: `INSERT OR IGNORE INTO memberships (tenant_id, user_id, role, created_at) VALUES (?,?, 'player', ?)`, args: [tenantId, userId, now] });
  });
}

/** Remove a Better Auth user and its application rows (sessions/accounts cascade). */
export async function deleteAuthUser(userId: string) {
  await writeTx(async (tx) => {
    await tx.execute({ sql: `DELETE FROM app_users WHERE id = ?`, args: [userId] });
    await tx.execute({ sql: `DELETE FROM user WHERE id = ?`, args: [userId] });
  });
}
