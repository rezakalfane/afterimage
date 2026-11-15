// Implicit Napster tool calls relayed by the player's browser. Treated as UNTRUSTED proposals:
// auth + ownership + active lease + closed tool list + strict args + engine prerequisites.
import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { sqlClient } from "@/server/db/client";
import { assertPlayable, getRun } from "@/server/dal/runs";
import { rejectedToolLog, toolsForActions, toolToCommand } from "@/server/napster/tools";
import { contextUpdateText } from "@/server/napster/context";
import { executeCommand } from "@/server/world/service";
import { texts, type Locale } from "@/server/world/texts";
import { log } from "@/server/security/log";
import { backingFor, isBacked } from "@/server/world/turns";
import { playerView } from "@/server/world/projections";
import type { CharacterId } from "@/server/world/content";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };

const body = z.strictObject({
  callId: z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/),
  name: z.string().max(60),
  args: z.unknown(),
  conversationLeaseId: z.string().max(80),
});

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const { runId } = await params;
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT");
  assertPlayable(await getRun(ctx, runId)); // foreign/unknown → 404; older chapter version → retired
  // The character is the one of the caller's lease — never an argument from the request.
  const lease = await sqlClient().execute({
    sql: `SELECT character_id, locale FROM conversation_leases WHERE id = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active'`,
    args: [p.data.conversationLeaseId, ctx.tenantId, runId, ctx.userId],
  });
  const character = lease.rows[0]?.character_id as CharacterId | undefined;
  const locale = (lease.rows[0]?.locale === "en" ? "en" : "fr") as Locale;
  if (!character) throw new HttpError("LEASE_INVALID", "Cette conversation n’est plus active.");
  const mapped = toolToCommand(character, p.data.name, p.data.args);

  const command = mapped.ok ? mapped.command : { action: "__invalid_tool__", args: {} };
  // A share recorded "from the player" must be backed by the player's own recent turn in this
  // session: an autonomous model call cannot create that proof.
  const backing = mapped.ok ? backingFor(command.action, command.args) : null;
  if (backing && !(await isBacked(ctx, runId, p.data.conversationLeaseId, backing))) {
    const run = await getRun(ctx, runId);
    log.info("napster.tool.rejected", rejectedToolLog({ character, name: p.data.name, callId: p.data.callId, revision: run.revision, code: "UNBACKED" }));
    return json({ ok: false, output: { ok: false, message: texts(locale).tool.unbacked }, revision: run.revision, publicState: playerView(run.state, locale), focus: null });
  }
  const result = await executeCommand(
    ctx,
    runId,
    { commandId: `tool:${p.data.callId}`, action: command.action, args: command.args, conversationLeaseId: p.data.conversationLeaseId },
    { channel: "tool", toolCharacter: character, locale },
  );
  // Output for the model: business result + this character's projection only.
  // A no-op is NOT a failure (e.g. a clue already noted): say so explicitly, or the model may
  // narrate a failure that never happened.
  // The next usable tools are stated explicitly (models skim long JSON contexts).
  if (!result.ok) log.info("napster.tool.rejected", rejectedToolLog({ character, name: p.data.name, callId: p.data.callId, revision: result.revision, code: mapped.ok ? (result.code ?? "REFUSED") : "INVALID_TOOL" }));
  const next = toolsForActions(character, result.characterContext.availableActions, locale);
  const looked = command.action === "look_at";
  const output = result.ok
    ? looked
      ? { ok: true, resultat: texts(locale).tool.shown, outilsMaintenant: next, contexte: contextUpdateText(result.characterContext, locale) }
      : result.changed
      ? { ok: true, resultat: result.event?.summary, aide: result.hint, outilsMaintenant: next, contexte: contextUpdateText(result.characterContext, locale) }
      : {
          ok: true,
          resultat: texts(locale).tool.noop.replace("{next}", next.join(" ; ") || "—"),
          outilsMaintenant: next,
          contexte: contextUpdateText(result.characterContext, locale),
        }
    : { ok: false, message: mapped.ok ? result.message : texts(locale).tool.invalid };
  // What the call was about, for the player's screen only (opens that object's window).
  const focus = mapped.ok ? { action: command.action, target: typeof command.args?.target === "string" ? command.args.target : null } : null;
  return json({ ok: result.ok, output, revision: result.revision, publicState: result.publicState, focus });
});
