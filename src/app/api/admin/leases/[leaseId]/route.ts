import { requireContext } from "@/server/dal/context";
import { forceCloseLease } from "@/server/dal/admin";
import { handler, json } from "@/server/security/http";

export const dynamic = "force-dynamic";
export const DELETE = handler(async (req, { params }: { params: Promise<{ leaseId: string }> }) => {
  const closed = await forceCloseLease(await requireContext(req), (await params).leaseId);
  return json({ ok: closed }, { status: closed ? 200 : 202 });
});
