import "server-only";
// Admin operations, scoped to the caller's tenant and role. Admins never read players' personal
// messages or game states (no such operation exists here); provider secrets are never returned.
import { sqlClient } from "@/server/db/client";
import { env } from "@/server/env";
import { createInvitation, type InvitationRole } from "@/server/auth/invitations";
import { closeProviderConnection, PROVIDER_SCOPE } from "@/server/napster/conversation";
import { HttpError } from "@/server/security/http";
import { newId } from "@/server/security/ids";
import { type TenantContext, requireRole } from "./context";

const OPEN = `('reserved','active','closing','uncertain')`;

async function audit(ctx: TenantContext, type: string, meta: Record<string, unknown>) {
  await sqlClient().execute({ sql: `INSERT INTO audit_events (id, tenant_id, actor_ref, event_type, metadata_json, created_at) VALUES (?,?,?,?,?,?)`, args: [newId("aud"), ctx.tenantId, ctx.userId, type, JSON.stringify(meta), Date.now()] });
}

export async function overview(ctx: TenantContext) {
  requireRole(ctx, ["owner", "admin"]);
  const c = sqlClient();
  const tenant = (await c.execute({ sql: `SELECT name, slug, is_public, max_active_sessions, status FROM tenants WHERE id = ?`, args: [ctx.tenantId] })).rows[0];
  const members = (await c.execute({
    sql: `SELECT m.user_id, m.role, m.created_at, u.email, u.is_anonymous FROM memberships m JOIN user u ON u.id = m.user_id WHERE m.tenant_id = ? AND (u.is_anonymous = 0 OR u.is_anonymous IS NULL) ORDER BY m.created_at`,
    args: [ctx.tenantId],
  })).rows.map((r) => ({ userId: String(r.user_id), role: String(r.role), email: String(r.email), since: Number(r.created_at) }));
  const guests = Number((await c.execute({ sql: `SELECT count(*) n FROM memberships m JOIN app_users a ON a.id = m.user_id WHERE m.tenant_id = ? AND a.is_guest = 1`, args: [ctx.tenantId] })).rows[0].n);
  const runs = (await c.execute({ sql: `SELECT status, count(*) n FROM runs WHERE tenant_id = ? GROUP BY status`, args: [ctx.tenantId] })).rows.map((r) => ({ status: String(r.status), n: Number(r.n) }));
  const leases = (await c.execute({
    sql: `SELECT id, character_id, status, status_reason, created_at, expires_at FROM conversation_leases WHERE tenant_id = ? AND status IN ${OPEN} ORDER BY created_at DESC LIMIT 50`,
    args: [ctx.tenantId],
  })).rows.map((r) => ({ id: String(r.id), character: String(r.character_id), status: String(r.status), reason: r.status_reason ? String(r.status_reason) : null, createdAt: Number(r.created_at), expiresAt: Number(r.expires_at) }));
  const globalOpen = Number((await c.execute({ sql: `SELECT count(*) n FROM conversation_leases WHERE provider_scope = ? AND status IN ${OPEN}`, args: [PROVIDER_SCOPE] })).rows[0].n);
  const invitations = (await c.execute({ sql: `SELECT id, email_normalized, role, expires_at FROM invitations WHERE tenant_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC`, args: [ctx.tenantId, Date.now()] })).rows.map((r) => ({ id: String(r.id), email: String(r.email_normalized), role: String(r.role), expiresAt: Number(r.expires_at) }));
  const e = env();
  return {
    tenant: { name: String(tenant.name), slug: String(tenant.slug), public: Number(tenant.is_public) === 1, maxActiveSessions: Number(tenant.max_active_sessions), status: String(tenant.status) },
    you: { role: ctx.role },
    members,
    guests,
    invitations,
    runs,
    capacity: { mode: e.CONVERSATION_MODE, environmentMax: e.NAPSTER_MAX_ACTIVE, environmentOpen: globalOpen, tenantMax: Number(tenant.max_active_sessions), tenantOpen: leases.length },
    leases,
    bonuses: { recordings: e.NAPSTER_RECORDINGS_ENABLED, phone: e.NAPSTER_PHONE_ENABLED },
    release: { env: e.APP_ENV, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local", schema: await schemaVersion() },
  };
}

export async function schemaVersion(): Promise<string> {
  try {
    const r = await sqlClient().execute(`SELECT count(*) n, max(created_at) last FROM __drizzle_migrations`);
    return `${r.rows[0].n} migration(s)`;
  } catch {
    return "unknown";
  }
}

export async function invite(ctx: TenantContext, email: string, role: InvitationRole) {
  requireRole(ctx, ["owner", "admin"]);
  if (role === "owner" || (role === "admin" && ctx.role !== "owner")) throw new HttpError("FORBIDDEN", "Seul l’owner peut inviter un admin.");
  const token = await createInvitation({ tenantId: ctx.tenantId, email, role, createdBy: ctx.userId });
  await audit(ctx, "invitation.created", { role });
  return `${env().APP_URL.replace(/\/$/, "")}/invitation/${token}?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

export async function removeMember(ctx: TenantContext, userId: string) {
  requireRole(ctx, ["owner"]);
  if (userId === ctx.userId) throw new HttpError("INVALID_ARGUMENT", "Vous ne pouvez pas vous retirer vous-même.");
  const r = await sqlClient().execute({ sql: `DELETE FROM memberships WHERE tenant_id = ? AND user_id = ? AND role != 'owner'`, args: [ctx.tenantId, userId] });
  if (r.rowsAffected !== 1) throw new HttpError("NOT_FOUND");
  await audit(ctx, "member.removed", {});
}

export async function forceCloseLease(ctx: TenantContext, leaseId: string) {
  requireRole(ctx, ["owner", "admin"]);
  const r = await sqlClient().execute({ sql: `UPDATE conversation_leases SET status = 'closing', status_reason = 'admin', updated_at = ? WHERE id = ? AND tenant_id = ? AND status IN ${OPEN} RETURNING connection_id`, args: [Date.now(), leaseId, ctx.tenantId] });
  if (!r.rows[0]) throw new HttpError("NOT_FOUND");
  await audit(ctx, "lease.force_closed", {});
  return closeProviderConnection(leaseId, r.rows[0].connection_id ? String(r.rows[0].connection_id) : null);
}
