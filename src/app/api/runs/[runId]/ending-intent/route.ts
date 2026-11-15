import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { createEndingIntent } from "@/server/world/ending";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };
const body = z.strictObject({ ending: z.string().max(40), expectedRevision: z.number().int().min(0) });

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const p = body.safeParse(await readJson(req, 2048));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT");
  return json({ ok: true, ...(await createEndingIntent(ctx, (await params).runId, p.data.ending, p.data.expectedRevision)) });
});
