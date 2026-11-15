import { requireContext } from "@/server/dal/context";
import { getRun, markRunDeleting, purgeRun } from "@/server/dal/runs";
import { env } from "@/server/env";
import { requestLocale } from "@/server/security/locale";
import { closeConversation } from "@/server/napster/conversation";
import { handler, json } from "@/server/security/http";
import { playerView } from "@/server/world/projections";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ runId: string }> };

export const GET = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const run = await getRun(ctx, (await params).runId);
  return json({ ok: true, runId: run.id, status: run.status, revision: run.revision, publicState: playerView(run.state, requestLocale(req)), mode: env().CONVERSATION_MODE });
});

/** "Supprimer ma partie": close provider sessions first, then purge our data. */
export const DELETE = handler(async (req, { params }: P) => {
  const ctx = await requireContext(req);
  const { runId } = await params;
  await markRunDeleting(ctx, runId);
  const { closed } = await closeConversation(ctx, runId);
  if (!closed) return json({ ok: false, code: "PROVIDER_UNAVAILABLE", message: "Suppression en attente de la fermeture de la conversation ; réessayez." }, { status: 202 });
  await purgeRun(ctx, runId);
  return json({ ok: true });
});
