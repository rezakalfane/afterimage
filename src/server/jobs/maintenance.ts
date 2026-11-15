import "server-only";
// Bounded, idempotent maintenance (cron at-least-once + `npm run ops:cleanup`):
//   1. reconcile leases that may still hold provider capacity (expired / closing / uncertain)
//   2. purge runs past their retention (guest 7 d, account 30 d of inactivity)
//   3. drop expired ending confirmations and old rate-limit rows
// A DB lease ("lock:maintenance") guarantees a single runner across instances.
import { sqlClient } from "@/server/db/client";
import { log } from "@/server/security/log";
import { napster, NapsterError, type SessionSummary } from "@/server/napster/api";
import { closeProviderConnection } from "@/server/napster/conversation";

const LOCK = "lock:maintenance";
const LOCK_MS = 120_000;
const BATCH = 25;

async function acquireLock(owner: number): Promise<boolean> {
  const now = Date.now();
  await sqlClient().execute({ sql: `INSERT OR IGNORE INTO provider_budgets (scope, next_allowed_at, updated_at) VALUES (?, 0, ?)`, args: [LOCK, now] });
  const r = await sqlClient().execute({ sql: `UPDATE provider_budgets SET next_allowed_at = ?, updated_at = ? WHERE scope = ? AND next_allowed_at < ?`, args: [now + LOCK_MS, owner, LOCK, now] });
  return r.rowsAffected === 1;
}
async function releaseLock(owner: number) {
  await sqlClient().execute({ sql: `UPDATE provider_budgets SET next_allowed_at = 0 WHERE scope = ? AND updated_at = ?`, args: [LOCK, owner] });
}

/** Find a provider session created for this memory identity after the lease (documented: GET /public/sessions?externalClientId=). */
async function findProviderSession(externalClientId: string, since: number): Promise<SessionSummary | null> {
  const r = await napster<{ items: SessionSummary[] }>(`/public/sessions?externalClientId=${encodeURIComponent(externalClientId)}&pageSize=10`);
  return r.items.find((s) => (s.createdAt ?? 0) * 1000 >= since - 60_000 && (s.status === "pending" || s.status === "started")) ?? null;
}

export async function reconcileLeases(now = Date.now()) {
  const stats = { checked: 0, closed: 0, stillOpen: 0, errors: 0 };
  // Expired active/reserved leases may still hold capacity: they become uncertain first.
  await sqlClient().execute({ sql: `UPDATE conversation_leases SET status = 'uncertain', status_reason = COALESCE(status_reason, 'expired'), updated_at = ? WHERE status IN ('reserved','active') AND expires_at < ?`, args: [now, now] });
  const rows = await sqlClient().execute({
    sql: `SELECT id, connection_id, external_client_id, created_at, status, status_reason FROM conversation_leases WHERE status IN ('closing','uncertain') ORDER BY updated_at ASC LIMIT ?`,
    args: [BATCH],
  });
  for (const l of rows.rows) {
    stats.checked++;
    const leaseId = String(l.id);
    try {
      let connectionId = l.connection_id ? String(l.connection_id) : null;
      if (!connectionId) {
        // Create without response: look the session up before deciding (never assume it does not exist).
        const s = await findProviderSession(String(l.external_client_id), Number(l.created_at));
        connectionId = s?.id ?? null;
        if (!connectionId) {
          await sqlClient().execute({ sql: `UPDATE conversation_leases SET status = 'closed', status_reason = 'reconciled_none', updated_at = ? WHERE id = ?`, args: [Date.now(), leaseId] });
          stats.closed++;
          continue;
        }
      }
      if (await closeProviderConnection(leaseId, connectionId)) stats.closed++;
      else stats.stillOpen++;
    } catch (e) {
      stats.errors++;
      log.warn("maintenance.lease_reconcile_failed", { leaseId, error: e instanceof NapsterError ? `${e.status} ${e.code}` : e });
    }
  }
  return stats;
}

export async function purgeExpiredRuns(now = Date.now()) {
  // Expired runs and interrupted deletions ('deleting' tombstones). Provider sessions are closed
  // first (reconcileLeases): only runs without an open lease are deleted.
  const r = await sqlClient().execute({
    sql: `DELETE FROM runs WHERE id IN (
            SELECT r.id FROM runs r WHERE (r.expires_at < ? OR r.status = 'deleting')
            AND NOT EXISTS (SELECT 1 FROM conversation_leases l WHERE l.tenant_id = r.tenant_id AND l.run_id = r.id AND l.status IN ('reserved','active','closing','uncertain'))
            LIMIT ?)`,
    args: [now, BATCH * 4],
  });
  return r.rowsAffected;
}

export async function purgeEphemera(now = Date.now()) {
  const a = await sqlClient().execute({ sql: `DELETE FROM ending_intents WHERE expires_at < ?`, args: [now - 3600_000] });
  const b = await sqlClient().execute({ sql: `DELETE FROM rate_limit WHERE last_request < ?`, args: [now - 86_400_000] });
  return a.rowsAffected + b.rowsAffected;
}

export async function runMaintenance() {
  const owner = Date.now();
  if (!(await acquireLock(owner))) return { ok: true, skipped: "another maintenance is running" };
  try {
    const leases = await reconcileLeases();
    const runs = await purgeExpiredRuns();
    const ephemera = await purgeEphemera();
    const result = { ok: true, leases, purgedRuns: runs, purgedEphemera: ephemera };
    log.info("maintenance.done", result);
    return result;
  } finally {
    await releaseLock(owner);
  }
}
