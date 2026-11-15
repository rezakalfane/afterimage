import { requireContext } from "@/server/dal/context";
import { closeConversation, openConversation } from "@/server/napster/conversation";
import { handler, json } from "@/server/security/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
type P = { params: Promise<{ runId: string }> };

/** Reserve capacity and open a live conversation with the character of the run's current era. */
export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const opened = await openConversation(ctx, (await params).runId);
  // The token is returned once, in the body only (never in a URL, log or cache).
  return json({ ok: true, token: opened.token, leaseId: opened.leaseId, character: opened.character, revision: opened.revision });
});

/** Close the caller's conversation for this run. Idempotent. */
export const DELETE = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const r = await closeConversation(ctx, (await params).runId);
  return json({ ok: r.closed }, { status: r.closed ? 200 : 202 });
});
