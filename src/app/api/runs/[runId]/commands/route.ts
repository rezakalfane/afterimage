// UI commands (buttons, keyboard). Same validation and engine as tool proposals.
import { requireContext } from "@/server/dal/context";
import { env } from "@/server/env";
import { requestLocale } from "@/server/security/locale";
import { contextUpdateText } from "@/server/napster/context";
import { closeConversation } from "@/server/napster/conversation";
import { sqlClient } from "@/server/db/client";
import type { Locale } from "@/server/world/texts";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { rehearsalReaction } from "@/server/world/rehearsal";
import { commandBody, executeCommand } from "@/server/world/service";

export const dynamic = "force-dynamic";

/** Locale of the caller's open conversation for this run (scoped), else French. */
async function liveLocale(ctx: { tenantId: string; userId: string }, runId: string): Promise<Locale> {
  const r = await sqlClient().execute({ sql: `SELECT locale FROM conversation_leases WHERE tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active'`, args: [ctx.tenantId, runId, ctx.userId] });
  return r.rows[0]?.locale === "en" ? "en" : "fr";
}
type P = { params: Promise<{ runId: string }> };

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const parsed = commandBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError("INVALID_ARGUMENT", "Commande invalide.");
  if (parsed.data.action === "choose_ending") throw new HttpError("INVALID_ARGUMENT", "La fin se confirme via /ending.");
  // Switching era ends the caller's conversation of the previous era (even one left behind by a
  // reload). Done before the transaction: closing calls Napster.
  if (parsed.data.action === "switch_era") await closeConversation(ctx, (await params).runId);
  const result = await executeCommand(ctx, (await params).runId, parsed.data, { channel: "ui", locale: requestLocale(req) });
  const live = env().CONVERSATION_MODE === "live";
  const extra =
    result.ok && result.changed && result.event
      ? live
        ? { contextText: contextUpdateText(result.characterContext, await liveLocale(ctx, (await params).runId)) } // pushed by the browser to ITS OWN live character
        : { reaction: rehearsalReaction(result.event.type, requestLocale(req)) }
      : {};
  // characterContext stays server-side; the client gets the public projection only.
  const { characterContext: _omit, ...publicResult } = result;
  void _omit;
  return json({ ...publicResult, ...extra }, { status: result.ok ? 200 : 422 });
});
