import "server-only";
// Command service: the ONLY path that mutates a run.
// One short write transaction: idempotency receipt lookup → lease/revision checks → pure engine →
// CAS update of snapshot + event + receipt (+ outbox job). No network call inside.
import type { Transaction } from "@libsql/client";
import { z } from "zod";
import { writeTx } from "@/server/db/client";
import { getRun, RUN_TTL } from "@/server/dal/runs";
import type { TenantContext } from "@/server/dal/context";
import { HttpError } from "@/server/security/http";
import { sha256 } from "@/server/security/ids";
import { characterForEra, type CharacterId } from "./content";
import { transition, type Action, type Command, type Channel, type WorldState } from "./engine";
import { characterContext, hintText, playerView, type CharacterContext, type PlayerView } from "./projections";
import { refusalText, texts, type Locale } from "./texts";

export const commandBody = z.strictObject({
  commandId: z.string().regex(/^[A-Za-z0-9_:.-]{8,80}$/),
  expectedRevision: z.number().int().min(0).optional(),
  action: z.string().max(40),
  args: z.record(z.string(), z.unknown()).optional(),
  conversationLeaseId: z.string().max(80).optional(),
});
export type CommandBody = z.infer<typeof commandBody>;

export type CommandResult =
  | {
      ok: true;
      changed: boolean;
      revision: number;
      event: { type: Action; summary: string } | null;
      hint: string | null;
      publicState: PlayerView;
      /** Projection for the active character, to update the live conversation. */
      characterContext: CharacterContext;
    }
  | { ok: false; code: string; message: string; revision: number; publicState: PlayerView; characterContext: CharacterContext };

interface ExecOptions {
  channel: Channel;
  /** Required for channel "tool": the character of the caller's active lease. */
  toolCharacter?: CharacterId;
  /** Extra checks inside the same transaction (e.g. consume an ending confirmation). */
  inTx?: (tx: Transaction, run: { state: WorldState; revision: number }) => Promise<void>;
  /** Arguments resolved inside the transaction (after inTx), e.g. the ending bound to a token. */
  resolveArgs?: () => Record<string, unknown>;
  /** Language of the returned texts and projections (the run state itself is language-free). */
  locale?: Locale;
}

function projectFor(state: WorldState, lastAction: { action: Action; summary: string } | null, locale: Locale = "fr") {
  return { publicState: playerView(state, locale), characterContext: characterContext(state, characterForEra(state.activeEra), lastAction, locale) };
}

export async function executeCommand(ctx: TenantContext, runId: string, body: CommandBody, opts: ExecOptions): Promise<CommandResult> {
  let command: Command = { action: body.action, args: body.args ?? {} };
  const L: Locale = opts.locale ?? "fr";
  const requestHash = sha256(JSON.stringify({ a: body.action, r: body.args ?? {}, e: body.expectedRevision ?? null, c: opts.channel, l: body.conversationLeaseId ?? null }));
  const now = Date.now();

  return writeTx(async (tx) => {
    // 1. Ownership (tenant + id + owner), inside the transaction.
    const run = await getRun(ctx, runId, tx);

    // 2. Idempotency: same commandId → replay the recorded result (even if the revision moved on).
    const prior = await tx.execute({ sql: `SELECT request_hash, result_json FROM command_receipts WHERE tenant_id = ? AND run_id = ? AND command_id = ?`, args: [ctx.tenantId, runId, body.commandId] });
    if (prior.rows[0]) {
      if (String(prior.rows[0].request_hash) !== requestHash) throw new HttpError("IDEMPOTENCY_MISMATCH", "Cette commande a déjà été utilisée avec d’autres paramètres.");
      return JSON.parse(String(prior.rows[0].result_json)) as CommandResult;
    }

    if (run.status !== "active") throw new HttpError("RUN_FINISHED", texts(L).refusals.default.RUN_FINISHED, projectFor(run.state, null, L));

    // 3. Tool proposals must come from the caller's own active conversation, for the current era's character.
    if (opts.channel === "tool") {
      const lease = await tx.execute({
        sql: `SELECT character_id FROM conversation_leases WHERE id = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active' AND expires_at > ?`,
        args: [body.conversationLeaseId ?? "", ctx.tenantId, runId, ctx.userId, now],
      });
      const leaseCharacter = lease.rows[0]?.character_id;
      if (!leaseCharacter || leaseCharacter !== opts.toolCharacter) throw new HttpError("LEASE_INVALID", "Cette conversation n’est plus active.");
    }

    // 4. Optimistic revision (UI commands must state what they saw; tool proposals are evaluated on the current state).
    if (body.expectedRevision !== undefined && body.expectedRevision !== run.revision) {
      throw new HttpError("REVISION_CONFLICT", L === "en" ? "The game changed in the meantime." : "La partie a changé entre-temps.", { revision: run.revision, ...projectFor(run.state, null, L) });
    }
    // ending-confirmed: the single-use token already binds the revision (checked in inTx).
    if (opts.channel === "ui" && body.expectedRevision === undefined) throw new HttpError("INVALID_ARGUMENT", "expectedRevision manquant.");

    // Era switch only once the live conversation of the previous era is closed (server-enforced).
    if (body.action === "switch_era") {
      const open = await tx.execute({ sql: `SELECT 1 FROM conversation_leases WHERE tenant_id = ? AND run_id = ? AND status IN ('reserved','active','closing')`, args: [ctx.tenantId, runId] });
      if (open.rows[0]) throw new HttpError("CONVERSATION_ACTIVE", "Terminez d’abord la conversation en cours.");
    }

    if (opts.inTx) await opts.inTx(tx, { state: run.state, revision: run.revision });
    if (opts.resolveArgs) command = { action: body.action, args: opts.resolveArgs() };

    // 5. Pure engine.
    const r = transition(run.state, command, { channel: opts.channel, character: opts.toolCharacter });
    let result: CommandResult;
    if (!r.ok) {
      result = { ok: false, code: r.code, message: refusalText(body.action, r.code, r.detail, L), revision: run.revision, ...projectFor(run.state, null, L) };
    } else if (!r.changed) {
      result = { ok: true, changed: false, revision: run.revision, event: null, hint: null, ...projectFor(run.state, null, L) };
    } else {
      const summary = texts(L).events[r.event.type] ?? r.event.type;
      const next = r.state;
      const status = next.ending ? "finished" : "active";
      // 6. Compare-and-swap on the revision.
      const upd = await tx.execute({
        sql: `UPDATE runs SET state_json = ?, revision = ?, status = ?, updated_at = ?, expires_at = ? WHERE tenant_id = ? AND id = ? AND owner_user_id = ? AND revision = ?`,
        args: [JSON.stringify(next), next.revision, status, now, now + (ctx.isGuest ? RUN_TTL.guest : RUN_TTL.account), ctx.tenantId, runId, ctx.userId, run.revision],
      });
      if (upd.rowsAffected !== 1) throw new HttpError("REVISION_CONFLICT", "La partie a changé entre-temps.");
      await tx.execute({
        sql: `INSERT INTO run_events (tenant_id, run_id, revision, type, payload_json, actor_user_id, channel, created_at) VALUES (?,?,?,?,?,?,?,?)`,
        // Minimal business payload; the personal message itself stays in the snapshot only.
        args: [ctx.tenantId, runId, next.revision, r.event.type, JSON.stringify({ hint: r.event.hint ?? null, era: next.activeEra }), ctx.userId, opts.channel, now],
      });
      const character = characterForEra(next.activeEra);
      await tx.execute({
        sql: `INSERT INTO character_memories (tenant_id, run_id, character_id, generation, observed_revision, facts_json, summary, updated_at) VALUES (?,?,?,1,?,?,'',?)
              ON CONFLICT(tenant_id, run_id, character_id) DO UPDATE SET observed_revision = excluded.observed_revision, facts_json = excluded.facts_json, updated_at = excluded.updated_at`,
        args: [ctx.tenantId, runId, character, next.revision, JSON.stringify(characterContext(next, character, null).knownFacts), now],
      });
      result = {
        ok: true,
        changed: true,
        revision: next.revision,
        event: { type: r.event.type, summary },
        hint: r.event.type === "request_hint" ? hintText(next, L) : null,
        ...projectFor(next, { action: r.event.type, summary }, L),
      };
    }
    // 7. Receipt (successes AND refusals are replayed identically).
    await tx.execute({
      sql: `INSERT INTO command_receipts (tenant_id, run_id, command_id, actor_user_id, request_hash, result_json, created_at) VALUES (?,?,?,?,?,?,?)`,
      args: [ctx.tenantId, runId, body.commandId, ctx.userId, requestHash, JSON.stringify(result), now],
    });
    return result;
  });
}
