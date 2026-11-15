import "server-only";
// Run access. EVERY query on a run is scoped by tenant_id + id + owner_user_id.
// A foreign or unknown run is reported as NOT_FOUND (no existence leak).
import type { Transaction } from "@libsql/client";
import { sqlClient, writeTx } from "@/server/db/client";
import { HttpError } from "@/server/security/http";
import { newId } from "@/server/security/ids";
import { EPISODE_ID, EPISODE_VERSION } from "@/server/world/content";
import { initialState, type WorldState } from "@/server/world/engine";
import type { TenantContext } from "./context";

export interface RunRow {
  id: string;
  tenantId: string;
  ownerUserId: string;
  revision: number;
  status: "active" | "finished" | "deleting";
  state: WorldState;
  createdAt: number;
  updatedAt: number;
}

const DAY = 86_400_000;
const MAX_ACTIVE_RUNS = { guest: 3, account: 10 };

function toRow(r: Record<string, unknown>): RunRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    ownerUserId: String(r.owner_user_id),
    revision: Number(r.revision),
    status: String(r.status) as RunRow["status"],
    state: JSON.parse(String(r.state_json)) as WorldState,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

const SCOPED = `SELECT id, tenant_id, owner_user_id, revision, status, state_json, created_at, updated_at FROM runs WHERE tenant_id = ? AND id = ? AND owner_user_id = ?`;

export async function getRun(ctx: TenantContext, runId: string, tx?: Transaction): Promise<RunRow> {
  if (!/^run_[a-f0-9]{32}$/.test(runId)) throw new HttpError("NOT_FOUND");
  const r = await (tx ?? sqlClient()).execute({ sql: SCOPED + ` AND status != 'deleting'`, args: [ctx.tenantId, runId, ctx.userId] });
  if (!r.rows[0]) throw new HttpError("NOT_FOUND");
  return toRow(r.rows[0] as Record<string, unknown>);
}

export async function listRuns(ctx: TenantContext) {
  const r = await sqlClient().execute({
    sql: `SELECT id, revision, status, updated_at, created_at FROM runs WHERE tenant_id = ? AND owner_user_id = ? AND status != 'deleting' ORDER BY updated_at DESC LIMIT 20`,
    args: [ctx.tenantId, ctx.userId],
  });
  return r.rows.map((x) => ({ id: String(x.id), revision: Number(x.revision), status: String(x.status), updatedAt: Number(x.updated_at), createdAt: Number(x.created_at) }));
}

export async function createRun(ctx: TenantContext): Promise<RunRow> {
  const now = Date.now();
  const id = newId("run");
  const state = initialState();
  const ttl = ctx.isGuest ? 7 * DAY : 30 * DAY;
  await writeTx(async (tx) => {
    const c = await tx.execute({ sql: `SELECT count(*) AS n FROM runs WHERE tenant_id = ? AND owner_user_id = ? AND status = 'active'`, args: [ctx.tenantId, ctx.userId] });
    if (Number(c.rows[0].n) >= (ctx.isGuest ? MAX_ACTIVE_RUNS.guest : MAX_ACTIVE_RUNS.account)) {
      throw new HttpError("QUOTA_EXCEEDED", "Vous avez déjà plusieurs parties en cours. Reprenez-en une ou supprimez-la.");
    }
    await tx.execute({
      sql: `INSERT INTO runs (id, tenant_id, owner_user_id, episode_id, episode_version, revision, status, state_json, created_at, updated_at, expires_at)
            VALUES (?,?,?,?,?,0,'active',?,?,?,?)`,
      args: [id, ctx.tenantId, ctx.userId, EPISODE_ID, EPISODE_VERSION, JSON.stringify(state), now, now, now + ttl],
    });
    await tx.execute({ sql: `UPDATE app_users SET last_seen_at = ? WHERE id = ?`, args: [now, ctx.userId] });
  });
  return { id, tenantId: ctx.tenantId, ownerUserId: ctx.userId, revision: 0, status: "active", state, createdAt: now, updatedAt: now };
}

/** Mark the run as deleting (tombstone). The caller closes provider sessions, then purges. */
export async function markRunDeleting(ctx: TenantContext, runId: string) {
  await getRun(ctx, runId);
  await sqlClient().execute({ sql: `UPDATE runs SET status = 'deleting', updated_at = ? WHERE tenant_id = ? AND id = ? AND owner_user_id = ?`, args: [Date.now(), ctx.tenantId, runId, ctx.userId] });
}

export async function purgeRun(ctx: TenantContext, runId: string) {
  // Cascades remove events, receipts, memories, bindings, leases, jobs, ending intents.
  await sqlClient().execute({ sql: `DELETE FROM runs WHERE tenant_id = ? AND id = ? AND owner_user_id = ? AND status = 'deleting'`, args: [ctx.tenantId, runId, ctx.userId] });
}

export const RUN_TTL = { guest: 7 * DAY, account: 30 * DAY };
