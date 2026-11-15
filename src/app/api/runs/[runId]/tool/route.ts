// Implicit Napster tool calls relayed by the player's browser. Treated as UNTRUSTED proposals:
// auth + ownership + active lease + closed tool list + strict args + engine prerequisites.
import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { sqlClient } from "@/server/db/client";
import { getRun } from "@/server/dal/runs";
import { toolToCommand } from "@/server/napster/tools";
import { contextUpdateText } from "@/server/napster/context";
import { executeCommand } from "@/server/world/service";
import { refusalText } from "@/server/world/texts";
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
  await getRun(ctx, runId); // foreign or unknown run → 404 before anything else
  // The character is the one of the caller's lease — never an argument from the request.
  const lease = await sqlClient().execute({
    sql: `SELECT character_id FROM conversation_leases WHERE id = ? AND tenant_id = ? AND run_id = ? AND user_id = ? AND status = 'active'`,
    args: [p.data.conversationLeaseId, ctx.tenantId, runId, ctx.userId],
  });
  const character = lease.rows[0]?.character_id as CharacterId | undefined;
  if (!character) throw new HttpError("LEASE_INVALID", "Cette conversation n’est plus active.");
  const mapped = toolToCommand(character, p.data.name, p.data.args);
  const command = mapped.ok ? mapped.command : { action: "__invalid_tool__", args: {} };
  const result = await executeCommand(
    ctx,
    runId,
    { commandId: `tool:${p.data.callId}`, action: command.action, args: command.args, conversationLeaseId: p.data.conversationLeaseId },
    { channel: "tool", toolCharacter: character },
  );
  // Output for the model: business result + this character's projection only.
  // A no-op is NOT a failure (e.g. a clue already noted): say so explicitly, or the model may
  // narrate a failure that never happened.
  const output = result.ok
    ? result.changed
      ? { ok: true, resultat: result.event?.summary, aide: result.hint, contexte: contextUpdateText(result.characterContext) }
      : {
          ok: true,
          resultat: "Déjà pris en compte : ce n’est pas un échec, rien n’a changé. Continue avec l’un des outils de availableTools si le joueur le demande.",
          contexte: contextUpdateText(result.characterContext),
        }
    : { ok: false, message: mapped.ok ? result.message : refusalText("", "INVALID_ARGUMENT", undefined) };
  return json({ ok: result.ok, output, revision: result.revision, publicState: result.publicState });
});
