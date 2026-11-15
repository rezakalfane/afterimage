import { requireContext } from "@/server/dal/context";
import { removeMember } from "@/server/dal/admin";
import { handler, json } from "@/server/security/http";

export const dynamic = "force-dynamic";
export const DELETE = handler(async (req, { params }: { params: Promise<{ userId: string }> }) => {
  await removeMember(await requireContext(req), (await params).userId);
  return json({ ok: true });
});
