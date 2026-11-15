import { z } from "zod";
import { requireContext } from "@/server/dal/context";
import { invite } from "@/server/dal/admin";
import { handler, HttpError, json, readJson } from "@/server/security/http";

export const dynamic = "force-dynamic";
const body = z.strictObject({ email: z.email().max(200), role: z.enum(["admin", "player"]) });
export const POST = handler(async (req) => {
  const ctx = await requireContext(req);
  const p = body.safeParse(await readJson(req, 2048));
  if (!p.success) throw new HttpError("INVALID_ARGUMENT", "Email ou rôle invalide.");
  // The link is shown ONCE to the inviter; only its hash is stored.
  return json({ ok: true, link: await invite(ctx, p.data.email, p.data.role) }, { status: 201 });
});
