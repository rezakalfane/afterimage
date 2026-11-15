// UI commands (buttons, keyboard). Same validation and engine as tool proposals.
import { requireContext } from "@/server/dal/context";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { commandBody, executeCommand } from "@/server/world/service";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const parsed = commandBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError("INVALID_ARGUMENT", "Commande invalide.");
  if (parsed.data.action === "choose_ending") throw new HttpError("INVALID_ARGUMENT", "La fin se confirme via /ending.");
  const result = await executeCommand(ctx, (await params).runId, parsed.data, { channel: "ui" });
  return json(result, { status: result.ok ? 200 : 422 });
});
