import { requireContext } from "@/server/dal/context";
import { createRun, listRuns } from "@/server/dal/runs";
import { handler, json } from "@/server/security/http";
import { playerView } from "@/server/world/projections";
import { requestLocale } from "@/server/security/locale";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const ctx = await requireContext(req);
  return json({ ok: true, runs: await listRuns(ctx) });
});

export const POST = handler(async (req) => {
  const ctx = await requireContext(req);
  const run = await createRun(ctx);
  return json({ ok: true, runId: run.id, revision: run.revision, publicState: playerView(run.state, requestLocale(req)) }, { status: 201 });
});
