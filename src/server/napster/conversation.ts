import "server-only";
// Conversation lifecycle with distributed admission (no process memory):
//   reserve (DB tx: quotas + rate slot + unique open lease per run) → create Napster connection
//   (outside any tx) → activate lease → token to the browser. Close: closing → DELETE → closed.
// Timeouts/network errors leave the lease "uncertain" until reconciled (ops:cleanup / cron).
import type { Transaction } from "@libsql/client";
import { sqlClient, writeTx } from "@/server/db/client";
import { getRun } from "@/server/dal/runs";
import type { TenantContext } from "@/server/dal/context";
import { env } from "@/server/env";
import { HttpError } from "@/server/security/http";
import { memoryId, newId } from "@/server/security/ids";
import { log } from "@/server/security/log";
import { characterForEra, type CharacterId } from "@/server/world/content";
import { characterContext } from "@/server/world/projections";
import type { Locale } from "@/server/world/texts";
import { napster, NapsterError, NapsterUncertain, type ConnectionResponse } from "./api";
import { connectionProfile, openingInstruction } from "./context";

export const PROVIDER_SCOPE = "napster:webrtc";
const RATE_SCOPE = "napster:connections"; // 1 request/s per API key, shared by create AND delete
// 1 req/s per key + margin. Tests shorten it (APP_ENV=test only) to keep the suite fast.
const RATE_GAP_MS = process.env.APP_ENV === "test" ? Number(process.env.NAPSTER_RATE_GAP_MS ?? 50) : 1500; // provider counts arrivals, not our departures
const MAX_WAIT_MS = 4000;
const RESERVE_TTL_MS = 30_000;
export const ACTIVE_TTL_MS = 90_000;
const OPEN = `('reserved','active','closing','uncertain')`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reserve the next slot of the shared provider rate budget, inside the caller's write tx. */
async function reserveRateSlot(tx: Transaction, now: number): Promise<number> {
  const r = await tx.execute({ sql: `SELECT next_allowed_at FROM provider_budgets WHERE scope = ?`, args: [RATE_SCOPE] });
  const next = Number(r.rows[0]?.next_allowed_at ?? 0);
  const slot = Math.max(now, next);
  if (slot - now > MAX_WAIT_MS) throw new HttpError("RATE_LIMITED", "Beaucoup de demandes en ce moment. Réessayez dans quelques secondes.", undefined, Math.ceil((slot - now) / 1000));
  await tx.execute({
    sql: `INSERT INTO provider_budgets (scope, next_allowed_at, updated_at) VALUES (?,?,?) ON CONFLICT(scope) DO UPDATE SET next_allowed_at = excluded.next_allowed_at, updated_at = excluded.updated_at`,
    args: [RATE_SCOPE, slot + RATE_GAP_MS, now],
  });
  return slot;
}

/** Agent for a character in a locale. fr = P0 agents; en = optional *_EN ids (P1, off unless set). */
function agentFor(character: CharacterId, locale: Locale): string {
  const e = env();
  const id =
    locale === "en"
      ? character === "jeanne" ? process.env.NAPSTER_JEANNE_AGENT_ID_EN : process.env.NAPSTER_MALIK_AGENT_ID_EN
      : character === "jeanne" ? e.NAPSTER_JEANNE_AGENT_ID : e.NAPSTER_MALIK_AGENT_ID;
  if (!id) throw new HttpError("LIVE_DISABLED", "Conversation en direct indisponible dans cette langue.");
  return id;
}

export interface OpenedConversation {
  token: string;
  leaseId: string;
  character: CharacterId;
  revision: number;
}

export async function openConversation(ctx: TenantContext, runId: string, opts: { resumed?: boolean; locale?: Locale } = {}): Promise<OpenedConversation> {
  const locale: Locale = opts.locale ?? "fr";
  const e = env();
  if (e.CONVERSATION_MODE !== "live") throw new HttpError("LIVE_DISABLED", "Conversation en direct désactivée (mode répétition).");
  const run = await getRun(ctx, runId);
  if (run.status !== "active") throw new HttpError("RUN_FINISHED");
  const character = characterForEra(run.state.activeEra);
  const agentId = agentFor(character, locale);
  const now = Date.now();
  const leaseId = newId("lease");

  // 0. Take over the caller's own open lease on this run (left behind by a reload, a language
  //    switch during an open, a crashed tab). The newest request wins; one avatar per run holds.
  //    Closing calls Napster, so it happens before (outside) the admission transaction.
  const own = await sqlClient().execute({ sql: `SELECT id FROM conversation_leases WHERE tenant_id = ? AND run_id = ? AND user_id = ? AND status IN ${OPEN}`, args: [ctx.tenantId, runId, ctx.userId] });
  if (own.rows[0]) {
    log.info("napster.connection.take_over", { leaseId: String(own.rows[0].id) });
    await closeConversation(ctx, runId);
  }

  // 1. Admission + identity, one write transaction.
  const { slot, externalClientId, resumed } = await writeTx(async (tx) => {
    // Expired active/reserved leases may still hold provider capacity: mark them uncertain (counted until reconciled).
    await tx.execute({ sql: `UPDATE conversation_leases SET status = 'uncertain', status_reason = 'expired', updated_at = ? WHERE status IN ('reserved','active') AND expires_at < ?`, args: [now, now] });
    const mine = await tx.execute({ sql: `SELECT id, status FROM conversation_leases WHERE tenant_id = ? AND run_id = ? AND status IN ${OPEN}`, args: [ctx.tenantId, runId] });
    if (mine.rows[0]) throw new HttpError("CONVERSATION_ACTIVE", "Une conversation est déjà ouverte pour cette partie (autre onglet ?).", { leaseStatus: String(mine.rows[0].status) });
    const global = await tx.execute({ sql: `SELECT count(*) AS n FROM conversation_leases WHERE provider_scope = ? AND status IN ${OPEN}`, args: [PROVIDER_SCOPE] });
    if (Number(global.rows[0].n) >= e.NAPSTER_MAX_ACTIVE) throw new HttpError("CAPACITY_FULL", "Toutes les places de conversation sont occupées. Réessayez dans un instant ; en attendant, toutes les actions restent possibles à l’écran.", undefined, 15);
    const tenant = await tx.execute({ sql: `SELECT count(*) AS n FROM conversation_leases WHERE tenant_id = ? AND status IN ${OPEN}`, args: [ctx.tenantId] });
    if (Number(tenant.rows[0].n) >= ctx.tenantMaxSessions) throw new HttpError("CAPACITY_FULL", "Toutes les places de conversation de cet espace sont occupées.", undefined, 15);

    // Memory identity: generated once per (run, character, generation), then reused on resume.
    let binding = await tx.execute({ sql: `SELECT external_client_id FROM napster_bindings WHERE tenant_id = ? AND run_id = ? AND character_id = ? AND generation = 1`, args: [ctx.tenantId, runId, character] });
    const hadBinding = Boolean(binding.rows[0]);
    if (!hadBinding) {
      const ecid = memoryId(e.MEMORY_ID_SECRET, { env: e.APP_ENV, tenantId: ctx.tenantId, userId: ctx.userId, runId, character, generation: 1 });
      await tx.execute({ sql: `INSERT INTO napster_bindings (tenant_id, run_id, character_id, generation, external_client_id, agent_id, created_at) VALUES (?,?,?,?,?,?,?)`, args: [ctx.tenantId, runId, character, 1, ecid, agentId, now] });
      binding = await tx.execute({ sql: `SELECT external_client_id FROM napster_bindings WHERE tenant_id = ? AND run_id = ? AND character_id = ? AND generation = 1`, args: [ctx.tenantId, runId, character] });
    }
    const ecid = String(binding.rows[0].external_client_id);
    const s = await reserveRateSlot(tx, now);
    await tx.execute({
      sql: `INSERT INTO conversation_leases (id, tenant_id, run_id, user_id, provider_scope, character_id, external_client_id, locale, status, heartbeat_at, expires_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,'reserved',?,?,?,?)`,
      args: [leaseId, ctx.tenantId, runId, ctx.userId, PROVIDER_SCOPE, character, ecid, locale, now, now + RESERVE_TTL_MS, now, now],
    });
    return { slot: s, externalClientId: ecid, resumed: hadBinding };
  });

  // 2. Provider call, outside any transaction, at our reserved slot.
  if (slot > Date.now()) await sleep(slot - Date.now());
  const context = characterContext(run.state, character, null, locale);
  let conn: ConnectionResponse;
  const create = () =>
    napster<ConnectionResponse>(`/public/agents/${agentId}/connections`, {
      method: "POST",
      body: {
        channelType: "webrtc",
        externalClientId,
        externalClientProfile: connectionProfile(context, locale),
        initialSpeech: openingInstruction(character, opts.resumed ?? resumed, locale),
        tags: { app: "afterimage", env: e.APP_ENV, lease: leaseId },
      },
    });
  try {
    try {
      conn = await create();
    } catch (first) {
      // 429 = rejected, nothing was created: one retry after Retry-After, through a fresh rate slot.
      if (!(first instanceof NapsterError && first.status === 429)) throw first;
      await sleep(Math.max(1, first.retryAfter ?? 1) * 1000);
      const again = await writeTx((tx) => reserveRateSlot(tx, Date.now()));
      if (again > Date.now()) await sleep(again - Date.now());
      conn = await create();
    }
  } catch (err) {
    const uncertain = err instanceof NapsterUncertain;
    await sqlClient().execute({
      sql: `UPDATE conversation_leases SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?`,
      args: [uncertain ? "uncertain" : "failed", uncertain ? "create_no_response" : `create_${(err as NapsterError).status ?? "error"}`, Date.now(), leaseId],
    });
    log.warn("napster.connection.create_failed", { leaseId, error: err });
    if (err instanceof NapsterError && err.status === 409) throw new HttpError("CAPACITY_FULL", "Le fournisseur n’a plus de place de conversation. Réessayez bientôt.", undefined, 15);
    if (err instanceof NapsterError && err.status === 429) throw new HttpError("RATE_LIMITED", "Un instant…", undefined, err.retryAfter ?? 2);
    throw new HttpError("PROVIDER_UNAVAILABLE", "La conversation en direct est indisponible. Vous pouvez continuer au clavier.");
  }

  // 3. Bind the connection id to the lease BEFORE handing out the token.
  const activated = await sqlClient().execute({
    sql: `UPDATE conversation_leases SET connection_id = ?, status = 'active', heartbeat_at = ?, expires_at = ?, updated_at = ? WHERE id = ? AND status = 'reserved'`,
    args: [conn.connection.id, Date.now(), Date.now() + ACTIVE_TTL_MS, Date.now(), leaseId],
  });
  if (activated.rowsAffected !== 1) {
    // The lease was closed while we were creating the connection (tab closed, era switch, cancel):
    // close the provider session right away and never hand out its token.
    await sqlClient().execute({ sql: `UPDATE conversation_leases SET connection_id = ?, status = 'closing', status_reason = 'cancelled_during_open', updated_at = ? WHERE id = ?`, args: [conn.connection.id, Date.now(), leaseId] });
    await closeProviderConnection(leaseId, conn.connection.id);
    log.info("napster.connection.cancelled_during_open", { leaseId });
    throw new HttpError("LEASE_INVALID", "La conversation a été annulée.");
  }
  log.info("napster.connection.opened", { leaseId, character });
  return { token: conn.token, leaseId, character, revision: run.revision };
}

/** Close the caller's open conversation for this run. Idempotent. */
export async function closeConversation(ctx: TenantContext, runId: string): Promise<{ closed: boolean }> {
  // No getRun here: the run may already be a 'deleting' tombstone. Every statement below is
  // scoped by tenant + run + user, so a foreign run simply matches nothing.
  const r = await sqlClient().execute({
    sql: `UPDATE conversation_leases SET status = 'closing', updated_at = ? WHERE tenant_id = ? AND run_id = ? AND user_id = ? AND status IN ${OPEN} RETURNING id, connection_id`,
    args: [Date.now(), ctx.tenantId, runId, ctx.userId],
  });
  const lease = r.rows[0];
  if (!lease) return { closed: true };
  return { closed: await closeProviderConnection(String(lease.id), lease.connection_id ? String(lease.connection_id) : null) };
}

/** DELETE the provider connection (rate-limited) and settle the lease. Used by close and cleanup. */
export async function closeProviderConnection(leaseId: string, connectionId: string | null): Promise<boolean> {
  if (!connectionId) {
    // Never got a connection id: cannot close remotely; leave for reconciliation unless it was only reserved.
    await sqlClient().execute({ sql: `UPDATE conversation_leases SET status = CASE WHEN status_reason = 'create_no_response' THEN 'uncertain' ELSE 'closed' END, updated_at = ? WHERE id = ?`, args: [Date.now(), leaseId] });
    return true;
  }
  const slot = await writeTx((tx) => reserveRateSlot(tx, Date.now())).catch(() => null);
  if (slot === null) return false;
  if (slot > Date.now()) await sleep(slot - Date.now());
  try {
    await napster(`/public/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" });
  } catch (err) {
    // ConnectionNotFound = already closed on the provider side (idle timeout, tab closed...).
    if (!(err instanceof NapsterError && err.status === 400 && err.code === "ConnectionNotFound")) {
      log.warn("napster.connection.close_failed", { leaseId, error: err });
      return false;
    }
  }
  await sqlClient().execute({ sql: `UPDATE conversation_leases SET status = 'closed', updated_at = ? WHERE id = ?`, args: [Date.now(), leaseId] });
  return true;
}

export async function heartbeat(ctx: TenantContext, runId: string, leaseId: string): Promise<{ ok: boolean }> {
  const now = Date.now();
  const r = await sqlClient().execute({
    sql: `UPDATE conversation_leases SET heartbeat_at = ?, expires_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active' AND heartbeat_at < ?`,
    args: [now, now + ACTIVE_TTL_MS, now, leaseId, ctx.tenantId, runId, ctx.userId, now - 10_000],
  });
  if (r.rowsAffected === 1) return { ok: true };
  const still = await sqlClient().execute({ sql: `SELECT 1 FROM conversation_leases WHERE id = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active'`, args: [leaseId, ctx.tenantId, runId, ctx.userId] });
  if (!still.rows[0]) throw new HttpError("LEASE_INVALID", "Cette conversation n’est plus active.");
  return { ok: true }; // too frequent: accepted without extending
}
