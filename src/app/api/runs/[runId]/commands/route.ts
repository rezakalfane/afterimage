// UI commands (buttons, keyboard). Same validation and engine as tool proposals.
import { requireContext } from "@/server/dal/context";
import { env } from "@/server/env";
import { contextUpdateText } from "@/server/napster/context";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { rehearsalReaction } from "@/server/world/rehearsal";
import { commandBody, executeCommand } from "@/server/world/service";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const parsed = commandBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError("INVALID_ARGUMENT", "Commande invalide.");
  if (parsed.data.action === "choose_ending") throw new HttpError("INVALID_ARGUMENT", "La fin se confirme via /ending.");
  const result = await executeCommand(ctx, (await params).runId, parsed.data, { channel: "ui" });
  const live = env().CONVERSATION_MODE === "live";
  const extra =
    result.ok && result.changed && result.event
      ? live
        ? { contextText: contextUpdateText(result.characterContext) } // pushed by the browser to ITS OWN live character
        : { reaction: rehearsalReaction(result.event.type) }
      : {};
  // characterContext stays server-side; the client gets the public projection only.
  const { characterContext: _omit, ...publicResult } = result;
  void _omit;
  return json({ ...publicResult, ...extra }, { status: result.ok ? 200 : 422 });
});
