import { requireContext } from "@/server/dal/context";
import { closeConversation, openConversation } from "@/server/napster/conversation";
import { reconcileLeases } from "@/server/jobs/maintenance";
import { handler, HttpError, json } from "@/server/security/http";
import { LOCALE_COOKIE, pickLocale } from "@/i18n/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
type P = { params: Promise<{ runId: string }> };

/** Reserve capacity and open a live conversation with the character of the run's current era. */
export const POST = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const { runId } = await params;
  // Only an ACTIVE locale (fr today) can be requested; anything else falls back to French.
  const locale = pickLocale(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([a-z]{2})`).exec(req.headers.get("cookie") ?? "")?.[1]);
  let opened;
  try {
    opened = await openConversation(ctx, runId, { locale });
  } catch (e) {
    // Capacity may be held by expired/uncertain leases: reconcile them (bounded), then retry once.
    if (!(e instanceof HttpError && e.code === "CAPACITY_FULL")) throw e;
    const r = await reconcileLeases();
    if (r.closed === 0) throw e;
    opened = await openConversation(ctx, runId, { locale });
  }
  // The token is returned once, in the body only (never in a URL, log or cache).
  return json({ ok: true, token: opened.token, leaseId: opened.leaseId, character: opened.character, revision: opened.revision });
});

/** Close the caller's conversation for this run. Idempotent. */
export const DELETE = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const r = await closeConversation(ctx, (await params).runId);
  return json({ ok: r.closed }, { status: r.closed ? 200 : 202 });
});
