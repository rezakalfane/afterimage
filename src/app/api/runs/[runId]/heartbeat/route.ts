import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { heartbeat } from "@/server/napster/conversation";
import { handler, HttpError, json, readJson } from "@/server/security/http";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };
const body = z.strictObject({ leaseId: z.string().max(80) });

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const p = body.safeParse(await readJson(req, 1024));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT");
  return json(await heartbeat(ctx, (await params).runId, p.data.leaseId));
});
