import "server-only";
// TenantContext: created ONLY after authentication + verified membership.
// The active tenant comes from a membership, never from a field the browser sends as authority.
import { auth } from "@/server/auth/auth";
import { sqlClient } from "@/server/db/client";
import { HttpError } from "@/server/security/http";

export type Role = "owner" | "admin" | "player";
export interface TenantContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: Role;
  readonly isGuest: boolean;
  readonly tenantMaxSessions: number;
}

export const TENANT_COOKIE = "afterimage_tenant";

/** Resolve the caller. Throws 401 without a session, 403 without an active membership. */
export async function requireContext(req: Request): Promise<TenantContext> {
  const session = await (await auth()).api.getSession({ headers: req.headers });
  if (!session?.user?.id) throw new HttpError("UNAUTHENTICATED", "Connexion nécessaire.");
  const userId = session.user.id;
  const wanted = /(?:^|;\s*)afterimage_tenant=([a-z0-9-]{2,40})/.exec(req.headers.get("cookie") ?? "")?.[1] ?? null;
  const r = await sqlClient().execute({
    sql: `SELECT m.tenant_id, m.role, t.slug, t.is_public, t.max_active_sessions, u.is_guest
          FROM memberships m JOIN tenants t ON t.id = m.tenant_id JOIN app_users u ON u.id = m.user_id
          WHERE m.user_id = ? AND t.status = 'active' ORDER BY t.is_public ASC, m.created_at ASC`,
    args: [userId],
  });
  if (r.rows.length === 0) throw new HttpError("FORBIDDEN", "Aucun accès actif.");
  const row = (wanted ? r.rows.find((x) => x.slug === wanted) : null) ?? r.rows[0];
  return {
    userId,
    tenantId: String(row.tenant_id),
    role: String(row.role) as Role,
    isGuest: Number(row.is_guest) === 1,
    tenantMaxSessions: Number(row.max_active_sessions),
  };
}

export function requireRole(ctx: TenantContext, roles: Role[]) {
  if (!roles.includes(ctx.role)) throw new HttpError("FORBIDDEN");
}
