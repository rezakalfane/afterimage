import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { handler, HttpError, json, readJson } from "@/server/security/http";
import { confirmEnding } from "@/server/world/ending";
import { requestLocale } from "@/server/security/locale";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };
const body = z.strictObject({ token: z.string().max(80), commandId: z.string().regex(/^[A-Za-z0-9_:.-]{8,80}$/) });

export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const p = body.safeParse(await readJson(req, 2048));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT");
  const r = await confirmEnding(ctx, (await params).runId, p.data.token, p.data.commandId, requestLocale(req));
  return json(r, { status: r.ok ? 200 : 422 });
});
