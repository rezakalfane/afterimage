import "server-only";
// Final choice: UI-only, two steps.
//   1. intent: server checks prerequisites, returns a short-lived single-use token bound to
//      (tenant, run, user, ending, revision).
//   2. confirm: consumes the token atomically inside the SAME transaction as the engine mutation.
// No model tool can reach this path.
import type { TenantContext } from "@/server/dal/context";
import { getRun } from "@/server/dal/runs";
import { sqlClient } from "@/server/db/client";
import { HttpError } from "@/server/security/http";
import { randomToken, sha256 } from "@/server/security/ids";
import { ENDING_IDS, EPISODE, type EndingId } from "./content";
import { transition } from "./engine";
import { executeCommand } from "./service";

const TTL_MS = 2 * 60_000;

export async function createEndingIntent(ctx: TenantContext, runId: string, ending: string, expectedRevision: number) {
  if (!ENDING_IDS.includes(ending as EndingId)) throw new HttpError("INVALID_ARGUMENT");
  const run = await getRun(ctx, runId);
  if (run.revision !== expectedRevision) throw new HttpError("REVISION_CONFLICT", "La partie a changé entre-temps.");
  const probe = transition(run.state, { action: "choose_ending", args: { ending } }, { channel: "ending-confirmed" });
  if (!probe.ok) throw new HttpError("INVALID_ARGUMENT", "Lisez d’abord le message et la lettre retrouvés.");
  const token = randomToken(24);
  const now = Date.now();
  await sqlClient().execute({
    sql: `INSERT INTO ending_intents (token_hash, tenant_id, run_id, user_id, ending, revision, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    args: [sha256(token), ctx.tenantId, runId, ctx.userId, ending, run.revision, now + TTL_MS, now],
  });
  const e = EPISODE.endings.find((x) => x.id === ending)!;
  return { token, expiresInMs: TTL_MS, ending: { id: e.id, label: e.label, consequence: e.consequence, confirmation: e.confirmation } };
}

export async function confirmEnding(ctx: TenantContext, runId: string, token: string, commandId: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new HttpError("INVALID_ARGUMENT");
  let ending: string | null = null;
  return executeCommand(
    ctx,
    runId,
    { commandId, action: "choose_ending", args: { ending: "__from_token__" } },
    {
      channel: "ending-confirmed",
      inTx: async (tx, run) => {
        const now = Date.now();
        const r = await tx.execute({
          sql: `UPDATE ending_intents SET consumed_at = ? WHERE token_hash = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND consumed_at IS NULL AND expires_at > ? RETURNING ending, revision`,
          args: [now, sha256(token), ctx.tenantId, runId, ctx.userId, now],
        });
        const row = r.rows[0];
        if (!row) throw new HttpError("FORBIDDEN", "Confirmation expirée ou déjà utilisée. Recommencez le choix.");
        if (Number(row.revision) !== run.revision) throw new HttpError("REVISION_CONFLICT", "La partie a changé depuis votre choix.");
        ending = String(row.ending);
      },
      resolveArgs: () => ({ ending }),
    },
  );
}
