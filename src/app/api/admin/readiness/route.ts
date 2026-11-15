// Owner/admin only: sanitized readiness (DB reachable, schema, mode, bonuses). No values of secrets.
import { requireContext, requireRole } from "@/server/dal/context";
import { schemaVersion } from "@/server/dal/admin";
import { sqlClient } from "@/server/db/client";
import { env } from "@/server/env";
import { handler, json } from "@/server/security/http";

export const dynamic = "force-dynamic";
export const GET = handler(async (req) => {
  const ctx = await requireContext(req);
  requireRole(ctx, ["owner", "admin"]);
  const t0 = Date.now();
  await sqlClient().execute("SELECT 1");
  const e = env();
  return json({
    ok: true,
    db: { ok: true, latencyMs: Date.now() - t0, remote: !e.DATABASE_URL.startsWith("file:"), schema: await schemaVersion() },
    mode: e.CONVERSATION_MODE,
    napster: { keyConfigured: Boolean(e.NAPSTER_API_KEY), agentsConfigured: Boolean(e.NAPSTER_JEANNE_AGENT_ID && e.NAPSTER_MALIK_AGENT_ID), maxActive: e.NAPSTER_MAX_ACTIVE },
    bonuses: { recordings: e.NAPSTER_RECORDINGS_ENABLED, phone: e.NAPSTER_PHONE_ENABLED },
    release: { env: e.APP_ENV, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "local" },
  });
});
