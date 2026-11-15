// The player's own turn in a live conversation (final transcript or typed line). Only indicators
// computed here are stored (see src/server/world/turns.ts) — never the text.
import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { assertPlayable, getRun } from "@/server/dal/runs";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { recordTurn } from "@/server/world/turns";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };

const body = z.strictObject({
  leaseId: z.string().max(80),
  itemId: z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/),
  text: z.string().min(1).max(1000),
});

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const { runId } = await params;
  const p = body.safeParse(await readJson(req));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT");
  assertPlayable(await getRun(ctx, runId));
  const ok = await recordTurn(ctx, runId, p.data.leaseId, p.data.itemId, p.data.text);
  if (!ok) throw new HttpError("LEASE_INVALID", "Cette conversation n’est plus active.");
  return json({ ok: true });
});
