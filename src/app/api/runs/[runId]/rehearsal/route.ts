// Rehearsal conversation: deterministic, no network, never mutates (suggestions only).
import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { assertPlayable, getRun } from "@/server/dal/runs";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { rehearsalReply } from "@/server/world/rehearsal";
import { requestLocale } from "@/server/security/locale";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };
const body = z.strictObject({ text: z.string().max(500).nullable() });

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const p = body.safeParse(await readJson(req, 4096));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT");
  const run = await getRun(ctx, (await params).runId);
  assertPlayable(run);
  return json({ ok: true, rehearsal: true, ...rehearsalReply(run.state, p.data.text, requestLocale(req)) });
});
